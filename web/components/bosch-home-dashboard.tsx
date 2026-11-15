"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronRight, Clock3, Search, ShieldAlert } from "lucide-react";
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
const SCHEDULE_LIMIT = 25;
const MS_DAY = 86400000;
const dash = "—";

function safeDate(value: string, locale: "vi" | "en") {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return dash;
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "vi-VN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(date);
}
function readablePriority(value: Job["priority"], en: boolean) {
  if (!value) return dash;
  if (en) return value;
  return ({ CRITICAL: "Khẩn cấp", HIGH: "Cao", NORMAL: "Bình thường", LOW: "Thấp" } as Record<string, string>)[value] || value;
}
function jobRisk(job: Job): number {
  return job.priority === "CRITICAL" ? 0 : job.priority === "HIGH" ? 1 : job.status === "DRAFT" ? 2 : 3;
}
function countMetric(jobs: Job[], key: keyof NonNullable<Job["metrics"]>): number | null {
  if (!jobs.length || jobs.some((job) => !job.metrics)) return null;
  return jobs.reduce((total, job) => {
    const value = job.metrics?.[key];
    return total + (typeof value === "number" && Number.isFinite(value) ? value : 0);
  }, 0);
}

export default function BoschHomeDashboard({
  jobs, roles, onOpenJob, onOpenJobs, onOpenInterviews, onAccessLost,
}: Props) {
  const { locale } = useLanguage();
  const en = locale === "en";
  const [period, setPeriod] = useState<"all" | "week">("all");
  const [section, setSection] = useState<"overview" | "actions" | "jobs">("overview");
  const [query, setQuery] = useState("");
  const [scheduled, setScheduled] = useState<InterviewWorklistItem[]>([]);
  const [interviewLoading, setInterviewLoading] = useState(true);
  const [interviewError, setInterviewError] = useState("");
  const request = useRef(0);

  const loadInterviews = useCallback(async () => {
    const version = ++request.current;
    setInterviewLoading(true);
    setInterviewError("");
    setScheduled([]);
    try {
      const items = await listInterviewWorklist("SCHEDULED", SCHEDULE_LIMIT, 0);
      if (version === request.current) setScheduled(items);
    } catch (cause: unknown) {
      if (version !== request.current) return;
      setInterviewError(cause instanceof Error ? cause.message : (en ? "Unable to load interviews." : "Không tải được lịch phỏng vấn."));
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) onAccessLost();
    } finally {
      if (version === request.current) setInterviewLoading(false);
    }
  }, [en, onAccessLost]);

  useEffect(() => {
    void loadInterviews();
    return () => { request.current += 1; };
  }, [loadInterviews]);

  const now = Date.now();
  const today = new Date(now);
  const weekEnd = now + 7 * MS_DAY;
  const upcoming = useMemo(() => scheduled
    .filter((item) => {
      const time = Date.parse(item.starts_at);
      return Number.isFinite(time) && time >= now && (period !== "week" || time <= weekEnd);
    })
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)), [scheduled, now, period, weekEnd]);

  const isAdmin = roles.includes("ADMIN");
  const isTA = roles.includes("TA_RECRUITER");
  const isInterviewer = roles.includes("INTERVIEWER") && !isAdmin && !isTA && !roles.includes("HIRING_MANAGER");
  const scope = isAdmin
    ? (en ? "Your authorized organization scope" : "Phạm vi tổ chức được phân quyền")
    : isTA ? (en ? "Your assigned jobs" : "Job được phân công")
      : isInterviewer ? (en ? "Your interview assignments" : "Lịch phỏng vấn được phân công")
        : (en ? "Your accessible jobs" : "Job được phép truy cập");

  const summary = [
    { label: en ? "Jobs Loaded" : "Job đã tải", value: String(jobs.length) },
    { label: en ? "Open Jobs" : "Job đang mở", value: String(jobs.filter((job) => job.status === "OPEN").length) },
    { label: en ? "Job Applications" : "Hồ sơ theo Job", value: countMetric(jobs, "total_candidates") },
    { label: en ? "Scheduled (page)" : "Lịch đã lên (trang)", value: interviewLoading || interviewError ? null : upcoming.length },
    { label: en ? "Pending Offers" : "Offer chờ duyệt", value: null },
  ];
  const pipeline = [
    { label: en ? "New" : "Mới", value: countMetric(jobs, "new_count") },
    { label: en ? "Screening" : "Sơ loại", value: countMetric(jobs, "screening_count") },
    { label: en ? "Interview" : "Phỏng vấn", value: countMetric(jobs, "interview_count") },
    // OFFER has its own backend workflow; Application metrics do not provide a reliable Offer total.
    { label: "Offer", value: null },
    { label: en ? "Hired" : "Đã tuyển", value: countMetric(jobs, "hired_count") },
  ];
  const priorityJobs = [...jobs]
    .filter((job) => job.status === "OPEN" || job.status === "DRAFT")
    .sort((a, b) => jobRisk(a) - jobRisk(b) || (a.job_code || "").localeCompare(b.job_code || ""));
  const filteredJobs = priorityJobs.filter((job) =>
    `${job.job_code || ""} ${job.title}`.toLocaleLowerCase(locale).includes(query.trim().toLocaleLowerCase(locale)));
  const actionJobs = priorityJobs.filter((job) =>
    job.status === "DRAFT" || job.priority === "CRITICAL" || job.priority === "HIGH").slice(0, 4);

  return <section className={styles.root} aria-label={en ? "Recruitment Dashboard" : "Tổng quan tuyển dụng"}>
    <div className={styles.crumb}>Home <ChevronRight size={13}/>{en ? "Dashboard" : "Tổng quan"}</div>
    <div className={styles.heading}>
      <div><h1>{en ? "Recruitment Dashboard" : "Tổng quan tuyển dụng"}</h1>
        <p>{en ? "Hiring activity and priorities in your authorized workspace." : "Tình hình tuyển dụng và công việc ưu tiên trong phạm vi được cấp quyền."}</p></div>
      <label className={styles.period}>
        <CalendarDays size={15}/>
        <span className={styles.visuallyHidden}>{en ? "Schedule period" : "Khoảng lịch phỏng vấn"}</span>
        <select aria-label={en ? "Schedule period" : "Khoảng lịch phỏng vấn"} value={period} onChange={(event) => setPeriod(event.target.value === "week" ? "week" : "all")}>
          <option value="all">{en ? "Upcoming schedule" : "Lịch sắp tới"}</option>
          <option value="week">{en ? "Next 7 days" : "7 ngày tới"}</option>
        </select>
      </label>
    </div>
    <nav className={styles.tabs} aria-label={en ? "Dashboard views" : "Chế độ xem Home"}>
      {([
        ["overview", en ? "Overview" : "Tổng quan"],
        ["actions", en ? "My Activities" : "Việc cần làm"],
        ["jobs", en ? "Job Priorities" : "Job ưu tiên"],
      ] as const).map(([id, label]) => <button key={id} type="button" className={section === id ? styles.active : ""}
        aria-current={section === id ? "page" : undefined} onClick={() => setSection(id)}>{label}</button>)}
    </nav>

    <div className={styles.summary}>
      <div className={styles.panelTitle}><h2>{en ? "Recruitment Summary" : "Tổng quan tuyển dụng"}</h2><small>{scope}</small></div>
      <div className={styles.metrics}>
        {summary.map((item, index) => <div key={item.label} className={`${styles.metric} ${index === 1 ? styles.highlight : ""}`}>
          <strong>{item.value ?? dash}</strong><span>{item.label}</span>
        </div>)}
      </div>
      <p className={styles.hint}>{en
        ? "Jobs are limited to the authorized loaded result (max 100). Applications count Job associations, not unique candidates. Missing API metrics show —."
        : "Số Job theo dữ liệu đã tải (tối đa 100). Hồ sơ là lượt gắn với Job, không phải số ứng viên duy nhất. Thiếu chỉ số API sẽ hiển thị —."}</p>
    </div>

    <div className={styles.dashboardGrid}>
      <div className={styles.mainColumn}>
        {section !== "jobs" && <section className={styles.panel}>
          <div className={styles.panelTitle}><h2>{en ? "Hiring Pipeline" : "Pipeline tuyển dụng"}</h2><button type="button" onClick={onOpenJobs}>{en ? "View Jobs" : "Xem Jobs"} <ChevronRight size={13}/></button></div>
          <div className={styles.pipeline}>
            {pipeline.map((item, i) => <div key={item.label} className={`${styles.stage} ${i === 2 ? styles.stageHighlight : ""}`}>
              <strong>{item.value ?? dash}</strong><span>{item.label}</span>
            </div>)}
          </div>
          <p className={styles.hint}>{en ? "Aggregated Job-stage counts from existing metrics. Offer is a separate approval workflow." : "Cộng các stage theo Job từ API. Offer thuộc workflow phê duyệt riêng, không tự suy ra từ stage."}</p>
        </section>}
        {section !== "jobs" && <section className={styles.panel}>
          <div className={styles.panelTitle}><h2>{en ? "Action Required" : "Cần chú ý"}</h2><button type="button" onClick={() => setSection("jobs")}>{en ? "Job priorities" : "Job ưu tiên"} <ChevronRight size={13}/></button></div>
          {actionJobs.length ? actionJobs.map((job) => <button type="button" key={job.id} className={styles.actionRow} onClick={() => onOpenJob(job)}>
            <span className={styles.actionIcon}><ShieldAlert size={16}/></span>
            <span className={styles.actionText}><strong>{job.title}</strong><small>{job.job_code || dash} · {job.status === "DRAFT" ? (en ? "Draft" : "Bản nháp") : (en ? "Priority" : "Ưu tiên")}</small></span>
            <span className={styles.priority}>{job.status === "DRAFT" ? "DRAFT" : readablePriority(job.priority, en)}</span>
          </button>) : <p className={styles.empty}>{en ? "No flagged high-priority or draft Jobs in the loaded scope." : "Không có Job ưu tiên cao hoặc bản nháp trong dữ liệu đã tải."}</p>}
          <p className={styles.hint}>{en ? "Priority and Draft are real Job fields; this is not an SLA overdue calculation." : "Chỉ dùng Priority và trạng thái Draft có thật; không suy diễn Job quá SLA."}</p>
        </section>}
        {section !== "actions" && <section className={styles.panel}>
          <div className={styles.panelTitle}><h2>{en ? "Jobs Needing Attention" : "Danh sách Job ưu tiên"}</h2><button type="button" onClick={onOpenJobs}>{en ? "All Jobs" : "Tất cả Job"} <ChevronRight size={13}/></button></div>
          <div className={styles.toolbar}><label className={styles.search}><Search size={15}/><input value={query}
            onChange={(event) => setQuery(event.target.value)} aria-label={en ? "Search Home Jobs" : "Tìm Job trên Home"}
            placeholder={en ? "Search Job ID or position" : "Tìm mã hoặc tên Job"}/></label></div>
          <div className={styles.tableScroll}><table><thead><tr>
            <th>{en ? "Job Opening / ID" : "Vị trí / Mã Job"}</th>
            <th>{en ? "Owner" : "Phụ trách"}</th><th>{en ? "Applications" : "Hồ sơ"}</th><th>{en ? "Status / Priority" : "Trạng thái / Ưu tiên"}</th>
          </tr></thead><tbody>
            {filteredJobs.slice(0, 8).map((job) => <tr key={job.id}>
              <td><button type="button" className={styles.jobLink} onClick={() => onOpenJob(job)}>{job.title}</button><small>{job.job_code || dash}</small></td>
              <td>{dash}</td><td>{job.metrics?.total_candidates ?? dash}</td>
              <td><span className={styles.status}>{job.status}</span><small>{readablePriority(job.priority, en)}</small></td>
            </tr>)}
          </tbody></table></div>
          {!filteredJobs.length && <p className={styles.empty}>{en ? "No Jobs match the search." : "Không tìm thấy Job phù hợp."}</p>}
          <p className={styles.hint}>{en ? "Owner is unavailable from the current authorized Job list API." : "Người phụ trách chưa có trong API danh sách Job hiện tại."}</p>
        </section>}
      </div>

      <div className={styles.rightColumn}>
        <section className={styles.panel}>
          <div className={styles.panelTitle}><h2>{en ? "Upcoming Interviews" : "Lịch phỏng vấn sắp tới"}</h2>
            <button type="button" onClick={onOpenInterviews}>{en ? "View all" : "Xem lịch"} <ChevronRight size={13}/></button></div>
          {interviewError && <div className={styles.error} role="alert">
            <p>{interviewError}</p><button type="button" onClick={() => void loadInterviews()}>{en ? "Retry" : "Thử lại"}</button>
          </div>}
          {interviewLoading && <p className={styles.empty} role="status">{en ? "Loading interviews…" : "Đang tải lịch phỏng vấn…"}</p>}
          {!interviewLoading && !interviewError && (upcoming.length ? upcoming.slice(0, 5).map((item) =>
            <div className={styles.interview} key={item.id}>
              <div className={styles.clock}><Clock3 size={16}/></div>
              <div><strong>{item.candidate_name}</strong><p>{item.job_title || item.job_code || dash}</p>
                <small>{safeDate(item.starts_at, locale)}</small></div>
            </div>) : <p className={styles.empty}>{en ? "No upcoming appointments in the current API page." : "Chưa có lịch sắp tới trong trang API hiện tại."}</p>)}
          <p className={styles.hint}>{en ? "Showing scheduled appointments from the first authorized API page (max 25), not a complete schedule count." : "Chỉ lấy trang đầu API lịch đã lên (tối đa 25), không phải tổng lịch toàn hệ thống."}</p>
        </section>
        <section className={styles.panel}>
          <div className={styles.panelTitle}><h2>{en ? "Recruitment Insights" : "Thông tin vận hành"}</h2></div>
          <div className={styles.insights}>
            <div><span>{en ? "High / Critical Jobs" : "Job ưu tiên cao / khẩn cấp"}</span><strong>{jobs.filter((job) => job.priority === "HIGH" || job.priority === "CRITICAL").length}</strong></div>
            <div><span>{en ? "Draft Jobs" : "Job bản nháp"}</span><strong>{jobs.filter((job) => job.status === "DRAFT").length}</strong></div>
            <div><span>{en ? "Interview Stage Applications" : "Hồ sơ ở stage Interview"}</span><strong>{countMetric(jobs, "interview_count") ?? dash}</strong></div>
          </div>
        </section>
      </div>
    </div>
    <p className={styles.bottomNote}>{en ? "This dashboard only displays information authorized by the existing APIs. No activity SLA, salary or approval data is inferred." : "Home chỉ hiển thị dữ liệu được API hiện có cho phép. Không tự suy luận SLA quá hạn, lương hoặc tiến độ duyệt Offer."}</p>
  </section>;
}
