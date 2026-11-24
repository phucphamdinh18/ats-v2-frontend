"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { listInterviewWorklist, type InterviewWorklistItem } from "@/lib/interviews";
import { useLanguage } from "./language";

const PAGE_SIZE = 100;
function pretty(iso: string, locale: "vi" | "en") {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "vi-VN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d) : "—";
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
    async function loadCompleted() {
      const completed = new Map<string, InterviewWorklistItem>();
      for (let offset = 0; active; offset += PAGE_SIZE) {
        const page = await listInterviewWorklist("COMPLETED", PAGE_SIZE, offset, applicationId);
        for (const row of page) if (row.status === "COMPLETED") completed.set(row.id, row);
        if (page.length < PAGE_SIZE) break;
      }
      if (active) setAppointments([...completed.values()]);
    }
    void loadCompleted().catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applicationId]);

  const copy = en ? {
    title: "Interview progress", completed: (count: number) => `${count} completed`, loading: "Loading interview rounds…", unavailable: "Could not load interview rounds.", empty: "No completed interviews yet.", round: "Round", phone: "Phone screen", final: "Final interview", interview: "Interview",
  } : {
    title: "Tiến độ phỏng vấn", completed: (count: number) => `${count} đã hoàn tất`, loading: "Đang tải các vòng phỏng vấn…", unavailable: "Chưa tải được các vòng phỏng vấn.", empty: "Chưa có buổi phỏng vấn hoàn tất.", round: "Vòng", phone: "Sàng lọc qua điện thoại", final: "Phỏng vấn cuối", interview: "Phỏng vấn",
  };
  return <section className="bosch-interview-progress" aria-label={copy.title}>
    <div className="bosch-progress-head"><h3>{copy.title}</h3>{!loading && !error && appointments.length > 0 && <span>{copy.completed(appointments.length)}</span>}</div>
    {loading ? <p className="bosch-muted-help">{copy.loading}</p> : error ? <p className="bosch-muted-help">{copy.unavailable}</p> : appointments.length === 0 ? <p className="bosch-muted-help">{copy.empty}</p> :
      <ol className="bosch-round-timeline">{appointments.map((row, index) =>
        <li key={row.id}>
          <CheckCircle2 size={20} className="completed" aria-hidden="true"/>
          <div><strong>{copy.round} {index + 1} — {row.interview_type === "PHONE_SCREEN" ? copy.phone : row.interview_type === "FINAL" ? copy.final : copy.interview}</strong>
            <span>{pretty(row.starts_at, locale)}</span>
            {row.participants?.length ? <small>{row.participants.map((p) => p.display_name).join(", ")}</small> : null}
          </div>
        </li>)}</ol>}
  </section>;
}
