"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readViewState, writeViewState } from "@/lib/view-state";
import type { Job } from "@/lib/policy";
import {
  applicationDetail,
  currentInterviewRounds,
  interviewApplication,
  moveApplicationBack,
  listApplications,
  screenApplication,
  searchApplications,
  type Application,
  type ApplicationDetail,
  type ApplicationInterviewRound,
  type ApplicationStage,
} from "@/lib/applications";
import { ApiError } from "@/lib/supabase";
import { listOfferBoard, type OfferBoardItem } from "@/lib/offers";
import ManualCandidateForm from "./manual-candidate-form";
import CandidateInterviewProgress from "./candidate-interview-progress";
import CandidateEditForm from "./candidate-edit-form";
import PipelineCandidateProfile from "./pipeline-candidate-profile";
import PipelineCandidateNotes from "./pipeline-candidate-notes";
import { useLanguage } from "./language";
import styles from "./bosch-v2-pipeline.module.css";

const PAGE_SIZE = 25;
const PIPELINE_STAGES = ["NEW", "SCREEN", "INTERVIEW", "HIRED", "REJECTED"] as const;
const NEXT_STAGE: Record<string, "SCREEN" | "INTERVIEW" | undefined> = { NEW: "SCREEN", SCREEN: "INTERVIEW" };
const PREVIOUS_STAGE: Record<string, "NEW" | "SCREEN" | undefined> = { SCREEN: "NEW", INTERVIEW: "SCREEN" };
type TransitionStage = "NEW" | "SCREEN" | "INTERVIEW";
type State = "loading" | "ready" | "empty" | "forbidden" | "error";
type CandidateTab = "overview" | "profile" | "interview" | "notes" | "activity";
type PipelineFilter = ApplicationStage | "OFFER";

function message(error: unknown, en = false) {
  return error instanceof Error ? error.message : en ? "Could not load the data. Please try again." : "Chưa tải được dữ liệu. Bạn thử lại nhé.";
}

