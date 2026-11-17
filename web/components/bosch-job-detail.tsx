"use client";

import { useState, type ReactNode } from "react";
import { useLanguage } from "./language";
import JobTeamAccess from "./job-team-access";
import BoschOffersWorkspace from "./bosch-offers-workspace";
import BoschJobInterviews from "./bosch-job-interviews";
import BoschJobActivity from "./bosch-job-activity";
import type { Job } from "@/lib/policy";
import { CalendarDays, ChevronDown, ChevronRight, Layers3, MapPin, Target, SlidersHorizontal } from "lucide-react";
import styles from "./bosch-v2-job-detail.module.css";

type Tab = "pipeline" | "details" | "sourcing" | "interviews" | "offers" | "team" | "activity";
type Props = {
  job: Job;
  allJobs: Job[];
  onSelectJob: (job: Job | null) => void;
  onBack: () => void;
  onModule: (module: "interviews" | "admin") => void;
  canViewOffers: boolean;
  canAdmin: boolean;
  children: ReactNode;
  onAccessLost?: () => void;
  roles?: string[];
  canManageApplications?: boolean;
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
const NOOP_ACCESS = () => {};
function readableDate(value: string | null | undefined, locale: "vi" | "en") {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "vi-VN", { day: "2-digit", month: "short", year: "numeric" }).format(parsed) : "—";
}

