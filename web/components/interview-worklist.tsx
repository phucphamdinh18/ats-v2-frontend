"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/supabase";
import { listInterviewWorklist, type InterviewStatus, type InterviewWorklistItem } from "@/lib/interviews";

const LIMIT = 25;
const statuses: { id: InterviewStatus; label: string }[] = [
  { id: "SCHEDULED", label: "Scheduled" },
  { id: "COMPLETED", label: "Completed" },
  { id: "CANCELLED", label: "Cancelled" },
];
function dateLabel(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function safeMeetingUrl(value: string | null): string | null {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === "https:" ? url.href : null; }
  catch { return null; }
}

/** Existing backend worklist is the source of truth for appointments and access control. */
export default function InterviewWorklist({ onAccessLost }: { onAccessLost: () => void }) {
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
  return <section className="ops-workspace interview-worklist" aria-label="Interview schedule workspace">
    <div className="ops-controls">
      <div>
        <h2>Interview Schedule</h2>
        <p>Lịch phỏng vấn được trả về theo quyền truy cập từ ATS Backend.</p>
      </div>
      <div className="interview-status-tabs" role="group" aria-label="Lọc trạng thái lịch phỏng vấn">
        {statuses.map((item) => <button key={item.id} type="button" className={status === item.id ? "active" : ""} aria-pressed={status === item.id} onClick={() => changeStatus(item.id)}>{item.label}</button>)}
      </div>
    </div>
    <div className="ops-content">
      <div className="ops-primary">
        <div className="ops-summary" aria-label="Tổng quan lịch trong trang">
          <div><span>Trạng thái</span><strong>{status}</strong></div>
          <div><span>Lịch trong trang</span><strong>{rows.length}</strong></div>
          <div><span>Múi giờ hiển thị</span><strong>{Intl.DateTimeFormat().resolvedOptions().timeZone || "Local"}</strong></div>
        </div>
        {error && <div className="notice error" role="alert">{error}</div>}
        {loading ? <p className="ops-empty" role="status">Đang tải lịch phỏng vấn…</p> : <div className="ops-table-wrap">
          <table className="ops-table">
            <thead><tr><th>Ứng viên</th><th>Job Opening</th><th>Loại</th><th>Bắt đầu (giờ máy)</th><th>Feedback</th></tr></thead>
            <tbody>{rows.map((item) => <tr key={item.id} className={selectedId === item.id ? "selected" : ""}>
              <td><button type="button" aria-pressed={selectedId === item.id} onClick={() => setSelectedId(item.id)}>{item.candidate_name}</button></td>
              <td>{item.job_code || item.job_title || "—"}</td>
              <td>{item.interview_type}</td>
              <td>{dateLabel(item.starts_at)}</td>
              <td>{item.feedback_count || 0}</td>
            </tr>)}</tbody>
          </table>
          {!rows.length && !error && <p className="ops-empty">Không có lịch phỏng vấn phù hợp với bộ lọc.</p>}
        </div>}
        <div className="ops-pagination">
          <button type="button" className="secondary" disabled={loading || offset === 0} onClick={() => setOffset((current) => Math.max(0, current - LIMIT))}>Trang trước</button>
          <span>Trang {offset / LIMIT + 1} · tối đa {LIMIT} lịch / trang</span>
          <button type="button" className="secondary" disabled={loading || rows.length < LIMIT} onClick={() => setOffset((current) => current + LIMIT)}>Trang sau</button>
        </div>
      </div>
      <aside className="ops-detail" aria-label="Chi tiết lịch phỏng vấn">
        <h3>{active?.candidate_name || "Interview Details"}</h3>
        {active ? <>
          <dl className="ops-fields">
            <dt>Job</dt><dd>{active.job_title}</dd>
            <dt>Loại</dt><dd>{active.interview_type}</dd>
            <dt>Trạng thái</dt><dd>{active.status}</dd>
            <dt>Bắt đầu</dt><dd>{dateLabel(active.starts_at)}</dd>
            <dt>Kết thúc</dt><dd>{dateLabel(active.ends_at)}</dd>
            <dt>Timezone gốc</dt><dd>{active.timezone || "—"}</dd>
            <dt>Địa điểm</dt><dd>{active.location || "—"}</dd>
            <dt>Feedback</dt><dd>{active.feedback_count || 0}</dd>
          </dl>
          {safeMeetingUrl(active.meeting_url) && <p><a href={safeMeetingUrl(active.meeting_url)!} target="_blank" rel="noopener noreferrer">Mở cuộc họp</a></p>}
          <h4>Interviewers</h4>
          {active.participants?.length ? <ul className="interview-participants">{active.participants.map((participant) => <li key={participant.id}><strong>{participant.display_name}</strong><small>{participant.role}</small></li>)}</ul> : <p className="ops-muted">Chưa có thông tin người tham gia.</p>}
          <p className="ops-disclaimer">Đây là màn hình theo dõi. Thao tác đặt lịch, chốt quyết định và gửi feedback phải dùng các quyền và quy trình đã được backend xác thực.</p>
        </> : <p className="ops-muted">Chọn lịch phỏng vấn trong danh sách để xem chi tiết.</p>}
      </aside>
    </div>
  </section>;
}
