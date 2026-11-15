"use client";

import { useEffect, useRef, useState } from "react";
import { listInterviewWorklist, type InterviewStatus, type InterviewWorklistItem } from "@/lib/interviews";
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
  const version = useRef(0);
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
        </aside>
      </div>}
    <div className={styles.pager}><span>{en ? "Worklist page" : "Trang lịch tổng"} {Math.floor(offset / LIMIT) + 1}</span>
      <button className={styles.outline} type="button" disabled={busy || offset === 0} onClick={() => setOffset(offset - LIMIT)}>{en ? "Previous" : "Trước"}</button>
      <button className={styles.outline} type="button" disabled={busy || !hasNext} onClick={() => setOffset(offset + LIMIT)}>{en ? "Next" : "Tiếp"}</button>
    </div>
    <p className={styles.footnote}>{en ? "The API only paginates the global authorized worklist, not by Job. This tab may omit other Job appointments; use Full interview worklist for a complete search." : "API hiện phân trang lịch tổng, chưa lọc theo Job tại máy chủ. Tab này có thể thiếu lịch; hãy mở lịch tổng để kiểm tra đầy đủ."}</p>
  </section>;
}
