"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { listApplications, type Application } from "@/lib/applications";
import { cancelInterview, completeInterview, createInterview, listInterviewAvailability, listInterviewDecisions, listInterviewFeedback, listInterviewRoster, listInterviewWorklist, submitInterviewDecision, submitInterviewFeedback, syncInterviewGoogleCalendar, type InterviewBusySlot, type InterviewDecision, type InterviewFeedback, type InterviewGoogleCalendarStatus, type InterviewRosterMember, type InterviewStatus, type InterviewWorklistItem } from "@/lib/interviews";
import { beginGoogleCalendarConnection } from "@/lib/google-calendar";
import { ApiError } from "@/lib/supabase";
import { useLanguage } from "./language";
import styles from "./bosch-v2-job-detail.module.css";
const LIMIT = 25;
const statuses: InterviewStatus[] = ["SCHEDULED", "COMPLETED", "CANCELLED"];
function localInputValue(value: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}
function sundayOf(value: Date) {
  const day = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  day.setDate(day.getDate() - day.getDay());
  return day;
}
function addDays(value: Date, amount: number) {
  const next = new Date(value); next.setDate(next.getDate() + amount); return next;
}
function dateKey(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`; }
function overlaps(start: number, end: number, slot: InterviewBusySlot) {
  const busyStart = Date.parse(slot.starts_at); const busyEnd = Date.parse(slot.ends_at);
  return Number.isFinite(busyStart) && Number.isFinite(busyEnd) && busyStart < end && busyEnd > start;
}

export function InterviewLifecycleActions({ item, en, onChanged, onAccessLost }: {
  item: InterviewWorklistItem; en: boolean; onChanged: () => void; onAccessLost: () => void;
}) {
  const [feedback, setFeedback] = useState<InterviewFeedback[]>([]);
  const [decisions, setDecisions] = useState<InterviewDecision[]>([]);
  const [score, setScore] = useState(3);
  const [recommendation, setRecommendation] = useState<InterviewFeedback["recommendation"]>("YES");
  const [strengths, setStrengths] = useState(""); const [concerns, setConcerns] = useState(""); const [summary, setSummary] = useState("");
  const [decision, setDecision] = useState<InterviewDecision["decision"]>("PROCEED"); const [decisionNote, setDecisionNote] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const mayReadFeedback = item.is_participant || item.can_decide || item.can_manage;
  useEffect(() => {
    let active = true; setFeedback([]); setDecisions([]); setError(""); setNotice("");
    if (item.status !== "COMPLETED") return () => { active = false; };
    const reads: Promise<unknown>[] = [];
    if (mayReadFeedback) reads.push(listInterviewFeedback(item.id).then((rows) => { if (active) setFeedback(rows); }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : (en ? "Could not load feedback." : "Không tải được feedback.")); if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) onAccessLost(); }));
    if (item.can_decide) reads.push(listInterviewDecisions(item.id).then((rows) => { if (active) setDecisions(rows); }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : (en ? "Could not load decisions." : "Không tải được quyết định.")); if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) onAccessLost(); }));
    void Promise.all(reads); return () => { active = false; };
  }, [item.id, item.status, item.can_decide, item.can_manage, item.is_participant, mayReadFeedback, en, onAccessLost]);
  const submit = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(success); onChanged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : (en ? "Could not save this interview action." : "Không lưu được thao tác phỏng vấn.")); if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) onAccessLost(); }
    finally { setBusy(false); }
  };
  const startPassed = Date.parse(item.starts_at) <= Date.now();
  return <section aria-label={en ? "Interview actions" : "Thao tác phỏng vấn"} className={styles.bookingParticipants}>
    <strong>{en ? "Interview actions" : "Thao tác phỏng vấn"}</strong>
    {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status" className={styles.bookingSuccess}>{notice}</p>}
    {item.status === "SCHEDULED" && item.can_manage && <div className={styles.bookingActions}>
      <button type="button" className={styles.outline} disabled={busy || !startPassed} title={!startPassed ? (en ? "Available after the interview starts." : "Chỉ dùng được sau khi buổi phỏng vấn bắt đầu.") : undefined} onClick={() => void submit(() => completeInterview(item.id), en ? "Interview marked as completed." : "Đã đánh dấu phỏng vấn hoàn tất.")}>{en ? "Mark completed" : "Đánh dấu hoàn tất"}</button>
      <button type="button" className={styles.outline} disabled={busy} onClick={() => { const ok = window.confirm(en ? "Cancel this interview? Google Calendar will remove the event and notify invitees." : "Hủy buổi phỏng vấn này? Google Calendar sẽ xóa sự kiện và gửi thông báo hủy cho người được mời."); if (ok) void submit(() => cancelInterview(item.id), en ? "Interview cancelled. Google Calendar cancellation was requested." : "Đã hủy phỏng vấn và yêu cầu Google Calendar gửi thông báo."); }}>{en ? "Cancel interview" : "Hủy phỏng vấn"}</button>
    </div>}
    {item.status === "COMPLETED" && item.is_participant && !item.feedback_submitted && <form onSubmit={(event) => { event.preventDefault(); void submit(() => submitInterviewFeedback({ interviewId: item.id, score, recommendation, strengths, concerns, summary }), en ? "Feedback submitted." : "Đã gửi feedback."); }}>
      <label className={styles.bookingField}><span>{en ? "Score (1–5)" : "Điểm (1–5)"}</span><select value={score} onChange={(event) => setScore(Number(event.target.value))}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option><option value={5}>5</option></select></label>
      <label className={styles.bookingField}><span>{en ? "Recommendation" : "Đề xuất"}</span><select value={recommendation} onChange={(event) => setRecommendation(event.target.value as InterviewFeedback["recommendation"])}><option value="STRONG_YES">Strong yes</option><option value="YES">Yes</option><option value="NO">No</option><option value="STRONG_NO">Strong no</option></select></label>
      <label className={styles.bookingField}><span>{en ? "Strengths" : "Điểm mạnh"}</span><textarea maxLength={4000} rows={2} value={strengths} onChange={(event) => setStrengths(event.target.value)} /></label>
      <label className={styles.bookingField}><span>{en ? "Concerns" : "Điểm cần cân nhắc"}</span><textarea maxLength={4000} rows={2} value={concerns} onChange={(event) => setConcerns(event.target.value)} /></label>
      <label className={styles.bookingField}><span>{en ? "Summary" : "Tóm tắt"}</span><textarea maxLength={4000} rows={2} value={summary} onChange={(event) => setSummary(event.target.value)} /></label>
      <button type="submit" className={styles.outline} disabled={busy}>{en ? "Submit feedback" : "Gửi feedback"}</button>
    </form>}
    {item.status === "COMPLETED" && item.can_decide && feedback.length > 0 && decisions.length === 0 && <form onSubmit={(event) => { event.preventDefault(); void submit(() => submitInterviewDecision({ interviewId: item.id, decision, note: decisionNote }), en ? "Decision recorded." : "Đã ghi nhận quyết định."); }}>
      <label className={styles.bookingField}><span>{en ? "Hiring decision" : "Quyết định tuyển dụng"}</span><select value={decision} onChange={(event) => setDecision(event.target.value as InterviewDecision["decision"])}><option value="PROCEED">Proceed</option><option value="HOLD">Hold</option><option value="DECLINE">Decline</option></select></label>
      <label className={styles.bookingField}><span>{en ? "Decision note (required for Decline)" : "Lý do (bắt buộc nếu từ chối)"}</span><textarea maxLength={1000} rows={2} value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} /></label>
      <button type="submit" className={styles.outline} disabled={busy || (decision === "DECLINE" && !decisionNote.trim())}>{en ? "Record decision" : "Ghi quyết định"}</button>
    </form>}
    {feedback.length > 0 && <div><strong>{en ? "Feedback received" : "Feedback đã nhận"}</strong>{feedback.map((row) => <p key={row.id}>{row.score}/5 · {row.recommendation}{row.summary ? " · " + row.summary : ""}</p>)}</div>}
    {decisions.map((row) => <p key={row.id} role="status">{en ? "Decision" : "Quyết định"}: {row.decision}{row.note ? " · " + row.note : ""}</p>)}
  </section>;
}

export default function BoschJobInterviews({ jobId, initialApplicationId, onAccessLost, onAllInterviews }: {
  jobId: string; initialApplicationId?: string; onAccessLost: () => void; onAllInterviews: () => void;
}) {
  const { locale } = useLanguage();
  const en = locale === "en";
  const statusText = (value: InterviewStatus) => en ? ({ SCHEDULED: "Scheduled", COMPLETED: "Completed", CANCELLED: "Cancelled" } as const)[value] : ({ SCHEDULED: "Đã lên lịch", COMPLETED: "Hoàn tất", CANCELLED: "Đã hủy" } as const)[value];
  const [status, setStatus] = useState<InterviewStatus>("SCHEDULED");
  const [items, setItems] = useState<InterviewWorklistItem[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [availabilityInterviewId, setAvailabilityInterviewId] = useState<string | null>(null);
  const [availabilitySlots, setAvailabilitySlots] = useState<InterviewBusySlot[]>([]);
  const [availabilityCalendars, setAvailabilityCalendars] = useState<InterviewGoogleCalendarStatus[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [applicationsError, setApplicationsError] = useState("");
  const [bookingApplicationId, setBookingApplicationId] = useState(initialApplicationId || "");
  const [roster, setRoster] = useState<InterviewRosterMember[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState("");
  const [bookingParticipantIds, setBookingParticipantIds] = useState<string[]>([]);
  const [bookingStart, setBookingStart] = useState("");
  const [bookingEnd, setBookingEnd] = useState("");
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [bookingWeekInterviews, setBookingWeekInterviews] = useState<InterviewWorklistItem[]>([]);
  const optimisticBookingIds = useRef(new Set<string>());
  const dragOrigin = useRef<{ day: string; index: number } | null>(null);
  const dragInvalid = useRef(false);
  const weekRowsRef = useRef<HTMLDivElement | null>(null);
  const weekCalendarRef = useRef<HTMLDivElement | null>(null);
  const [bookingType, setBookingType] = useState<"PHONE_SCREEN" | "INTERVIEW" | "FINAL">("INTERVIEW");
  const [bookingLocation, setBookingLocation] = useState("");
  const [bookingMeetingUrl, setBookingMeetingUrl] = useState("");
  const [bookingNote, setBookingNote] = useState("");
  const [weekAvailability, setWeekAvailability] = useState<{ signature: string; slots: InterviewBusySlot[]; calendars: InterviewGoogleCalendarStatus[] } | null>(null);
  const [weekAvailabilityBusy, setWeekAvailabilityBusy] = useState(false);
  const [weekAvailabilityError, setWeekAvailabilityError] = useState("");
  const [weekRefresh, setWeekRefresh] = useState(0);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState("");
  const [calendarSyncRetryId, setCalendarSyncRetryId] = useState<string | null>(null);
  const [calendarSyncBusy, setCalendarSyncBusy] = useState(false);
  const [reloadWorklist, setReloadWorklist] = useState(0);
  const version = useRef(0);
  const availabilityVersion = useRef(0);
  const eligibleApplications = applications.filter((item) => item.status === "ACTIVE" && ["SCREEN", "INTERVIEW"].includes(item.stage));
  const selectedApplication = eligibleApplications.find((item) => item.application_id === bookingApplicationId);
  const bookingTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Ho_Chi_Minh";
  const timezoneLabel = new Intl.DateTimeFormat("en", { timeZone: bookingTimezone, timeZoneName: "shortOffset" })
    .formatToParts(new Date()).find((part) => part.type === "timeZoneName")?.value || bookingTimezone;
  const calendarWeekStart = sundayOf(weekAnchor);
  const calendarWeekEnd = addDays(calendarWeekStart, 7);
  const weekSignature = `${bookingApplicationId}|${[...bookingParticipantIds].sort().join(",")}|${calendarWeekStart.toISOString()}|${calendarWeekEnd.toISOString()}|${bookingTimezone}`;
  const bookingStartMs = bookingStart ? new Date(bookingStart).getTime() : NaN;
  const bookingEndMs = bookingEnd ? new Date(bookingEnd).getTime() : NaN;
  const weekAvailabilityCurrent = weekAvailability?.signature === weekSignature;
  const bookingConflicts = weekAvailabilityCurrent && weekAvailability ? weekAvailability.slots.filter((slot) => overlaps(bookingStartMs, bookingEndMs, slot)) : [];
  const bookingCalendarStatuses = bookingParticipantIds.map((id) => weekAvailabilityCurrent ? weekAvailability?.calendars.find((entry) => entry.participant_id === id)?.status || "UNAVAILABLE" : "UNAVAILABLE");
  const bookingHasUnknownCalendar = !weekAvailabilityCurrent || bookingCalendarStatuses.some((value) => value !== "AVAILABLE");
  const organizerId = bookingParticipantIds[0];
  const organizerCanCreateEvents = Boolean(organizerId && weekAvailabilityCurrent && weekAvailability?.calendars.find((entry) => entry.participant_id === organizerId)?.can_create_events);
  const bookingWriteScopeRequired = weekAvailabilityCurrent && !bookingHasUnknownCalendar && !organizerCanCreateEvents;
  const canCreateBooking = Boolean(bookingApplicationId && bookingParticipantIds.length && Number.isFinite(bookingStartMs) && Number.isFinite(bookingEndMs) && bookingStartMs > Date.now() && bookingEndMs > bookingStartMs && weekAvailabilityCurrent && !bookingHasUnknownCalendar && organizerCanCreateEvents && bookingConflicts.length === 0);
  useEffect(() => {
    let active = true;
    setApplicationsLoading(true); setApplicationsError(""); setApplications([]); setBookingApplicationId(initialApplicationId || ""); setRoster([]); setBookingParticipantIds([]);
    void listApplications(jobId, 100, 0).then((result) => {
      if (!active) return;
      setApplications(result.applications);
    }).catch((cause) => {
      if (!active) return;
      setApplicationsError(cause instanceof Error ? cause.message : (en ? "Could not load eligible applications." : "Không tải được hồ sơ đủ điều kiện đặt lịch."));
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) onAccessLost();
    }).finally(() => { if (active) setApplicationsLoading(false); });
    return () => { active = false; };
  }, [jobId, initialApplicationId, en, onAccessLost]);
  useEffect(() => {
    let active = true;
    setRoster([]); setBookingParticipantIds([]); setRosterError(""); setWeekAvailability(null); setBookingSuccess("");
    if (!bookingApplicationId) return () => { active = false; };
    setRosterLoading(true);
    void listInterviewRoster(bookingApplicationId).then((people) => {
      if (active) setRoster(people);
    }).catch((cause) => {
      if (!active) return;
      setRosterError(cause instanceof Error ? cause.message : (en ? "Could not load interviewers." : "Không tải được danh sách người phỏng vấn."));
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) onAccessLost();
    }).finally(() => { if (active) setRosterLoading(false); });
    return () => { active = false; };
  }, [bookingApplicationId, en, onAccessLost]);
  useEffect(() => {
    let active = true;
    if (!bookingApplicationId || !bookingParticipantIds.length) {
      setWeekAvailability(null); setWeekAvailabilityError(""); setWeekAvailabilityBusy(false);
      return () => { active = false; };
    }
    setWeekAvailability(null); setWeekAvailabilityError(""); setWeekAvailabilityBusy(true);
    void listInterviewAvailability(bookingApplicationId, bookingParticipantIds, calendarWeekStart.toISOString(), calendarWeekEnd.toISOString(), bookingTimezone).then((result) => {
      if (active) setWeekAvailability({ signature: weekSignature, slots: result.busy_slots, calendars: result.google_calendars });
    }).catch((cause) => {
      if (!active) return;
      setWeekAvailability(null);
      setWeekAvailabilityError(cause instanceof Error ? cause.message : (en ? "Could not load this week's calendars." : "Không tải được lịch tuần này."));
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) onAccessLost();
    }).finally(() => { if (active) setWeekAvailabilityBusy(false); });
    return () => { active = false; };
  }, [bookingApplicationId, bookingParticipantIds, calendarWeekStart.getTime(), calendarWeekEnd.getTime(), bookingTimezone, weekSignature, weekRefresh, en, onAccessLost]);
  useEffect(() => {
    let active = true;
    if (!bookingApplicationId) {
      setBookingWeekInterviews([]);
      return () => { active = false; };
    }
    void listInterviewWorklist("SCHEDULED", 100, 0, bookingApplicationId).then((rows) => {
      if (active) setBookingWeekInterviews((current) => {
        const currentForApplication = current.filter((item) => item.application_id === bookingApplicationId);
        const serverIds = new Set(rows.map((item) => item.id));
        serverIds.forEach((id) => optimisticBookingIds.current.delete(id));
        return [...rows, ...currentForApplication.filter((item) => optimisticBookingIds.current.has(item.id) && !serverIds.has(item.id))];
      });
    }).catch((cause) => {
      if (!active) return;
      setBookingError(cause instanceof Error ? cause.message : (en ? "Could not load this candidate's scheduled interviews." : "Không tải được lịch đã đặt của ứng viên này."));
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) onAccessLost();
    });
    return () => { active = false; };
  }, [bookingApplicationId, reloadWorklist, en, onAccessLost]);
  useEffect(() => {
    const ticket = ++version.current;
    setBusy(true); setError(""); setHasNext(false);
    void listInterviewWorklist(status, LIMIT, offset).then((rows) => {
      if (ticket !== version.current) return;
      setHasNext(rows.length === LIMIT);
      const jobRows = rows.filter((row) => row.job_id === jobId);
      setItems(jobRows);
      setSelectedId((current) => current && jobRows.some((row) => row.id === current) ? current : null);
    }).catch((cause) => {
      if (ticket !== version.current) return;
      setError(cause instanceof Error ? cause.message : (en ? "Could not load interviews." : "Không tải được lịch phỏng vấn."));
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) onAccessLost();
    }).finally(() => { if (ticket === version.current) setBusy(false); });
    return () => { version.current += 1; };
  }, [jobId, status, offset, onAccessLost, reloadWorklist]);
  const active = items.find((item) => item.id === selectedId);
  const date = (value: string) => {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat(en ? "en-GB" : "vi-VN", {dateStyle:"medium", timeStyle:"short"}).format(d) : "—";
  };
  async function loadParticipantAvailability(item: InterviewWorklistItem) {
    const ticket = ++availabilityVersion.current;
    setAvailabilityInterviewId(item.id);
    setAvailabilitySlots([]);
    setAvailabilityCalendars([]);
    setAvailabilityError("");
    setAvailabilityLoading(true);
    const start = new Date(item.starts_at);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Ho_Chi_Minh";
      const result = await listInterviewAvailability(item.application_id, item.participants.map((person) => person.id), start.toISOString(), end.toISOString(), timezone);
      if (ticket === availabilityVersion.current) { setAvailabilitySlots(result.busy_slots); setAvailabilityCalendars(result.google_calendars); }
    } catch (cause) {
      if (ticket === availabilityVersion.current) {
        setAvailabilityError(cause instanceof Error ? cause.message : (en ? "Could not load participant schedules." : "Không tải được lịch của người tham gia."));
        if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) onAccessLost();
      }
    } finally {
      if (ticket === availabilityVersion.current) setAvailabilityLoading(false);
    }
  }
  async function submitBooking() {
    setBookingError(""); setBookingSuccess("");
    if (!canCreateBooking || !selectedApplication) {
      setBookingError(en ? "Choose an available time from the week calendar first." : "Hãy chọn một khung giờ còn trống trên lịch tuần trước.");
      return;
    }
    setBookingBusy(true);
    try {
      // Recheck immediately before writing so stale Google/ATS availability is not treated as free.
      const latest = await listInterviewAvailability(bookingApplicationId, bookingParticipantIds, new Date(bookingStartMs).toISOString(), new Date(bookingEndMs).toISOString(), bookingTimezone);
      const latestStatuses = bookingParticipantIds.map((id) => latest.google_calendars.find((entry) => entry.participant_id === id)?.status || "UNAVAILABLE");
      const latestConflicts = latest.busy_slots.filter((slot) => overlaps(bookingStartMs, bookingEndMs, slot));
      if (latestStatuses.some((value) => value !== "AVAILABLE")) {
        setBookingStart(""); setBookingEnd(""); setWeekRefresh((value) => value + 1);
        setBookingError(en ? "At least one interviewer’s Google calendar could not be verified. No interview was booked." : "Không xác minh được Google Calendar của ít nhất một người phỏng vấn. Chưa đặt lịch.");
        return;
      }
      if (latestConflicts.length) {
        setBookingStart(""); setBookingEnd(""); setWeekRefresh((value) => value + 1);
        setBookingError(en ? "The selected time now overlaps a busy period. Choose another time." : "Khung giờ vừa chọn đang trùng với lịch bận. Hãy chọn giờ khác.");
        return;
      }
      const created = await createInterview({
        request_id: crypto.randomUUID(), application_id: bookingApplicationId, participant_ids: bookingParticipantIds,
        starts_at: new Date(bookingStartMs).toISOString(), ends_at: new Date(bookingEndMs).toISOString(),
        interview_type: bookingType, timezone: bookingTimezone,
        location: bookingLocation.trim() || undefined, meeting_url: bookingMeetingUrl.trim() || undefined,
        notes: bookingNote.trim() || undefined,
      });
      const startsAt = new Date(bookingStartMs).toISOString();
      const endsAt = new Date(bookingEndMs).toISOString();
      const optimisticInterview: InterviewWorklistItem = {
        id: created.interview_id,
        application_id: bookingApplicationId,
        job_id: jobId,
        job_title: "Interview",
        job_code: null,
        candidate_name: selectedApplication.candidate_name,
        interview_type: bookingType,
        status: "SCHEDULED",
        starts_at: startsAt,
        ends_at: endsAt,
        timezone: bookingTimezone,
        location: bookingLocation.trim() || null,
        meeting_url: bookingMeetingUrl.trim() || null,
        can_manage: true,
        can_decide: false,
        is_participant: true,
        feedback_submitted: false,
        feedback_count: 0,
        participants: bookingParticipantIds.map((id) => {
          const person = roster.find((entry) => entry.id === id);
          return { id, display_name: person?.display_name || id, role: person?.role || "INTERVIEWER" };
        }),
      };
      optimisticBookingIds.current.add(optimisticInterview.id);
      setBookingWeekInterviews((current) => [optimisticInterview, ...current.filter((item) => item.id !== optimisticInterview.id)]);
      setBookingStart(""); setBookingEnd("");
      setWeekRefresh((value) => value + 1);
      if (created.calendar_sync.status === "SYNCED") {
        setBookingSuccess(en
          ? `Interview booked for ${selectedApplication.candidate_name}. Google Calendar event created and invitation emails requested.`
          : `Đã đặt lịch cho ${selectedApplication.candidate_name}. Google Calendar đã tạo sự kiện và gửi yêu cầu thư mời.`);
        setCalendarSyncRetryId(null);
      } else {
        setBookingSuccess(en
          ? `The ATS interview is saved, but Google Calendar sync failed (${created.calendar_sync.code || "unknown error"}). Retry the calendar sync below.`
          : `Lịch đã lưu trong ATS nhưng chưa đồng bộ Google Calendar (${created.calendar_sync.code || "lỗi chưa xác định"}). Hãy thử đồng bộ lại.`);
        setCalendarSyncRetryId(created.interview_id);
      }
      setReloadWorklist((value) => value + 1);
    } catch (cause) {
      setBookingError(cause instanceof Error ? cause.message : (en ? "Could not book this interview." : "Không đặt được lịch phỏng vấn."));
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) onAccessLost();
    } finally { setBookingBusy(false); }
  }
  async function retryGoogleSync() {
    if (!calendarSyncRetryId) return;
    setCalendarSyncBusy(true); setBookingError("");
    try {
      const result = await syncInterviewGoogleCalendar(calendarSyncRetryId);
      if (result.status === "SYNCED") {
        setBookingSuccess(en ? "Google Calendar event is synced and invitation emails were requested." : "Đã đồng bộ Google Calendar và gửi yêu cầu thư mời.");
        setCalendarSyncRetryId(null);
      } else {
        setBookingError(en ? `Google Calendar sync is still pending (${result.code || "unknown error"}).` : `Google Calendar vẫn chưa đồng bộ được (${result.code || "lỗi chưa xác định"}).`);
      }
    } catch (cause) {
      setBookingError(cause instanceof Error ? cause.message : (en ? "Could not retry Google Calendar sync." : "Không thể thử đồng bộ Google Calendar lần nữa."));
    } finally { setCalendarSyncBusy(false); }
  }
  const googleStatusLabel = (value: string) => en
    ? ({ AVAILABLE: "Google Calendar checked", NO_ACCESS: "Google access unavailable", NO_EMAIL: "Google email missing", NOT_CONFIGURED: "Google is not configured", NOT_CONNECTED: "Not connected", EMAIL_MISMATCH: "Google email does not match ATS", REAUTH_REQUIRED: "Reconnect Google Calendar", UNAVAILABLE: "Calendar could not be checked" } as Record<string, string>)[value] || "Calendar status unknown"
    : ({ AVAILABLE: "Đã kiểm tra Google Calendar", NO_ACCESS: "Không có quyền xem lịch Google", NO_EMAIL: "Thiếu email Google", NOT_CONFIGURED: "Google chưa được cấu hình", NOT_CONNECTED: "Chưa kết nối Google", EMAIL_MISMATCH: "Email Google không khớp ATS", REAUTH_REQUIRED: "Cần kết nối lại Google Calendar", UNAVAILABLE: "Không kiểm tra được lịch" } as Record<string, string>)[value] || "Không rõ trạng thái lịch";
  const calendarDays = Array.from({ length: 7 }, (_, index) => addDays(calendarWeekStart, index));
  const calendarCells = Array.from({ length: 28 }, (_, index) => index);
  const visibleBookingInterviews = bookingWeekInterviews.filter((item) =>
    item.application_id === bookingApplicationId && item.status === "SCHEDULED" && item.participants.some((person) => bookingParticipantIds.includes(person.id)) &&
    Date.parse(item.starts_at) < calendarWeekEnd.getTime() && Date.parse(item.ends_at) > calendarWeekStart.getTime());
  function applyCalendarRange(day: Date, firstIndex: number, lastIndex: number) {
    const startIndex = Math.min(firstIndex, lastIndex);
    const endIndex = Math.max(firstIndex, lastIndex) + 1;
    const startMinute = 7 * 60 + startIndex * 30;
    const endMinute = 7 * 60 + endIndex * 30;
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(startMinute / 60), startMinute % 60);
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(endMinute / 60), endMinute % 60);
    const invalid = start.getTime() <= Date.now() || endMinute > 21 * 60 ||
      !weekAvailabilityCurrent || bookingHasUnknownCalendar || weekAvailabilityBusy || Boolean(weekAvailabilityError) ||
      Boolean(weekAvailability?.slots.some((slot) => overlaps(start.getTime(), end.getTime(), slot)));
    if (invalid) return false;
    setBookingStart(localInputValue(start)); setBookingEnd(localInputValue(end)); setBookingError(""); setBookingSuccess("");
    return true;
  }
  function onCalendarPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-calendar-slot]") : null;
    if (!target || target.getAttribute("aria-disabled") === "true") return;
    const day = target.dataset.day;
    const index = Number(target.dataset.index);
    const date = calendarDays.find((value) => dateKey(value) === day);
    if (!date || !Number.isInteger(index)) return;
    event.preventDefault();
    dragOrigin.current = { day: day!, index };
    dragInvalid.current = false;
    if (weekRowsRef.current?.setPointerCapture) weekRowsRef.current.setPointerCapture(event.pointerId);
    applyCalendarRange(date, index, index);
  }
  function onCalendarPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragOrigin.current) return;
    const calendar = weekCalendarRef.current;
    if (calendar) {
      const bounds = calendar.getBoundingClientRect();
      if (event.clientY < bounds.top + 34 && calendar.scrollTop > 0) calendar.scrollTop = Math.max(0, calendar.scrollTop - 18);
      else if (event.clientY > bounds.bottom - 34) calendar.scrollTop += 18;
    }
    const target = document.elementFromPoint?.(event.clientX, event.clientY);
    const cell = target instanceof HTMLElement ? target.closest<HTMLElement>("[data-calendar-slot]") : null;
    if (!cell || cell.dataset.day !== dragOrigin.current.day) return;
    const date = calendarDays.find((value) => dateKey(value) === dragOrigin.current?.day);
    const index = Number(cell.dataset.index);
    if (!date || !Number.isInteger(index)) return;
    dragInvalid.current = !applyCalendarRange(date, dragOrigin.current.index, index);
  }
  function onCalendarPointerUp() {
    if (dragInvalid.current) {
      setBookingStart(""); setBookingEnd("");
      setBookingError(en ? "That range includes a busy or unavailable time. Drag across free slots only." : "Khung giờ có giờ bận hoặc chưa xác minh. Hãy kéo qua các ô trống đã xác minh.");
    }
    dragOrigin.current = null;
    dragInvalid.current = false;
  }
  function shiftCalendarWeek(amount: number) {
    setWeekAnchor((current) => addDays(current, amount * 7));
    setBookingStart(""); setBookingEnd(""); setBookingError("");
  }
  return <section className={styles.aux} aria-label={en ? "Job interviews" : "Phỏng vấn theo Job"}>
    <div className={styles.sectionHead}><div><h2>{en ? "Interview Schedule" : "Lịch phỏng vấn theo Job"}</h2><p>{en ? "Read-only schedule records from your authorized worklist." : "Lịch theo quyền truy cập của bạn; không thay đổi lịch hay feedback."}</p></div>
      <button className={styles.outline} type="button" onClick={onAllInterviews}>{en ? "Full interview worklist" : "Mở lịch phỏng vấn"} </button></div>
    <section className={styles.bookingPanel} aria-label={en ? "Book an interview" : "Đặt lịch phỏng vấn"}>
      <div><h3>{en ? "Book an interview" : "Đặt lịch phỏng vấn"}</h3><p>{en ? "Choose a candidate and interviewers first. The week calendar shows their Google and ATS busy times so you can pick a free slot." : "Chọn ứng viên và người phỏng vấn trước. Lịch tuần sẽ hiện giờ bận từ Google và ATS để bạn chọn khung giờ trống."}</p></div>
      {applicationsError && <p role="alert" className={styles.error}>{applicationsError}</p>}
      {applicationsLoading ? <p role="status">{en ? "Loading eligible applications…" : "Đang tải hồ sơ đủ điều kiện…"}</p> : eligibleApplications.length === 0 ?
        <p className={styles.empty}>{en ? "No active application is at Screening or Interview stage for this Job." : "Job này chưa có hồ sơ đang hoạt động ở vòng Sơ loại hoặc Phỏng vấn."}</p> : <>
        <div className={styles.bookingGrid}>
          {initialApplicationId && bookingApplicationId === initialApplicationId && selectedApplication ? <div className={`${styles.bookingField} ${styles.bookingSelectedCandidate}`} aria-label={en ? "Selected candidate" : "Ứng viên đã chọn"}>
            <span>{en ? "Candidate" : "Ứng viên"}</span><strong>{selectedApplication.candidate_name}</strong><small>{en ? "Interview stage · selected from this Job’s Pipeline" : "Vòng Phỏng vấn · đã chọn từ Pipeline của Job"}</small>
            <button type="button" className={styles.changeCandidate} onClick={() => { setBookingApplicationId(""); setBookingStart(""); setBookingEnd(""); setBookingError(""); }}>{en ? "Choose another" : "Chọn ứng viên khác"}</button>
          </div> : <label className={styles.bookingField}><span>{en ? "Candidate" : "Ứng viên"}</span><select value={bookingApplicationId} onChange={(event) => { setBookingApplicationId(event.target.value); setBookingStart(""); setBookingEnd(""); setBookingError(""); }}>
            <option value="">{en ? "Choose a candidate" : "Chọn ứng viên"}</option>
            {eligibleApplications.map((item) => <option key={item.application_id} value={item.application_id}>{item.candidate_name} · {item.stage === "SCREEN" ? (en ? "Screening" : "Sơ loại") : (en ? "Interview" : "Phỏng vấn")}</option>)}
          </select></label>}
          <label className={styles.bookingField}><span>{en ? "Interview type" : "Loại phỏng vấn"}</span><select value={bookingType} onChange={(event) => setBookingType(event.target.value as typeof bookingType)}>
            <option value="PHONE_SCREEN">{en ? "Phone screen" : "Sơ loại qua điện thoại"}</option><option value="INTERVIEW">{en ? "Interview" : "Phỏng vấn"}</option><option value="FINAL">{en ? "Final interview" : "Phỏng vấn cuối"}</option>
          </select></label>
          <label className={styles.bookingField}><span>{en ? "Location (optional)" : "Địa điểm (không bắt buộc)"}</span><input maxLength={240} value={bookingLocation} onChange={(event) => setBookingLocation(event.target.value)} /></label>
          <label className={styles.bookingField}><span>{en ? "Meeting link (optional)" : "Link họp (không bắt buộc)"}</span><input type="url" maxLength={2048} value={bookingMeetingUrl} onChange={(event) => setBookingMeetingUrl(event.target.value)} /></label>
        </div>
        <fieldset className={styles.bookingParticipants}><legend>{en ? "Interviewers / Hiring Managers" : "Người phỏng vấn / Hiring Manager"}</legend>
          {rosterLoading ? <p role="status">{en ? "Loading job team…" : "Đang tải nhóm Job…"}</p> : rosterError ? <p role="alert" className={styles.error}>{rosterError}</p> : roster.length === 0 ? <p className={styles.empty}>{en ? "No interviewer or hiring manager is assigned to this Job." : "Job chưa được phân quyền Interviewer hoặc Hiring Manager."}</p> : roster.map((person) => <label key={person.id}><input type="checkbox" checked={bookingParticipantIds.includes(person.id)} onChange={(event) => { setBookingParticipantIds((current) => event.target.checked ? [...current, person.id] : current.filter((id) => id !== person.id)); setBookingStart(""); setBookingEnd(""); setBookingError(""); }} /><span>{person.display_name}</span><small>{person.role === "HIRING_MANAGER" ? "Hiring Manager" : "Interviewer"}</small></label>)}
        </fieldset>
        <section className={styles.weekAvailability} aria-label={en ? "Weekly participant availability" : "Lịch bận/rảnh trong tuần"}>
          <div className={styles.weekToolbar}>
            <strong>{en ? "Choose a time" : "Chọn giờ phỏng vấn"}</strong>
            <div className={styles.weekControls}>
              <button type="button" className={styles.outline} onClick={() => shiftCalendarWeek(-1)} aria-label={en ? "Previous week" : "Tuần trước"}>‹</button>
              <button type="button" className={styles.outline} onClick={() => { setWeekAnchor(new Date()); setBookingStart(""); setBookingEnd(""); }}>{en ? "Today" : "Tuần này"}</button>
              <button type="button" className={styles.outline} onClick={() => shiftCalendarWeek(1)} aria-label={en ? "Next week" : "Tuần sau"}>›</button>
            </div>
            <span>{new Intl.DateTimeFormat(en ? "en-GB" : "vi-VN", { day: "numeric", month: "short" }).format(calendarWeekStart)} – {new Intl.DateTimeFormat(en ? "en-GB" : "vi-VN", { dateStyle: "medium" }).format(addDays(calendarWeekEnd, -1))}</span>
          </div>
          <p className={styles.weekTimezone}>{en ? "Displayed in" : "Giờ hiển thị theo"} {bookingTimezone}. {en ? "Google events show busy/free only. Drag across free 30-minute cells to choose both start and end." : "Sự kiện Google riêng tư chỉ hiện bận/rảnh. Kéo qua các ô trống 30 phút để chọn cả giờ bắt đầu và kết thúc."}</p>
          {bookingParticipantIds.length > 0 && <div className={styles.weekPeople}>
            {bookingParticipantIds.map((id) => {
              const person = roster.find((entry) => entry.id === id);
              const calendar = weekAvailabilityCurrent ? weekAvailability?.calendars.find((entry) => entry.participant_id === id) : undefined;
              const statusValue = calendar?.status || "UNAVAILABLE";
              const hint = id === organizerId && statusValue === "AVAILABLE" && !calendar?.can_create_events
                ? (en ? "This interviewer must reconnect to allow ATS to create events." : "Người phỏng vấn này cần kết nối lại để ATS được tạo lịch.")
                : statusValue === "NOT_CONNECTED"
                  ? (en ? "This person must connect Google Calendar from their ATS account." : "Người này cần tự kết nối Google Calendar trong tài khoản ATS.")
                  : "";
              return <div className={styles.weekPerson} key={id}><strong>{person?.display_name || id}</strong><span>{weekAvailabilityBusy ? (en ? "Checking…" : "Đang kiểm tra…") : googleStatusLabel(statusValue)}</span>{hint && <small>{hint}</small>}</div>;
            })}
          </div>}
          {weekAvailabilityError && <p role="alert" className={styles.error}>{weekAvailabilityError}</p>}
          <div className={styles.weekLegend}><span><i className={styles.legendGoogle} />Google Busy</span><span><i className={styles.legendAts} />{en ? "ATS interview" : "Lịch phỏng vấn ATS"}</span><span><i className={styles.legendSelected} />{en ? "Selected" : "Đang chọn"}</span></div>
          {bookingApplicationId && bookingParticipantIds.length > 0 ? <div ref={weekCalendarRef} className={styles.weekCalendar}>
            <div className={styles.weekHeader}><span title={bookingTimezone}>{timezoneLabel}</span>{calendarDays.map((day) => <strong key={dateKey(day)}><small>{new Intl.DateTimeFormat(en ? "en-GB" : "vi-VN", { weekday: "short" }).format(day)}</small>{new Intl.DateTimeFormat(en ? "en-GB" : "vi-VN", { day: "numeric", month: "numeric" }).format(day)}</strong>)}</div>
            <div ref={weekRowsRef} className={styles.weekRows} data-calendar-rows="true" onPointerDown={onCalendarPointerDown} onPointerMove={onCalendarPointerMove} onPointerUp={onCalendarPointerUp} onPointerCancel={onCalendarPointerUp}>
              {calendarCells.map((index) => {
                const minute = 7 * 60 + index * 30;
                const timeLabel = String(Math.floor(minute / 60)).padStart(2, "0") + ":" + String(minute % 60).padStart(2, "0");
                return <div className={styles.weekRow} key={timeLabel}><span className={styles.weekTime}>{timeLabel}</span>{calendarDays.map((day) => {
                  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minute / 60), minute % 60);
                  const end = new Date(start.getTime() + 30 * 60_000);
                  const rangeOk = end.getHours() < 21 || (end.getHours() === 21 && end.getMinutes() === 0);
                  const cellSlots = weekAvailabilityCurrent && weekAvailability ? weekAvailability.slots.filter((slot) => overlaps(start.getTime(), end.getTime(), slot)) : [];
                  const cellInterviews = visibleBookingInterviews.filter((item) => Date.parse(item.starts_at) < end.getTime() && Date.parse(item.ends_at) > start.getTime());
                  const past = start.getTime() <= Date.now();
                  const selected = Boolean(bookingStart && new Date(bookingStart).getTime() < end.getTime() && new Date(bookingEnd).getTime() > start.getTime());
                  const selectedStart = selected && start.getTime() === bookingStartMs;
                  const selectedEnd = selected && end.getTime() === bookingEndMs;
                  const unknown = !weekAvailabilityCurrent || bookingHasUnknownCalendar || weekAvailabilityBusy || Boolean(weekAvailabilityError);
                  const disabled = past || unknown || !rangeOk || cellSlots.length > 0;
                  const hasGoogle = cellSlots.some((slot) => slot.source === "GOOGLE");
                  const hasAts = cellSlots.some((slot) => slot.source === "ATS");
                  const source = hasGoogle && hasAts ? "Google + ATS" : hasGoogle ? "Google Busy" : cellSlots.length ? (en ? "ATS busy" : "ATS bận") : "";
                  const people = cellSlots.map((slot) => roster.find((person) => person.id === slot.participant_id)?.display_name || "").filter(Boolean).join(", ");
                  const title = cellInterviews.length ? (en ? `Interview · ${cellInterviews.map((item) => item.candidate_name).join(", ")}` : `Phỏng vấn · ${cellInterviews.map((item) => item.candidate_name).join(", ")}`) : cellSlots.length ? source + (people ? ": " + people : "") : unknown ? (en ? "Calendar availability is not verified" : "Chưa xác minh được lịch") : timeLabel;
                  const classes = [styles.weekCell, unknown && !past ? styles.weekUnknown : "", selected ? styles.weekSelected : "", selectedStart ? styles.weekSelectedStart : "", selectedEnd ? styles.weekSelectedEnd : ""].filter(Boolean).join(" ");
                  return <button key={`${dateKey(day)}-${index}`} type="button" data-calendar-slot="true" data-day={dateKey(day)} data-index={index} data-range-selected={selected || undefined} data-selected-start={selectedStart || undefined} data-selected-end={selectedEnd || undefined} aria-disabled={disabled} className={classes} disabled={disabled} title={selectedStart ? `${en ? "Starts" : "Bắt đầu"} ${timeLabel}` : selectedEnd ? `${en ? "Ends" : "Kết thúc"} ${String(Math.floor((minute + 30) / 60)).padStart(2, "0")}:${String((minute + 30) % 60).padStart(2, "0")}` : title} aria-label={new Intl.DateTimeFormat(en ? "en-GB" : "vi-VN", { dateStyle: "full" }).format(day) + " " + timeLabel + (cellInterviews.length ? ", " + title : source ? ", " + source : "")} onClick={(event) => { if (event.detail === 0) applyCalendarRange(day, index, index); }} />;
                })}</div>;
              })}
              <div className={styles.weekEventLayer} aria-hidden="true">
                {calendarDays.flatMap((day, dayIndex) => {
                  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 7, 0).getTime();
                  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 21, 0).getTime();
                  const formatTime = (value: number) => new Intl.DateTimeFormat(en ? "en-US" : "vi-VN", { hour: "2-digit", minute: "2-digit", hour12: en, timeZone: bookingTimezone }).format(new Date(value));
                  const left = `calc(58px + ((100% - 58px) / 7 * ${dayIndex}) + 3px)`;
                  const width = "calc((100% - 58px) / 7 - 6px)";
                  const card = (key: string, start: number, end: number, title: string, kind: "google" | "ats" | "selected") => {
                    const clippedStart = Math.max(start, dayStart);
                    const clippedEnd = Math.min(end, dayEnd);
                    if (clippedEnd <= clippedStart) return null;
                    const top = (clippedStart - dayStart) / 60_000 * (32 / 30);
                    const height = (clippedEnd - clippedStart) / 60_000 * (32 / 30);
                    return <div key={key} className={`${styles.weekEvent} ${kind === "google" ? styles.weekEventGoogle : kind === "ats" ? styles.weekEventAts : styles.weekEventSelected}`} data-calendar-event={kind} style={{ top, height: Math.max(height, 24), left, width }}>
                      <strong>{title}</strong><small>{formatTime(start)}–{formatTime(end)}</small>
                    </div>;
                  };
                  const dayInterviews = visibleBookingInterviews.filter((item) => {
                    const starts = Date.parse(item.starts_at); const ends = Date.parse(item.ends_at);
                    return starts < dayEnd && ends > dayStart;
                  });
                  const interviewCards = dayInterviews.map((item) => {
                    const starts = Date.parse(item.starts_at); const ends = Date.parse(item.ends_at);
                    return card(`interview-${item.id}-${dayIndex}`, starts, ends, `${en ? "Interview" : "Phỏng vấn"} | ${item.job_code || item.candidate_name}`, "ats");
                  });
                  const busyCards = (weekAvailabilityCurrent ? weekAvailability?.slots || [] : [])
                    .filter((slot) => bookingParticipantIds.includes(slot.participant_id))
                    .filter((slot) => Date.parse(slot.starts_at) < dayEnd && Date.parse(slot.ends_at) > dayStart)
                    .filter((slot) => slot.source !== "ATS" || !dayInterviews.some((item) => Date.parse(item.starts_at) < Date.parse(slot.ends_at) && Date.parse(item.ends_at) > Date.parse(slot.starts_at)))
                    .map((slot) => card(`${slot.source}-${slot.participant_id}-${slot.starts_at}-${dayIndex}`, Date.parse(slot.starts_at), Date.parse(slot.ends_at), slot.source === "GOOGLE" ? (en ? "Busy" : "Bận") : (en ? "ATS busy" : "ATS bận"), slot.source === "GOOGLE" ? "google" : "ats"));
                  const selectedStartDate = bookingStart ? new Date(bookingStart) : null;
                  const selectedEndDate = bookingEnd ? new Date(bookingEnd) : null;
                  const selectedCard = selectedStartDate && selectedEndDate && dateKey(selectedStartDate) === dateKey(day)
                    ? card(`selected-${dayIndex}`, selectedStartDate.getTime(), selectedEndDate.getTime(), `${en ? "Interview" : "Phỏng vấn"} | ${selectedApplication?.candidate_name || ""}`, "selected")
                    : null;
                  return [...busyCards, ...interviewCards, selectedCard];
                })}
              </div>
            </div>
          </div> : <p className={styles.empty}>{en ? "Choose a candidate and at least one interviewer to load the week." : "Chọn ứng viên và ít nhất một người phỏng vấn để xem lịch tuần."}</p>}
        </section>
        <label className={styles.bookingField}><span>{en ? "Notes (optional)" : "Ghi chú (không bắt buộc)"}</span><textarea maxLength={4000} rows={3} value={bookingNote} onChange={(event) => setBookingNote(event.target.value)} /></label>
        <p className={styles.bookingNotice}>{en ? "Google Calendar creates the event on the first selected interviewer’s primary calendar. The backend checks the chosen time again before saving." : "Google Calendar sẽ tạo sự kiện trên lịch chính của người phỏng vấn đầu tiên. Backend kiểm tra lại khung giờ ngay trước khi lưu."}</p>
        {bookingError && <p role="alert" className={styles.error}>{bookingError}</p>}{bookingSuccess && <p role="status" className={styles.bookingSuccess}>{bookingSuccess}</p>}
        {bookingWriteScopeRequired && <p role="alert" className={styles.error}>{en ? "The first selected interviewer must reconnect Google and grant permission to create events." : "Người phỏng vấn đầu tiên cần kết nối lại Google và cấp quyền tạo sự kiện."}</p>}
        <div className={styles.bookingActions}>
          <button className={styles.bookButton} type="button" disabled={bookingBusy || !canCreateBooking} onClick={() => void submitBooking()}>{bookingBusy ? (en ? "Booking…" : "Đang đặt lịch…") : (en ? "Book & send invitation" : "Đặt lịch và gửi thư mời")}</button>
        </div>
        {calendarSyncRetryId && <button className={styles.outline} type="button" disabled={calendarSyncBusy} onClick={() => void retryGoogleSync()}>{calendarSyncBusy ? (en ? "Retrying…" : "Đang đồng bộ lại…") : (en ? "Retry Google Calendar sync" : "Thử đồng bộ Google Calendar lại")}</button>}
      </>}
    </section>
    <div className={styles.subTabs} role="group" aria-label={en ? "Interview status" : "Trạng thái phỏng vấn"}>
      {statuses.map((value) => <button key={value} type="button" aria-pressed={status === value} className={status === value ? styles.currentSubTab : ""}
        onClick={() => { setStatus(value); setOffset(0); }}>{statusText(value)}</button>)}
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {busy ? <p role="status">{en ? "Loading schedule…" : "Đang tải lịch…"}</p> :
      <div className={styles.twoColumn}>
        <div className={styles.tableScroll}><table className={styles.nativeTable}><thead><tr><th>{en ? "Candidate" : "Ứng viên"}</th><th>{en ? "Start" : "Bắt đầu"}</th><th>{en ? "Round / Type" : "Loại lịch"}</th></tr></thead>
          <tbody>{items.map((item) => <tr key={item.id}><td><button className={styles.linkButton} aria-pressed={selectedId === item.id} type="button" onClick={() => setSelectedId(item.id)}>{item.candidate_name}</button></td>
            <td>{date(item.starts_at)}</td><td>{item.interview_type}</td></tr>)}</tbody></table>
          {!items.length && !error && <p className={styles.empty}>{en ? "No matching appointments on this API page." : "Không có lịch thuộc Job này trong trang dữ liệu hiện tại."}</p>}
        </div>
        <aside className={styles.detailPane} aria-label={en ? "Schedule details" : "Chi tiết lịch"}>
          <h3>{active?.candidate_name || (en ? "Interview Details" : "Thông tin lịch phỏng vấn")}</h3>
          {active ? <dl className={styles.facts}>
            <dt>{en ? "Status" : "Trạng thái"}</dt><dd>{statusText(active.status)}</dd>
            <dt>{en ? "Start" : "Bắt đầu"}</dt><dd>{date(active.starts_at)}</dd>
            <dt>{en ? "End" : "Kết thúc"}</dt><dd>{date(active.ends_at)}</dd>
            <dt>{en ? "Location" : "Địa điểm"}</dt><dd>{active.location || "—"}</dd>
            <dt>{en ? "Feedback" : "Đánh giá"}</dt><dd>{active.feedback_count}</dd>
            <dt>{en ? "Interviewers" : "Người phỏng vấn"}</dt><dd>{active.participants?.map((p) => p.display_name).join(", ") || "—"}</dd>
          </dl> : <p className={styles.empty}>{en ? "Select an interview." : "Chọn một lịch để xem chi tiết."}</p>}
          {active?.can_manage && active.participants?.length > 0 && <div className={styles.availability}>
            <button className={styles.outline} type="button" disabled={availabilityLoading} onClick={() => void loadParticipantAvailability(active)}>
              {availabilityLoading ? (en ? "Loading schedules…" : "Đang tải lịch…") : (en ? "Check Google and ATS availability" : "Kiểm tra lịch Google và ATS của người tham gia")}
            </button>
            <p>{en ? "Shows Google Calendar Free/Busy and ATS appointments for the 7 days starting on this interview date. Event details are never shown." : "Hiển thị giờ Busy từ Google Calendar và lịch ATS trong 7 ngày tính từ ngày phỏng vấn. Không hiển thị nội dung sự kiện."}</p>
            {availabilityInterviewId === active.id && availabilityLoading && <p role="status">{en ? "Loading busy times…" : "Đang tải các khung giờ bận…"}</p>}
            {availabilityInterviewId === active.id && availabilityError && <p className={styles.error} role="alert">{availabilityError}</p>}
            {availabilityInterviewId === active.id && !availabilityLoading && !availabilityError && active.participants.map((person) => {
              const blocks = availabilitySlots.filter((slot) => slot.participant_id === person.id);
              const googleStatus = availabilityCalendars.find((entry) => entry.participant_id === person.id)?.status || "UNAVAILABLE";
              const googleBlocks = blocks.filter((slot) => slot.source === "GOOGLE");
              const atsBlocks = blocks.filter((slot) => slot.source === "ATS");
              const googleLabel = en
                ? ({ AVAILABLE: "Google Calendar checked", NO_ACCESS: "Google Calendar access unavailable", NO_EMAIL: "Google account email not found", NOT_CONFIGURED: "Google connection is not configured", NOT_CONNECTED: "Interviewer has not connected Google Calendar", EMAIL_MISMATCH: "Google email does not match ATS account", REAUTH_REQUIRED: "Google connection expired; reconnect required", UNAVAILABLE: "Google Calendar could not be checked" } as const)[googleStatus]
                : ({ AVAILABLE: "Đã kiểm tra Google Calendar", NO_ACCESS: "Google không cho phép xem lịch", NO_EMAIL: "Không tìm thấy email Google", NOT_CONFIGURED: "Chưa cấu hình kết nối Google", NOT_CONNECTED: "Interviewer chưa kết nối Google Calendar", EMAIL_MISMATCH: "Email Google không khớp email ATS", REAUTH_REQUIRED: "Kết nối Google hết hạn, cần kết nối lại", UNAVAILABLE: "Không kiểm tra được Google Calendar" } as const)[googleStatus];
              return <div className={styles.availabilityPerson} key={person.id}>
                <strong>{person.display_name}</strong>
                <span>{googleLabel}</span>
                {googleStatus === "AVAILABLE" && googleBlocks.length === 0 && <span>{en ? "No busy Google Calendar events in this period." : "Google Calendar không có giờ bận trong khoảng này."}</span>}
                {googleBlocks.map((slot) => <span key={"google-" + slot.participant_id + "-" + slot.starts_at}>{date(slot.starts_at)} – {date(slot.ends_at)} · Google Busy</span>)}
                {atsBlocks.map((slot) => <span key={"ats-" + slot.participant_id + "-" + slot.starts_at}>{date(slot.starts_at)} – {date(slot.ends_at)} · {en ? "ATS appointment" : "Lịch hẹn ATS"}</span>)}
              </div>;
            })}
          </div>}
          {active && <InterviewLifecycleActions
            key={active.id}
            item={active}
            en={en}
            onChanged={() => setReloadWorklist((value) => value + 1)}
            onAccessLost={onAccessLost}
          />}
        </aside>
      </div>}
    <div className={styles.pager}><span>{en ? "Worklist page" : "Trang lịch tổng"} {Math.floor(offset / LIMIT) + 1}</span>
      <button className={styles.outline} type="button" disabled={busy || offset === 0} onClick={() => setOffset(offset - LIMIT)}>{en ? "Previous" : "Trước"}</button>
      <button className={styles.outline} type="button" disabled={busy || !hasNext} onClick={() => setOffset(offset + LIMIT)}>{en ? "Next" : "Tiếp"}</button>
    </div>
    <p className={styles.footnote}>{en ? "The API only paginates the global authorized worklist, not by Job. This tab may omit other Job appointments; use Full interview worklist for a complete search." : "API hiện phân trang lịch tổng, chưa lọc theo Job tại máy chủ. Tab này có thể thiếu lịch; hãy mở lịch tổng để kiểm tra đầy đủ."}</p>
  </section>;
}
