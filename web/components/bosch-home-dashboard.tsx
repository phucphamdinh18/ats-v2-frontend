"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowRight, BriefcaseBusiness, CalendarClock, CheckCircle2, ChevronRight, ClipboardCheck } from "lucide-react";
import type { Job } from "@/lib/policy";
import { listInterviewWorklist, type InterviewWorklistItem } from "@/lib/interviews";
import { ApiError } from "@/lib/supabase";
import { useLanguage } from "./language";
import styles from "./bosch-home-dashboard.module.css";

type Props = {
  jobs: Job[];
  roles: string[];
  userName: string;
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
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "vi-VN", { timeZone: "Asia/Ho_Chi_Minh", ...(includeDate
    ? { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }
    : { hour: "2-digit", minute: "2-digit" }) }).format(date);
}

function dateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

function accessError(error: unknown) {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export default function BoschHomeDashboard({ jobs, roles, userName, onOpenJob, onOpenJobs, onOpenInterviews, onAccessLost }: Props) {
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
      setScheduleError(en ? "Could not load your interviews. Please try again." : "Chưa tải được lịch phỏng vấn. Vui lòng thử lại.");
      lostAccess ||= accessError(scheduledResult.reason);
    }
    if (completedResult.status === "fulfilled") {
      setFeedbackItems(completedResult.value.filter((item) => !item.feedback_submitted && (item.is_participant || item.can_decide || item.can_manage)));
    } else {
      setFeedbackItems([]);
      setFeedbackError(en ? "Could not load feedback tasks. Please try again." : "Chưa tải được việc cần gửi feedback. Vui lòng thử lại.");
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
  const todayKey = dateKey(new Date());
  const todayInterviews = upcoming.filter((item) => dateKey(new Date(item.starts_at)) === todayKey);

  const drafts = jobs.filter((job) => job.status === "DRAFT");
  const priorityJobs = jobs.filter((job) => job.status === "OPEN" && (job.priority === "CRITICAL" || job.priority === "HIGH"));
  const attentionJobs = [...drafts, ...priorityJobs].slice(0, 4);
  const isAdmin = roles.includes("ADMIN");
  const isTA = roles.includes("TA_RECRUITER");
  const isDepartmentHead = roles.some((role) => ["DEPARTMENT_HEAD", "DEPT_HEAD", "DH"].includes(role));
  const isHiringManager = roles.includes("HIRING_MANAGER");
  const scope = isAdmin ? (en ? "Organization workspace" : "Không gian toàn tổ chức")
    : isTA ? (en ? "Jobs assigned to you" : "Các Job được phân công cho bạn")
      : isDepartmentHead ? (en ? "Jobs in your authorized department scope" : "Job trong phạm vi phòng ban được phân quyền")
        : isHiringManager ? (en ? "Jobs assigned to your hiring scope" : "Job trong phạm vi tuyển dụng được phân quyền")
      : (en ? "Jobs and interviews you can access" : "Job và lịch phỏng vấn bạn được phép xem");
  const perspective = isAdmin ? (en ? "ADMIN WORKSPACE" : "KHÔNG GIAN ADMIN")
    : isTA ? (en ? "RECRUITER WORKSPACE" : "KHÔNG GIAN TA")
      : isDepartmentHead ? (en ? "DEPARTMENT HEAD WORKSPACE" : "GÓC NHÌN TRƯỞNG PHÒNG BAN")
        : isHiringManager ? (en ? "HIRING MANAGER WORKSPACE" : "GÓC NHÌN HIRING MANAGER")
          : (en ? "YOUR RECRUITMENT WORKSPACE" : "KHÔNG GIAN TUYỂN DỤNG CỦA BẠN");
  const greetingName = userName ? `${userName.charAt(0).toUpperCase()}${userName.slice(1)}` : "";
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  const greeting = en ? (hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening") : "Xin chào";
  const reviewPriority = () => {
    if (feedbackItems.length && !feedbackError) onOpenInterviews();
    else if (attentionJobs[0]) onOpenJob(attentionJobs[0]);
    else onOpenJobs();
  };
  const todayLabel = new Intl.DateTimeFormat(en ? "en-GB" : "vi-VN", { timeZone: "Asia/Ho_Chi_Minh", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

  const metrics = [
    { label: en ? "Feedback to submit" : "Feedback cần gửi", value: feedbackError || interviewLoading ? dash : feedbackItems.length, icon: ClipboardCheck, tone: feedbackItems.length ? "warning" : "blue", action: onOpenInterviews },
    { label: en ? "Interviews today" : "Phỏng vấn hôm nay", value: scheduleError || interviewLoading ? dash : todayInterviews.length, icon: CalendarClock, tone: "blue", action: onOpenInterviews },
    { label: en ? "Jobs needing attention" : "Job cần theo dõi", value: drafts.length + priorityJobs.length, icon: BriefcaseBusiness, tone: "neutral", action: onOpenJobs },
  ] as const;

  return <section className={styles.root} aria-label={en ? "Recruitment overview" : "Tổng quan tuyển dụng"}>
    <div className={styles.crumb}>Home <ChevronRight size={13}/>{en ? "Overview" : "Tổng quan"}</div>
    <header className={styles.hero}>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>{perspective}</p>
        <h1>{`${greeting}${greetingName ? `, ${greetingName}` : ""}`}</h1>
        <p className={styles.todayLabel}>{todayLabel}</p>
        <span className={styles.scope}><span className={styles.scopeDot}/>{scope}</span>
      </div>
      <div className={styles.heroActions}>
        <button type="button" className={styles.primaryAction} onClick={reviewPriority}>{en ? "Review priority tasks" : "Xử lý việc ưu tiên"}<ArrowRight size={16}/></button>
      </div>
    </header>

    <section className={styles.metrics} aria-label={en ? "At a glance" : "Tóm tắt nhanh"}>
      {metrics.map(({ label, value, icon: Icon, tone, action }) => <button type="button" onClick={action} className={`${styles.metric} ${tone === "warning" ? styles.metricWarning : tone === "blue" ? styles.metricBlue : ""}`} key={label}>
        <span className={styles.metricIcon}><Icon size={23}/></span>
        <span className={styles.metricText}><strong>{value}</strong><small>{label}</small></span><ChevronRight className={styles.metricArrow} size={18}/>
      </button>)}
    </section>

    <div className={styles.contentGrid}>
      <section className={styles.card} aria-label={en ? "Next actions" : "Việc cần làm tiếp theo"}>
        <div className={styles.cardHeading}>
          <div><h2>{en ? "My tasks" : "Việc cần làm"}</h2><p className={styles.subtitle}>{en ? "Your next steps to keep hiring moving." : "Những việc cần xử lý để tuyển dụng tiếp tục."}</p></div>
          <span className={styles.countBadge}>{interviewLoading || feedbackError ? dash : feedbackItems.length + attentionJobs.length}</span>
        </div>
        {feedbackError && <div className={styles.inlineError} role="alert"><span>{feedbackError}</span><button type="button" onClick={() => void loadWork()}>{en ? "Retry" : "Tải lại"}</button></div>}
        {!interviewLoading && !feedbackError && feedbackItems.slice(0, 3).map((item) => <button type="button" key={`feedback-${item.id}`} className={styles.taskRow} onClick={onOpenInterviews}>
          <span className={`${styles.taskIcon} ${styles.taskIconRed}`}><AlertCircle size={17}/></span>
          <span className={styles.taskCopy}><strong>{en ? "Submit interview feedback" : "Gửi feedback phỏng vấn"}</strong><small>{item.candidate_name} · {item.job_title || item.job_code || dash}</small></span>
          <span className={styles.taskAction}>{en ? "Submit feedback" : "Gửi feedback"}<ChevronRight size={15}/></span>
        </button>)}
        {attentionJobs.map((job) => {
          const isDraft = job.status === "DRAFT";
          return <button type="button" key={`job-${job.id}`} className={styles.taskRow} onClick={() => onOpenJob(job)}>
            <span className={`${styles.taskIcon} ${isDraft ? styles.taskIconAmber : styles.taskIconBlue}`}>{isDraft ? <ClipboardCheck size={17}/> : <BriefcaseBusiness size={17}/>}</span>
            <span className={styles.taskCopy}><strong>{isDraft ? (en ? "Complete draft job" : "Hoàn thiện Job bản nháp") : (en ? "Review high-priority job" : "Job ưu tiên cao / khẩn cấp")}</strong><small>{job.title}{job.job_code ? ` · ${job.job_code}` : ""}</small></span>
            <span className={styles.taskAction}>{isDraft ? (en ? "Complete draft" : "Hoàn thiện") : (en ? "Review job" : "Xem Job")}<ChevronRight size={15}/></span>
          </button>;
        })}
        {interviewLoading && <p className={styles.loading} role="status">{en ? "Loading tasks…" : "Đang tải công việc…"}</p>}
        {!interviewLoading && !feedbackItems.length && !attentionJobs.length && !feedbackError && <div className={styles.emptyState}><CheckCircle2 size={21}/><p>{en ? "You’re all caught up. No tasks need attention." : "Bạn đã xử lý hết việc cần chú ý."}</p></div>}
      </section>

      <section className={styles.card} aria-label={en ? "Upcoming interviews" : "Lịch phỏng vấn sắp tới"}>
        <div className={styles.cardHeading}>
          <div><h2>{en ? "Today's interviews" : "Phỏng vấn hôm nay"}</h2><p className={styles.subtitle}>{en ? `${interviewLoading || scheduleError ? dash : todayInterviews.length} scheduled today · GMT+7` : `${interviewLoading || scheduleError ? dash : todayInterviews.length} lịch hôm nay · GMT+7`}</p></div>
          <button type="button" className={styles.textAction} onClick={onOpenInterviews}>{en ? "All interviews" : "Tất cả lịch"}<ArrowRight size={15}/></button>
        </div>
        {scheduleError && <div className={styles.inlineError} role="alert"><span>{scheduleError}</span><button type="button" onClick={() => void loadWork()}>{en ? "Retry" : "Tải lại"}</button></div>}
        {interviewLoading && <p className={styles.loading} role="status">{en ? "Loading your schedule…" : "Đang tải lịch của bạn…"}</p>}
        {!interviewLoading && !scheduleError && (todayInterviews.length ? todayInterviews.slice(0, 5).map((item) => <div className={styles.interviewRow} key={item.id}>
          <span className={styles.dateBlock}><strong>{formatDate(item.starts_at, locale, false)}</strong><small>GMT+7</small></span>
          <span className={styles.interviewCopy}><strong>{item.candidate_name}</strong><small>{item.job_title || item.job_code || dash}</small></span>
        </div>) : <div className={styles.emptyState}><CalendarClock size={21}/><p>{en ? "No interviews scheduled for today." : "Hôm nay chưa có lịch phỏng vấn."}</p></div>)}
        {!interviewLoading && !scheduleError && upcoming.length > todayInterviews.length && <button type="button" className={styles.textAction} onClick={onOpenInterviews}>{en ? "View upcoming interviews" : "Xem lịch phỏng vấn sắp tới"}<ArrowRight size={15}/></button>}
        {!interviewLoading && !scheduleError && scheduled.length === LIST_LIMIT && <p className={styles.cardFootnote}>{en ? "Showing recent interviews. Open all interviews to see the full schedule." : "Đang hiển thị các lịch gần đây. Mở tất cả lịch để xem đầy đủ."}</p>}
      </section>
    </div>

    <section className={styles.jobsCard}>
      <div className={styles.cardHeading}>
        <div><h2>{en ? "Jobs needing attention" : "Job cần chú ý"}</h2></div>
        <button type="button" className={styles.textAction} onClick={onOpenJobs}>{en ? "View all jobs" : "Xem tất cả Job"}<ArrowRight size={15}/></button>
      </div>
      <div className={styles.jobList}>
        {attentionJobs.slice(0, 5).map((job) => <button type="button" className={styles.jobRow} key={job.id} aria-label={`${en ? "Open pipeline" : "Mở pipeline"} ${job.title}`} onClick={() => onOpenJob(job)}>
          <span className={styles.jobBrief}><strong>{job.title}</strong><small>{[job.job_code, job.business_unit].filter(Boolean).join(" · ") || dash}</small></span>
          <span className={`${styles.jobReason} ${job.status === "DRAFT" ? styles.draftReason : ""}`}>{job.status === "DRAFT" ? (en ? "Draft needs completion" : "Cần hoàn thiện bản nháp") : (en ? "High priority" : "Ưu tiên cao")}</span>
          <span className={`${styles.jobState} ${job.status === "DRAFT" ? styles.jobDraft : ""}`}>{job.status === "DRAFT" ? (en ? "Draft" : "Bản nháp") : (en ? "Open" : "Đang tuyển")}</span>
          <ChevronRight size={16}/>
        </button>)}
        {!attentionJobs.length && <div className={styles.emptyState}><CheckCircle2 size={21}/><p>{en ? "No draft or high-priority jobs need attention." : "Không có Job nháp hoặc Job ưu tiên cao cần theo dõi."}</p></div>}
      </div>
    </section>

  </section>;
}
