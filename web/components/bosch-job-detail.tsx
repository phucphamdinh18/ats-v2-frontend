"use client";

import { cloneElement, isValidElement, useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from "react";
import { readViewState, writeViewState } from "@/lib/view-state";
import { useLanguage } from "./language";
import JobTeamAccess from "./job-team-access";
import BoschOffersWorkspace from "./bosch-offers-workspace";
import BoschJobInterviews from "./bosch-job-interviews";
import BoschInterviewTemplates from "./bosch-interview-templates";
import BoschJobActivity from "./bosch-job-activity";
import type { Job } from "@/lib/policy";
import { ArrowLeft, CalendarDays, CalendarPlus, ChevronDown, Layers3, MapPin, Pencil, Target } from "lucide-react";
import styles from "./bosch-v2-job-detail.module.css";
import type { Application } from "@/lib/applications";
import { getCopy, roleLabel } from "@/lib/i18n";

type Tab = "pipeline" | "details" | "sourcing" | "interviews" | "templates" | "offers" | "team" | "activity";
type Props = {
  job: Job;
  onBack: () => void;
  onEdit?: (job: Job) => void;
  onModule: (module: "interviews") => void;
  canViewOffers: boolean;
  canAdmin: boolean;
  children: ReactNode;
  onAccessLost?: () => void;
  roles?: string[];
  membershipLoadFailed?: boolean;
  canManageApplications?: boolean;
};
const tabs: { id: Tab; label: string }[] = [
  { id: "pipeline", label: "Pipeline" },
  { id: "details", label: "Job Details" },
  { id: "sourcing", label: "Sourcing" },
  { id: "interviews", label: "Interviews" },
  { id: "templates", label: "Templates" },
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
export default function BoschJobDetail({ job, onBack, onEdit, onModule, canViewOffers, canAdmin, onAccessLost, roles = [], membershipLoadFailed = false, canManageApplications = false, children }: Props) {
  const { locale } = useLanguage();
  const en = locale === "en";
  const copy = getCopy(locale);
  const [tab, setTab] = useState<Tab>(() => readViewState<Tab>(`ats-v2:job-detail-tab:${job.id}`, "pipeline", ["pipeline", "details", "sourcing", "interviews", "templates", "offers", "team", "activity"]));
  const [actionsOpen, setActionsOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [initialBookingApplicationId, setInitialBookingApplicationId] = useState<string | undefined>();
  useEffect(() => { writeViewState(`ats-v2:job-detail-tab:${job.id}`, tab); }, [job.id, tab]);
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const canInviteSelected = canManageApplications && selectedApplication?.status === "ACTIVE" && selectedApplication.stage === "INTERVIEW";
  const onPipelineSelection = useCallback((application: Application | null) => setSelectedApplication(application), []);
  useEffect(() => {
    if (!actionsOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !actionsRef.current?.contains(event.target)) setActionsOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [actionsOpen]);
  const pipelineChildren = isValidElement(children)
    ? cloneElement(children as ReactElement<{ onSelectionChange?: (application: Application | null) => void }>, { onSelectionChange: onPipelineSelection })
    : children;
  function handleJobActionsKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); setActionsOpen(false); }
  }
  function inviteSelectedCandidate() {
    if (!canInviteSelected || !selectedApplication) return;
    setInitialBookingApplicationId(selectedApplication.application_id);
    setActionsOpen(false);
    setTab("interviews");
  }
  return <section ref={rootRef} className={`${styles.root} ${tab === "pipeline" ? styles.pipelineLayout : ""}`} aria-label={`${en ? "Job detail" : "Chi tiết Job"}: ${job.title}`}>
    <div className={styles.crumb}><button type="button" aria-label={en ? "Back to Jobs Overview" : "Quay lại Bảng Master"} onClick={onBack}>{en ? "Jobs" : "Vị trí tuyển dụng"}</button></div>
    <div className={styles.titleRow}>
      <h1>{job.title}</h1>
      <span className={[styles.status, job.status === "OPEN" ? styles.statusOpen : ""].filter(Boolean).join(" ")}>{job.status === "OPEN" ? (en ? "Open" : "Đang tuyển") : job.status === "DRAFT" ? (en ? "Draft" : "Bản nháp") : job.status}</span>
      <div className={styles.actions} ref={actionsRef}>
        <button type="button" className={styles.jobActionsTrigger} aria-haspopup="menu" aria-expanded={actionsOpen} onClick={() => setActionsOpen(x=>!x)} onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); setActionsOpen(true); } }}>{en ? "Job actions" : "Thao tác Job"} <ChevronDown size={15}/></button>
        {actionsOpen && <div className={styles.actionMenu} role="menu" aria-label={en ? "Job actions" : "Thao tác Job"} onKeyDown={handleJobActionsKeyDown}>
          {canAdmin && onEdit && <button type="button" role="menuitem" disabled={! ["DRAFT", "OPEN", "ON_HOLD"].includes(job.status)} onClick={() => { setActionsOpen(false); onEdit(job); }}><Pencil size={17}/><span>{en ? "Edit Job" : "Sửa Job"}<small>{job.title}</small></span></button>}
          <button type="button" role="menuitem" disabled={!canInviteSelected} title={!canInviteSelected ? (en ? "Select an active candidate at the Interview stage first." : "Trước tiên hãy chọn ứng viên đang ở vòng Phỏng vấn.") : undefined} onClick={inviteSelectedCandidate}><CalendarPlus size={17}/><span>{en ? "Invite to interview" : "Mời phỏng vấn"}<small>{canInviteSelected ? selectedApplication?.candidate_name : (en ? "Select an Interview candidate in the Pipeline" : "Chọn ứng viên ở vòng Phỏng vấn trong Pipeline")}</small></span></button>
          <button type="button" role="menuitem" onClick={() => { setActionsOpen(false); onBack(); }}><ArrowLeft size={17}/><span>{en ? "All job openings" : "Tất cả Job"}</span></button>
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
      {tabs.filter(x=>x.id!=="offers" || canViewOffers).map(x=><button type="button" key={x.id} className={tab===x.id?styles.active:""} aria-current={tab===x.id?"page":undefined} onClick={() => setTab(x.id)}>{en ? (x.id === "templates" ? "Candidate email" : x.label) : ({pipeline:"Pipeline", details:"Chi tiết Job", sourcing:"Nguồn tuyển", interviews:"Đặt lịch", templates:"Thư mời ứng viên", offers:"Offers", team:"Nhóm & Quyền", activity:"Hoạt động"} as Record<Tab, string>)[x.id]}</button>)}
    </nav>
    {tab === "pipeline" && <div className={styles.content}>{pipelineChildren}</div>}
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
    {tab === "interviews" && <BoschJobInterviews key={job.id} jobId={job.id} initialApplicationId={initialBookingApplicationId} showWorklist={false} onAccessLost={onAccessLost || NOOP_ACCESS} onAllInterviews={() => onModule("interviews")}/>}
    {tab === "templates" && <BoschInterviewTemplates key={job.id} jobId={job.id} initialApplication={selectedApplication} jobTitle={job.title} onAccessLost={onAccessLost || NOOP_ACCESS}/>}
    {tab === "offers" && canViewOffers && <section className={styles.embedded} aria-label="Job Offers">
      <BoschOffersWorkspace key={job.id} job={job} onAccessLost={onAccessLost || NOOP_ACCESS}/>
    </section>}
    {tab === "team" && (canAdmin ? <JobTeamAccess key={job.id} job={job} onAccessLost={onAccessLost || NOOP_ACCESS}/> : <section className={styles.aux} aria-label={en ? "Team & Access" : "Nhóm & Phân quyền"}>
      <div className={styles.sectionHead}><div><h2>{en ? "Team & Access" : "Nhóm & Phân quyền"}</h2><p>{en ? "Your current permissions for this Job." : "Quyền truy cập của tài khoản hiện tại đối với Job này."}</p></div></div>
      <div className={styles.detailsGrid}>
        <section className={styles.detailPane}><h3>{en ? "Your roles on this Job" : "Vai trò trên Job này"}</h3>
          <p>{roles.length ? roles.map((role) => roleLabel(role, copy)).join(", ") : membershipLoadFailed ? (en ? "Could not verify Job role assignments" : "Không xác minh được phân công vai trò trên Job") : (en ? "No Job role assignment found" : "Không tìm thấy phân công vai trò trên Job này")}</p></section>
        <section className={styles.detailPane}><h3>{en ? "Available actions" : "Quyền thao tác"}</h3><dl className={styles.facts}>
          <dt>{en ? "Read Job" : "Xem Job"}</dt><dd>{en ? "Authorized" : "Được cấp quyền"}</dd>
          <dt>{en ? "Move applications" : "Chuyển stage"}</dt><dd>{canManageApplications ? (en ? "Allowed" : "Được phép") : (en ? "Read-only" : "Chỉ xem")}</dd>
          <dt>{en ? "View Offers" : "Xem Offers"}</dt><dd>{canViewOffers ? (en ? "Allowed" : "Được phép") : (en ? "Not available" : "Không có quyền")}</dd>
        </dl></section>
      </div>
      <p className={styles.footnote}>{en ? "Contact your administrator to change team assignments." : "Liên hệ Admin để thay đổi phân công đội ngũ."}</p>
    </section>)}
    {tab === "activity" && <BoschJobActivity key={job.id} jobId={job.id} onAccessLost={onAccessLost || NOOP_ACCESS}/>}
  </section>;
}

