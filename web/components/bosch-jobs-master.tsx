"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Search, Plus, Pencil } from "lucide-react";
import type { Job } from "@/lib/policy";
import { useLanguage } from "./language";
import styles from "./bosch-v2-jobs.module.css";

type Props = {
  onCreate?: () => void;
  onEdit?: (job: Job) => void;
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
const PAGE_SIZE = 10;
const dash = "—";
const factValue = (value: string | number) => <span className={value === dash ? styles.placeholder : undefined}>{value}</span>;
function sourceOf(job: Job) {
  const sources = job.metrics?.source_summary || [];
  const total = sources.reduce((sum, item) => sum + Math.max(0, item.count || 0), 0);
  if (!total) return dash;
  return [...sources].sort((a, b) => b.count - a.count)[0]?.source || dash;
}
function reqDate(value: string | null | undefined, en: boolean) {
  if (!value) return dash;
  // YYYY-MM-DD is a date-only value; do not parse in the browser's timezone.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return en ? `${d}/${m}/${y}` : `${d}/${m}/${y}`;
  }
  return value;
}
function priorityLabel(value: Job["priority"], en: boolean) {
  if (!value) return dash;
  const vi: Record<string, string> = { CRITICAL: "Khẩn cấp", HIGH: "Cao", NORMAL: "Bình thường", LOW: "Thấp" };
  return en ? value : (vi[value] || value);
}
function requestLabel(value: Job["request_type"], en: boolean) {
  if (!value) return dash;
  return value === "NEW" ? (en ? "New HC" : "Tuyển mới") : (en ? "Replacement" : "Thay thế");
}

