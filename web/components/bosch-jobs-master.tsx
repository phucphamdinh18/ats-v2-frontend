"use client";

import { BriefcaseBusiness, ChevronRight, Filter, Search } from "lucide-react";
import type { Job } from "@/lib/policy";
import { useLanguage } from "./language";
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
  const { locale } = useLanguage();
  const en = locale === "en";
  const labels = en ? {
    title: "Job Openings", subtitle: "Recruitment positions in your authorized workspace.", total: "Total Jobs", open: "Open", draft: "Draft", other: "Other Status",
    search: "Search job openings", allStatuses: "All Statuses", jobId: "Job Opening / ID", department: "Department", location: "Location", hiringStatus: "Hiring Status", candidates: "Candidates", pipeline: "Pipeline", priority: "Priority", action: "Action",
    noMatch: "No Job matches this filter.", clear: "Clear filters", openings: "Job openings", new: "New", screening: "Screening", interview: "Interview", hired: "Hired", openPipeline: "Open pipeline",
  } : {
    title: "Vị trí tuyển dụng", subtitle: "Theo dõi các vị trí bạn được phân quyền.", total: "Tổng số Job", open: "Đang tuyển", draft: "Bản nháp", other: "Trạng thái khác",
    search: "Tìm vị trí tuyển dụng", allStatuses: "Tất cả trạng thái", jobId: "Vị trí / Mã Job", department: "Phòng ban", location: "Địa điểm", hiringStatus: "Trạng thái tuyển dụng", candidates: "Ứng viên", pipeline: "Tiến độ", priority: "Ưu tiên", action: "Thao tác",
    noMatch: "Không có Job phù hợp với bộ lọc này.", clear: "Xóa bộ lọc", openings: "vị trí tuyển dụng", new: "Mới", screening: "Sơ loại", interview: "Phỏng vấn", hired: "Đã tuyển", openPipeline: "Mở Pipeline",
  };
  const open = allJobs.filter((job) => job.status === "OPEN").length;
  const draft = allJobs.filter((job) => job.status === "DRAFT").length;
  const statusOptions = ["ALL", "OPEN", "DRAFT", ...allJobs.map((job) => job.status)]
    .filter((value, index, values) => values.indexOf(value) === index);

  const summary = [
    [labels.total, allJobs.length],
    [labels.open, open],
    [labels.draft, draft],
    [labels.other, allJobs.length - open - draft],
  ] as const;

  return <section className={styles.root} aria-label={labels.title}>
    <header className={styles.heading}>
      <div className={styles.crumb}><strong>{en ? "Jobs" : "Job"}</strong><ChevronRight size={14}/><span>{labels.title}</span></div>
      <h1>{labels.title}</h1>
      <p className={styles.subtitle}>{labels.subtitle}</p>
    </header>

    <div className={styles.summary} aria-label={en ? "Job summary" : "Tổng quan Job"}>
      {summary.map(([label, count]) => <div className={styles.metric} key={label}><span>{label}</span><strong>{count}</strong></div>)}
    </div>

    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <h2>{labels.title} <span className={styles.count}>({jobs.length})</span></h2>
        <div className={styles.controls}>
          <label className={styles.search}>
            <Search size={16} aria-hidden="true"/>
            <input value={query} onChange={(event) => onQuery(event.target.value)}
              aria-label={en ? "Search Job" : "Tìm Job"} placeholder={labels.search}/>
          </label>
          <label className={styles.filter}>
            <Filter size={15} aria-hidden="true"/>
            <select aria-label={en ? "Job status" : "Trạng thái Job"} value={status} onChange={(event) => onStatus(event.target.value)}>
              {statusOptions.map((value) => <option key={value} value={value}>
                {value === "ALL" ? labels.allStatuses : value === "OPEN" ? labels.open : value === "DRAFT" ? labels.draft : value}
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
            <th scope="col">{labels.jobId}</th>
            <th scope="col">{labels.department}</th>
            <th scope="col">{labels.location}</th>
            <th scope="col">{labels.hiringStatus}</th>
            <th scope="col">{labels.candidates}</th>
            <th scope="col">{labels.pipeline}</th>
            <th scope="col">{labels.priority}</th>
            <th scope="col">{labels.action}</th>
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
                  {job.status === "OPEN" ? labels.open : job.status === "DRAFT" ? labels.draft : job.status}
                </span>
              </td>
              <td>{job.metrics?.total_candidates ?? "—"}</td>
              <td><div className={styles.pipeline} title={`${labels.new} · ${labels.screening} · ${labels.interview} · ${labels.hired}`}>
                <span>{job.metrics?.new_count ?? "—"}</span>
                <span>{job.metrics?.screening_count ?? "—"}</span>
                <span>{job.metrics?.interview_count ?? "—"}</span>
                <span>{job.metrics?.hired_count ?? "—"}</span>
              </div></td>
              <td>{job.priority || "—"}</td>
              <td><button className={styles.action} type="button" aria-label={en ? `Open pipeline for ${job.title}` : `Mở pipeline ${job.title}`}
                onClick={() => onOpen(job)}>{labels.pipeline} <ChevronRight size={14}/></button></td>
            </tr>)}
          </tbody>
        </table>
        {!jobs.length && <div className={styles.empty}>
          <p>{labels.noMatch}</p>
          <button type="button" className={styles.clear} onClick={() => { onQuery(""); onStatus("ALL"); }}>{labels.clear}</button>
        </div>}
      </div>

      <footer className={styles.footer}>
        <span>{en ? `${jobs.length} of ${allJobs.length} ${labels.openings}` : `${jobs.length} / ${allJobs.length} ${labels.openings}`}</span>
        <span>{labels.new} · {labels.screening} · {labels.interview} · {labels.hired}</span>
      </footer>
    </section>
  </section>;
}