export default function ApplicationPipeline({ job, onSessionLost, canViewOffers = false, canManageApplications = false, onSelectionChange }: { job: Job; onSessionLost: () => void; canViewOffers?: boolean; canManageApplications?: boolean; onSelectionChange?: (application: Application | null) => void }) {
  const { locale } = useLanguage();
  const en = locale === "en";
  const copy = en ? {
    pipeline: "Hiring Pipeline", counts: "Candidate counts by stage", jobPipeline: "Pipeline for this job", candidates: "Candidates", addCandidate: "Add candidate to job", searchCandidates: "Search candidates in this job…", candidatesLabel: "Search candidates in this job", pageCount: (count: number) => `${count} applications on this page`, offerCount: (count: number) => `${count} offers`, filterStage: (stage: string) => `Filter candidates by ${stage}`, clearFilter: "Show all stages", filteredBy: (stage: string) => `Showing ${stage} candidates`, noStageResults: "No candidates in this stage.",
    readOnly: "View only. Only an Admin or a TA assigned to this job can move candidates between stages.", loading: "Loading candidates…", forbidden: "No access. This job’s data has been removed from the screen.", retry: "Try again", loadOffer: "Could not load offer data:", noCandidates: "No candidates yet", noCandidatesBody: "There are no results for this job.", retryMove: "Try moving again", selectAll: "Select all visible candidates", candidate: "Candidate", stage: "Stage", round: "Interview round", matching: "Match", experience: "Experience", source: "Source", activity: "Last activity", emptyPage: "No candidates on this page.", overview: "Candidate overview", selectCandidate: "Select a candidate to see their interview progress, summary and activity.", tabs: "Candidate details", overviewTab: "Overview", profile: "Profile", interviewProgressTab: "Interview progress", notes: "Notes", activityTab: "Activity", close: "Close candidate details", history: "History", matchingContext: "Matching details", disabledReadonly: "You can view this pipeline, but only an Admin or an assigned TA can move candidates between stages.", disabledSelect: "Select a candidate to continue.", disabledStage: "Only active candidates in New, Screening or Interview can move between stages.", moveActions: "Candidate stage actions", user: "User", stageLabel: (value: string) => value === "NEW" ? "New" : value === "SCREEN" ? "Screening" : value === "INTERVIEW" ? "Interview" : value === "HIRED" ? "Hired" : value === "OFFER" ? "Offer" : value === "REJECTED" ? "Rejected" : value,
    previous: (value: string) => `Move back to ${value}`, next: (value: string) => `Move to ${value}`, retryRequest: (value: string) => `Retry request: ${value}`, firstPage: "You’re on the first page", prevPage: "Previous page", nextPage: "Next page", lastPage: "There are no more pages", page: (n: number) => `Page ${n}`, processing: "Saving…", confirm: (name: string, direction: string, value: string) => `Move ${name} ${direction} ${value}?`,
  } : {
    pipeline: "Tiến độ tuyển dụng", counts: "Số hồ sơ theo giai đoạn", jobPipeline: "Pipeline của vị trí này", candidates: "Ứng viên", addCandidate: "Thêm ứng viên vào vị trí", searchCandidates: "Tìm ứng viên trong vị trí này…", candidatesLabel: "Tìm ứng viên trong vị trí này", pageCount: (count: number) => `${count} hồ sơ ở trang này`, offerCount: (count: number) => `${count} hồ sơ Offer`, filterStage: (stage: string) => `Lọc ứng viên theo vòng ${stage}`, clearFilter: "Hiện tất cả vòng", filteredBy: (stage: string) => `Đang hiển thị ứng viên ở vòng ${stage}`, noStageResults: "Không có ứng viên trong vòng này.",
    readOnly: "Chế độ chỉ xem. Chỉ Admin hoặc TA được phân công vào vị trí này mới có thể chuyển ứng viên giữa các vòng.", loading: "Đang tải ứng viên…", forbidden: "Không có quyền truy cập. Dữ liệu của vị trí này đã được ẩn.", retry: "Thử lại", loadOffer: "Chưa tải được dữ liệu Offer:", noCandidates: "Chưa có ứng viên", noCandidatesBody: "Chưa có kết quả trong phạm vi vị trí này.", retryMove: "Thử chuyển lại", selectAll: "Chọn tất cả ứng viên đang hiển thị", candidate: "Ứng viên", stage: "Vòng tuyển dụng", round: "Vòng phỏng vấn", matching: "Độ phù hợp", experience: "Kinh nghiệm", source: "Nguồn", activity: "Hoạt động gần nhất", emptyPage: "Không có ứng viên ở trang này.", overview: "Tổng quan ứng viên", selectCandidate: "Chọn một ứng viên để xem tiến độ phỏng vấn, thông tin và lịch sử hoạt động.", tabs: "Thông tin ứng viên", overviewTab: "Tổng quan", profile: "Hồ sơ", interviewProgressTab: "Tiến độ phỏng vấn", notes: "Ghi chú", activityTab: "Hoạt động", close: "Đóng chi tiết ứng viên", history: "Lịch sử", matchingContext: "Chi tiết đối chiếu", disabledReadonly: "Bạn có thể xem Pipeline; chỉ Admin hoặc TA được phân công mới có thể chuyển ứng viên giữa các vòng.", disabledSelect: "Chọn một ứng viên để tiếp tục.", disabledStage: "Chỉ có thể chuyển hồ sơ đang xử lý ở vòng Mới ứng tuyển, Sơ loại hoặc Phỏng vấn.", moveActions: "Thao tác chuyển vòng ứng viên", user: "Người dùng", stageLabel: (value: string) => value === "NEW" ? "Mới ứng tuyển" : value === "SCREEN" ? "Sơ loại" : value === "INTERVIEW" ? "Phỏng vấn" : value === "HIRED" ? "Đã tuyển" : value === "OFFER" ? "Offer" : value === "REJECTED" ? "Từ chối" : value,
    previous: (value: string) => `Chuyển về ${value}`, next: (value: string) => `Chuyển sang ${value}`, retryRequest: (value: string) => `Gửi lại yêu cầu: ${value}`, firstPage: "Đang ở trang đầu", prevPage: "Trang trước", nextPage: "Trang sau", lastPage: "Không còn trang sau", page: (n: number) => `Trang ${n}`, processing: "Đang lưu…", confirm: (name: string, direction: string, value: string) => `Chuyển ${name} ${direction} ${value}?`,
  };
  const [items, setItems] = useState<Application[]>([]);
  const [offerItems, setOfferItems] = useState<OfferBoardItem[]>([]);
  const [offerError, setOfferError] = useState("");
  const [rounds, setRounds] = useState<Map<string, ApplicationInterviewRound> | null>(null);
  const [roundsError, setRoundsError] = useState(false);
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<PipelineFilter | null>(null);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Application | null>(null);
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [candidateTab, setCandidateTab] = useState<CandidateTab>("overview");
  const restoreCandidateView = useRef(readViewState<{ applicationId: string | null; tab: CandidateTab }>(`ats-v2:pipeline-view:${job.id}`, { applicationId: null, tab: "overview" }));
  const candidateViewRestored = useRef(false);
  const [editingCandidate, setEditingCandidate] = useState(false);
  const [savedCandidate, setSavedCandidate] = useState(false);
  const [transitionRequestId, setTransitionRequestId] = useState<string | null>(null);
  const [transitionRequestTarget, setTransitionRequestTarget] = useState<TransitionStage | null>(null);
  const [failedTransition, setFailedTransition] = useState<{ application: Application; targetStage: TransitionStage; message: string } | null>(null);
  const [transitionBusy, setTransitionBusy] = useState(false);
  const transitionRequestIds = useRef(new Map<string, string>());
  const listTicket = useRef(0);
  const detailTicket = useRef(0);
  const selectedId = useRef<string | null>(null);
  const detailScroll = useRef<HTMLDivElement>(null);

  const load = useCallback(async (nextOffset = offset, nextQuery = query, nextStage = stageFilter) => {
    const ticket = ++listTicket.current;
    setState("loading");
    setError("");
    setRounds(null);
    setRoundsError(false);
    try {
      const [result, offerResult] = await Promise.all([
        nextQuery.trim()
          ? searchApplications(job.id, nextQuery.trim(), PAGE_SIZE, nextOffset, nextStage === "OFFER" ? null : nextStage)
          : listApplications(job.id, PAGE_SIZE, nextOffset, nextStage === "OFFER" ? null : nextStage),
        canViewOffers
          ? listOfferBoard(job.id).catch((cause): Error => cause instanceof Error ? cause : new Error("Không tải được dữ liệu Offer."))
          : Promise.resolve({ applications: [] as OfferBoardItem[] }),
      ]);
      if (ticket !== listTicket.current) return;
      setItems(result.applications);
      if (offerResult instanceof Error) {
        setOfferItems([]);
        setOfferError(message(offerResult, en));
        if (offerResult instanceof ApiError && offerResult.status === 401) onSessionLost();
      } else {
        setOfferItems(offerResult.applications);
        setOfferError("");
      }
      const offerCount = offerResult instanceof Error ? 0 : offerResult.applications.length;
      setState(result.applications.length || offerCount ? "ready" : "empty");
      const applicationIds = [...result.applications, ...(offerResult instanceof Error ? [] : offerResult.applications.map(({ application }) => application))]
        .map(({ application_id }) => application_id);
      void currentInterviewRounds(job.id, applicationIds).then((current) => {
        if (ticket === listTicket.current) setRounds(current);
      }).catch((cause: unknown) => {
        if (ticket !== listTicket.current) return;
        if (cause instanceof ApiError && cause.status === 401) onSessionLost();
        setRoundsError(true);
      });
    } catch (cause) {
      if (ticket !== listTicket.current) return;
      const apiError = cause instanceof ApiError ? cause : undefined;
      setItems([]);
      setOfferItems([]);
      setOfferError("");
      if (apiError?.status === 401) onSessionLost();
      if (apiError?.status === 403) setState("forbidden");
      else setState("error");
      setError(message(cause, en));
    }
  }, [job.id, offset, query, stageFilter, onSessionLost, canViewOffers]);

  useEffect(() => {
    // The search effect below performs the first load too, avoiding two initial requests.
    return () => { listTicket.current += 1; detailTicket.current += 1; };
    // A job switch must immediately discard the prior scope, before a new request resolves.
  }, [job.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setStageFilter(null);
    setQuery("");
    setOffset(0);
  }, [job.id]);

  useEffect(() => {
    // Changing the search scope invalidates the selected record and any in-flight detail read.
    // This prevents a previous Application from looking like a match for the new query.
    detailTicket.current += 1;
    selectedId.current = null;
    setSelected(null);
    onSelectionChange?.(null);
    setDetail(null);
    setEditingCandidate(false);
    setSavedCandidate(false);
    setDetailError("");
    setDetailLoading(false);
    setTransitionRequestId(null);
    setTransitionRequestTarget(null);
    const timer = window.setTimeout(() => {
      setOffset(0);
      void load(0, query, stageFilter);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, stageFilter]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const visibleStages = stageFilter ? stages.filter(([stage]) => stage === stageFilter) : stages;

  const openDetail = useCallback(async (application: Application, restoredTab?: CandidateTab) => {
    const ticket = ++detailTicket.current;
    setSelected(application);
    onSelectionChange?.(application);
    selectedId.current = application.application_id;
    setDetail(null);
    setCandidateTab(restoredTab || "overview");
    if (detailScroll.current) detailScroll.current.scrollTop = 0;
    setEditingCandidate(false);
    setSavedCandidate(false);
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
      onSelectionChange?.(result.application);
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
      setDetailError(message(cause, en));
    } finally {
      if (ticket === detailTicket.current) setDetailLoading(false);
    }
  }, [job.id, onSessionLost, onSelectionChange]);

  useEffect(() => {
    if (candidateViewRestored.current || (state !== "ready" && state !== "empty")) return;
    candidateViewRestored.current = true;
    const saved = restoreCandidateView.current;
    const application = saved.applicationId ? items.find((item) => item.application_id === saved.applicationId) : undefined;
    if (application) void openDetail(application, saved.tab);
  }, [state, items, openDetail]);

  useEffect(() => {
    if (!candidateViewRestored.current) return;
    writeViewState(`ats-v2:pipeline-view:${job.id}`, { applicationId: selected?.application_id || null, tab: candidateTab });
  }, [job.id, selected?.application_id, candidateTab]);

  async function moveApplication(application: Application, targetStage: TransitionStage) {
    if (!canManageApplications) return;
    const isForward = NEXT_STAGE[application.stage] === targetStage;
    const isBackward = PREVIOUS_STAGE[application.stage] === targetStage;
    if (transitionBusy || (!isForward && !isBackward) || application.status !== "ACTIVE") return;
    const requestKey = `${application.application_id}:${targetStage}`;
    const existingRequestId = transitionRequestIds.current.get(requestKey);
    const requestId = existingRequestId ?? crypto.randomUUID();
    if (!existingRequestId && !window.confirm(copy.confirm(application.candidate_name, isBackward ? (en ? "back to" : "về") : (en ? "to" : "sang"), copy.stageLabel(targetStage)))) return;
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
          setError(message(cause, en));
          onSessionLost();
        } else {
          setState("forbidden");
        }
        return;
      }
      setFailedTransition({ application, targetStage, message: message(cause, en) });
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
  const disabledReason = !canManageApplications ? copy.disabledReadonly : !selected ? copy.disabledSelect : !eligible ? copy.disabledStage : "";

  const refreshAfterCandidateCreated = useCallback(async () => {
    setQuery("");
    setStageFilter(null);
    setOffset(0);
    await load(0, "", null);
  }, [load]);

  function candidateSaved(application: Application, name: string) {
    if (selectedId.current !== application.application_id) return;
    const updated = { ...application, candidate_name: name };
    setSelected(updated);
    setDetail((current) => current && { ...current, application: updated });
    setEditingCandidate(false);
    setSavedCandidate(true);
    onSelectionChange?.(updated);
    void load();
  }

  function openCandidateTab(tab: CandidateTab) {
    if (tab === candidateTab) return;
    setCandidateTab(tab);
    setEditingCandidate(false);
    if (detailScroll.current) detailScroll.current.scrollTop = 0;
  }

  const filteredTotal = stageFilter === "OFFER" ? offerItems.length
    : stageFilter === "NEW" ? job.metrics?.new_count
    : stageFilter === "SCREEN" ? job.metrics?.screening_count
    : stageFilter === "INTERVIEW" ? job.metrics?.interview_count
    : stageFilter === "HIRED" ? job.metrics?.hired_count
    : stageFilter === "REJECTED" ? job.metrics?.rejected_count
    : job.metrics?.total_candidates;

  return <section className={styles.root} aria-label={`${copy.pipeline} ${job.title}`}>
    <div className={styles.mainColumn}>
    <div className={styles.summary}>
      <div className={styles.summaryHeader}>
        <h2>{copy.pipeline} <span aria-hidden="true" title={en ? "Counts from Job overview when available; otherwise loaded records only." : "Số liệu từ tổng quan vị trí; nếu chưa có thì tính từ hồ sơ đã tải."}>ⓘ</span></h2>
        <span className={styles.summaryScope}>{copy.jobPipeline}</span>
      </div>
      <div className={styles.stageSummary} role="group" aria-label={copy.counts}>
        {(["NEW", "SCREEN", "INTERVIEW", "OFFER", "HIRED"] as const).map((stage) => {
          const loaded = stages.find(([value]) => value === stage)?.[1].length ?? 0;
          const total = stage === "NEW" ? job.metrics?.new_count : stage === "SCREEN" ? job.metrics?.screening_count : stage === "INTERVIEW" ? job.metrics?.interview_count : stage === "HIRED" ? job.metrics?.hired_count : undefined;
          const active = stageFilter === stage;
          return <button type="button" disabled={stage === "OFFER" && !canViewOffers} aria-pressed={active} aria-label={copy.filterStage(copy.stageLabel(stage))} title={copy.filterStage(copy.stageLabel(stage))} className={`${styles.stageCell} ${stage === "INTERVIEW" && !stageFilter ? styles.stageHighlight : ""} ${active ? styles.stageSelected : ""}`} key={stage} onClick={() => setStageFilter((current) => current === stage ? null : stage)}>
            <span>{copy.stageLabel(stage)}</span>
            <strong>{total ?? loaded}</strong>
            <small>{total == null ? (en ? "Loaded" : "Đã tải" ) : (en ? "Overall" : "Tổng số")}</small>
          </button>;
        })}
      </div>
      {job.metrics?.rejected_count != null && <button type="button" aria-pressed={stageFilter === "REJECTED"} className={`${styles.rejected} ${stageFilter === "REJECTED" ? styles.rejectedSelected : ""}`} onClick={() => setStageFilter((current) => current === "REJECTED" ? null : "REJECTED")}>{en ? "Rejected" : "Từ chối"}: {job.metrics.rejected_count}</button>}
    </div>
    <div className={styles.listSection}>
    <div className={styles.toolbar}>
      <h2 className={styles.tableHeading}>{copy.candidates} ({filteredTotal ?? items.length})</h2>
      {stageFilter && <><span className={styles.filterStatus} role="status">{copy.filteredBy(copy.stageLabel(stageFilter))}</span><button type="button" className={styles.actionSecondary} onClick={() => setStageFilter(null)}>{copy.clearFilter}</button></>}
      {canManageApplications && (state === "ready" || state === "empty" || state === "error") && <details className={styles.disclosure}><summary><span aria-hidden="true">＋</span> {copy.addCandidate}</summary><ManualCandidateForm job={job} onCreated={refreshAfterCandidateCreated} onSessionLost={onSessionLost} /></details>}
      <label className={styles.search}><span aria-hidden="true">⌕</span><input aria-label={copy.candidatesLabel} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={en ? "Search candidates…" : "Tìm ứng viên…"} /></label>
      {state === "ready" && <span className={styles.muted}>{stageFilter === "OFFER" ? copy.offerCount(visibleStages[0]?.[1].length ?? 0) : copy.pageCount(items.length)}</span>}
    </div>
    {!canManageApplications && <div className={styles.notice} role="status">{copy.readOnly}</div>}
    {state === "loading" && <p role="status" aria-live="polite">{copy.loading}</p>}
    {state === "forbidden" && <div className={`${styles.notice} ${styles.error}`} role="alert">{copy.forbidden}</div>}
    {state === "error" && <div className={`${styles.notice} ${styles.error}`} role="alert">{error}<button className={styles.retry} onClick={() => void load()}>{copy.retry}</button></div>}
    {offerError && canViewOffers && <div className={`${styles.notice} ${styles.error}`} role="alert">{copy.loadOffer} {offerError}<button className={styles.retry} onClick={() => void load()}>{copy.retry}</button></div>}
    {state === "empty" && !offerError && !stageFilter && <div className={styles.empty}><h3>{copy.noCandidates}</h3><p>{copy.noCandidatesBody}</p></div>}
    {failedTransition && <div className={`${styles.notice} ${styles.error}`} role="alert"><strong>{failedTransition.application.candidate_name}</strong>: <span>{failedTransition.message}</span><button className={styles.retry} aria-label={copy.retryRequest(copy.stageLabel(failedTransition.targetStage))} onClick={() => void moveApplication(failedTransition.application, failedTransition.targetStage)}>{copy.retryMove} {copy.stageLabel(failedTransition.targetStage)}</button></div>}
    {(state === "ready" || state === "empty") && <div className={styles.scroll}>
      <table className={styles.table}>
        <colgroup><col className={styles.checkCol}/><col className={styles.candidateCol}/><col className={styles.stageCol}/><col className={styles.roundCol}/><col className={styles.matchCol}/><col className={styles.experienceCol}/><col className={styles.sourceCol}/></colgroup>
        <thead><tr><th><input type="checkbox" aria-label={copy.selectAll} checked={false} onChange={() => { /* Bulk mutations intentionally unavailable. */ }} disabled /></th><th>{copy.candidate}</th><th>{copy.stage}</th><th title={copy.round}>{copy.round}</th><th>{copy.matching}</th><th>{copy.experience}</th><th>{copy.source}</th></tr></thead>
        <tbody>
          {visibleStages.flatMap(([stage, applications]) => applications.map((application) => {
            const round = rounds?.get(application.application_id);
            return (
            <tr key={`${stage}:${application.application_id}`} className={selected?.application_id === application.application_id ? styles.selected : ""}>
              <td><input type="checkbox" aria-label={`Select ${application.candidate_name}`} checked={selected?.application_id === application.application_id} onChange={() => void openDetail(application)}/></td>
              <td><button className={styles.candidateLink} type="button" title={application.candidate_name} onClick={() => void openDetail(application)}>{application.candidate_name}</button></td>
              <td><span className={`${styles.stageBadge} ${stage === "NEW" ? styles.badgeNew : stage === "SCREEN" ? styles.badgeScreen : stage === "INTERVIEW" ? styles.badgeInterview : stage === "OFFER" ? styles.badgeOffer : stage === "HIRED" ? styles.badgeHired : stage === "REJECTED" ? styles.badgeRejected : ""}`}>{copy.stageLabel(stage)}</span></td>
              <td className={round ? undefined : styles.emptyValue} title={roundsError ? (en ? "Could not load interview rounds" : "Chưa tải được vòng phỏng vấn") : undefined}>
                {round ? <>
                  <span>{en ? "Round" : "Vòng"} {round.round_number}</span>
                  <small className={styles.roundStatus}>{round.interview_status === "COMPLETED"
                    ? (en ? "Completed" : "Đã hoàn tất") : (en ? "Scheduled" : "Đã lên lịch")}</small>
                </> : roundsError ? (en ? "Unavailable" : "Chưa tải được") : rounds ? "—" : "…"}
              </td>
              <td className={styles.emptyValue} title={en ? "The Application API doesn’t return a match score" : "API hồ sơ chưa trả về điểm phù hợp"}>—</td>
              <td className={styles.emptyValue} title={en ? "The Application API doesn’t return experience" : "API hồ sơ chưa trả về kinh nghiệm"}>—</td>
              <td><span className={styles.sourceText} title={application.source || "—"}>{application.source || "—"}</span></td>
            </tr>
          ); }))}
        </tbody>
      </table>
      {(stageFilter && !(stageFilter === "OFFER" && offerError) ? !visibleStages.some(([, applications]) => applications.length > 0) : !stageFilter && !items.length && !offerItems.length) && <p className={styles.empty}>{stageFilter ? copy.noStageResults : copy.emptyPage}</p>}
    </div>}
    {state === "ready" && stageFilter !== "OFFER" && <div className={styles.pagination}><button className={styles.actionSecondary} disabled={offset === 0} title={offset === 0 ? copy.firstPage : copy.prevPage} onClick={() => { const next = Math.max(0, offset - PAGE_SIZE); setOffset(next); void load(next, query); }}>{copy.prevPage}</button><span>{copy.page(offset / PAGE_SIZE + 1)}</span><button className={styles.actionSecondary} disabled={items.length < PAGE_SIZE} title={items.length < PAGE_SIZE ? copy.lastPage : copy.nextPage} onClick={() => { const next = offset + PAGE_SIZE; setOffset(next); void load(next, query); }}>{copy.nextPage}</button></div>}
    </div>
    </div>
    {!selected && <aside className={`${styles.side} ${styles.placeholder}`} aria-label={copy.overview}><div className={styles.sideInner}><h2>{copy.overview}</h2><p>{copy.selectCandidate}</p></div></aside>}
    {selected && <aside className={styles.side} aria-label="Chi tiết ứng viên">
      <div className={styles.sideInner} ref={detailScroll}>
      <div className={styles.detailSticky}>
      <div className={styles.profileHead}>
        <div><h2>{selected.candidate_name}</h2><p>{job.title}</p></div>
        <div className={styles.profileActions}>
          {canManageApplications && detail && !editingCandidate && <button type="button" className={styles.actionSecondary} onClick={() => { openCandidateTab("profile"); setEditingCandidate(true); setSavedCandidate(false); }}>{en ? "Edit Candidate" : "Sửa ứng viên"}</button>}
          <button type="button" className={styles.close} aria-label={copy.close} onClick={() => { detailTicket.current += 1; selectedId.current = null; setSelected(null); onSelectionChange?.(null); }}>×</button>
        </div>
      </div>
      <nav className={styles.profileTabs} aria-label={copy.tabs}>
        {([ ["overview", copy.overviewTab], ["profile", copy.profile], ["interview", copy.interviewProgressTab], ["notes", copy.notes], ["activity", copy.activityTab] ] as const).map(([tab, label]) =>
          <button key={tab} type="button" className={candidateTab === tab ? styles.active : undefined}
            aria-current={candidateTab === tab ? "page" : undefined} onClick={() => openCandidateTab(tab)}>{label}</button>)}
      </nav>
      </div>
      {detailLoading && <p role="status">{en ? "Loading details…" : "Đang tải chi tiết…"}</p>}
      {detailError && <div className={`${styles.notice} ${styles.error}`} role="alert">{detailError}<button className={styles.retry} onClick={() => void openDetail(selected)}>{copy.retry}</button></div>}
      {savedCandidate && <p role="status">{en ? "Candidate profile saved." : "Đã lưu hồ sơ ứng viên."}</p>}
      {detail && candidateTab === "interview" && <div className={styles.profileCard}>
        <CandidateInterviewProgress applicationId={detail.application.application_id} />
      </div>}
      {detail && (candidateTab === "overview" || candidateTab === "profile") && (
        candidateTab === "profile" && canManageApplications && editingCandidate ? <CandidateEditForm
          key={detail.application.application_id} candidateId={detail.application.candidate_id} applicationId={detail.application.application_id}
          jobId={job.id} en={en} onSessionLost={onSessionLost} onClose={() => setEditingCandidate(false)}
          onSave={(name) => candidateSaved(detail.application, name)} />
          : <PipelineCandidateProfile key={detail.application.candidate_id} view={candidateTab}
            candidateId={canManageApplications ? detail.application.candidate_id : undefined} en={en} onSessionLost={onSessionLost} />
      )}
      {detail && candidateTab === "overview" && detail.matching_context != null && <details><summary>{copy.matchingContext}</summary><pre>{JSON.stringify(detail.matching_context, null, 2)}</pre></details>}
      {detail && candidateTab === "notes" && <PipelineCandidateNotes key={detail.application.application_id} jobId={job.id} applicationId={detail.application.application_id} en={en} onSessionLost={onSessionLost} canWriteShared={canManageApplications} />}
      {detail && candidateTab === "activity" && <section className={styles.profileCard}>
        <h3>{copy.history}</h3>
        {detail.events.length ? <ol className={styles.timeline}>{detail.events.map((event) => <li key={event.event_id}>
          <strong>{event.event_type}</strong>
          <span>{event.from_stage ? copy.stageLabel(event.from_stage) : "—"} → {event.to_stage ? copy.stageLabel(event.to_stage) : "—"}</span>
          <small>{event.actor_display_name || copy.user} · {new Date(event.created_at).toLocaleString(en ? "en-GB" : "vi-VN")}</small>
        </li>)}</ol> : <p>{en ? "No activity yet." : "Chưa có hoạt động."}</p>}
      </section>}
      {candidateTab === "overview" && disabledReason && <p className={styles.disabledExplanation}>{disabledReason}</p>}
      </div>
      {canManageApplications && !editingCandidate && (previousStage || nextStage) && <div className={styles.stageActions} role="group" aria-label={copy.moveActions}>
        {previousStage && <button className={styles.actionSecondary} aria-label={transitionRequestTarget === previousStage ? `${copy.retryMove} ${copy.stageLabel(previousStage)}` : copy.previous(copy.stageLabel(previousStage))} disabled={!eligible || transitionBusy} title={disabledReason || copy.previous(copy.stageLabel(previousStage))} onClick={() => selected && void moveApplication(selected, previousStage)}>{transitionBusy ? copy.processing : transitionRequestTarget === previousStage ? `${copy.retryMove} ${copy.stageLabel(previousStage)}` : copy.previous(copy.stageLabel(previousStage))}</button>}
        {nextStage && <button className={styles.actionPrimary} aria-label={transitionRequestTarget === nextStage ? `${copy.retryMove} ${copy.stageLabel(nextStage)}` : copy.next(copy.stageLabel(nextStage))} disabled={!eligible || transitionBusy} title={disabledReason || copy.next(copy.stageLabel(nextStage))} onClick={() => selected && void moveApplication(selected, nextStage as TransitionStage)}>{transitionBusy ? copy.processing : transitionRequestTarget === nextStage ? `${copy.retryMove} ${copy.stageLabel(nextStage)}` : copy.next(copy.stageLabel(nextStage))}</button>}
      </div>}
    </aside>}
  </section>;
}