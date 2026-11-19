"use client";

import { useEffect, useRef, useState } from "react";
import { listApplications, type Application } from "@/lib/applications";
import { createInterview, listInterviewAvailability, listInterviewRoster, listInterviewWorklist, type InterviewBusySlot, type InterviewGoogleCalendarStatus, type InterviewRosterMember, type InterviewStatus, type InterviewWorklistItem } from "@/lib/interviews";
import { ApiError } from "@/lib/supabase";
import { useLanguage } from "./language";
import styles from "./bosch-v2-job-detail.module.css";
const LIMIT = 25;
const statuses: InterviewStatus[] = ["SCHEDULED", "COMPLETED", "CANCELLED"];
function localInputValue(value: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}
function defaultInterviewTimes() {
  const start = new Date(); start.setDate(start.getDate() + 1); start.setHours(9, 0, 0, 0);
  const end = new Date(start); end.setHours(end.getHours() + 1);
  return { start: localInputValue(start), end: localInputValue(end) };
}
function overlaps(start: number, end: number, slot: InterviewBusySlot) {
  const busyStart = Date.parse(slot.starts_at); const busyEnd = Date.parse(slot.ends_at);
  return Number.isFinite(busyStart) && Number.isFinite(busyEnd) && busyStart < end && busyEnd > start;
}
export default function BoschJobInterviews({ jobId, onAccessLost, onAllInterviews }: {
  jobId: string; onAccessLost: () => void; onAllInterviews: () => void;
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
  const initialTimes = defaultInterviewTimes();
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [applicationsError, setApplicationsError] = useState("");
  const [bookingApplicationId, setBookingApplicationId] = useState("");
  const [roster, setRoster] = useState<InterviewRosterMember[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState("");
  const [bookingParticipantIds, setBookingParticipantIds] = useState<string[]>([]);
  const [bookingStart, setBookingStart] = useState(initialTimes.start);
  const [bookingEnd, setBookingEnd] = useState(initialTimes.end);
  const [bookingType, setBookingType] = useState<"PHONE_SCREEN" | "INTERVIEW" | "FINAL">("INTERVIEW");
  const [bookingLocation, setBookingLocation] = useState("");
  const [bookingMeetingUrl, setBookingMeetingUrl] = useState("");
  const [bookingNote, setBookingNote] = useState("");
  const [bookingAvailability, setBookingAvailability] = useState<{ signature: string; slots: InterviewBusySlot[]; calendars: InterviewGoogleCalendarStatus[] } | null>(null);
  const [bookingAvailabilityBusy, setBookingAvailabilityBusy] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState("");
  const [reloadWorklist, setReloadWorklist] = useState(0);
  const version = useRef(0);
  const availabilityVersion = useRef(0);
  const bookingAvailabilityVersion = useRef(0);
  const eligibleApplications = applications.filter((item) => item.status === "ACTIVE" && ["SCREEN", "INTERVIEW"].includes(item.stage));
  const selectedApplication = eligibleApplications.find((item) => item.application_id === bookingApplicationId);
  const bookingTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Ho_Chi_Minh";
  const bookingSignature = `${bookingApplicationId}|${[...bookingParticipantIds].sort().join(",")}|${bookingStart}|${bookingEnd}|${bookingTimezone}`;
  const bookingStartMs = new Date(bookingStart).getTime();
  const bookingEndMs = new Date(bookingEnd).getTime();
  const bookingCheckCurrent = bookingAvailability?.signature === bookingSignature;
  const bookingConflicts = bookingCheckCurrent && bookingAvailability ? bookingAvailability.slots.filter((slot) => overlaps(bookingStartMs, bookingEndMs, slot)) : [];
  const bookingCalendarStatuses = bookingParticipantIds.map((id) => bookingAvailability?.calendars.find((entry) => entry.participant_id === id)?.status || "UNAVAILABLE");
  const bookingHasUnknownCalendar = !bookingCheckCurrent || bookingCalendarStatuses.some((value) => value !== "AVAILABLE");
  const canCreateBooking = Boolean(bookingApplicationId && bookingParticipantIds.length && Number.isFinite(bookingStartMs) && Number.isFinite(bookingEndMs) && bookingStartMs > Date.now() && bookingEndMs > bookingStartMs && bookingCheckCurrent && !bookingHasUnknownCalendar && bookingConflicts.length === 0);
  useEffect(() => {
    let active = true;
    setApplicationsLoading(true); setApplicationsError(""); setApplications([]); setBookingApplicationId(""); setRoster([]); setBookingParticipantIds([]);
    void listApplications(jobId, 100, 0).then((result) => {
      if (!active) return;
      setApplications(result.applications);
    }).catch((cause) => {
      if (!active) return;
      setApplicationsError(cause instanceof Error ? cause.message : (en ? "Could not load eligible applications." : "Không tải được hồ sơ đủ điều kiện đặt lịch."));
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) onAccessLost();
    }).finally(() => { if (active) setApplicationsLoading(false); });
    return () => { active = false; };
  }, [jobId, en, onAccessLost]);
  useEffect(() => {
    let active = true;
    setRoster([]); setBookingParticipantIds([]); setRosterError(""); setBookingAvailability(null); setBookingSuccess("");
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
    const ticket = ++version.current;
    setBusy(true); setError(""); setItems([]); setHasNext(false); setSelectedId(null);
    void listInterviewWorklist(status, LIMIT, offset).then((rows) => {
      if (ticket !== version.current) return;
      setHasNext(rows.length === LIMIT);
      setItems(rows.filter((row) => row.job_id === jobId));
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
  async function checkBookingAvailability() {
    setBookingError(""); setBookingSuccess(""); setBookingAvailability(null);
    if (!bookingApplicationId || !bookingParticipantIds.length || !Number.isFinite(bookingStartMs) || !Number.isFinite(bookingEndMs) || bookingStartMs <= Date.now() || bookingEndMs <= bookingStartMs) {
      setBookingError(en ? "Choose an eligible application, at least one interviewer, and a future time range." : "Chọn hồ sơ đủ điều kiện, ít nhất một người phỏng vấn và khung giờ trong tương lai.");
      return;
    }
    const ticket = ++bookingAvailabilityVersion.current;
    setBookingAvailabilityBusy(true);
    try {
      const result = await listInterviewAvailability(bookingApplicationId, bookingParticipantIds, new Date(bookingStartMs).toISOString(), new Date(bookingEndMs).toISOString(), bookingTimezone);
      if (ticket === bookingAvailabilityVersion.current) setBookingAvailability({ signature: bookingSignature, slots: result.busy_slots, calendars: result.google_calendars });
    } catch (cause) {
      if (ticket === bookingAvailabilityVersion.current) {
        setBookingError(cause instanceof Error ? cause.message : (en ? "Could not check calendars." : "Không kiểm tra được lịch."));
        if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) onAccessLost();
      }
    } finally { if (ticket === bookingAvailabilityVersion.current) setBookingAvailabilityBusy(false); }
  }
  async function submitBooking() {
    setBookingError(""); setBookingSuccess("");
    if (!canCreateBooking || !selectedApplication) {
      setBookingError(en ? "Check availability again. The selected time or participants changed." : "Hãy kiểm tra lịch lại. Khung giờ hoặc người tham gia đã thay đổi.");
      return;
    }
    setBookingBusy(true);
    try {
      // Recheck immediately before writing so stale Google/ATS availability is not treated as free.
      const latest = await listInterviewAvailability(bookingApplicationId, bookingParticipantIds, new Date(bookingStartMs).toISOString(), new Date(bookingEndMs).toISOString(), bookingTimezone);
      const latestStatuses = bookingParticipantIds.map((id) => latest.google_calendars.find((entry) => entry.participant_id === id)?.status || "UNAVAILABLE");
      const latestConflicts = latest.busy_slots.filter((slot) => overlaps(bookingStartMs, bookingEndMs, slot));
      if (latestStatuses.some((value) => value !== "AVAILABLE")) {
        setBookingAvailability({ signature: bookingSignature, slots: latest.busy_slots, calendars: latest.google_calendars });
        setBookingError(en ? "At least one interviewer’s Google calendar could not be verified. No interview was booked." : "Không xác minh được Google Calendar của ít nhất một người phỏng vấn. Chưa đặt lịch.");
        return;
      }
      if (latestConflicts.length) {
        setBookingAvailability({ signature: bookingSignature, slots: latest.busy_slots, calendars: latest.google_calendars });
        setBookingError(en ? "The selected time now overlaps a busy period. Choose another time." : "Khung giờ vừa chọn đang trùng với lịch bận. Hãy chọn giờ khác.");
        return;
      }
      await createInterview({
        request_id: crypto.randomUUID(), application_id: bookingApplicationId, participant_ids: bookingParticipantIds,
        starts_at: new Date(bookingStartMs).toISOString(), ends_at: new Date(bookingEndMs).toISOString(),
        interview_type: bookingType, timezone: bookingTimezone,
        location: bookingLocation.trim() || undefined, meeting_url: bookingMeetingUrl.trim() || undefined,
        notes: bookingNote.trim() || undefined,
      });
      setBookingSuccess(en ? `Interview booked for ${selectedApplication.candidate_name}. It is saved in ATS.` : `Đã đặt lịch phỏng vấn cho ${selectedApplication.candidate_name} trong ATS.`);
      setBookingAvailability(null); setReloadWorklist((value) => value + 1);
    } catch (cause) {
      setBookingError(cause instanceof Error ? cause.message : (en ? "Could not book this interview." : "Không đặt được lịch phỏng vấn."));
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) onAccessLost();
    } finally { setBookingBusy(false); }
  }
  const googleStatusLabel = (value: string) => en
    ? ({ AVAILABLE: "Google Calendar checked", NO_ACCESS: "Google access unavailable", NO_EMAIL: "Google email missing", NOT_CONFIGURED: "Google is not configured", NOT_CONNECTED: "Not connected", EMAIL_MISMATCH: "Google email does not match ATS", REAUTH_REQUIRED: "Reconnect Google Calendar", UNAVAILABLE: "Calendar could not be checked" } as Record<string, string>)[value] || "Calendar status unknown"
    : ({ AVAILABLE: "Đã kiểm tra Google Calendar", NO_ACCESS: "Không có quyền xem lịch Google", NO_EMAIL: "Thiếu email Google", NOT_CONFIGURED: "Google chưa được cấu hình", NOT_CONNECTED: "Chưa kết nối Google", EMAIL_MISMATCH: "Email Google không khớp ATS", REAUTH_REQUIRED: "Cần kết nối lại Google Calendar", UNAVAILABLE: "Không kiểm tra được lịch" } as Record<string, string>)[value] || "Không rõ trạng thái lịch";
  return <section className={styles.aux} aria-label={en ? "Job interviews" : "Phỏng vấn theo Job"}>
    <div className={styles.sectionHead}><div><h2>{en ? "Interview Schedule" : "Lịch phỏng vấn theo Job"}</h2><p>{en ? "Read-only schedule records from your authorized worklist." : "Lịch theo quyền truy cập của bạn; không thay đổi lịch hay feedback."}</p></div>
      <button className={styles.outline} type="button" onClick={onAllInterviews}>{en ? "Full interview worklist" : "Mở lịch phỏng vấn"} </button></div>
    <section className={styles.bookingPanel} aria-label={en ? "Book an interview" : "Đặt lịch phỏng vấn"}>
      <div><h3>{en ? "Book an interview" : "Đặt lịch phỏng vấn"}</h3><p>{en ? "Choose an active candidate and job-assigned interviewers. ATS checks Google Free/Busy and existing ATS appointments before saving." : "Chọn hồ sơ đang hoạt động và người phỏng vấn đã được phân quyền cho Job. ATS sẽ kiểm tra giờ bận trên Google và các lịch ATS trước khi lưu."}</p></div>
      {applicationsError && <p role="alert" className={styles.error}>{applicationsError}</p>}
      {applicationsLoading ? <p role="status">{en ? "Loading eligible applications…" : "Đang tải hồ sơ đủ điều kiện…"}</p> : eligibleApplications.length === 0 ?
        <p className={styles.empty}>{en ? "No active application is at Screening or Interview stage for this Job." : "Job này chưa có hồ sơ đang hoạt động ở vòng Sơ loại hoặc Phỏng vấn."}</p> : <>
        <div className={styles.bookingGrid}>
          <label className={styles.bookingField}><span>{en ? "Candidate" : "Ứng viên"}</span><select value={bookingApplicationId} onChange={(event) => { setBookingApplicationId(event.target.value); setBookingAvailability(null); setBookingError(""); }}>
            <option value="">{en ? "Choose a candidate" : "Chọn ứng viên"}</option>
            {eligibleApplications.map((item) => <option key={item.application_id} value={item.application_id}>{item.candidate_name} · {item.stage === "SCREEN" ? (en ? "Screening" : "Sơ loại") : (en ? "Interview" : "Phỏng vấn")}</option>)}
          </select></label>
          <label className={styles.bookingField}><span>{en ? "Interview type" : "Loại phỏng vấn"}</span><select value={bookingType} onChange={(event) => setBookingType(event.target.value as typeof bookingType)}>
            <option value="PHONE_SCREEN">{en ? "Phone screen" : "Sơ loại qua điện thoại"}</option><option value="INTERVIEW">{en ? "Interview" : "Phỏng vấn"}</option><option value="FINAL">{en ? "Final interview" : "Phỏng vấn cuối"}</option>
          </select></label>
          <label className={styles.bookingField}><span>{en ? "Start" : "Bắt đầu"} ({bookingTimezone})</span><input type="datetime-local" value={bookingStart} onChange={(event) => { setBookingStart(event.target.value); setBookingAvailability(null); setBookingError(""); }} /></label>
          <label className={styles.bookingField}><span>{en ? "End" : "Kết thúc"} ({bookingTimezone})</span><input type="datetime-local" value={bookingEnd} onChange={(event) => { setBookingEnd(event.target.value); setBookingAvailability(null); setBookingError(""); }} /></label>
          <label className={styles.bookingField}><span>{en ? "Location (optional)" : "Địa điểm (không bắt buộc)"}</span><input maxLength={240} value={bookingLocation} onChange={(event) => setBookingLocation(event.target.value)} /></label>
          <label className={styles.bookingField}><span>{en ? "Meeting link (optional)" : "Link họp (không bắt buộc)"}</span><input type="url" maxLength={2048} value={bookingMeetingUrl} onChange={(event) => setBookingMeetingUrl(event.target.value)} /></label>
        </div>
        <fieldset className={styles.bookingParticipants}><legend>{en ? "Interviewers / Hiring Managers" : "Người phỏng vấn / Hiring Manager"}</legend>
          {rosterLoading ? <p role="status">{en ? "Loading job team…" : "Đang tải nhóm Job…"}</p> : rosterError ? <p role="alert" className={styles.error}>{rosterError}</p> : roster.length === 0 ? <p className={styles.empty}>{en ? "No interviewer or hiring manager is assigned to this Job." : "Job chưa được phân quyền Interviewer hoặc Hiring Manager."}</p> : roster.map((person) => <label key={person.id}><input type="checkbox" checked={bookingParticipantIds.includes(person.id)} onChange={(event) => { setBookingParticipantIds((current) => event.target.checked ? [...current, person.id] : current.filter((id) => id !== person.id)); setBookingAvailability(null); setBookingError(""); }} /><span>{person.display_name}</span><small>{person.role === "HIRING_MANAGER" ? "Hiring Manager" : "Interviewer"}</small></label>)}
        </fieldset>
        <label className={styles.bookingField}><span>{en ? "Notes (optional)" : "Ghi chú (không bắt buộc)"}</span><textarea maxLength={4000} rows={3} value={bookingNote} onChange={(event) => setBookingNote(event.target.value)} /></label>
        <p className={styles.bookingNotice}>{en ? "This step saves an interview in ATS only. It does not send email or create Google Calendar events yet." : "Bước này chỉ lưu lịch trong ATS. Hiện chưa gửi email mời hoặc tạo sự kiện trên Google Calendar."}</p>
        {bookingError && <p role="alert" className={styles.error}>{bookingError}</p>}{bookingSuccess && <p role="status" className={styles.bookingSuccess}>{bookingSuccess}</p>}
        {bookingCheckCurrent && bookingParticipantIds.map((id) => {
          const person = roster.find((entry) => entry.id === id); const google = bookingAvailability?.calendars.find((entry) => entry.participant_id === id)?.status || "UNAVAILABLE";
          const busy = bookingConflicts.filter((slot) => slot.participant_id === id);
          return <div className={styles.bookingAvailabilityRow} key={id}><strong>{person?.display_name || id}</strong><span>{googleStatusLabel(google)}</span>{busy.length ? busy.map((slot) => <span key={`${slot.source}:${slot.starts_at}`}>{date(slot.starts_at)} – {date(slot.ends_at)} · {slot.source === "GOOGLE" ? "Google Busy" : (en ? "ATS appointment" : "Lịch ATS")}</span>) : google === "AVAILABLE" ? <span>{en ? "No overlap in the selected period." : "Không trùng lịch trong khung giờ đã chọn."}</span> : null}</div>;
        })}
        <div className={styles.bookingActions}>
          <button className={styles.outline} type="button" disabled={bookingAvailabilityBusy || rosterLoading || !bookingApplicationId || !bookingParticipantIds.length || !Number.isFinite(bookingStartMs) || !Number.isFinite(bookingEndMs) || bookingStartMs <= Date.now() || bookingEndMs <= bookingStartMs} onClick={() => void checkBookingAvailability()}>{bookingAvailabilityBusy ? (en ? "Checking calendars…" : "Đang kiểm tra lịch…") : (en ? "Check availability" : "Kiểm tra lịch bận/rảnh")}</button>
          <button className={styles.bookButton} type="button" disabled={bookingBusy || !canCreateBooking} onClick={() => void submitBooking()}>{bookingBusy ? (en ? "Booking…" : "Đang đặt lịch…") : (en ? "Book in ATS" : "Đặt lịch trong ATS")}</button>
        </div>
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
        </aside>
      </div>}
    <div className={styles.pager}><span>{en ? "Worklist page" : "Trang lịch tổng"} {Math.floor(offset / LIMIT) + 1}</span>
      <button className={styles.outline} type="button" disabled={busy || offset === 0} onClick={() => setOffset(offset - LIMIT)}>{en ? "Previous" : "Trước"}</button>
      <button className={styles.outline} type="button" disabled={busy || !hasNext} onClick={() => setOffset(offset + LIMIT)}>{en ? "Next" : "Tiếp"}</button>
    </div>
    <p className={styles.footnote}>{en ? "The API only paginates the global authorized worklist, not by Job. This tab may omit other Job appointments; use Full interview worklist for a complete search." : "API hiện phân trang lịch tổng, chưa lọc theo Job tại máy chủ. Tab này có thể thiếu lịch; hãy mở lịch tổng để kiểm tra đầy đủ."}</p>
  </section>;
}
