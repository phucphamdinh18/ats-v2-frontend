"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, CalendarClock, XCircle } from "lucide-react";
import { listInterviewWorklist, type InterviewWorklistItem, type InterviewStatus } from "@/lib/interviews";

const STATUSES: InterviewStatus[] = ["SCHEDULED", "COMPLETED", "CANCELLED"];
function pretty(iso: string) {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d) : "—";
}

/** Render authorized interview records only. No invented fixed round count or mutations. */
export default function CandidateInterviewProgress({ applicationId }: { applicationId: string }) {
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
  return <section className="bosch-interview-progress" aria-label="Interview Progress">
    <div className="bosch-progress-head"><h3>Interview Progress</h3>{!loading && !error && appointments.length > 0 && <span>{complete} of {appointments.length} completed</span>}</div>
    {loading ? <p className="bosch-muted-help">Loading interview rounds…</p> : error ? <p className="bosch-muted-help">Interview rounds are not available for this account or environment.</p> : appointments.length === 0 ? <p className="bosch-muted-help">No scheduled interview rounds for this candidate.</p> :
      <ol className="bosch-round-timeline">{appointments.map((row, index) =>
        <li key={row.id}>
          {row.status === "COMPLETED" ? <CheckCircle2 size={20} className="completed"/> : row.status === "CANCELLED" ? <XCircle size={20} className="cancelled"/> : <Circle size={20} className="scheduled"/>}
          <div><strong>Round {index + 1} — {row.interview_type === "PHONE_SCREEN" ? "Phone Screening" : row.interview_type === "FINAL" ? "Final" : "Interview"}</strong>
            <span>{row.status === "COMPLETED" ? "Completed" : row.status === "CANCELLED" ? "Cancelled" : "Scheduled"} · {pretty(row.starts_at)}</span>
            {row.participants?.length ? <small>{row.participants.map((p) => p.display_name).join(", ")}</small> : null}
          </div>
        </li>)}</ol>}
    <p className="bosch-muted-help">Rounds are retrieved from the existing Interviews API. No fixed number of rounds is assumed.</p>
  </section>;
}
