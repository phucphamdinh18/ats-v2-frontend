"use client";

import { useEffect, useRef, useState } from "react";
import { listInterviewAvailability, listInterviewWorklist, type InterviewBusySlot, type InterviewGoogleCalendarStatus, type InterviewStatus, type InterviewWorklistItem } from "@/lib/interviews";
import { ApiError } from "@/lib/supabase";
import { useLanguage } from "./language";
import styles from "./bosch-v2-job-detail.module.css";
const LIMIT = 25;
const statuses: InterviewStatus[] = ["SCHEDULED", "COMPLETED", "CANCELLED"];
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
  const version = useRef(0);
  const availabilityVersion = useRef(0);
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
  }, [jobId, status, offset, onAccessLost]);
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
  return <section className={styles.aux} aria-label={en ? "Job interviews" : "Phỏng vấn theo Job"}>
    <div className={styles.sectionHead}><div><h2>{en ? "Interview Schedule" : "Lịch phỏng vấn theo Job"}</h2><p>{en ? "Read-only schedule records from your authorized worklist." : "Lịch theo quyền truy cập của bạn; không thay đổi lịch hay feedback."}</p></div>
      <button className={styles.outline} type="button" onClick={onAllInterviews}>{en ? "Full interview worklist" : "Mở lịch phỏng vấn"} </button></div>
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
