"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3 } from "lucide-react";
import { listInterviewWorklist, type InterviewWorklistItem } from "@/lib/interviews";
import { useLanguage } from "./language";

const PAGE_SIZE = 100;
const DISPLAY_STATUSES = ["SCHEDULED", "COMPLETED"] as const;
const DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh";

function interviewDate(row: InterviewWorklistItem, locale: "vi" | "en") {
  const date = new Date(row.starts_at);
  if (!Number.isFinite(date.getTime())) return "—";
  const language = locale === "en" ? "en-GB" : "vi-VN";
  function format(timeZone: string) {
    const day = new Intl.DateTimeFormat(language, { day: "2-digit", month: locale === "en" ? "short" : "2-digit", year: "numeric", timeZone }).format(date);
    if (row.status === "COMPLETED") return day;
    const time = new Intl.DateTimeFormat(language, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(date);
    return `${day}, ${time}`;
  }
  try { return format(row.timezone || DEFAULT_TIMEZONE); }
  catch { return format(DEFAULT_TIMEZONE); }
}

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
    async function loadStatus(status: typeof DISPLAY_STATUSES[number]) {
      const rows: InterviewWorklistItem[] = [];
      for (let offset = 0; active; offset += PAGE_SIZE) {
        const page = await listInterviewWorklist(status, PAGE_SIZE, offset, applicationId);
        rows.push(...page.filter((row) => row.status === status));
        if (page.length < PAGE_SIZE) break;
      }
      return rows;
    }
    void Promise.all(DISPLAY_STATUSES.map(loadStatus)).then((groups) => {
      if (!active) return;
      // Prefer the completed record if an interview transitions between the two reads.
      const unique = new Map(groups.flat().map((row) => [row.id, row]));
      setAppointments([...unique.values()].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at) || a.id.localeCompare(b.id)));
    }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applicationId]);

  const copy = en ? {
    title: "Interview progress", count: (completed: number, total: number) => `${completed} of ${total} completed`, loading: "Loading interview rounds…", unavailable: "Could not load interview rounds.", empty: "No interviews scheduled or completed yet.", round: "Round", phone: "Phone screen", final: "Final interview", interview: "Interview", scheduled: "Scheduled", completed: "Completed",
  } : {
    title: "Tiến độ phỏng vấn", count: (completed: number, total: number) => `${completed}/${total} đã hoàn tất`, loading: "Đang tải các vòng phỏng vấn…", unavailable: "Chưa tải được các vòng phỏng vấn.", empty: "Chưa có buổi phỏng vấn được lên lịch hoặc hoàn tất.", round: "Vòng", phone: "Sàng lọc qua điện thoại", final: "Phỏng vấn cuối", interview: "Phỏng vấn", scheduled: "Đã lên lịch", completed: "Đã hoàn tất",
  };
  const completedCount = appointments.filter((row) => row.status === "COMPLETED").length;
  return <section className="bosch-interview-progress" aria-label={copy.title}>
    <div className="bosch-progress-head"><h3>{copy.title}</h3>{!loading && !error && appointments.length > 0 && <span>{copy.count(completedCount, appointments.length)}</span>}</div>
    {loading ? <p className="bosch-muted-help">{copy.loading}</p> : error ? <p className="bosch-muted-help">{copy.unavailable}</p> : appointments.length === 0 ? <p className="bosch-muted-help">{copy.empty}</p> :
      <ol className="bosch-round-timeline">{appointments.map((row, index) => {
        const completed = row.status === "COMPLETED";
        return <li key={row.id}>
          {completed ? <CheckCircle2 size={20} className="completed" aria-hidden="true"/> : <Clock3 size={20} className="scheduled" aria-hidden="true"/>}
          <div><strong>{copy.round} {index + 1} — {row.interview_type === "PHONE_SCREEN" ? copy.phone : row.interview_type === "FINAL" ? copy.final : copy.interview}</strong>
            <span>{completed ? copy.completed : copy.scheduled} · <time dateTime={row.starts_at}>{interviewDate(row, locale)}</time></span>
            {row.participants?.length ? <small>{row.participants.map((p) => p.display_name).join(", ")}</small> : null}
          </div>
        </li>;
      })}</ol>}
  </section>;
}
