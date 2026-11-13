"use client";
import { useLanguage } from "./language";
import { useUiText, useUiNotice, useUiError } from "./ui-text";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Job } from "@/lib/policy";
import { candidateProfile, type CandidateProfile } from "@/lib/candidates";
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
import Icon from "./icon";
import { eventLabel } from "@/lib/ui-copy";
import CandidateEntryDialog from "./candidate-entry-dialog";
import InterviewSchedule from "./interview-schedule";
const PAGE_SIZE = 25;
const PIPELINE_STAGES = [
  "NEW",
  "SCREEN",
  "INTERVIEW",
  "HIRED",
  "REJECTED",
] as const;
const NEXT_STAGE: Record<string, "SCREEN" | "INTERVIEW" | undefined> = {
  NEW: "SCREEN",
  SCREEN: "INTERVIEW",
};
const PREVIOUS_STAGE: Record<string, "NEW" | "SCREEN" | undefined> = {
  SCREEN: "NEW",
  INTERVIEW: "SCREEN",
};
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
  return error instanceof Error
    ? error.message
    : "Không tải được dữ liệu. Vui lòng thử lại.";
}
export default function ApplicationPipeline({
  job,
  onSessionLost,
  canViewOffers = false,
  canManageApplications = false,
  onDataChanged,
}: {
  job: Job;
  onSessionLost: () => void;
  canViewOffers?: boolean;
  canManageApplications?: boolean;
  onDataChanged?: () => Promise<void>;
}) {
  const tr = useUiText();
  const notice = useUiNotice();
  const errorText = useUiError();
  const { locale } = useLanguage();
  const [items, setItems] = useState<Application[]>([]);
  const [offerItems, setOfferItems] = useState<OfferBoardItem[]>([]);
  const [offerError, setOfferError] = useState("");
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [candidateOpen, setCandidateOpen] = useState(false);
  const [source, setSource] = useState("all");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [pipelineView, setPipelineView] = useState<"table" | "board">("table");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Application | null>(null);
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [transitionRequestId, setTransitionRequestId] = useState<string | null>(
    null,
  );
  const [transitionRequestTarget, setTransitionRequestTarget] =
    useState<TransitionStage | null>(null);
  const [failedTransition, setFailedTransition] = useState<{
    application: Application;
    targetStage: TransitionStage;
    message: string;
  } | null>(null);
  const [transitionBusy, setTransitionBusy] = useState(false);
  const [metricsStatus, setMetricsStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const metricsTicket = useRef(0);
  const refreshMetrics = useCallback(async () => {
    if (!onDataChanged) return;
    const ticket = ++metricsTicket.current;
    setMetricsStatus("loading");
    try {
      await onDataChanged();
      if (ticket !== metricsTicket.current) return;
      setMetricsStatus("idle");
    } catch (cause) {
      if (ticket !== metricsTicket.current) return;
      setMetricsStatus("error");
      if (cause instanceof ApiError && [401, 403].includes(cause.status || 0))
        onSessionLost();
    }
  }, [onDataChanged, onSessionLost]);
  const [dragging, setDragging] = useState<Application | null>(null);
  const transitionRequestIds = useRef(new Map<string, string>());
  const listTicket = useRef(0);
  const detailTicket = useRef(0);
  const selectedId = useRef<string | null>(null);
  const load = useCallback(
    async (nextOffset = offset, nextQuery = query) => {
      const ticket = ++listTicket.current;
      setState("loading");
      setError("");
      try {
        const [result, offerResult] = await Promise.all([
          nextQuery.trim()
            ? searchApplications(
                job.id,
                nextQuery.trim(),
                PAGE_SIZE,
                nextOffset,
              )
            : listApplications(job.id, PAGE_SIZE, nextOffset),
          canViewOffers
            ? listOfferBoard(job.id).catch((cause): Error =>
                cause instanceof Error
                  ? cause
                  : new Error(tr("Không tải được dữ liệu Offer.")),
              )
            : Promise.resolve({ applications: [] as OfferBoardItem[] }),
        ]);
        if (ticket !== listTicket.current) return;
        setItems(result.applications);
        if (offerResult instanceof Error) {
          setOfferItems([]);
          setOfferError(message(offerResult));
          if (offerResult instanceof ApiError && offerResult.status === 401)
            onSessionLost();
        } else {
          setOfferItems(offerResult.applications);
          setOfferError("");
        }
        const offerCount =
          offerResult instanceof Error ? 0 : offerResult.applications.length;
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
    },
    [job.id, offset, query, onSessionLost, canViewOffers],
  );
  useEffect(() => {
    // The search effect below performs the first load too, avoiding two initial requests.
    return () => {
      listTicket.current += 1;
      detailTicket.current += 1;
      metricsTicket.current += 1;
    };
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
    const grouped = items
      .filter((item) => source === "all" || item.source === source)
      .reduce<Record<string, Application[]>>((all, application) => {
        (all[application.stage] ??= []).push(application);
        return all;
      }, {});
    // These are the persisted Application stages in the backend; unknown future stages remain visible.
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const visibleOffers = offerItems.filter(
      (offer) =>
        (source === "all" || offer.application.source === source) &&
        (!normalizedQuery ||
          offer.application.candidate_name
            .toLocaleLowerCase()
            .includes(normalizedQuery)),
    );
    const offeredApplicationIds = new Set(
      visibleOffers.map((offer) => offer.application_id),
    );
    const stages = [
      "NEW",
      "SCREEN",
      "INTERVIEW",
      ...(canViewOffers ? ["OFFER"] : []),
      "HIRED",
      "REJECTED",
      ...Object.keys(grouped).filter(
        (stage) =>
          !PIPELINE_STAGES.includes(stage as (typeof PIPELINE_STAGES)[number]),
      ),
    ];
    return stages.map(
      (stage) =>
        [
          stage,
          stage === "OFFER"
            ? visibleOffers.map((offer) => offer.application)
            : (grouped[stage] ?? []).filter(
                (application) =>
                  !offeredApplicationIds.has(application.application_id),
              ),
        ] as [string, Application[]],
    );
  }, [items, offerItems, canViewOffers, query, source]);
  const tableRows = stages.flatMap(([stage, applications]) =>
    applications.map((application) => ({ stage, application })),
  );
  const visibleTableRows = tableRows.filter(
    ({ stage }) => stageFilter === "ALL" || stage === stageFilter,
  );
  const openDetail = useCallback(
    async (application: Application) => {
      const ticket = ++detailTicket.current;
      setSelected(application);
      selectedId.current = application.application_id;
      setDetail(null);
      setProfile(null);
      setDetailError("");
      setTransitionRequestId(null);
      setTransitionRequestTarget(null);
      setDetailLoading(true);
      try {
        const result = await applicationDetail(
          job.id,
          application.application_id,
        );
        if (ticket !== detailTicket.current) return;
        setDetail(result);
        // Detail is the authoritative post-action state; the screen RPC returns only ID + changed.
        setSelected(result.application);
        // Candidate details use the existing RLS-protected candidates endpoint.
        try {
          const candidate = await candidateProfile(result.application.candidate_id);
          if (ticket === detailTicket.current) setProfile(candidate);
        } catch (profileCause) {
          if (profileCause instanceof ApiError && profileCause.status === 401) onSessionLost();
        }
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
    },
    [job.id, onSessionLost],
  );
  async function moveApplication(
    application: Application,
    targetStage: TransitionStage,
  ) {
    if (!canManageApplications) return;
    const isForward = NEXT_STAGE[application.stage] === targetStage;
    const isBackward = PREVIOUS_STAGE[application.stage] === targetStage;
    if (
      transitionBusy ||
      (!isForward && !isBackward) ||
      application.status !== "ACTIVE"
    )
      return;
    const requestKey = `${application.application_id}:${targetStage}`;
    const existingRequestId = transitionRequestIds.current.get(requestKey);
    const requestId = existingRequestId ?? crypto.randomUUID();
    if (
      !existingRequestId &&
      !window.confirm(
        tr("Chuyển {0} {1} {2}?", [
          application.candidate_name,
          isBackward ? tr("về") : tr("sang"),
          tr(STAGE_LABEL[targetStage] || targetStage),
        ]),
      )
    )
      return;
    transitionRequestIds.current.set(requestKey, requestId);
    if (selectedId.current === application.application_id) {
      setTransitionRequestId(requestId);
      setTransitionRequestTarget(targetStage);
    }
    setTransitionBusy(true);
    setFailedTransition(null);
    try {
      if (isBackward)
        await moveApplicationBack(
          application.application_id,
          targetStage as "NEW" | "SCREEN",
          requestId,
        );
      else if (targetStage === "SCREEN")
        await screenApplication(application.application_id, requestId);
      else await interviewApplication(application.application_id, requestId);
      transitionRequestIds.current.delete(requestKey);
      if (selectedId.current === application.application_id) {
        setTransitionRequestId(null);
        setTransitionRequestTarget(null);
        await openDetail(application);
      }
      await Promise.all([load(offset, query), refreshMetrics()]);
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
      setFailedTransition({
        application,
        targetStage,
        message: message(cause),
      });
      if (selectedId.current === application.application_id) {
        setTransitionRequestId(requestId);
        setTransitionRequestTarget(targetStage);
      }
    } finally {
      setTransitionBusy(false);
    }
  }
  useEffect(() => {
    if (!selected || candidateOpen) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        detailTicket.current += 1;
        selectedId.current = null;
        setSelected(null);
      }
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [selected, candidateOpen]);
  const nextStage = selected ? NEXT_STAGE[selected.stage] : undefined;
  const previousStage = selected ? PREVIOUS_STAGE[selected.stage] : undefined;
  const eligible = Boolean(
    (nextStage || previousStage) && selected?.status === "ACTIVE",
  );
  const disabledReason = !canManageApplications
    ? tr("Bạn chỉ có quyền xem Pipeline của Job này.")
    : !selected
      ? tr("Chọn một ứng viên để thao tác.")
      : !eligible
        ? tr(
            "Chỉ hồ sơ đang xử lý ở NEW, SCREEN hoặc INTERVIEW mới có thể chuyển vòng.",
          )
        : "";
  const refreshAfterCandidateCreated = useCallback(async () => {
    setQuery("");
    setOffset(0);
    await Promise.all([load(0, ""), refreshMetrics()]);
  }, [load, refreshMetrics]);
  return (
    <section className="panel pipeline" aria-label={`Pipeline ${job.title}`}>
      <h2 className="pipeline-accessible-heading">
        {tr("Tiến độ tuyển dụng")}
      </h2>
      <div
        className="pipeline-summary pipeline-stage-summary"
        role="region"
        aria-label={tr("Tổng quan Job đang chọn")}
      >
        {[
          { key: "NEW", label: tr("Mới ứng tuyển"), value: job.metrics?.new_count },
          { key: "SCREEN", label: tr("Sơ loại"), value: job.metrics?.screening_count },
          { key: "INTERVIEW", label: tr("Phỏng vấn"), value: job.metrics?.interview_count },
          { key: "OFFER", label: tr("Offer"), value: offerItems.length },
          { key: "HIRED", label: tr("Đã tuyển"), value: job.metrics?.hired_count },
        ].map((stage) => (
          <button key={stage.key} type="button" aria-pressed={stageFilter === stage.key} className={stageFilter === stage.key ? "active" : ""} onClick={() => { setPipelineView("table"); setStageFilter(stageFilter === stage.key ? "ALL" : stage.key); }}>
            <small>{stage.label}</small>
            <strong>{metricsStatus === "idle" ? (stage.value ?? "—") : "—"}</strong>
          </button>
        ))}
      </div>
      {metricsStatus === "loading" && (
        <p role="status">{tr("Đang cập nhật số liệu…")}</p>
      )}
      {metricsStatus === "error" && (
        <div className="notice error" role="alert">
          {tr("Đã lưu thay đổi nhưng chưa tải lại được số liệu tổng quan.")}
          <button className="quiet" onClick={() => void refreshMetrics()}>
            {tr("Tải lại số liệu")}
          </button>
        </div>
      )}
      {canManageApplications && (
        <CandidateEntryDialog
          key={job.id}
          job={job}
          isOpen={candidateOpen}
          onDismiss={() => setCandidateOpen(false)}
          onCreated={refreshAfterCandidateCreated}
          onSessionLost={onSessionLost}
        />
      )}
      <div className="pipeline-toolbar">
        <label className="search">
          <Icon name="search" size={17} />
          <input
            aria-label={tr("Tìm ứng viên trong Job")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tr("Tìm ứng viên trong Job…")}
          />
        </label>
        <label className="pipeline-source">
          {tr("Nguồn")}
          <select
            aria-label={tr("Lọc nguồn ứng viên")}
            value={source}
            onChange={(event) => setSource(event.target.value)}
          >
            <option value="all">{tr("Tất cả nguồn")}</option>
            {[
              ...new Set(
                [...items, ...offerItems.map((item) => item.application)]
                  .map((item) => item.source)
                  .filter((value): value is string => Boolean(value)),
              ),
            ].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        {canManageApplications &&
          (state === "ready" || state === "empty" || state === "error") && (
            <button
              className="primary add-candidate-button"
              type="button"
              aria-haspopup="dialog"
              onClick={() => setCandidateOpen(true)}
            >
              <span aria-hidden="true">＋</span>
              {tr("Thêm ứng viên")}
            </button>
          )}
        {state === "ready" && (
          <span className="muted">
            {stages.reduce(
              (count, [, applications]) => count + applications.length,
              0,
            )}{" "}
            {tr("hồ sơ đang hiển thị")}
          </span>
        )}
      </div>
      <p className="pipeline-scope-note">
        {tr(
          "Danh sách ứng viên được chia trang; bộ lọc nguồn áp dụng cho trang đang xem. Số liệu tổng quan tính trên toàn bộ Job. Mục tiêu thời gian từng vòng chỉ để tham khảo.",
        )}
      </p>
      {!canManageApplications && (
        <div className="notice" role="status">
          {tr(
            "Chế độ chỉ xem. Chỉ Admin hoặc TA được phân công vào Job này mới có thể chuyển ứng viên giữa các vòng.",
          )}
        </div>
      )}
      {state === "loading" && (
        <p role="status" aria-live="polite">
          {tr("Đang tải ứng viên…")}
        </p>
      )}
      {state === "forbidden" && (
        <div className="notice error" role="alert">
          {tr("Không có quyền. Dữ liệu của Job này đã được xoá khỏi màn hình.")}
        </div>
      )}
      {state === "error" && (
        <div className="notice error" role="alert">
          {errorText(error)}
          <button className="quiet" onClick={() => void load()}>
            {tr("Thử lại")}
          </button>
        </div>
      )}
      {offerError && canViewOffers && (
        <div className="notice error" role="alert">
          {tr("Không tải được dữ liệu Offer:")} {errorText(offerError)}
          <button className="quiet" onClick={() => void load()}>
            {tr("Thử lại")}
          </button>
        </div>
      )}
      {state === "empty" && !offerError && (
        <div className="empty">
          <h3>{tr("Chưa có ứng viên")}</h3>
          <p>{tr("Không có kết quả trong phạm vi Job này.")}</p>
        </div>
      )}
      {failedTransition && (
        <div className="notice error" role="alert">
          <strong>{failedTransition.application.candidate_name}</strong>:{" "}
          <span>{errorText(failedTransition.message)}</span>
          <button
            className="quiet"
            onClick={() =>
              void moveApplication(
                failedTransition.application,
                failedTransition.targetStage,
              )
            }
          >
            {tr("Thử lại chuyển")}{" "}
            {tr(
              STAGE_LABEL[failedTransition.targetStage] ||
                failedTransition.targetStage,
            )}
          </button>
        </div>
      )}
      <div className={`pipeline-layout ${selected ? "has-detail" : ""}`}>
      {(state === "ready" || state === "empty") && (
        <>
        <section className="pipeline-table-view" hidden={pipelineView !== "table"} aria-label={tr("Bảng ứng viên")}>
          <div className="pipeline-table-toolbar">
            <div className="pipeline-stage-filters" role="group" aria-label={tr("Lọc theo giai đoạn")}>
              {[{ key: "ALL", label: tr("Tất cả"), count: tableRows.length }, ...stages.map(([key, applications]) => ({ key, label: tr(STAGE_LABEL[key] || key), count: applications.length }))].map((item) => (
                <button key={item.key} type="button" className={stageFilter === item.key ? "active" : ""} aria-pressed={stageFilter === item.key} onClick={() => setStageFilter(item.key)}>
                  {item.label}<span>{item.count}</span>
                </button>
              ))}
            </div>
            <div className="pipeline-view-switch" role="group" aria-label={tr("Cách hiển thị")}>
              <button type="button" className={pipelineView === "table" ? "active" : ""} aria-pressed={pipelineView === "table"} onClick={() => setPipelineView("table")}>{tr("Bảng")}</button>
              <button type="button" className={pipelineView === "board" ? "active" : ""} aria-pressed={pipelineView === "board"} onClick={() => setPipelineView("board")}>{tr("Kanban")}</button>
            </div>
          </div>
          <div className="application-table-scroll">
            <table className="application-table">
              <colgroup>
                <col style={{ width: "25%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "17%" }} />
                <col style={{ width: "12%" }} />
              </colgroup>
              <thead><tr><th>{tr("Ứng viên")}</th><th>{tr("Giai đoạn")}</th><th>{tr("Vòng phỏng vấn")}</th><th>{tr("Matching")}</th><th>{tr("Kinh nghiệm")}</th><th>{tr("Nguồn")}</th><th>{tr("Ngày ứng tuyển")}</th></tr></thead>
              <tbody>{visibleTableRows.map(({ stage, application }) => (
                <tr key={application.application_id} className={selected?.application_id === application.application_id ? "selected" : ""} aria-selected={selected?.application_id === application.application_id}>
                  <td><button type="button" className="application-table-candidate" onClick={() => void openDetail(application)}><span className="application-avatar" aria-hidden="true">{application.candidate_name.trim().split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase() || "UV"}</span><strong>{application.candidate_name}</strong></button></td>
                  <td><span className={`application-stage-pill stage-${stage.toLocaleLowerCase()}`}>{tr(STAGE_LABEL[stage] || stage)}</span></td>
                  <td>—</td><td>—</td><td>—</td>
                  <td>{application.source || tr("Chưa ghi nguồn")}</td>
                  <td>{new Date(application.created_at).toLocaleDateString(locale === "en" ? "en-GB" : "vi-VN")}</td>
                </tr>
              ))}{visibleTableRows.length === 0 && <tr><td colSpan={7} className="application-table-empty">{tr("Không có ứng viên trong giai đoạn này.")}</td></tr>}</tbody>
            </table>
          </div>
        </section>
        <div className="pipeline-grid" hidden={pipelineView !== "board"}>
          {stages.map(([stage, applications]) => {
            const allowedTargets =
              canManageApplications && dragging
                ? [NEXT_STAGE[dragging.stage], PREVIOUS_STAGE[dragging.stage]]
                : [];
            const acceptsDrop =
              allowedTargets.includes(
                stage as "NEW" | "SCREEN" | "INTERVIEW",
              ) && dragging?.status === "ACTIVE";
            return (
              <section
                className={`stage ${acceptsDrop ? "drop-target" : ""}`}
                key={stage}
                data-stage={stage}
                aria-label={tr("Giai đoạn {0}", [
                  tr(STAGE_LABEL[stage] || stage),
                ])}
                onDragOver={(event) => {
                  if (acceptsDrop) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const candidate = dragging;
                  const targetStage = stage as TransitionStage;
                  setDragging(null);
                  if (acceptsDrop && candidate)
                    void moveApplication(candidate, targetStage);
                }}
              >
                <header className="stage-header">
                  <h3>
                    <span className="stage-title">
                      <i aria-hidden="true" />
                      {tr(STAGE_LABEL[stage] || stage)}
                    </span>
                    <span className="count">{applications.length}</span>
                  </h3>
                  <p
                    className="stage-meta"
                    title={
                      stage === "OFFER"
                        ? tr("Theo dõi đề nghị đang chờ hoặc đã được duyệt.")
                        : undefined
                    }
                  >
                    {ROUND_SLA_DAYS[stage] > 0 ? (
                      <>
                        {tr("Mục tiêu: ≤")} {ROUND_SLA_DAYS[stage]} {tr("ngày")}
                      </>
                    ) : stage === "OFFER" ? (
                      tr("Theo dõi đề nghị")
                    ) : stage === "HIRED" ? (
                      tr("Hoàn tất tuyển dụng")
                    ) : (
                      tr("Hồ sơ đã kết thúc")
                    )}
                  </p>
                </header>
                {applications.length === 0 && (
                  <p className="empty-stage">
                    {tr("Chưa có ứng viên ở vòng này.")}
                  </p>
                )}
                {applications.map((application) => {
                  const offer =
                    stage === "OFFER"
                      ? offerItems.find(
                          (item) =>
                            item.application_id === application.application_id,
                        )
                      : undefined;
                  const canDrag =
                    canManageApplications &&
                    stage !== "OFFER" &&
                    Boolean(
                      NEXT_STAGE[application.stage] ||
                      PREVIOUS_STAGE[application.stage],
                    ) &&
                    application.status === "ACTIVE";
                  const dragTargets = [
                    NEXT_STAGE[application.stage],
                    PREVIOUS_STAGE[application.stage],
                  ].filter(Boolean);
                  const dragReason = canDrag
                    ? tr("Kéo sang {0}", [
                        dragTargets
                          .map((stage) => tr(STAGE_LABEL[stage!] || stage!))
                          .join(tr(" hoặc ")),
                      ])
                    : tr(
                        "Chỉ hồ sơ đang xử lý ở NEW, SCREEN hoặc INTERVIEW mới có thể chuyển vòng.",
                      );
                  return (
                    <button
                      className="application-card"
                      key={application.application_id}
                      draggable={canDrag}
                      onDragStart={(event) => {
                        if (!canDrag) {
                          event.preventDefault();
                          return;
                        }
                        if (event.dataTransfer) {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData(
                            "text/plain",
                            application.application_id,
                          );
                        }
                        setDragging(application);
                      }}
                      onDragEnd={() => setDragging(null)}
                      onClick={() => void openDetail(application)}
                      title={`${application.candidate_name}\n${application.source || tr("Chưa ghi nguồn")}\n${dragReason}`}
                      aria-label={tr("Mở hồ sơ của {0}. {1}", [
                        application.candidate_name,
                        dragReason,
                      ])}
                    >
                      <span className="application-person">
                        <span className="application-avatar" aria-hidden="true">
                          {application.candidate_name
                            .trim()
                            .split(/\s+/)
                            .slice(-2)
                            .map((part) => part[0])
                            .join("")
                            .toUpperCase() || "UV"}
                        </span>
                        <span>
                          <strong>{application.candidate_name}</strong>
                        </span>
                      </span>
                      {(offer || application.status !== "ACTIVE") && (
                        <span className="application-card-status">
                          {offer
                            ? offer.offer_status === "APPROVED"
                              ? tr("Offer đã duyệt")
                              : tr("Offer chờ duyệt")
                            : tr(application.status)}
                        </span>
                      )}
                      <span className="application-card-footer">
                        <small
                          title={application.source || tr("Chưa ghi nguồn")}
                        >
                          {application.source || tr("Chưa ghi nguồn")}
                        </small>
                        <span aria-hidden="true">{tr("Xem hồ sơ →")}</span>
                      </span>
                    </button>
                  );
                })}
              </section>
            );
          })}
        </div>
        </>
      )}
      {state === "ready" && (
        <div className="panel-footer">
          <button
            className="secondary"
            disabled={offset === 0}
            title={offset === 0 ? tr("Đang ở trang đầu") : tr("Trang trước")}
            onClick={() => {
              const next = Math.max(0, offset - PAGE_SIZE);
              setOffset(next);
              void load(next, query);
            }}
          >
            {tr("Trang trước")}
          </button>
          <span>
            {tr("Trang")} {offset / PAGE_SIZE + 1}
          </span>
          <button
            className="secondary"
            disabled={items.length < PAGE_SIZE}
            title={
              items.length < PAGE_SIZE
                ? tr("Không còn trang sau")
                : tr("Trang sau")
            }
            onClick={() => {
              const next = offset + PAGE_SIZE;
              setOffset(next);
              void load(next, query);
            }}
          >
            {tr("Trang sau")}
          </button>
        </div>
      )}
      {selected && (
        <aside
          className="application-detail"
          aria-label={tr("Chi tiết ứng viên")}
        >
          <div className="panel-heading">
            <h2>{tr("Chi tiết ứng viên")}</h2>
            <button
              className="quiet"
              aria-label={tr("Đóng chi tiết")}
              onClick={() => {
                detailTicket.current += 1;
                selectedId.current = null;
                setSelected(null);
              }}
            >
              {tr("Đóng")}
            </button>
          </div>
          {detailLoading && <p role="status">{tr("Đang tải chi tiết…")}</p>}
          {detailError && (
            <div className="notice error" role="alert">
              {errorText(detailError)}
              <button
                className="quiet"
                onClick={() => void openDetail(selected)}
              >
                {tr("Thử lại")}
              </button>
            </div>
          )}
          {detail && (
            <>
              <dl className="application-fields">
                <dt>{tr("Ứng viên")}</dt>
                <dd>{detail.application.candidate_name}</dd>
                <dt>{tr("Email")}</dt>
                <dd>{profile?.candidate.email || "—"}</dd>
                <dt>{tr("Điện thoại")}</dt>
                <dd>{profile?.candidate.phone || "—"}</dd>
                <dt>{tr("Vị trí hiện tại")}</dt>
                <dd>{profile?.candidate.current_title || "—"}</dd>
                <dt>{tr("Công ty hiện tại")}</dt>
                <dd>{profile?.candidate.current_company || "—"}</dd>
                <dt>{tr("Kinh nghiệm")}</dt>
                <dd>{profile?.candidate.total_experience_years != null ? tr("{0} năm", [profile.candidate.total_experience_years]) : "—"}</dd>
                <dt>{tr("Địa điểm")}</dt>
                <dd>{profile?.candidate.location || "—"}</dd>
                <dt>{tr("Giai đoạn")}</dt>
                <dd>{tr(detail.application.stage)}</dd>
                <dt>{tr("Trạng thái")}</dt>
                <dd>{tr(detail.application.status)}</dd>
                <dt>{tr("Nguồn")}</dt>
                <dd>{detail.application.source || tr("Không có")}</dd>
              </dl>
              {canManageApplications &&
                detail.application.status === "ACTIVE" &&
                ["SCREEN", "INTERVIEW"].includes(detail.application.stage) && (
                  <InterviewSchedule
                    key={selected.application_id}
                    applicationId={selected.application_id}
                    onAccessLost={onSessionLost}
                    onSaved={async () => {
                      await Promise.all([load(offset), refreshMetrics()]);
                      const ticket = ++detailTicket.current;
                      const updated = await applicationDetail(
                        job.id,
                        selected.application_id,
                      );
                      if (
                        ticket === detailTicket.current &&
                        selectedId.current === selected.application_id
                      )
                        setDetail(updated);
                    }}
                  />
                )}
              <h3>{tr("Lịch sử")}</h3>
              <ol className="timeline">
                {detail.events.map((event) => (
                  <li key={event.event_id}>
                    <strong>{eventLabel(locale, event.event_type)}</strong>
                    <span>
                      {tr(event.from_stage || "—")} →{" "}
                      {tr(event.to_stage || "—")}
                    </span>
                    <small>
                      {event.actor_display_name || tr("Người dùng")} ·{" "}
                      {new Date(event.created_at).toLocaleString(
                        locale === "en" ? "en-GB" : "vi-VN",
                      )}
                    </small>
                  </li>
                ))}
              </ol>
              {detail.matching_context != null && (
                <details>
                  <summary>{tr("Matching context")}</summary>
                  <pre>{JSON.stringify(detail.matching_context, null, 2)}</pre>
                </details>
              )}
            </>
          )}
          {canManageApplications && previousStage && (
            <button
              className="secondary"
              aria-label={
                transitionRequestTarget === previousStage
                  ? tr("Thử lại chuyển về {0}", [
                      tr(STAGE_LABEL[previousStage] || previousStage),
                    ])
                  : tr("Chuyển về {0}", [
                      tr(STAGE_LABEL[previousStage] || previousStage),
                    ])
              }
              disabled={!eligible || transitionBusy}
              title={
                disabledReason ||
                tr("Chuyển về {0}", [
                  tr(STAGE_LABEL[previousStage] || previousStage),
                ])
              }
              onClick={() =>
                selected && void moveApplication(selected, previousStage)
              }
            >
              {transitionBusy
                ? tr("Đang xử lý…")
                : transitionRequestTarget === previousStage
                  ? tr("Thử lại chuyển {0}", [
                      tr(STAGE_LABEL[previousStage] || previousStage),
                    ])
                  : tr("Chuyển về {0}", [
                      tr(STAGE_LABEL[previousStage] || previousStage),
                    ])}
            </button>
          )}
          {canManageApplications && nextStage && (
            <button
              className="primary"
              aria-label={
                transitionRequestTarget === nextStage
                  ? tr("Thử lại chuyển sang {0}", [
                      tr(STAGE_LABEL[nextStage] || nextStage),
                    ])
                  : tr("Chuyển sang {0}", [
                      tr(STAGE_LABEL[nextStage] || nextStage),
                    ])
              }
              disabled={!eligible || transitionBusy}
              title={
                disabledReason ||
                tr("Chuyển sang {0}", [tr(STAGE_LABEL[nextStage] || nextStage)])
              }
              onClick={() =>
                selected &&
                void moveApplication(selected, nextStage as TransitionStage)
              }
            >
              {transitionBusy
                ? tr("Đang xử lý…")
                : transitionRequestTarget === nextStage
                  ? tr("Thử lại chuyển {0}", [
                      tr(STAGE_LABEL[nextStage] || nextStage),
                    ])
                  : tr("Chuyển sang {0}", [
                      tr(STAGE_LABEL[nextStage] || nextStage),
                    ])}
            </button>
          )}
          {disabledReason && (
            <p className="disabled-explanation">{disabledReason}</p>
          )}
        </aside>
      )}
      </div>
    </section>
  );
}
