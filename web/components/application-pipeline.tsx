"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Job } from "@/lib/policy";
import {
  applicationDetail,
  interviewApplication,
  moveApplicationBack,
  listApplications,
  screenApplication,
  searchApplications,
  type Application,
  type ApplicationDetail,
} from "@/lib/applications";
import { ApiError } from "@/lib/supabase";
import { listOfferBoard, type OfferBoardItem } from "@/lib/offers";
import ManualCandidateForm from "./manual-candidate-form";

const PAGE_SIZE = 25;
const PIPELINE_STAGES = ["NEW", "SCREEN", "INTERVIEW", "HIRED", "REJECTED"] as const;
const NEXT_STAGE: Record<string, "SCREEN" | "INTERVIEW" | undefined> = { NEW: "SCREEN", SCREEN: "INTERVIEW" };
const PREVIOUS_STAGE: Record<string, "NEW" | "SCREEN" | undefined> = { SCREEN: "NEW", INTERVIEW: "SCREEN" };
const STAGE_LABEL: Record<string, string> = {
  NEW: "Mới ứng tuyển",
  SCREEN: "Sơ loại",
  INTERVIEW: "Phỏng vấn",
  OFFER: "Offer",
  HIRED: "Đã tuyển",
  REJECTED: "Từ chối",
};
// Interim round limits from the supplied UI reference. These are presentation
// targets; the TA-SLA Master file defines requisition-level targets separately.
const ROUND_SLA_DAYS: Record<string, number> = {
  NEW: 2,
  SCREEN: 3,
  INTERVIEW: 4,
  OFFER: 0,
  HIRED: 0,
  REJECTED: 0,
};
type TransitionStage = "NEW" | "SCREEN" | "INTERVIEW";
type State = "loading" | "ready" | "empty" | "forbidden" | "error";

function message(error: unknown) {
  return error instanceof Error ? error.message : "Không tải được dữ liệu. Vui lòng thử lại.";
}

