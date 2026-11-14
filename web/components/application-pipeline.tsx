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
import CandidateInterviewProgress from "./candidate-interview-progress";
import { useLanguage } from "./language";
import styles from "./bosch-v2-pipeline.module.css";

const PAGE_SIZE = 25;
const PIPELINE_STAGES = ["NEW", "SCREEN", "INTERVIEW", "HIRED", "REJECTED"] as const;
const NEXT_STAGE: Record<string, "SCREEN" | "INTERVIEW" | undefined> = { NEW: "SCREEN", SCREEN: "INTERVIEW" };
const PREVIOUS_STAGE: Record<string, "NEW" | "SCREEN" | undefined> = { SCREEN: "NEW", INTERVIEW: "SCREEN" };
type TransitionStage = "NEW" | "SCREEN" | "INTERVIEW";
type State = "loading" | "ready" | "empty" | "forbidden" | "error";

function message(error: unknown) {
  return error instanceof Error ? error.message : "Không tải được dữ liệu. Vui lòng thử lại.";
}

export default function ApplicationPipeline({ job, onSessionLost, canViewOffers = false, canManageApplications = false }: { job: Job; onSessionLost: () => void; canViewOffers?: boolean; canManageApplications?: boolean }) {
  const { locale } = useLanguage();
  const en = locale === "en";
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

  return <section className={styles.root} aria-label={`Pipeline ${job.title}`}>
    <div className={styles.summary}>
      <div className={styles.summaryHeader}>
        <h2>Hiring Pipeline <span aria-hidden="true" title="Counts from Job overview when available; otherwise loaded records only.">ⓘ</span></h2>
        <div className={styles.summaryFilters}>
          <span>{en ? "All Candidates" : "Tất cả ứng viên"}</span>
          <span>{en ? "All Sources" : "Tất cả nguồn"}</span>
        </div>
      </div>
      <div className={styles.stageSummary} aria-label={en ? "Hiring pipeline counts" : "Số hồ sơ theo giai đoạn"}>
        {(["NEW", "SCREEN", "INTERVIEW", "OFFER", "HIRED"] as const).map((stage) => {
          const loaded = stages.find(([value]) => value === stage)?.[1].length ?? 0;
          const total = stage === "NEW" ? job.metrics?.new_count : stage === "SCREEN" ? job.metrics?.screening_count : stage === "INTERVIEW" ? job.metrics?.interview_count : stage === "HIRED" ? job.metrics?.hired_count : undefined;
          return <div className={`${styles.stageCell} ${stage === "INTERVIEW" ? styles.stageHighlight : ""}`} key={stage}>
            <span>{stage === "SCREEN" ? "Screening" : stage === "NEW" ? "New" : stage === "INTERVIEW" ? "Interview" : stage === "HIRED" ? "Hired" : "Offer"}</span>
            <strong>{total ?? loaded}</strong>
            <small>{total == null ? "Loaded" : "Overall"}</small>
          </div>;
        })}
      </div>
      {job.metrics?.rejected_count != null && <div className={styles.rejected}>Rejected: {job.metrics.rejected_count}</div>}
    </div>
    <div className={styles.listSection}>
    <div className={styles.toolbar}>
      <h2 className={styles.tableHeading}>Candidates ({job.metrics?.total_candidates ?? items.length})</h2>
      {canManageApplications && (state === "ready" || state === "empty" || state === "error") && <details className={styles.disclosure}><summary><span aria-hidden="true">＋</span> {en ? "Add candidate to job" : "Thêm ứng viên vào vị trí"}</summary><ManualCandidateForm job={job} onCreated={refreshAfterCandidateCreated} onSessionLost={onSessionLost} /></details>}
      <label className={styles.search}><span aria-hidden="true">⌕</span><input aria-label={en ? "Search candidates in this job" : "Tìm ứng viên trong vị trí này"} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={en ? "Search candidates in this job…" : "Tìm ứng viên trong vị trí này…"} /></label>
      {state === "ready" && <span className="muted">{en ? `${items.length} applications on this page` : `${items.length} hồ sơ đang hiển thị`}</span>}
    </div>
    {!canManageApplications && <div className="notice" role="status">Chế độ chỉ xem. Chỉ Admin hoặc TA được phân công vào Job này mới có thể chuyển ứng viên giữa các vòng.</div>}
    {state === "loading" && <p role="status" aria-live="polite">Đang tải ứng viên…</p>}
    {state === "forbidden" && <div className="notice error" role="alert">Không có quyền. Dữ liệu của Job này đã được xoá khỏi màn hình.</div>}
    {state === "error" && <div className="notice error" role="alert">{error}<button className="quiet" onClick={() => void load()}>Thử lại</button></div>}
    {offerError && canViewOffers && <div className="notice error" role="alert">Không tải được dữ liệu Offer: {offerError}<button className="quiet" onClick={() => void load()}>Thử lại</button></div>}
    {state === "empty" && !offerError && <div className="empty"><h3>Chưa có ứng viên</h3><p>Không có kết quả trong phạm vi Job này.</p></div>}
    {failedTransition && <div className="notice error" role="alert"><strong>{failedTransition.application.candidate_name}</strong>: <span>{failedTransition.message}</span><button className="quiet" onClick={() => void moveApplication(failedTransition.application, failedTransition.targetStage)}>Thử lại chuyển {failedTransition.targetStage}</button></div>}
    {(state === "ready" || state === "empty") && <div className={styles.scroll}>
      <table className={styles.table}>
        <thead><tr><th><input type="checkbox" aria-label="Select all visible candidates" checked={false} onChange={() => { /* Bulk mutations intentionally unavailable. */ }} disabled /></th><th>Candidate</th><th>Stage</th><th>Interview Round</th><th>Matching</th><th>Experience</th><th>Source</th><th>Last Activity</th></tr></thead>
        <tbody>
          {stages.flatMap(([stage, applications]) => applications.map((application) => (
            <tr key={`${stage}:${application.application_id}`} className={selected?.application_id === application.application_id ? styles.selected : ""}>
              <td><input type="checkbox" aria-label={`Select ${application.candidate_name}`} checked={selected?.application_id === application.application_id} onChange={() => void openDetail(application)}/></td>
              <td><button className={styles.candidateLink} type="button" onClick={() => void openDetail(application)}>{application.candidate_name}</button></td>
              <td><span className={`${styles.stageBadge} ${stage === "NEW" ? styles.badgeNew : stage === "SCREEN" ? styles.badgeScreen : stage === "INTERVIEW" ? styles.badgeInterview : stage === "OFFER" ? styles.badgeOffer : stage === "HIRED" ? styles.badgeHired : stage === "REJECTED" ? styles.badgeRejected : ""}`}>{stage === "SCREEN" ? "Screening" : stage === "NEW" ? "New" : stage === "INTERVIEW" ? "Interview" : stage === "HIRED" ? "Hired" : stage === "OFFER" ? "Offer" : stage === "REJECTED" ? "Rejected" : stage}</span></td>
              <td title="Actual interview rounds are not included in the Application list response">—</td>
              <td title="Matching score not returned by Application list API">—</td>
              <td title="Experience not returned by Application list API">—</td>
              <td>{application.source || "—"}</td>
              <td title="The API returns created_at, not last activity">—</td>
            </tr>
          )))}
        </tbody>
      </table>
      {!items.length && !offerItems.length && <p className="empty-stage">{en ? "No candidates on this page." : "Chưa có ứng viên ở trang này."}</p>}
    </div>}
    {state === "ready" && <div className={styles.pagination}><button className="secondary" disabled={offset === 0} title={offset === 0 ? "Đang ở trang đầu" : "Trang trước"} onClick={() => { const next = Math.max(0, offset - PAGE_SIZE); setOffset(next); void load(next, query); }}>Trang trước</button><span>Trang {offset / PAGE_SIZE + 1}</span><button className="secondary" disabled={items.length < PAGE_SIZE} title={items.length < PAGE_SIZE ? "Không còn trang sau" : "Trang sau"} onClick={() => { const next = offset + PAGE_SIZE; setOffset(next); void load(next, query); }}>Trang sau</button></div>}
    </div>
    {!selected && <aside className={`${styles.side} ${styles.placeholder}`} aria-label="Candidate overview"><h2>Candidate Overview</h2><p>Select a candidate from the list to view Interview Progress, summary, stage actions and activity history.</p></aside>}
    {selected && <aside className={styles.side} aria-label="Chi tiết ứng viên">
      <div className={styles.profileHead}>
        <div><h2>{selected.candidate_name}</h2><p>{job.title}</p></div>
        <button type="button" className={styles.close} aria-label="Đóng chi tiết" onClick={() => { detailTicket.current += 1; selectedId.current = null; setSelected(null); }}>×</button>
      </div>
      <nav className={styles.profileTabs} aria-label="Candidate details"><span className={styles.active}>Overview</span><span>Profile</span><span>Notes</span><span>Activity</span></nav>
      {detailLoading && <p role="status">Đang tải chi tiết…</p>}
      {detailError && <div className="notice error" role="alert">{detailError}<button className="quiet" onClick={() => void openDetail(selected)}>Thử lại</button></div>}
      {detail && <>
        <div className={styles.profileCard}>
          <CandidateInterviewProgress applicationId={detail.application.application_id} />
          <dl className={styles.profileFields}><dt>Stage</dt><dd>{detail.application.stage === "SCREEN" ? "Screening" : detail.application.stage}</dd><dt>Status</dt><dd>{detail.application.status}</dd><dt>Source</dt><dd>{detail.application.source || "—"}</dd></dl>
        </div>
        <div className={styles.profileCard}>
          <h3>Summary</h3><p className={styles.profileMuted}>Candidate experience, email and matching score are not supplied by this Job's Application API.</p>
          <dl className={styles.profileFields}><dt>Current role</dt><dd>—</dd><dt>Experience</dt><dd>—</dd><dt>Company</dt><dd>—</dd></dl>
        </div>
        <div className={styles.profileCard}><h3>Lịch sử</h3><ol className={styles.timeline}>{detail.events.map((event) => <li key={event.event_id}><strong>{event.event_type}</strong><span>{event.from_stage || "—"} → {event.to_stage || "—"}</span><small>{event.actor_display_name || "Người dùng"} · {new Date(event.created_at).toLocaleString()}</small></li>)}</ol></div>
        {detail.matching_context != null && <details><summary>Matching context</summary><pre>{JSON.stringify(detail.matching_context, null, 2)}</pre></details>}
      </>}
      {canManageApplications && previousStage && <button className="secondary" aria-label={transitionRequestTarget === previousStage ? `Thử lại chuyển về ${previousStage}` : `Chuyển về ${previousStage}`} disabled={!eligible || transitionBusy} title={disabledReason || `Chuyển về ${previousStage}`} onClick={() => selected && void moveApplication(selected, previousStage)}>{transitionBusy ? "Đang xử lý…" : transitionRequestTarget === previousStage ? `Thử lại chuyển ${previousStage}` : `Chuyển về ${previousStage}`}</button>}
      {canManageApplications && nextStage && <button className="primary" aria-label={transitionRequestTarget === nextStage ? `Thử lại chuyển sang ${nextStage}` : `Chuyển sang ${nextStage}`} disabled={!eligible || transitionBusy} title={disabledReason || `Chuyển sang ${nextStage}`} onClick={() => selected && void moveApplication(selected, nextStage as TransitionStage)}>{transitionBusy ? "Đang xử lý…" : transitionRequestTarget === nextStage ? `Thử lại chuyển ${nextStage}` : `Chuyển sang ${nextStage}`}</button>}
      {disabledReason && <p className="disabled-explanation">{disabledReason}</p>}
    </aside>}
  </section>;
}
