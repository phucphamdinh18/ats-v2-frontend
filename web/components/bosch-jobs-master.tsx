"use client";

import { BriefcaseBusiness, ChevronRight, Filter, Search } from "lucide-react";
import type { Job } from "@/lib/policy";

type Props = {
  jobs: Job[];
  allJobs: Job[];
  selectedJobId?: string | null;
  query: string;
  onQuery: (query: string) => void;
  status: string;
  onStatus: (status: string) => void;
  onSelect: (job: Job) => void;
  onOpen: (job: Job) => void;
};

/** New Jobs module. Source data and access scope come from the unchanged Workspace. */
export default function BoschJobsMaster({
  jobs, allJobs, selectedJobId, query, onQuery, status, onStatus, onSelect, onOpen,
}: Props) {
  const open = allJobs.filter((job) => job.status === "OPEN").length;
  const draft = allJobs.filter((job) => job.status === "DRAFT").length;
  const statusOptions = ["ALL", "OPEN", "DRAFT", ...allJobs.map((job) => job.status)]
    .filter((value, index, values) => values.indexOf(value) === index);
  return <section className="bosch-master" aria-label="Job openings">
    <header className="bosch-master-header">
      <div className="bosch-breadcrumb"><strong>Jobs</strong><ChevronRight size={14}/><span>Job Openings</span></div>
      <h1>Job Openings</h1>
      <p>Recruitment positions in your authorized workspace.</p>
    </header>

    <div className="bosch-master-summary" aria-label="Job summary">
      <div><span>Total Jobs</span><strong>{allJobs.length}</strong></div>
      <div><span>Open</span><strong>{open}</strong></div>
      <div><span>Draft</span><strong>{draft}</strong></div>
      <div><span>Other Status</span><strong>{allJobs.length - open - draft}</strong></div>
    </div>

    <section className="bosch-master-panel">
      <div className="bosch-master-panel-head">
        <h2>Job Openings <span>({jobs.length})</span></h2>
        <div className="bosch-master-controls">
          <label className="bosch-master-search">
            <Search size={16}/>
            <input value={query} onChange={event => onQuery(event.target.value)}
              aria-label="Tìm Job" placeholder="Search job openings"/>
          </label>
          <label className="bosch-master-select">
            <Filter size={15}/>
            <select aria-label="Trạng thái Job" value={status} onChange={event => onStatus(event.target.value)}>
              {statusOptions.map(value => <option key={value} value={value}>
                {value === "ALL" ? "All Statuses" : value === "OPEN" ? "Open" : value === "DRAFT" ? "Draft" : value}
              </option>)}
            </select>
          </label>
        </div>
      </div>
      <div className="bosch-master-table-scroll">
        <table className="bosch-master-table">
          <thead>
            <tr>
              <th>Job Opening / ID</th>
              <th>Department</th>
              <th>Location</th>
              <th>Hiring Status</th>
              <th>Candidates</th>
              <th>Pipeline</th>
              <th>Priority</th>
              <th aria-label="Action">Action</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(job => <tr key={job.id} className={selectedJobId === job.id ? "selected" : ""}>
              <td><div className="bosch-master-job-title">
                <BriefcaseBusiness size={17}/>
                <button type="button" aria-label={`Chọn Job ${job.title}`} onClick={() => onSelect(job)}>{job.title}</button>
              </div>
                <button type="button" className="bosch-master-job-code" aria-label={`Mở Job ID ${job.job_code || job.title}`} onClick={() => onOpen(job)}>{job.job_code || "—"}</button>
              </td>
              <td>{job.business_unit || "—"}</td>
              <td>{job.location || "—"}</td>
              <td><span className={`bosch-master-state state-${job.status.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}>{job.status === "OPEN" ? "Open" : job.status === "DRAFT" ? "Draft" : job.status}</span></td>
              <td>{job.metrics?.total_candidates ?? "—"}</td>
              <td><div className="bosch-master-funnel" title="New · Screening · Interview · Hired">
                <span>{job.metrics?.new_count ?? "—"}</span>
                <span>{job.metrics?.screening_count ?? "—"}</span>
                <span>{job.metrics?.interview_count ?? "—"}</span>
                <span>{job.metrics?.hired_count ?? "—"}</span>
              </div></td>
              <td>{job.priority || "—"}</td>
              <td><button className="bosch-master-open" type="button" aria-label={`Mở pipeline ${job.title}`} onClick={() => onOpen(job)}>Pipeline <ChevronRight size={14}/></button></td>
            </tr>)}
          </tbody>
        </table>
        {!jobs.length && <div className="bosch-master-empty">
          <p>No Job matches this filter.</p>
          <button type="button" onClick={() => { onQuery(""); onStatus("ALL"); }}>Clear filters</button>
        </div>}
      </div>
      <footer className="bosch-master-footer">
        <span>{jobs.length} of {allJobs.length} Job openings</span>
        <span>New · Screening · Interview · Hired</span>
      </footer>
    </section>
  </section>;
}
