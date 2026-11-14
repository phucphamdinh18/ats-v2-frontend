"use client";

import { BriefcaseBusiness, ChevronRight, Filter, Search } from "lucide-react";
import type { Job } from "@/lib/policy";
import styles from "./bosch-v2-jobs.module.css";

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

/**
 * Presentation-only module with an isolated CSS module.
 * Authorization, RLS, API calls and job selection remain owned by Workspace.
 */
export default function BoschJobsMaster({
  jobs, allJobs, selectedJobId, query, onQuery, status, onStatus, onSelect, onOpen,
}: Props) {
  const open = allJobs.filter((job) => job.status === "OPEN").length;
  const draft = allJobs.filter((job) => job.status === "DRAFT").length;
  const statusOptions = ["ALL", "OPEN", "DRAFT", ...allJobs.map((job) => job.status)]
    .filter((value, index, values) => values.indexOf(value) === index);

  const summary = [
    ["Total Jobs", allJobs.length],
    ["Open", open],
    ["Draft", draft],
    ["Other Status", allJobs.length - open - draft],
  ] as const;

  return <section className={styles.root} aria-label="Job openings">
    <header className={styles.heading}>
      <div className={styles.crumb}><strong>Jobs</strong><ChevronRight size={14}/><span>Job Openings</span></div>
      <h1>Job Openings</h1>
      <p className={styles.subtitle}>Recruitment positions in your authorized workspace.</p>
    </header>

    <div className={styles.summary} aria-label="Job summary">
      {summary.map(([label, count]) => <div className={styles.metric} key={label}><span>{label}</span><strong>{count}</strong></div>)}
    </div>

    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <h2>Job Openings <span className={styles.count}>({jobs.length})</span></h2>
        <div className={styles.controls}>
          <label className={styles.search}>
            <Search size={16} aria-hidden="true"/>
            <input value={query} onChange={(event) => onQuery(event.target.value)}
              aria-label="Tìm Job" placeholder="Search job openings"/>
          </label>
          <label className={styles.filter}>
            <Filter size={15} aria-hidden="true"/>
            <select aria-label="Trạng thái Job" value={status} onChange={(event) => onStatus(event.target.value)}>
              {statusOptions.map((value) => <option key={value} value={value}>
                {value === "ALL" ? "All Statuses" : value === "OPEN" ? "Open" : value === "DRAFT" ? "Draft" : value}
              </option>)}
            </select>
          </label>
        </div>
      </div>

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <colgroup>
            <col style={{ width: "29%" }}/><col style={{ width: "12%" }}/><col style={{ width: "13%" }}/>
            <col style={{ width: "10%" }}/><col style={{ width: "8%" }}/><col style={{ width: "12%" }}/>
            <col style={{ width: "7%" }}/><col style={{ width: "9%" }}/>
          </colgroup>
          <thead><tr>
            <th scope="col">Job Opening / ID</th>
            <th scope="col">Department</th>
            <th scope="col">Location</th>
            <th scope="col">Hiring Status</th>
            <th scope="col">Candidates</th>
            <th scope="col">Pipeline</th>
            <th scope="col">Priority</th>
            <th scope="col">Action</th>
          </tr></thead>
          <tbody>
            {jobs.map((job) => <tr key={job.id} className={selectedJobId === job.id ? styles.selected : undefined}>
              <td>
                <div className={styles.jobCell}>
                  <div className={styles.jobLine}>
                    <BriefcaseBusiness size={17} aria-hidden="true"/>
                    <button type="button" className={styles.jobName} aria-label={`Chọn Job ${job.title}`}
                      onClick={() => onSelect(job)}>{job.title}</button>
                  </div>
                  <button type="button" className={styles.jobCode}
                    aria-label={`Mở Job ID ${job.job_code || job.title}`} onClick={() => onOpen(job)}>
                    {job.job_code || "—"}
                  </button>
                </div>
              </td>
              <td>{job.business_unit || "—"}</td>
              <td>{job.location || "—"}</td>
              <td>
                <span className={[styles.state, job.status === "OPEN" ? styles.open : job.status === "DRAFT" ? styles.draft : ""].filter(Boolean).join(" ")}>
                  {job.status === "OPEN" ? "Open" : job.status === "DRAFT" ? "Draft" : job.status}
                </span>
              </td>
              <td>{job.metrics?.total_candidates ?? "—"}</td>
              <td><div className={styles.pipeline} title="New · Screening · Interview · Hired">
                <span>{job.metrics?.new_count ?? "—"}</span>
                <span>{job.metrics?.screening_count ?? "—"}</span>
                <span>{job.metrics?.interview_count ?? "—"}</span>
                <span>{job.metrics?.hired_count ?? "—"}</span>
              </div></td>
              <td>{job.priority || "—"}</td>
              <td><button className={styles.action} type="button" aria-label={`Mở pipeline ${job.title}`}
                onClick={() => onOpen(job)}>Pipeline <ChevronRight size={14}/></button></td>
            </tr>)}
          </tbody>
        </table>
        {!jobs.length && <div className={styles.empty}>
          <p>No Job matches this filter.</p>
          <button type="button" className={styles.clear} onClick={() => { onQuery(""); onStatus("ALL"); }}>Clear filters</button>
        </div>}
      </div>

      <footer className={styles.footer}>
        <span>{jobs.length} of {allJobs.length} Job openings</span>
        <span>New · Screening · Interview · Hired</span>
      </footer>
    </section>
  </section>;
}