export default function ApplicationPipeline({ job, onSessionLost, canViewOffers = false, canManageApplications = false }: { job: Job; onSessionLost: () => void; canViewOffers?: boolean; canManageApplications?: boolean }) {
  const [items, setItems] = useState<Application[]>([]);
  const [offerItems, setOfferItems] = useState<OfferBoardItem[]>([]);
  const [offerError, setOfferError] = useState("");
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Application | null>(null);
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [transitionRequestId, setTransitionRequestId] = useState<string | null>(null);
  const [transitionRequestTarget, setTransitionRequestTarget] = useState<TransitionStage | null>(null);
  const [failedTransition, setFailedTransition] = useState<{ application: Application; targetStage: TransitionStage; message: string } | null>(null);
  const [transitionBusy, setTransitionBusy] = useState(false);
  const [dragging, setDragging] = useState<Application | null>(null);
  const transitionRequestIds = useRef(new Map<string, string>());
  const listTicket = useRef(0);
  const detailTicket = useRef(0);
  const selectedId = useRef<string | null>(null);

  const load = useCallback(async (nextOffset = offset, nextQuery = query) => {
    const ticket = ++listTicket.current;
    setState("loading");
    setError("");
    try {
      const [result, offerResult] = await Promise.all([
        nextQuery.trim()
          ? searchApplications(job.id, nextQuery.trim(), PAGE_SIZE, nextOffset)
          : listApplications(job.id, PAGE_SIZE, nextOffset),
        canViewOffers
          ? listOfferBoard(job.id).catch((cause): Error => cause instanceof Error ? cause : new Error("Không tải được dữ liệu Offer."))
          : Promise.resolve({ applications: [] as OfferBoardItem[] }),
      ]);
      if (ticket !== listTicket.current) return;
      setItems(result.applications);
      if (offerResult instanceof Error) {
        setOfferItems([]);
        setOfferError(message(offerResult));
        if (offerResult instanceof ApiError && offerResult.status === 401) onSessionLost();
      } else {
        setOfferItems(offerResult.applications);
        setOfferError("");
      }
      const offerCount = offerResult instanceof Error ? 0 : offerResult.applications.length;
      setState(result.applications.length || offerCount ? "ready" : "empty");
    } catch (cause) {
      if (ticket !== listTicket.current) return;
      const apiError = cause instanceof ApiError ? cause : undefined;
      setItems([]);
      setOfferItems([]);
      setOfferError("");
      if (apiError?.status === 401) onSessionLost();
      if (apiError?.status === 403) setState("forbidden");
      else setState("error");
      setError(message(cause));
    }
  }, [job.id, offset, query, onSessionLost, canViewOffers]);

  useEffect(() => {
    // The search effect below performs the first load too, avoiding two initial requests.
    return () => { listTicket.current += 1; detailTicket.current += 1; };
    // A job switch must immediately discard the prior scope, before a new request resolves.
  }, [job.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Changing the search scope invalidates the selected record and any in-flight detail read.
    // This prevents a previous Application from looking like a match for the new query.
    detailTicket.current += 1;
    selectedId.current = null;
    setSelected(null);
    setDetail(null);
    setDetailError("");
    setDetailLoading(false);
    setTransitionRequestId(null);
    setTransitionRequestTarget(null);
    const timer = window.setTimeout(() => {
      setOffset(0);
      void load(0, query);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const stages = useMemo(() => {
    const grouped = items.reduce<Record<string, Application[]>>((all, application) => {
      (all[application.stage] ??= []).push(application);
      return all;
    }, {});
    // These are the persisted Application stages in the backend; unknown future stages remain visible.
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const visibleOffers = offerItems.filter((offer) => !normalizedQuery || offer.application.candidate_name.toLocaleLowerCase().includes(normalizedQuery));
    const offeredApplicationIds = new Set(visibleOffers.map((offer) => offer.application_id));
    const stages = ["NEW", "SCREEN", "INTERVIEW", ...(canViewOffers ? ["OFFER"] : []), "HIRED", "REJECTED", ...Object.keys(grouped).filter((stage) => !PIPELINE_STAGES.includes(stage as typeof PIPELINE_STAGES[number]))];
    return stages.map((stage) => [stage, stage === "OFFER" ? visibleOffers.map((offer) => offer.application) : (grouped[stage] ?? []).filter((application) => !offeredApplicationIds.has(application.application_id))] as [string, Application[]]);
  }, [items, offerItems, canViewOffers, query]);

  const openDetail = useCallback(async (application: Application) => {
    const ticket = ++detailTicket.current;
    setSelected(application);
    selectedId.current = application.application_id;
    setDetail(null);
    setDetailError("");
    setTransitionRequestId(null);
    setTransitionRequestTarget(null);
    setDetailLoading(true);
    try {
      const result = await applicationDetail(job.id, application.application_id);
      if (ticket !== detailTicket.current) return;
      setDetail(result);
      // Detail is the authoritative post-action state; the screen RPC returns only ID + changed.
      setSelected(result.application);
    } catch (cause) {
      if (ticket !== detailTicket.current) return;
      const apiError = cause instanceof ApiError ? cause : undefined;
      if (apiError?.status === 401) onSessionLost();
      if (apiError?.status === 403) {
        transitionRequestIds.current.clear();
        setTransitionRequestId(null);
        setTransitionRequestTarget(null);
        setFailedTransition(null);
        setDragging(null);
        setItems([]);
        setDetail(null);
        setSelected(null);
        selectedId.current = null;
        setState("forbidden");
      }
      setDetailError(message(cause));
    } finally {
      if (ticket === detailTicket.current) setDetailLoading(false);
    }
  }, [job.id, onSessionLost]);

  async function moveApplication(application: Application, targetStage: TransitionStage) {
    if (!canManageApplications) return;
    const isForward = NEXT_STAGE[application.stage] === targetStage;
    const isBackward = PREVIOUS_STAGE[application.stage] === targetStage;
    if (transitionBusy || (!isForward && !isBackward) || application.status !== "ACTIVE") return;
    const requestKey = `${application.application_id}:${targetStage}`;
    const existingRequestId = transitionRequestIds.current.get(requestKey);
    const requestId = existingRequestId ?? crypto.randomUUID();
    if (!existingRequestId && !window.confirm(`Chuyển ${application.candidate_name} ${isBackward ? "về" : "sang"} ${targetStage}?`)) return;
    transitionRequestIds.current.set(requestKey, requestId);
    if (selectedId.current === application.application_id) {
      setTransitionRequestId(requestId);
      setTransitionRequestTarget(targetStage);
    }
    setTransitionBusy(true);
    setFailedTransition(null);
    try {
      if (isBackward) await moveApplicationBack(application.application_id, targetStage as "NEW" | "SCREEN", requestId);
      else if (targetStage === "SCREEN") await screenApplication(application.application_id, requestId);
      else await interviewApplication(application.application_id, requestId);
      transitionRequestIds.current.delete(requestKey);
      if (selectedId.current === application.application_id) {
        setTransitionRequestId(null);
        setTransitionRequestTarget(null);
        await openDetail(application);
      }
      await load(offset, query);
    } catch (cause) {
      const apiError = cause instanceof ApiError ? cause : undefined;
      if (apiError?.status === 401 || apiError?.status === 403) {
        transitionRequestIds.current.clear();
        setTransitionRequestId(null);
        setTransitionRequestTarget(null);
        setFailedTransition(null);
        setItems([]);
        setDetail(null);
        setDetailError("");
        setSelected(null);
        selectedId.current = null;
        setDragging(null);
        if (apiError.status === 401) {
          setState("error");
          setError(message(cause));
          onSessionLost();
        } else {
          setState("forbidden");
        }
        return;
      }
      setFailedTransition({ application, targetStage, message: message(cause) });
      if (selectedId.current === application.application_id) {
        setTransitionRequestId(requestId);
        setTransitionRequestTarget(targetStage);
      }
    } finally {
      setTransitionBusy(false);
    }
  }

  useEffect(() => {
    if (!selected) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") { detailTicket.current += 1; selectedId.current = null; setSelected(null); }
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [selected]);

  const nextStage = selected ? NEXT_STAGE[selected.stage] : undefined;
  const previousStage = selected ? PREVIOUS_STAGE[selected.stage] : undefined;
  const eligible = Boolean((nextStage || previousStage) && selected?.status === "ACTIVE");
  const disabledReason = !canManageApplications ? "Bạn chỉ có quyền xem Pipeline của Job này." : !selected ? "Chọn một ứng viên để thao tác." : !eligible
    ? "Chỉ hồ sơ đang xử lý ở NEW, SCREEN hoặc INTERVIEW mới có thể chuyển vòng." : "";

  const refreshAfterCandidateCreated = useCallback(async () => {
    setQuery("");
    setOffset(0);
    await load(0, "");
  }, [load]);

  return <section className="panel pipeline" aria-label={`Pipeline ${job.title}`}>
    <div className="pipeline-heading">
      <div><span className="eyebrow">HIRING PIPELINE</span><h2>Pipeline tuyển dụng</h2><p>{job.job_code || "Job chưa có mã"} <span aria-hidden="true">·</span> {job.title}</p></div>
      <span className={`badge ${job.status === "OPEN" ? "green" : "amber-badge"}`}><span className="status-dot" />{job.status === "OPEN" ? "Đang tuyển" : job.status === "DRAFT" ? "Bản nháp" : job.status}</span>
    </div>
    <div className="pipeline-toolbar">
      {canManageApplications && (state === "ready" || state === "empty" || state === "error") && <details className="add-candidate-disclosure"><summary><span aria-hidden="true">＋</span> Thêm ứng viên vào Job</summary><ManualCandidateForm job={job} onCreated={refreshAfterCandidateCreated} onSessionLost={onSessionLost} /></details>}
      <label className="search"><span aria-hidden="true">⌕</span><input aria-label="Tìm ứng viên trong Job" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm ứng viên trong Job…" /></label>
      {state === "ready" && <span className="muted">{items.length} ứng viên đang hiển thị</span>}
    </div>
    {!canManageApplications && <div className="notice" role="status">Chế độ chỉ xem. Chỉ Admin hoặc TA được phân công vào Job này mới có thể chuyển ứng viên giữa các vòng.</div>}
    {state === "loading" && <p role="status" aria-live="polite">Đang tải ứng viên…</p>}
    {state === "forbidden" && <div className="notice error" role="alert">Không có quyền. Dữ liệu của Job này đã được xoá khỏi màn hình.</div>}
    {state === "error" && <div className="notice error" role="alert">{error}<button className="quiet" onClick={() => void load()}>Thử lại</button></div>}
    {offerError && canViewOffers && <div className="notice error" role="alert">Không tải được dữ liệu Offer: {offerError}<button className="quiet" onClick={() => void load()}>Thử lại</button></div>}
    {state === "empty" && !offerError && <div className="empty"><h3>Chưa có ứng viên</h3><p>Không có kết quả trong phạm vi Job này.</p></div>}
    {failedTransition && <div className="notice error" role="alert"><strong>{failedTransition.application.candidate_name}</strong>: <span>{failedTransition.message}</span><button className="quiet" onClick={() => void moveApplication(failedTransition.application, failedTransition.targetStage)}>Thử lại chuyển {failedTransition.targetStage}</button></div>}
    {(state === "ready" || state === "empty") && <div className="pipeline-grid">
      {stages.map(([stage, applications]) => {
        const allowedTargets = canManageApplications && dragging ? [NEXT_STAGE[dragging.stage], PREVIOUS_STAGE[dragging.stage]] : [];
        const acceptsDrop = allowedTargets.includes(stage as "NEW" | "SCREEN" | "INTERVIEW") && dragging?.status === "ACTIVE";
        return <section className={`stage ${acceptsDrop ? "drop-target" : ""}`} key={stage} data-stage={stage} aria-label={`Giai đoạn ${stage}`}
          onDragOver={(event) => { if (acceptsDrop) event.preventDefault(); }}
          onDrop={(event) => { event.preventDefault(); const candidate = dragging; const targetStage = stage as TransitionStage; setDragging(null); if (acceptsDrop && candidate) void moveApplication(candidate, targetStage); }}>
          <h3><span className="stage-title"><i aria-hidden="true" />{STAGE_LABEL[stage] || stage}</span><span className="count">{applications.length}</span></h3>
          {ROUND_SLA_DAYS[stage] > 0 && <p className="stage-sla">SLA vòng: ≤ {ROUND_SLA_DAYS[stage]} ngày</p>}
          {stage === "NEW" && <p className="drop-hint">Kéo thẻ ứng viên ở vòng SCREEN đang xử lý vào đây để đưa về NEW.</p>}
          {stage === "SCREEN" && <p className="drop-hint">Kéo thẻ ứng viên ở vòng NEW hoặc INTERVIEW đang xử lý vào đây.</p>}
          {stage === "INTERVIEW" && <p className="drop-hint">Kéo thẻ ứng viên ở vòng SCREEN đang xử lý vào đây để chuyển sang INTERVIEW.</p>}
          {stage === "OFFER" && <p className="drop-hint">Hồ sơ có Offer đang chờ hoặc đã được duyệt. Application vẫn giữ nguyên vòng hiện tại.</p>}
          {applications.length === 0 && <p className="empty-stage">Chưa có ứng viên ở vòng này.</p>}
          {applications.map((application) => {
            const offer = stage === "OFFER" ? offerItems.find((item) => item.application_id === application.application_id) : undefined;
            const canDrag = canManageApplications && stage !== "OFFER" && Boolean(NEXT_STAGE[application.stage] || PREVIOUS_STAGE[application.stage]) && application.status === "ACTIVE";
            const dragTargets = [NEXT_STAGE[application.stage], PREVIOUS_STAGE[application.stage]].filter(Boolean);
            const dragReason = canDrag ? `Kéo sang ${dragTargets.join(" hoặc ")}` : "Chỉ hồ sơ đang xử lý ở NEW, SCREEN hoặc INTERVIEW mới có thể chuyển vòng.";
            return <button className="application-card" key={application.application_id}
              draggable={canDrag}
              onDragStart={(event) => { if (!canDrag) { event.preventDefault(); return; } setDragging(application); }}
              onDragEnd={() => setDragging(null)}
              onClick={() => void openDetail(application)}
              title={dragReason}
              aria-label={`Mở hồ sơ của ${application.candidate_name}. ${dragReason}`}>
              <span className="application-person"><span className="application-avatar" aria-hidden="true">{application.candidate_name.trim().split(/\s+/).slice(-2).map(part => part[0]).join("").toUpperCase() || "UV"}</span><span><strong>{application.candidate_name}</strong><span className="application-card-code">{job.job_code || "ỨNG VIÊN"}</span></span></span><span className="application-card-status">{offer ? offer.offer_status === "APPROVED" ? "Offer đã duyệt" : "Offer chờ duyệt" : application.status === "ACTIVE" ? "Đang xử lý" : application.status}</span><span className="application-card-footer"><small>{application.source || "Chưa ghi nguồn"}</small><span aria-hidden="true">Xem hồ sơ →</span></span>
            </button>;
          })}
        </section>;
      })}
    </div>}
    {state === "ready" && <div className="panel-footer"><button className="secondary" disabled={offset === 0} title={offset === 0 ? "Đang ở trang đầu" : "Trang trước"} onClick={() => { const next = Math.max(0, offset - PAGE_SIZE); setOffset(next); void load(next, query); }}>Trang trước</button><span>Trang {offset / PAGE_SIZE + 1}</span><button className="secondary" disabled={items.length < PAGE_SIZE} title={items.length < PAGE_SIZE ? "Không còn trang sau" : "Trang sau"} onClick={() => { const next = offset + PAGE_SIZE; setOffset(next); void load(next, query); }}>Trang sau</button></div>}
    {selected && <aside className="application-detail" aria-label="Chi tiết ứng viên">
      <div className="panel-heading"><h2>Chi tiết ứng viên</h2><button className="quiet" aria-label="Đóng chi tiết" onClick={() => { detailTicket.current += 1; selectedId.current = null; setSelected(null); }}>Đóng</button></div>
      {detailLoading && <p role="status">Đang tải chi tiết…</p>}
      {detailError && <div className="notice error" role="alert">{detailError}<button className="quiet" onClick={() => void openDetail(selected)}>Thử lại</button></div>}
      {detail && <><dl className="application-fields"><dt>Ứng viên</dt><dd>{detail.application.candidate_name}</dd><dt>Giai đoạn</dt><dd>{detail.application.stage}</dd><dt>Trạng thái</dt><dd>{detail.application.status}</dd><dt>Nguồn</dt><dd>{detail.application.source || "Không có"}</dd></dl>
        <h3>Lịch sử</h3><ol className="timeline">{detail.events.map((event) => <li key={event.event_id}><strong>{event.event_type}</strong><span>{event.from_stage || "—"} → {event.to_stage || "—"}</span><small>{event.actor_display_name || "Người dùng"} · {new Date(event.created_at).toLocaleString()}</small></li>)}</ol>
        {detail.matching_context != null && <details><summary>Matching context</summary><pre>{JSON.stringify(detail.matching_context, null, 2)}</pre></details>}
      </>}
      {canManageApplications && previousStage && <button className="secondary" aria-label={transitionRequestTarget === previousStage ? `Thử lại chuyển về ${previousStage}` : `Chuyển về ${previousStage}`} disabled={!eligible || transitionBusy} title={disabledReason || `Chuyển về ${previousStage}`} onClick={() => selected && void moveApplication(selected, previousStage)}>{transitionBusy ? "Đang xử lý…" : transitionRequestTarget === previousStage ? `Thử lại chuyển ${previousStage}` : `Chuyển về ${previousStage}`}</button>}
      {canManageApplications && nextStage && <button className="primary" aria-label={transitionRequestTarget === nextStage ? `Thử lại chuyển sang ${nextStage}` : `Chuyển sang ${nextStage}`} disabled={!eligible || transitionBusy} title={disabledReason || `Chuyển sang ${nextStage}`} onClick={() => selected && void moveApplication(selected, nextStage as TransitionStage)}>{transitionBusy ? "Đang xử lý…" : transitionRequestTarget === nextStage ? `Thử lại chuyển ${nextStage}` : `Chuyển sang ${nextStage}`}</button>}
      {disabledReason && <p className="disabled-explanation">{disabledReason}</p>}
    </aside>}
  </section>;
}
