"use client";

import { useState } from "react";
import {
  ArrowUpRight, BriefcaseBusiness, Building2, CalendarDays, ChevronLeft,
  ChevronRight, FileText, Layers3, Mail, MapPin, Phone,
} from "lucide-react";
import type { CandidateProfile } from "@/lib/candidates";
import type { Job } from "@/lib/policy";
import { driveLink } from "@/lib/policy";
import styles from "./bosch-v2-candidates.module.css";

type SourceOption = { sub_source: string; source: string; source_ownership: string };
type Props = {
  profile: CandidateProfile;
  jobs: Job[];
  openJobs: Job[];
  en: boolean;
  jobId: string;
  subSource: string;
  sourceOptions: SourceOption[];
  sourceLoadError: string;
  busy: boolean;
  message: string;
  profileError: string;
  requestRetry: boolean;
  onJobChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onAddToJob: () => void;
  onOpenJob?: (job: Job) => void;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
};

export default function BoschCandidateDetail({
  profile, jobs, openJobs, en, jobId, subSource, sourceOptions, sourceLoadError,
  busy, message, profileError, requestRetry, onJobChange, onSourceChange,
  onAddToJob, onOpenJob, onPrevious, onNext, hasPrevious, hasNext,
}: Props) {
  const [tab, setTab] = useState<"overview" | "resume">("overview");
  const t = (vi: string, english: string) => en ? english : vi;
  const candidate = profile.candidate;
  const assigned = profile.applications.flatMap((application) => {
    const job = jobs.find((item) => item.id === application.job_id);
    return job ? [{ application, job }] : [];
  });
  const eligibleJobs = openJobs.filter((job) => !profile.applications.some((app) => app.job_id === job.id));
  const firstJob = assigned[0]?.job;
  const docs = <div className={styles.detailSection}>
    <h4 className={styles.detailSectionTitle}><FileText size={16} aria-hidden="true"/>{t("CV / Tài liệu", "CV / Documents")}</h4>
    {profile.documents.length ? <ul className={styles.documentList}>
      {profile.documents.map((document) => {
        const url = driveLink(document.drive_url);
        return <li key={`${document.drive_file_id}-${document.created_at}`}>
          <span title={document.original_name}>{document.original_name}</span>
          {url ? <a href={url} target="_blank" rel="noopener noreferrer">{t("Mở CV", "Open CV")} <ArrowUpRight size={13} aria-hidden="true"/></a>
            : <small>{t("Link không hợp lệ", "Invalid link")}</small>}
        </li>;
      })}
    </ul> : <p className={styles.muted}>{t("Chưa có CV trong hồ sơ.", "No CV documents saved on this profile.")}</p>}
  </div>;

  return <>
    <header className={styles.detailHead}>
      <div className={styles.detailHeadRow}>
        <h3>{candidate.full_name}</h3>
        <div className={styles.detailNav}>
          <button type="button" onClick={onPrevious} disabled={!hasPrevious} aria-label={t("Ứng viên trước", "Previous candidate")} title={t("Ứng viên trước", "Previous candidate")}><ChevronLeft size={18}/></button>
          <button type="button" onClick={onNext} disabled={!hasNext} aria-label={t("Ứng viên sau", "Next candidate")} title={t("Ứng viên sau", "Next candidate")}><ChevronRight size={18}/></button>
        </div>
      </div>
      <p className={styles.detailRole}>{candidate.current_title || candidate.primary_role || t("Chưa có chức danh", "Title unavailable")}</p>
      <div className={styles.detailContactLine}>
        {candidate.email && <span title={candidate.email}><Mail size={15} aria-hidden="true"/>{candidate.email}</span>}
        {candidate.phone && <span><Phone size={15} aria-hidden="true"/>{candidate.phone}</span>}
        {candidate.location && <span><MapPin size={15} aria-hidden="true"/>{candidate.location}</span>}
      </div>
      <nav className={styles.detailTabs} aria-label={t("Thông tin hồ sơ", "Candidate detail tabs")}>
        <button type="button" className={tab === "overview" ? styles.detailTabActive : ""} aria-current={tab === "overview" ? "page" : undefined} onClick={() => setTab("overview")}>{t("Tổng quan", "Overview")}</button>
        <button type="button" className={tab === "resume" ? styles.detailTabActive : ""} aria-current={tab === "resume" ? "page" : undefined} onClick={() => setTab("resume")}>{t("Hồ sơ CV", "Resume")}</button>
      </nav>
    </header>
    {profileError && <p className={`${styles.notice} ${styles.error}`} role="alert">{profileError}</p>}
    {message && <p className={`${styles.notice} ${styles.success}`} role="status">{message}</p>}
    <div className={styles.detailBody}>
      {tab === "resume" ? docs : <>
        <section className={styles.detailSection}>
          <h4 className={styles.detailSectionTitle}>{t("Liên hệ", "Contact")}</h4>
          <div className={styles.detailFactLines}>
            <div><Mail size={16} aria-hidden="true"/><span>{candidate.email || "—"}</span></div>
            <div><Phone size={16} aria-hidden="true"/><span>{candidate.phone || "—"}</span></div>
            <div><MapPin size={16} aria-hidden="true"/><span>{candidate.location || "—"}</span></div>
          </div>
        </section>
        <section className={styles.detailSection}>
          <h4 className={styles.detailSectionTitle}>{t("Công việc hiện tại", "Current Role")}</h4>
          <div className={styles.detailFactLines}>
            <div><BriefcaseBusiness size={16} aria-hidden="true"/><span>{candidate.current_title || candidate.primary_role || "—"}</span></div>
            <div><Building2 size={16} aria-hidden="true"/><span>{candidate.current_company || "—"}</span></div>
            <div><CalendarDays size={16} aria-hidden="true"/><span>{candidate.total_experience_years == null ? "—" : `${candidate.total_experience_years} ${t("năm", "yrs")}`}</span></div>
            {candidate.seniority && <div><Layers3 size={16} aria-hidden="true"/><span>{candidate.seniority}</span></div>}
          </div>
        </section>
        {/* Skills intentionally absent: CandidateProfile API contract has no skills field. */}
        {docs}
        <section className={styles.detailSection}>
          <div className={styles.detailSectionHeading}>
            <h4 className={styles.detailSectionTitle}>{t("Jobs", "Jobs")} ({assigned.length})</h4>
            {onOpenJob && firstJob && <button type="button" className={styles.viewJob} onClick={() => onOpenJob(firstJob)}>{t("Xem Job", "View Job")} <ArrowUpRight size={13} aria-hidden="true"/></button>}
          </div>
          {assigned.length ? <ul className={styles.assignmentList}>
            {assigned.map(({ job, application }) => <li key={application.id}>
              {onOpenJob ? <button type="button" className={styles.assignmentTitle} onClick={() => onOpenJob(job)}>{job.title}</button> : <strong className={styles.assignmentTitleStatic}>{job.title}</strong>}
              {job.business_unit && <div className={styles.assignmentUnit}><BriefcaseBusiness size={14} aria-hidden="true"/>{job.business_unit}</div>}
              <div className={styles.assignmentMeta}>
                <span className={`${styles.assignmentStage} ${application.stage.toUpperCase() === "INTERVIEW" ? styles.stageInterview : ["SCREEN","SCREENING"].includes(application.stage.toUpperCase()) ? styles.stageScreen : styles.stageNeutral}`}>{application.stage}</span>
                <span>{application.status}</span>
              </div>
            </li>)}
          </ul> : <p className={styles.muted}>{t("Chưa có Job trong phạm vi bạn được xem.", "No assigned Jobs in your access scope.")}</p>}
        </section>
        <section className={styles.detailSection}>
          <h4 className={styles.detailSectionTitle}>{t("Thêm vào Job", "Add to Job")}</h4>
          {eligibleJobs.length ? <div className={styles.addControls}>
            <select aria-label={t("Chọn Job để thêm ứng viên", "Select Job to add candidate")} value={jobId} onChange={(event) => onJobChange(event.target.value)}>
              <option value="">{t("Chọn Job đang mở", "Select an open Job")}</option>
              {eligibleJobs.map((job) => <option key={job.id} value={job.id}>{job.job_code ? `${job.job_code} · ` : ""}{job.title}</option>)}
            </select>
            <select aria-label={t("Chọn nguồn ứng viên", "Select candidate source")} value={subSource} onChange={(event) => onSourceChange(event.target.value)} disabled={!!sourceLoadError}>
              <option value="">{t("Chọn nguồn ứng viên", "Select candidate source")}</option>
              {sourceOptions.map((source) => <option key={source.sub_source} value={source.sub_source}>{source.sub_source} · {source.source} · {source.source_ownership}</option>)}
            </select>
            <button className={styles.primary} type="button" disabled={!jobId || !subSource || busy || !sourceOptions.length} onClick={onAddToJob}>
              {busy ? t("Đang thêm…", "Adding…") : requestRetry ? t("Thử lại", "Retry") : t("Thêm vào Job", "Add to Job")}
            </button>
          </div> : <p className={styles.muted}>{t("Không có Job đang mở mà bạn có quyền thêm hồ sơ này.", "No eligible open Job is available for this candidate.")}</p>}
          {sourceLoadError && <p className={`${styles.notice} ${styles.error}`} role="alert">{t("Không tải được danh mục nguồn tuyển dụng.", "Could not load the recruitment source catalog.")}</p>}
        </section>
      </>}
    </div>
  </>;
}