export default function BoschJobsMaster({
  jobs, allJobs, selectedJobId, query, onQuery, status, onStatus, onSelect, onOpen, onCreate, onEdit,
}: Props) {
  const { locale } = useLanguage();
  const en = locale === "en";
  const [priority, setPriority] = useState("ALL");
  const [page, setPage] = useState(0);
  const [snapshotId, setSnapshotId] = useState<string | null>(null);

  const labels = en ? {
    title: "Job Openings", subtitle: "Manage requisitions, hiring priorities and job-level performance.",
    overview: "Job Overview", summary: "Job Summary", total: "Total Jobs", open: "Open", draft: "Draft", onHold: "On Hold", closed: "Closed",
    search: "Search Job ID / position", allStatuses: "All Statuses", allPriorities: "All Priorities",
    job: "Job Opening", unit: "Department", req: "Req Type / Date", level: "Level / Priority",
    status: "Status", sla: "SLA Target", volume: "Applications", action: "Action",
    noMatch: "No Jobs match these filters.", clear: "Clear filters", select: "Select Job",
    snapshot: "Job Snapshot", requisition: "Requisition Information", progress: "Hiring Status & SLA",
    metrics: "Job-level Metrics", department: "Department", function: "Function", requestType: "Request type",
    reqDate: "Req Date", priority: "Priority", actual: "Actual SLA", applications: "Applications",
    topSource: "Top source", target: "Configured target", openDetail: "Open Job Detail",
    notAvailable: "Not available", source: "Source", levelLabel: "Level", candidate: "Candidates",
  } : {
    title: "Vị trí tuyển dụng", subtitle: "Quản lý yêu cầu tuyển, mức ưu tiên và tiến độ theo từng Job.",
    overview: "Tổng quan Job", summary: "Tổng quan Job", total: "Tổng số Job", open: "Đang tuyển", draft: "Bản nháp", onHold: "Tạm dừng", closed: "Đã đóng",
    search: "Tìm mã hoặc tên Job", allStatuses: "Tất cả trạng thái", allPriorities: "Tất cả ưu tiên",
    job: "Vị trí tuyển dụng", unit: "Đơn vị", req: "Loại Req / Ngày", level: "Level / Ưu tiên",
    status: "Trạng thái", sla: "SLA mục tiêu", volume: "Hồ sơ", action: "Thao tác",
    noMatch: "Không tìm thấy Job phù hợp.", clear: "Xóa bộ lọc", select: "Chọn Job",
    snapshot: "Tóm tắt Job", requisition: "Thông tin yêu cầu tuyển", progress: "Trạng thái & SLA",
    metrics: "Số liệu theo Job", department: "Đơn vị", function: "Chức năng", requestType: "Loại yêu cầu",
    reqDate: "Ngày Req", priority: "Ưu tiên", actual: "SLA thực tế", applications: "Hồ sơ",
    topSource: "Nguồn chính", target: "Mục tiêu cấu hình", openDetail: "Mở chi tiết Job",
    notAvailable: "Chưa có dữ liệu", source: "Nguồn", levelLabel: "Level", candidate: "Ứng viên",
  };

  const statusOptions = ["ALL", "OPEN", "DRAFT", ...allJobs.map((job) => job.status)]
    .filter((value, index, values) => values.indexOf(value) === index);
  const priorityOptions = ["ALL", "CRITICAL", "HIGH", "NORMAL", "LOW"];
  const visible = useMemo(
    () => jobs.filter((job) => priority === "ALL" || job.priority === priority),
    [jobs, priority],
  );
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const rows = visible.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const selected = allJobs.find((job) => job.id === snapshotId)
    || allJobs.find((job) => job.id === selectedJobId) || visible[0] || null;
  const openCount = allJobs.filter((job) => job.status === "OPEN").length;
  const draftCount = allJobs.filter((job) => job.status === "DRAFT").length;
  const onHoldCount = allJobs.filter((job) => job.status === "ON_HOLD").length;
  const closedCount = allJobs.filter((job) => job.status === "CLOSED").length;
  const summary = [
    [labels.total, allJobs.length, false], [labels.open, openCount, true],
    [labels.draft, draftCount, false], [labels.onHold, onHoldCount, false],
    [labels.closed, closedCount, false],
  ] as const;
  const choose = (job: Job) => { setSnapshotId(job.id); onSelect(job); };
  const clear = () => { onQuery(""); onStatus("ALL"); setPriority("ALL"); setPage(0); };

  return <section className={styles.root} aria-label={labels.title}>
    <header className={styles.heading}>
      <div className={styles.crumb}><strong>Jobs</strong><ChevronRight size={14}/><span>{labels.title}</span></div>
      <div className={styles.headingRow}><h1>{labels.title}</h1>{onCreate && <button type="button" className={styles.addJob} onClick={onCreate}><Plus size={18} aria-hidden="true"/>{en ? "Add Job" : "Thêm Job"}</button>}</div>
      <p className={styles.subtitle}>{labels.subtitle}</p>
    </header>
    <div className={styles.tabs}><span className={styles.tabActive}>{labels.overview}</span></div>
    <div className={styles.workspace}>
      <div className={styles.stack}>
        <section className={styles.panel} aria-label={labels.summary}>
          <div className={styles.panelHead}><h2>{labels.summary}</h2><span className={styles.count}>{en ? "Authorized Jobs" : "Job được phân quyền"}</span></div>
          <div className={styles.summary}>
            {summary.map(([label, count, active]) => <div key={label} className={`${styles.metric} ${active ? styles.metricActive : ""}`}>
              <strong>{count}</strong><span>{label}</span>
            </div>)}
          </div>
        </section>
        <section className={`${styles.panel} ${styles.jobsPanel}`}>
          <div className={styles.panelHead}>
            <h2>{labels.title} <span className={styles.count}>({visible.length})</span></h2>
            <div className={styles.controls}>
              <label className={styles.search}><Search size={16} aria-hidden="true"/>
                <input value={query} onChange={(event) => { onQuery(event.target.value); setPage(0); }}
                  aria-label={en ? "Search Job" : "Tìm Job"} placeholder={labels.search}/></label>
              <select className={styles.select} aria-label={en ? "Job status" : "Trạng thái Job"}
                value={status} onChange={(event) => { onStatus(event.target.value); setPage(0); }}>
                {statusOptions.map((value) => <option key={value} value={value}>
                  {value === "ALL" ? labels.allStatuses : value === "OPEN" ? labels.open : value === "DRAFT" ? labels.draft : value}
                </option>)}
              </select>
              <select className={styles.select} aria-label={en ? "Job priority" : "Ưu tiên Job"}
                value={priority} onChange={(event) => { setPriority(event.target.value); setPage(0); }}>
                {priorityOptions.map((value) => <option key={value} value={value}>
                  {value === "ALL" ? labels.allPriorities : priorityLabel(value as Job["priority"], en)}
                </option>)}
              </select>
            </div>
          </div>
          <div className={styles.tableScroll}>
            <table className={`${styles.table} ${en ? "" : styles.vietnamese}`}>
              <colgroup><col style={{ width: "30%" }}/><col style={{ width: "15%" }}/><col style={{ width: "13%" }}/><col style={{ width: "12%" }}/><col style={{ width: "17%" }}/><col style={{ width: "13%" }}/></colgroup>
              <thead><tr>
                <th scope="col">{labels.job}</th><th scope="col">{labels.unit}</th><th scope="col">{labels.function}</th>
                <th scope="col">{labels.status}</th><th scope="col">{labels.volume}</th>
                <th scope="col">{labels.action}</th>
              </tr></thead>
              <tbody>{rows.map((job) => <tr key={job.id} className={selected?.id === job.id ? styles.selected : undefined}>
                <td><div className={styles.jobCell}>
                  <button type="button" className={styles.jobName} title={job.title} aria-label={`Chọn Job ${job.title}`}
                    onClick={() => choose(job)}>{job.title}</button>
                  <span className={styles.jobCode}>{job.job_code || dash}</span></div></td>
                <td><div className={styles.departmentCell}><b className={job.business_unit ? styles.department : styles.departmentEmpty}>{job.business_unit || dash}</b></div></td>
                <td><div className={styles.departmentCell}>{job.function_group || dash}</div></td>
                <td><span className={`${styles.state} ${job.status === "OPEN" ? styles.open : job.status === "DRAFT" ? styles.draft : ""}`}>{job.status === "OPEN" ? labels.open : job.status === "DRAFT" ? labels.draft : job.status}</span></td>
                <td><div className={styles.applicationCell}><div><b>{job.metrics?.total_candidates ?? dash}</b> {labels.applications}</div>
                  <div className={styles.dim} title={sourceOf(job)}>{sourceOf(job)}</div></div></td>
                <td><button className={styles.action} type="button"
                  aria-label={en ? `Open pipeline for ${job.title}` : `Mở pipeline ${job.title}`}
                  onClick={() => onOpen(job)}>{en ? "View detail" : "Chi tiết"} <ChevronRight size={14}/></button>
                  {onEdit && ["DRAFT","OPEN","ON_HOLD"].includes(job.status) && <button className={styles.action} type="button" aria-label={`${en ? "Edit Job" : "Sửa Job"}: ${job.title}`} onClick={()=>onEdit(job)}><Pencil size={14}/>{en ? "Edit Job" : "Sửa Job"}</button>}</td>
              </tr>)}</tbody>
            </table>
            {!visible.length && <div className={styles.empty}><p>{labels.noMatch}</p>
              <button className={styles.clear} onClick={clear} type="button">{labels.clear}</button></div>}
          </div>
          <footer className={styles.footer}>
            <span>{visible.length ? `${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, visible.length)} / ${visible.length}` : "0"} {en ? "Jobs" : "Job"}</span>
            <div className={styles.pagination}>
              <button type="button" disabled={currentPage === 0} onClick={() => setPage(Math.max(0, currentPage - 1))}>{en ? "Previous" : "Trước"}</button>
              <span>{currentPage + 1} / {pages}</span>
              <button type="button" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>{en ? "Next" : "Sau"}</button>
            </div>
          </footer>
        </section>
      </div>
      <aside className={`${styles.panel} ${styles.snapshot}`} aria-label={labels.snapshot}>
        <div className={styles.snapshotInner}>
        {selected ? <>
          <div className={styles.snapshotHead}><h2>{selected.title}</h2><p>{selected.job_code || dash}</p>
            {onEdit && ["DRAFT","OPEN","ON_HOLD"].includes(selected.status) && <button className={styles.action} type="button" onClick={()=>onEdit(selected)}><Pencil size={15}/>{en ? "Edit Job" : "Sửa Job"}</button>}</div>
          <div className={styles.snapshotSection}><h3>{labels.requisition}</h3>
            <dl className={styles.facts}>
              <dt>{labels.department}</dt><dd>{factValue(selected.business_unit || dash)}</dd>
              <dt>{labels.function}</dt><dd>{factValue(selected.function_group || dash)}</dd>
              <dt>{labels.requestType}</dt><dd>{factValue(requestLabel(selected.request_type, en))}</dd>
              <dt>{labels.reqDate}</dt><dd>{factValue(reqDate(selected.req_date, en))}</dd>
              <dt>{labels.levelLabel}</dt><dd>{factValue(selected.level == null ? dash : `L${selected.level}`)}</dd>
              <dt>{labels.priority}</dt><dd>{factValue(priorityLabel(selected.priority, en))}</dd>
            </dl>
          </div>
          <div className={styles.snapshotSection}><h3>{labels.progress}</h3>
            <dl className={styles.facts}>
              <dt>{labels.status}</dt><dd>{factValue(selected.status)}</dd>
              <dt>{labels.sla}</dt><dd>{factValue(selected.sla_target_workdays == null ? dash : `${selected.sla_target_workdays} ${en ? "workdays" : "ngày làm việc"}`)}</dd>
              <dt>{labels.actual}</dt><dd>{factValue(dash)}</dd>
            </dl>
          </div>
          <div className={styles.snapshotSection}><h3>{labels.metrics}</h3>
            <dl className={styles.facts}>
              <dt>{labels.applications}</dt><dd>{factValue(selected.metrics?.total_candidates ?? dash)}</dd>
              <dt>{labels.topSource}</dt><dd>{factValue(sourceOf(selected))}</dd>
            </dl>
            <button className={styles.primary} type="button" onClick={() => onOpen(selected)}>{labels.openDetail} <ChevronRight size={14}/></button>
          </div>
        </> : <div className={styles.empty}>{en ? "No Job selected" : "Chưa chọn Job"}</div>}
        </div>
      </aside>
    </div>
    <p className={styles.note}>{en
      ? "SLA is a configured target, not a breach calculation. Counts and source data come from authorized Job metrics; unavailable fields show —."
      : "SLA là mục tiêu cấu hình, không phải kết luận quá hạn. Chỉ số lấy từ dữ liệu Job được phân quyền; trường thiếu hiển thị —."}</p>
  </section>;
}