/** New composition only; no API/stage/role changes. */
export default function BoschJobDetail({ job, allJobs, onSelectJob, onBack, onModule, canViewOffers, canAdmin, onAccessLost, roles = [], canManageApplications = false, children }: Props) {
  const { locale } = useLanguage();
  const en = locale === "en";
  const [tab, setTab] = useState<Tab>("pipeline");
  const [actionsOpen, setActionsOpen] = useState(false);
  return <section className={`${styles.root} ${tab === "pipeline" ? styles.pipelineLayout : ""}`} aria-label={`${en ? "Job detail" : "Chi tiết Job"}: ${job.title}`}>
    <div className={styles.crumb}><button type="button" aria-label={en ? "Back to Jobs Overview" : "Quay lại Bảng Master"} onClick={onBack}>{en ? "Jobs" : "Vị trí tuyển dụng"}</button><ChevronRight size={14}/><strong>{job.job_code || "Job detail"}</strong></div>
    <div className={styles.titleRow}>
      <h1>{job.title}</h1>
      <span className={[styles.status, job.status === "OPEN" ? styles.statusOpen : ""].filter(Boolean).join(" ")}>{job.status === "OPEN" ? (en ? "Open" : "Đang tuyển") : job.status === "DRAFT" ? (en ? "Draft" : "Bản nháp") : job.status}</span>
      <div className={styles.actions}>
        <button type="button" className={styles.outline} aria-expanded={actionsOpen} onClick={() => setActionsOpen(x=>!x)}>{en ? "Actions" : "Thao tác"} <ChevronDown size={15}/></button>
        {actionsOpen && <div className={styles.actionMenu}>
          <button type="button" onClick={() => { setActionsOpen(false); onBack(); }}>{en ? "All job openings" : "Tất cả Job"}</button>
          {canAdmin && <button type="button" onClick={() => { setActionsOpen(false); onModule("admin"); }}>{en ? "Manage this Job" : "Quản lý Job này"}</button>}
        </div>}
      </div>
    </div>
    <div className={styles.metadata}>
      <span><MapPin size={16}/>{job.location || (en ? "Location —" : "Địa điểm —")}</span>
      <span><Layers3 size={16}/>{job.business_unit || job.function_group || (en ? "Department —" : "Đơn vị —")}</span>
      <span><CalendarDays size={16}/>{en ? "Req" : "Ngày Req"}: {readableDate(job.req_date, locale)}</span>
      <span><Target size={16}/>{en ? "SLA target" : "Mục tiêu SLA"}: {job.sla_target_workdays == null ? "—" : `${job.sla_target_workdays} ${en ? "workdays" : "ngày làm việc"}`}</span>
    </div>
    <nav className={styles.tabs} aria-label={en ? "Job sections" : "Các tab của Job"}>
      {tabs.filter(x=>x.id!=="offers" || canViewOffers).map(x=><button type="button" key={x.id} className={tab===x.id?styles.active:""} aria-current={tab===x.id?"page":undefined} onClick={() => setTab(x.id)}>{en ? x.label : ({pipeline:"Pipeline", details:"Chi tiết Job", sourcing:"Nguồn tuyển", interviews:"Phỏng vấn", offers:"Offers", team:"Nhóm & Quyền", activity:"Hoạt động"} as Record<Tab, string>)[x.id]}</button>)}
    </nav>
    {tab === "pipeline" && <div className={styles.content}>{children}</div>}
    {tab === "details" && <section className={styles.aux} aria-label={en ? "Job Details" : "Chi tiết Job"}>
      <div className={styles.sectionHead}><div><h2>{en ? "Job Details" : "Chi tiết Job"}</h2><p>{en ? "Verified requisition fields from the authorized Job record." : "Thông tin yêu cầu tuyển từ Job đang được phân quyền."}</p></div></div>
      <div className={styles.detailsGrid}>
        <section className={styles.detailPane}><h3>{en ? "Requisition Information" : "Thông tin yêu cầu tuyển"}</h3><dl className={styles.facts}>
          <dt>{en ? "Job ID" : "Mã Job"}</dt><dd>{job.job_code || "—"}</dd><dt>{en ? "Position" : "Vị trí"}</dt><dd>{job.title}</dd>
          <dt>{en ? "Status" : "Trạng thái"}</dt><dd>{job.status}</dd><dt>{en ? "Business unit" : "Đơn vị"}</dt><dd>{job.business_unit || "—"}</dd>
          <dt>{en ? "Function" : "Nhóm chức năng"}</dt><dd>{job.function_group || "—"}</dd>
          <dt>{en ? "Location" : "Địa điểm"}</dt><dd>{job.location || "—"}</dd>
          <dt>{en ? "Level" : "Cấp bậc"}</dt><dd>{job.level == null ? "—" : `L${job.level}`}</dd>
        </dl></section>
        <section className={styles.detailPane}><h3>{en ? "Hiring Settings" : "Thông số tuyển dụng"}</h3><dl className={styles.facts}>
          <dt>{en ? "Request date" : "Ngày Req"}</dt><dd>{readableDate(job.req_date, locale)}</dd>
          <dt>{en ? "Request type" : "Loại yêu cầu"}</dt><dd>{job.request_type === "NEW" ? (en ? "New headcount" : "Tuyển mới") : job.request_type === "REPLACEMENT" ? (en ? "Replacement" : "Thay thế") : "—"}</dd>
          <dt>{en ? "Replacement for" : "Thay thế cho"}</dt><dd>{job.replacement_for || "—"}</dd>
          <dt>{en ? "Hiring season" : "Giai đoạn tuyển"}</dt><dd>{job.hiring_season || "—"}</dd>
          <dt>{en ? "Priority" : "Ưu tiên"}</dt><dd>{job.priority || "—"}</dd>
          <dt>{en ? "SLA target" : "Mục tiêu SLA"}</dt><dd>{job.sla_target_workdays == null ? "—" : `${job.sla_target_workdays} ${en ? "workdays" : "ngày làm việc"}`}</dd>
          <dt>{en ? "SLA actual" : "SLA thực tế"}</dt><dd>—</dd>
        </dl></section>
      </div><p className={styles.footnote}>{en ? "SLA target is configured by Level/Function/Season. The Job API does not provide actual SLA, Hiring Manager or TA PIC." : "SLA mục tiêu lấy từ ma trận Level/Function/Season. API Job chưa cung cấp SLA thực tế, tên HM hoặc TA PIC."}</p>
    </section>}
    {tab === "sourcing" && <section className={styles.aux} aria-label={en ? "Job sourcing" : "Nguồn tuyển theo Job"}>
      <div className={styles.sectionHead}><div><h2>{en ? "Sourcing" : "Nguồn tuyển"}</h2><p>{en ? "Authorized sourcing breakdown for this Job." : "Phân bổ nguồn hồ sơ của Job theo dữ liệu được cấp quyền."}</p></div></div>
      <div className={styles.summaryGrid}>
        <div><span>{en ? "Applications" : "Hồ sơ"}</span><strong>{job.metrics?.total_candidates ?? "—"}</strong></div>
        <div><span>{en ? "Distinct sources" : "Số nhóm nguồn"}</span><strong>{job.metrics?.source_summary ? new Set(job.metrics.source_summary.map(x => x.source)).size : "—"}</strong></div>
        <div><span>{en ? "Interview stage" : "Đang ở vòng phỏng vấn"}</span><strong>{job.metrics?.interview_count ?? "—"}</strong></div>
      </div>
      {job.metrics?.source_summary?.length ? <div className={styles.tableScroll}><table className={styles.nativeTable}><thead><tr><th>{en ? "Source" : "Nguồn"}</th><th>{en ? "Sub-source" : "Nguồn chi tiết"}</th><th>{en ? "Ownership" : "Quyền sở hữu"}</th><th>{en ? "Applications" : "Hồ sơ"}</th></tr></thead><tbody>
        {job.metrics.source_summary.map(x => <tr key={`${x.source}:${x.sub_source}:${x.source_ownership}`}><td>{x.source}</td><td>{x.sub_source}</td><td>{x.source_ownership}</td><td>{x.count}</td></tr>)}
      </tbody></table></div> : <p className={styles.empty}>{en ? "Sourcing data is not available for this Job." : "Job này chưa có dữ liệu nguồn tuyển dụng được API trả về."}</p>}
      <p className={styles.footnote}>{en ? "Counts are Job applications, not unique candidates or source effectiveness scores." : "Các số này là lượt hồ sơ theo Job, không phải ứng viên duy nhất hay điểm hiệu quả nguồn."}</p>
    </section>}
    {tab === "interviews" && <BoschJobInterviews key={job.id} jobId={job.id} onAccessLost={onAccessLost || NOOP_ACCESS} onAllInterviews={() => onModule("interviews")}/>}
    {tab === "offers" && canViewOffers && <section className={styles.embedded} aria-label="Job Offers">
      <BoschOffersWorkspace key={job.id} job={job} onAccessLost={onAccessLost || NOOP_ACCESS}/>
    </section>}
    {tab === "team" && (canAdmin ? <JobTeamAccess key={job.id} job={job} onAccessLost={onAccessLost || NOOP_ACCESS}/> : <section className={styles.aux} aria-label={en ? "Team & Access" : "Nhóm & Phân quyền"}>
      <div className={styles.sectionHead}><div><h2>{en ? "Team & Access" : "Nhóm & Phân quyền"}</h2><p>{en ? "Your current permissions for this Job." : "Quyền truy cập của tài khoản hiện tại đối với Job này."}</p></div></div>
      <div className={styles.detailsGrid}>
        <section className={styles.detailPane}><h3>{en ? "Your roles" : "Vai trò tài khoản"}</h3>
          <p>{roles.length ? roles.join(", ") : "—"}</p></section>
        <section className={styles.detailPane}><h3>{en ? "Available actions" : "Quyền thao tác"}</h3><dl className={styles.facts}>
          <dt>{en ? "Read Job" : "Xem Job"}</dt><dd>{en ? "Authorized" : "Được cấp quyền"}</dd>
          <dt>{en ? "Move applications" : "Chuyển stage"}</dt><dd>{canManageApplications ? (en ? "Allowed" : "Được phép") : (en ? "Read-only" : "Chỉ xem")}</dd>
          <dt>{en ? "View Offers" : "Xem Offers"}</dt><dd>{canViewOffers ? (en ? "Allowed" : "Được phép") : (en ? "Not available" : "Không có quyền")}</dd>
        </dl></section>
      </div>
      <p className={styles.footnote}>{en ? "Contact your administrator to change team assignments." : "Liên hệ Admin để thay đổi phân công đội ngũ."}</p>
    </section>)}
    {tab === "activity" && <BoschJobActivity key={job.id} jobId={job.id} onAccessLost={onAccessLost || NOOP_ACCESS}/>}
    <div className={styles.jobSwitch} aria-label={en ? "Switch requisition" : "Chuyển Job"}>
      <label htmlFor="bosch-job-switcher">Job ID</label>
      <select id="bosch-job-switcher" aria-label={en ? "Select Job for Hiring Pipeline" : "Chọn Job cho Hiring Pipeline"} value={job.id} onChange={(event)=>onSelectJob(allJobs.find(x=>x.id===event.target.value)||null)}>
        {allJobs.map(x=><option key={x.id} value={x.id}>{x.job_code||"—"} · {x.title}</option>)}
      </select>
    </div>
  </section>;
}
