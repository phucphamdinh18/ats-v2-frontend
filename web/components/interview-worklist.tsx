"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/supabase";
import { listInterviewWorklist, type InterviewStatus, type InterviewWorklistItem } from "@/lib/interviews";
import { useLanguage } from "./language";

const LIMIT = 25;
function dateLabel(iso: string, locale: "vi" | "en"): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function safeMeetingUrl(value: string | null): string | null {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === "https:" ? url.href : null; }
  catch { return null; }
}

/** Existing backend worklist is the source of truth for appointments and access control. */
export default function InterviewWorklist({ onAccessLost }: { onAccessLost: () => void }) {
  const { locale } = useLanguage();
  const en = locale === "en";
  const statuses: { id: InterviewStatus; label: string }[] = [
    { id: "SCHEDULED", label: en ? "Scheduled" : "Đã lên lịch" },
    { id: "COMPLETED", label: en ? "Completed" : "Đã hoàn tất" },
    { id: "CANCELLED", label: en ? "Cancelled" : "Đã hủy" },
  ];
  const [status, setStatus] = useState<InterviewStatus>("SCHEDULED");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<InterviewWorklistItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestVersion = useRef(0);
  const active = rows.find((row) => row.id === selectedId) || null;

  useEffect(() => {
    const version = ++requestVersion.current;
    setRows([]);
    setSelectedId(null);
    setError("");
    setLoading(true);
    void listInterviewWorklist(status, LIMIT, offset).then((result) => {
      if (version !== requestVersion.current) return;
      setRows(result);
      setSelectedId(result[0]?.id || null);
    }).catch((cause: unknown) => {
      if (version !== requestVersion.current) return;
      setRows([]);
      setSelectedId(null);
      setError(cause instanceof Error ? cause.message : "Không tải được lịch phỏng vấn.");
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) onAccessLost();
    }).finally(() => {
      if (version === requestVersion.current) setLoading(false);
    });
    return () => { requestVersion.current += 1; };
  }, [status, offset, onAccessLost]);

  function changeStatus(next: InterviewStatus) {
    setStatus(next);
    setOffset(0);
  }
  return <section className="ops-workspace interview-worklist" aria-label={en ? "Interview schedule workspace" : "Lịch phỏng vấn"}>
    <div className="ops-controls">
      <div>
        <h2>{en ? "Interview schedule" : "Lịch phỏng vấn"}</h2>
        <p>{en ? "Appointments available to you based on your ATS access." : "Các lịch hẹn bạn được xem theo quyền truy cập ATS."}</p>
      </div>
      <div className="interview-status-tabs" role="group" aria-label={en ? "Filter interview status" : "Lọc trạng thái lịch phỏng vấn"}>
        {statuses.map((item) => <button key={item.id} type="button" className={status === item.id ? "active" : ""} aria-pressed={status === item.id} onClick={() => changeStatus(item.id)}>{item.label}</button>)}
      </div>
    </div>
    <div className="ops-content">
      <div className="ops-primary">
        <div className="ops-summary" aria-label={en ? "Schedule summary" : "Tổng quan lịch trong trang"}>
          <div><span>{en ? "Status" : "Trạng thái"}</span><strong>{statuses.find((item) => item.id === status)?.label || status}</strong></div>
          <div><span>{en ? "Appointments on this page" : "Lịch trong trang"}</span><strong>{rows.length}</strong></div>
          <div><span>{en ? "Displayed time zone" : "Múi giờ hiển thị"}</span><strong>{Intl.DateTimeFormat().resolvedOptions().timeZone || "Local"}</strong></div>
        </div>
        {error && <div className="notice error" role="alert">{error}</div>}
        {loading ? <p className="ops-empty" role="status">Đang tải lịch phỏng vấn…</p> : <div className="ops-table-wrap">
          <table className="ops-table">
            <thead><tr><th>{en ? "Candidate" : "Ứng viên"}</th><th>{en ? "Job opening" : "Vị trí tuyển dụng"}</th><th>{en ? "Type" : "Loại lịch"}</th><th>{en ? "Starts (local time)" : "Bắt đầu (giờ địa phương)"}</th><th>{en ? "Feedback" : "Đánh giá"}</th></tr></thead>
            <tbody>{rows.map((item) => <tr key={item.id} className={selectedId === item.id ? "selected" : ""}>
              <td><button type="button" aria-pressed={selectedId === item.id} onClick={() => setSelectedId(item.id)}>{item.candidate_name}</button></td>
              <td>{item.job_code || item.job_title || "—"}</td>
              <td>{item.interview_type}</td>
              <td>{dateLabel(item.starts_at, locale)}</td>
              <td>{item.feedback_count || 0}</td>
            </tr>)}</tbody>
          </table>
          {!rows.length && !error && <p className="ops-empty">{en ? "No interviews match this filter." : "Không có lịch phỏng vấn phù hợp với bộ lọc."}</p>}
        </div>}
        <div className="ops-pagination">
          <button type="button" className="secondary" disabled={loading || offset === 0} onClick={() => setOffset((current) => Math.max(0, current - LIMIT))}>{en ? "Previous" : "Trang trước"}</button>
          <span>{en ? `Page ${offset / LIMIT + 1} · up to ${LIMIT} appointments per page` : `Trang ${offset / LIMIT + 1} · tối đa ${LIMIT} lịch / trang`}</span>
          <button type="button" className="secondary" disabled={loading || rows.length < LIMIT} onClick={() => setOffset((current) => current + LIMIT)}>{en ? "Next" : "Trang sau"}</button>
        </div>
      </div>
      <aside className="ops-detail" aria-label={en ? "Interview details" : "Chi tiết lịch phỏng vấn"}>
        <h3>{active?.candidate_name || (en ? "Interview details" : "Chi tiết lịch phỏng vấn")}</h3>
        {active ? <>
          <dl className="ops-fields">
            <dt>{en ? "Job" : "Vị trí"}</dt><dd>{active.job_title}</dd>
            <dt>{en ? "Type" : "Loại lịch"}</dt><dd>{active.interview_type}</dd>
            <dt>{en ? "Status" : "Trạng thái"}</dt><dd>{statuses.find((item) => item.id === active.status)?.label || active.status}</dd>
            <dt>{en ? "Starts" : "Bắt đầu"}</dt><dd>{dateLabel(active.starts_at, locale)}</dd>
            <dt>{en ? "Ends" : "Kết thúc"}</dt><dd>{dateLabel(active.ends_at, locale)}</dd>
            <dt>{en ? "Original time zone" : "Múi giờ gốc"}</dt><dd>{active.timezone || "—"}</dd>
            <dt>{en ? "Location" : "Địa điểm"}</dt><dd>{active.location || "—"}</dd>
            <dt>Feedback</dt><dd>{active.feedback_count || 0}</dd>
          </dl>
          {safeMeetingUrl(active.meeting_url) && <p><a href={safeMeetingUrl(active.meeting_url)!} target="_blank" rel="noopener noreferrer">{en ? "Open meeting" : "Mở cuộc họp"}</a></p>}
          <h4>{en ? "Interviewers" : "Người phỏng vấn"}</h4>
          {active.participants?.length ? <ul className="interview-participants">{active.participants.map((participant) => <li key={participant.id}><strong>{participant.display_name}</strong><small>{participant.role}</small></li>)}</ul> : <p className="ops-muted">Chưa có thông tin người tham gia.</p>}
          <p className="ops-disclaimer">{en ? "This screen is for tracking only. Scheduling, decisions, and feedback must follow the existing ATS permissions and verified workflows." : "Màn hình này dùng để theo dõi. Việc đặt lịch, ra quyết định và gửi feedback vẫn cần theo quyền và quy trình ATS hiện có."}</p>
        </> : <p className="ops-muted">{en ? "Choose an interview from the list to view its details." : "Chọn một lịch phỏng vấn trong danh sách để xem chi tiết."}</p>}
      </aside>
    </div>
  </section>;
}
