"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowRight, BriefcaseBusiness, CalendarClock, CheckCircle2, ChevronRight, ClipboardCheck, Clock3 } from "lucide-react";
import type { Job } from "@/lib/policy";
import { listInterviewWorklist, type InterviewWorklistItem } from "@/lib/interviews";
import { ApiError } from "@/lib/supabase";
import { useLanguage } from "./language";
import styles from "./bosch-home-dashboard.module.css";

type Props = {
  jobs: Job[];
  roles: string[];
  onOpenJob: (job: Job) => void;
  onOpenJobs: () => void;
  onOpenInterviews: () => void;
  onAccessLost: () => void;
};
const dash = "—";
const LIST_LIMIT = 25;
const WEEK_MS = 7 * 86400000;

function formatDate(value: string, locale: "vi" | "en", includeDate = true) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return dash;
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "vi-VN", includeDate
    ? { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }
    : { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatPriority(value: Job["priority"], en: boolean) {
  if (!value) return dash;
  return en ? value : ({ CRITICAL: "Khẩn cấp", HIGH: "Cao", NORMAL: "Bình thường", LOW: "Thấp" } as Record<string, string>)[value] || value;
}

function accessError(error: unknown) {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export default function BoschHomeDashboard({ jobs, roles, onOpenJob, onOpenJobs, onOpenInterviews, onAccessLost }: Props) {
  const { locale } = useLanguage();
  const en = locale === "en";
  const [scheduled, setScheduled] = useState<InterviewWorklistItem[]>([]);
  const [feedbackItems, setFeedbackItems] = useState<InterviewWorklistItem[]>([]);
  const [interviewLoading, setInterviewLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const request = useRef(0);

  const loadWork = useCallback(async () => {
    const version = ++request.current;
    setInterviewLoading(true);
    setScheduleError("");
    setFeedbackError("");
    const [scheduledResult, completedResult] = await Promise.allSettled([
      listInterviewWorklist("SCHEDULED", LIST_LIMIT, 0),
      listInterviewWorklist("COMPLETED", LIST_LIMIT, 0),
    ]);
    if (version !== request.current) return;
    let lostAccess = false;
    if (scheduledResult.status === "fulfilled") setScheduled(scheduledResult.value);
    else {
      setScheduled([]);
      setScheduleError(scheduledResult.reason instanceof Error ? scheduledResult.reason.message : (en ? "Could not load the schedule." : "Không tải được lịch phỏng vấn."));
      lostAccess ||= accessError(scheduledResult.reason);
    }
    if (completedResult.status === "fulfilled") {
      setFeedbackItems(completedResult.value.filter((item) => !item.feedback_submitted && (item.is_participant || item.can_decide || item.can_manage)));
    } else {
      setFeedbackItems([]);
      setFeedbackError(completedResult.reason instanceof Error ? completedResult.reason.message : (en ? "Could not load pending feedback." : "Không tải được feedback cần gửi."));
      lostAccess ||= accessError(completedResult.reason);
    }
    if (lostAccess) onAccessLost();
    setInterviewLoading(false);
  }, [en, onAccessLost]);

  useEffect(() => {
    void loadWork();
    return () => { request.current += 1; };
  }, [loadWork]);

  const now = Date.now();
  const weekEnd = now + WEEK_MS;
  const upcoming = useMemo(() => scheduled
    .filter((item) => {
      const starts = Date.parse(item.starts_at);
      return Number.isFinite(starts) && starts >= now && starts <= weekEnd;
    })
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)), [scheduled, now, weekEnd]);

  const drafts = jobs.filter((job) => job.status === "DRAFT");
  const openJobs = jobs.filter((job) => job.status === "OPEN");
  const priorityJobs = jobs.filter((job) => job.status === "OPEN" && (job.priority === "CRITICAL" || job.priority === "HIGH"));
  const attentionJobs = [...drafts, ...priorityJobs].slice(0, 4);
  const isAdmin = roles.includes("ADMIN");
  const isTA = roles.includes("TA_RECRUITER");
  const isDepartmentHead = roles.some((role) => ["DEPARTMENT_HEAD", "DEPT_HEAD", "DH"].includes(role));
  const isHiringManager = roles.includes("HIRING_MANAGER");
  const scope = isAdmin ? (en ? "Authorized organization scope" : "Phạm vi tổ chức được phân quyền")
    : isTA ? (en ? "Jobs assigned to you" : "Các Job được phân công cho bạn")
      : isDepartmentHead ? (en ? "Jobs in your authorized department scope" : "Job trong phạm vi phòng ban được phân quyền")
        : isHiringManager ? (en ? "Jobs assigned to your hiring scope" : "Job trong phạm vi tuyển dụng được phân quyền")
      : (en ? "Jobs and interviews you can access" : "Job và lịch phỏng vấn bạn được phép xem");
  const perspective = isAdmin ? (en ? "ADMIN WORKSPACE" : "KHÔNG GIAN ADMIN")
    : isTA ? (en ? "RECRUITER WORKSPACE" : "KHÔNG GIAN TA")
      : isDepartmentHead ? (en ? "DEPARTMENT HEAD WORKSPACE" : "GÓC NHÌN TRƯỞNG PHÒNG BAN")
        : isHiringManager ? (en ? "HIRING MANAGER WORKSPACE" : "GÓC NHÌN HIRING MANAGER")
          : (en ? "YOUR RECRUITMENT WORKSPACE" : "KHÔNG GIAN TUYỂN DỤNG CỦA BẠN");
  const overviewTitle = isDepartmentHead
    ? (en ? "Department hiring overview" : "Tổng quan tuyển dụng phòng ban")
    : isTA
      ? (en ? "Recruitment work for today" : "Việc tuyển dụng hôm nay")
      : (en ? "Recruitment overview" : "Tổng quan tuyển dụng");

  const metrics = [
    { label: en ? "Open jobs" : "Job đang mở", value: openJobs.length, icon: BriefcaseBusiness, tone: "neutral" },
    { label: en ? "Draft jobs" : "Job bản nháp", value: drafts.length, icon: ClipboardCheck, tone: drafts.length ? "warning" : "neutral" },
    { label: en ? "Feedback to submit" : "Feedback cần gửi", value: feedbackError ? dash : feedbackItems.length, icon: AlertCircle, tone: feedbackItems.length ? "warning" : "neutral" },
    { label: en ? "Interviews · next 7 days" : "Phỏng vấn · 7 ngày tới", value: scheduleError || interviewLoading ? dash : upcoming.length, icon: CalendarClock, tone: "neutral" },
  ] as const;

  return <section className={styles.root} aria-label={en ? "Recruitment overview" : "Tổng quan tuyển dụng"}>
    <div className={styles.crumb}>Home <ChevronRight size={13}/>{en ? "Overview" : "Tổng quan"}</div>
    <header className={styles.hero}>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>{perspective}</p>
        <h1>{overviewTitle}</h1>
        <p className={styles.subtitle}>{en ? "See your authorized jobs, upcoming interviews, and the next actions to take." : "Xem Job được phân quyền, lịch phỏng vấn sắp tới và việc cần xử lý tiếp theo."}</p>
        <span className={styles.scope}><span className={styles.scopeDot}/>{scope}</span>
      </div>
      <div className={styles.heroActions}>
        <button type="button" className={styles.primaryAction} onClick={onOpenJobs}>{en ? "Open Jobs" : "Mở Job tuyển dụng"}<ArrowRight size={16}/></button>
        <button type="button" className={styles.secondaryAction} onClick={onOpenInterviews}>{en ? "Open interviews" : "Mở lịch phỏng vấn"}<CalendarClock size={16}/></button>
      </div>
    </header>

    <section className={styles.metrics} aria-label={en ? "At a glance" : "Tóm tắt nhanh"}>
      {metrics.map(({ label, value, icon: Icon, tone }) => <div className={`${styles.metric} ${tone === "warning" ? styles.metricWarning : ""}`} key={label}>
        <span className={styles.metricIcon}><Icon size={17}/></span>
        <span className={styles.metricText}><strong>{value}</strong><small>{label}</small></span>
      </div>)}
    </section>

    <div className={styles.contentGrid}>
      <section className={styles.card} aria-label={en ? "Next actions" : "Việc cần làm tiếp theo"}>
        <div className={styles.cardHeading}>
          <div><p className={styles.eyebrow}>{en ? "NEXT STEPS" : "BƯỚC TIẾP THEO"}</p><h2>{en ? "Needs your attention" : "Việc cần bạn chú ý"}</h2></div>
          <span className={styles.countBadge}>{feedbackItems.length + attentionJobs.length}</span>
        </div>
        {feedbackError && <div className={styles.inlineError} role="alert"><span>{feedbackError}</span><button type="button" onClick={() => void loadWork()}>{en ? "Retry" : "Tải lại"}</button></div>}
        {!feedbackError && feedbackItems.slice(0, 3).map((item) => <button type="button" key={`feedback-${item.id}`} className={styles.taskRow} onClick={onOpenInterviews}>
          <span className={`${styles.taskIcon} ${styles.taskIconRed}`}><AlertCircle size={17}/></span>
          <span className={styles.taskCopy}><strong>{en ? "Submit interview feedback" : "Gửi feedback phỏng vấn"}</strong><small>{item.candidate_name} · {item.job_title || item.job_code || dash}</small></span>
          <span className={styles.taskAction}>{en ? "Open" : "Mở"}<ChevronRight size={15}/></span>
        </button>)}
        {attentionJobs.map((job) => {
          const isDraft = job.status === "DRAFT";
          return <button type="button" key={`job-${job.id}`} className={styles.taskRow} onClick={() => onOpenJob(job)}>
            <span className={`${styles.taskIcon} ${isDraft ? styles.taskIconAmber : styles.taskIconBlue}`}>{isDraft ? <ClipboardCheck size={17}/> : <BriefcaseBusiness size={17}/>}</span>
            <span className={styles.taskCopy}><strong>{isDraft ? (en ? "Complete draft job" : "Hoàn thiện Job bản nháp") : (en ? "Review high-priority job" : "Job ưu tiên cao / khẩn cấp")}</strong><small>{job.title} · {job.job_code || dash}</small></span>
            <span className={styles.taskAction}>{en ? "Open" : "Mở"}<ChevronRight size={15}/></span>
          </button>;
        })}
        {!feedbackItems.length && !attentionJobs.length && !feedbackError && <div className={styles.emptyState}><CheckCircle2 size={21}/><p>{en ? "Nothing needs attention in the data currently available to you." : "Hiện không có việc cần chú ý trong dữ liệu bạn được phép xem."}</p></div>}
        <p className={styles.cardFootnote}>{en ? "Draft and priority jobs are reminders; no overdue SLA or pending offer is inferred." : "Job nháp và Job ưu tiên là mục nhắc theo dõi; Home không tự kết luận quá SLA hay Offer đang chờ duyệt."}</p>
      </section>

      <section className={styles.card} aria-label={en ? "Upcoming interviews" : "Lịch phỏng vấn sắp tới"}>
        <div className={styles.cardHeading}>
          <div><p className={styles.eyebrow}>{en ? "YOUR CALENDAR" : "LỊCH CỦA BẠN"}</p><h2>{en ? "Next 7 days" : "7 ngày tới"}</h2></div>
          <button type="button" className={styles.textAction} onClick={onOpenInterviews}>{en ? "All interviews" : "Tất cả lịch"}<ArrowRight size={15}/></button>
        </div>
        {scheduleError && <div className={styles.inlineError} role="alert"><span>{scheduleError}</span><button type="button" onClick={() => void loadWork()}>{en ? "Retry" : "Tải lại"}</button></div>}
        {interviewLoading && <p className={styles.loading} role="status">{en ? "Loading your schedule…" : "Đang tải lịch của bạn…"}</p>}
        {!interviewLoading && !scheduleError && (upcoming.length ? upcoming.slice(0, 5).map((item) => <div className={styles.interviewRow} key={item.id}>
          <span className={styles.dateBlock}><strong>{formatDate(item.starts_at, locale).split(",")[1]?.trim().split(" ")[0] || "—"}</strong><small>{formatDate(item.starts_at, locale).split(",")[0]}</small></span>
          <span className={styles.interviewCopy}><strong>{item.candidate_name}</strong><small>{item.job_title || item.job_code || dash}</small><small><Clock3 size={13}/>{formatDate(item.starts_at, locale, false)}</small></span>
        </div>) : <div className={styles.emptyState}><CalendarClock size={21}/><p>{en ? "No upcoming interviews in the next 7 days." : "Không có lịch phỏng vấn trong 7 ngày tới."}</p></div>)}
        <p className={styles.cardFootnote}>{en ? "Schedule is limited to the first authorized API page (up to 25 interviews)." : "Lịch lấy từ trang API được phân quyền đầu tiên (tối đa 25 lịch)."}</p>
      </section>
    </div>

    <section className={styles.jobsCard}>
      <div className={styles.cardHeading}>
        <div><p className={styles.eyebrow}>{en ? "YOUR JOBS" : "JOB CỦA BẠN"}</p><h2>{en ? "Hiring at a glance" : "Tình hình các Job"}</h2></div>
        <button type="button" className={styles.textAction} onClick={onOpenJobs}>{en ? "View all jobs" : "Xem tất cả Job"}<ArrowRight size={15}/></button>
      </div>
      <div className={styles.jobsSummary}>
        <span><strong>{openJobs.length}</strong>{en ? "open" : "đang mở"}</span>
        <span><strong>{drafts.length}</strong>{en ? "draft" : "bản nháp"}</span>
        <span><strong>{priorityJobs.length}</strong>{en ? "high priority" : "ưu tiên cao"}</span>
      </div>
      <div className={styles.jobList}>
        {[...attentionJobs, ...openJobs.filter((job) => !priorityJobs.some((priorityJob) => priorityJob.id === job.id))].slice(0, 5).map((job) => <button type="button" className={styles.jobRow} key={job.id} onClick={() => onOpenJob(job)}>
          <span className={styles.jobBrief}><strong>{job.title}</strong><small>{job.job_code || dash} · {job.business_unit || (en ? "No department" : "Chưa có phòng ban")}</small></span>
          <span className={`${styles.jobState} ${job.status === "DRAFT" ? styles.jobDraft : ""}`}>{job.status === "DRAFT" ? (en ? "Draft" : "Bản nháp") : (en ? "Open" : "Đang mở")}</span>
          <span className={styles.jobPriority}>{formatPriority(job.priority, en)}</span>
          <ChevronRight size={16}/>
        </button>)}
        {!jobs.length && <p className={styles.loading}>{en ? "No jobs are available in your current access scope." : "Chưa có Job trong phạm vi truy cập hiện tại."}</p>}
      </div>
    </section>

    <p className={styles.bottomNote}>{en ? "Reports stay separate from Home. Counts reflect authorized data returned by current APIs." : "Báo cáo là mục riêng, không trộn vào Home. Các số liệu chỉ phản ánh dữ liệu API trả về theo quyền hiện tại."}</p>
  </section>;
}
