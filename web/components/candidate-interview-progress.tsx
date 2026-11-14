"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, CalendarClock, XCircle } from "lucide-react";
import { listInterviewWorklist, type InterviewWorklistItem, type InterviewStatus } from "@/lib/interviews";
import { useLanguage } from "./language";

const STATUSES: InterviewStatus[] = ["SCHEDULED", "COMPLETED", "CANCELLED"];
function pretty(iso: string, locale: "vi" | "en") {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "vi-VN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d) : "—";
}

/** Render authorized interview records only. No invented fixed round count or mutations. */
export default function CandidateInterviewProgress({ applicationId }: { applicationId: string }) {
  const { locale } = useLanguage();
  const en = locale === "en";
  const [appointments, setAppointments] = useState<InterviewWorklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setAppointments([]);
    void Promise.all(STATUSES.map(async (status) => listInterviewWorklist(status, 100, 0, applicationId))).then((groups) => {
      if (!active) return;
      const unique = new Map<string, InterviewWorklistItem>();
      groups.flat().forEach((row) => unique.set(row.id, row));
      setAppointments([...unique.values()].sort((a,b) => a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id)));
    }).catch(() => { if (active) { setError(true); setAppointments([]); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applicationId]);

  const complete = appointments.filter((item) => item.status === "COMPLETED").length;
  const copy = en ? {
    title: "Interview progress", completed: "completed", loading: "Loading interview rounds…", unavailable: "Interview rounds aren’t available for this account or environment.", empty: "No interview rounds have been scheduled for this candidate.", source: "Interview rounds come from the existing Interviews service. No fixed number of rounds is assumed.", round: "Round", phone: "Phone screen", final: "Final interview", interview: "Interview", completedStatus: "Completed", cancelled: "Cancelled", scheduled: "Scheduled",
  } : {
    title: "Tiến độ phỏng vấn", completed: "đã hoàn tất", loading: "Đang tải các vòng phỏng vấn…", unavailable: "Tài khoản hoặc môi trường này chưa thể xem lịch phỏng vấn.", empty: "Ứng viên này chưa có lịch phỏng vấn.", source: "Lịch phỏng vấn được lấy từ hệ thống Interviews hiện có. Không mặc định số vòng phỏng vấn.", round: "Vòng", phone: "Sàng lọc qua điện thoại", final: "Phỏng vấn cuối", interview: "Phỏng vấn", completedStatus: "Đã hoàn tất", cancelled: "Đã hủy", scheduled: "Đã lên lịch",
  };
  return <section className="bosch-interview-progress" aria-label={copy.title}>
    <div className="bosch-progress-head"><h3>{copy.title}</h3>{!loading && !error && appointments.length > 0 && <span>{complete} / {appointments.length} {copy.completed}</span>}</div>
    {loading ? <p className="bosch-muted-help">{copy.loading}</p> : error ? <p className="bosch-muted-help">{copy.unavailable}</p> : appointments.length === 0 ? <p className="bosch-muted-help">{copy.empty}</p> :
      <ol className="bosch-round-timeline">{appointments.map((row, index) =>
        <li key={row.id}>
          {row.status === "COMPLETED" ? <CheckCircle2 size={20} className="completed"/> : row.status === "CANCELLED" ? <XCircle size={20} className="cancelled"/> : <Circle size={20} className="scheduled"/>}
          <div><strong>{copy.round} {index + 1} — {row.interview_type === "PHONE_SCREEN" ? copy.phone : row.interview_type === "FINAL" ? copy.final : copy.interview}</strong>
            <span>{row.status === "COMPLETED" ? copy.completedStatus : row.status === "CANCELLED" ? copy.cancelled : copy.scheduled} · {pretty(row.starts_at, locale)}</span>
            {row.participants?.length ? <small>{row.participants.map((p) => p.display_name).join(", ")}</small> : null}
          </div>
        </li>)}</ol>}
    <p className="bosch-muted-help">{copy.source}</p>
  </section>;
}
