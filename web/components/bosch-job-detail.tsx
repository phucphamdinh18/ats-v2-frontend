"use client";

import { useState, type ReactNode } from "react";
import type { Job } from "@/lib/policy";
import { CalendarDays, ChevronDown, ChevronRight, Layers3, MapPin, Target, SlidersHorizontal } from "lucide-react";

type Tab = "pipeline" | "details" | "sourcing" | "interviews" | "offers" | "team" | "activity";
type Props = {
  job: Job;
  allJobs: Job[];
  onSelectJob: (job: Job | null) => void;
  onBack: () => void;
  onModule: (module: "interviews" | "offers" | "admin") => void;
  canViewOffers: boolean;
  canAdmin: boolean;
  children: ReactNode;
};
const tabs: { id: Tab; label: string }[] = [
  { id: "pipeline", label: "Pipeline" },
  { id: "details", label: "Job Details" },
  { id: "sourcing", label: "Sourcing" },
  { id: "interviews", label: "Interviews" },
  { id: "offers", label: "Offers" },
  { id: "team", label: "Team & Access" },
  { id: "activity", label: "Activity" },
];
function readableDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(parsed) : "—";
}

/** New composition only; no API/stage/role changes. */
export default function BoschJobDetail({ job, allJobs, onSelectJob, onBack, onModule, canViewOffers, canAdmin, children }: Props) {
  const [tab, setTab] = useState<Tab>("pipeline");
  const [actionsOpen, setActionsOpen] = useState(false);
  return <section className="bosch-job-page" aria-label={`Job detail: ${job.title}`}>
    <div className="bosch-breadcrumb"><button type="button" aria-label="Quay lại Bảng Master" onClick={onBack}>Jobs</button><ChevronRight size={14}/><strong>{job.job_code || "Job detail"}</strong></div>
    <div className="bosch-job-title-row">
      <h1>{job.title}</h1>
      <span className={`bosch-status ${job.status === "OPEN" ? "is-open" : ""}`}>{job.status === "OPEN" ? "Open" : job.status === "DRAFT" ? "Draft" : job.status}</span>
      <div className="bosch-actions">
        <button type="button" className="bosch-outline-btn" aria-expanded={actionsOpen} onClick={() => setActionsOpen(x=>!x)}>Actions <ChevronDown size={15}/></button>
        {actionsOpen && <div className="bosch-action-menu">
          <button type="button" onClick={() => { setActionsOpen(false); onBack(); }}>All job openings</button>
          {canAdmin && <button type="button" onClick={() => { setActionsOpen(false); onModule("admin"); }}>Manage this Job</button>}
        </div>}
      </div>
    </div>
    <div className="bosch-job-metadata">
      <span><MapPin size={16}/>{job.location || "Location —"}</span>
      <span><Layers3 size={16}/>{job.business_unit || job.function_group || "Department —"}</span>
      <span><CalendarDays size={16}/>Req: {readableDate(job.req_date)}</span>
      <span><Target size={16}/>Hiring target: —</span>
    </div>
    <nav className="bosch-job-tabs" aria-label="Job sections">
      {tabs.filter(x=>x.id!=="offers" || canViewOffers).map(x=><button type="button" key={x.id} className={tab===x.id?"active":""} aria-current={tab===x.id?"page":undefined} onClick={() => setTab(x.id)}>{x.label}</button>)}
    </nav>
    {tab === "pipeline" && children}
    {tab === "details" && <section className="bosch-aux-page"><h2>Job Details</h2><dl className="bosch-facts"><dt>Job ID</dt><dd>{job.job_code||"—"}</dd><dt>Position</dt><dd>{job.title}</dd><dt>Status</dt><dd>{job.status}</dd><dt>Department</dt><dd>{job.business_unit||"—"}</dd><dt>Location</dt><dd>{job.location||"—"}</dd><dt>Level</dt><dd>{job.level??"—"}</dd><dt>Priority</dt><dd>{job.priority||"—"}</dd><dt>SLA (working days)</dt><dd>{job.sla_target_workdays??"—"}</dd></dl></section>}
    {tab === "sourcing" && <section className="bosch-aux-page"><h2>Sourcing</h2>{job.metrics?.source_summary?.length ? <table className="bosch-native-table"><thead><tr><th>Source</th><th>Sub-source</th><th>Ownership</th><th>Candidates</th></tr></thead><tbody>{job.metrics.source_summary.map(x=><tr key={`${x.source}:${x.sub_source}:${x.source_ownership}`}><td>{x.source}</td><td>{x.sub_source}</td><td>{x.source_ownership}</td><td>{x.count}</td></tr>)}</tbody></table> : <p>Source data is not available for this Job.</p>}</section>}
    {tab === "interviews" && <section className="bosch-aux-page"><h2>Interviews</h2><p>Interview schedules and multiple rounds are managed by the existing authorized interview workspace.</p><button type="button" className="bosch-outline-btn" onClick={() => onModule("interviews")}>Open Interviews <ChevronRight size={16}/></button></section>}
    {tab === "offers" && <section className="bosch-aux-page"><h2>Offers</h2><p>Open the existing job-scoped offer workspace; approval rules remain unchanged.</p><button type="button" className="bosch-outline-btn" onClick={() => onModule("offers")}>Open Offers <ChevronRight size={16}/></button></section>}
    {tab === "team" && <section className="bosch-aux-page"><h2>Team & Access</h2><p>Job membership and access are controlled by Supabase. This UI does not change those assignments.</p>{canAdmin && <button type="button" className="bosch-outline-btn" onClick={() => onModule("admin")}>Manage permissions <SlidersHorizontal size={15}/></button>}</section>}
    {tab === "activity" && <section className="bosch-aux-page"><h2>Activity</h2><p>Open a candidate from Pipeline to inspect the recorded Application timeline with actor names.</p><button type="button" className="bosch-outline-btn" onClick={() => setTab("pipeline")}>View candidate activity <ChevronRight size={15}/></button></section>}
    <div className="bosch-job-switch" aria-label="Switch requisition">
      <label htmlFor="bosch-job-switcher">Job ID</label>
      <select id="bosch-job-switcher" aria-label="Chọn Job cho Hiring Pipeline" value={job.id} onChange={(event)=>onSelectJob(allJobs.find(x=>x.id===event.target.value)||null)}>
        {allJobs.map(x=><option key={x.id} value={x.id}>{x.job_code||"—"} · {x.title}</option>)}
      </select>
    </div>
  </section>;
}
