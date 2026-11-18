"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  MapPin,
  RefreshCw,
  UserRound,
  Video,
} from "lucide-react";
import { listJobRecruiters, type JobRecruiter } from "@/lib/admin-jobs";
import type { Job } from "@/lib/policy";
import type { InterviewWorklistItem } from "@/lib/interviews";
import { approvalReturnPath, type WorkflowOffer } from "@/lib/offer-approval";
import { ApiError } from "@/lib/supabase";
import {
  allInterviews,
  allMyTasks,
  allHomeOffers,
  todaysInterviews,
  localDay,
  HOME_TIME_ZONE,
  safeMeetingUrl,
  interviewKind,
  type RecruitmentTask,
} from "@/lib/home-data";
import {
  buildHomeTasks,
  homePerspectives,
  type HomeTask,
  type HomePerspective,
} from "@/lib/home-model";
import { useLanguage } from "./language";
import HomeWorkDialog from "./home-work-dialog";
import styles from "./bosch-home-dashboard.module.css";
type Props = {
  jobs: Job[];
  roles: string[];
  userName: string;
  userId?: string;
  onOpenJob: (job: Job) => void;
  onOpenJobs: () => void;
  onOpenInterviews: () => void;
  onAccessLost: () => void;
};
const SIZE = 6;
const labels: Record<HomePerspective, [string, string]> = {
  PERSONAL: ["Cá nhân", "Personal"],
  ADMIN: ["Admin", "Admin"],
  RECRUITER: ["TA", "Recruiter"],
  APPROVER: ["Người duyệt", "Approver"],
  HIRING_MANAGER: ["Hiring Manager", "Hiring Manager"],
  INTERVIEWER: ["Người phỏng vấn", "Interviewer"],
};
const groups: Record<HomeTask["group"], [string, string]> = {
  applications: ["Đánh giá hồ sơ", "Application review"],
  assigned: ["Công việc được giao", "Assigned tasks"],
  feedback: ["Đánh giá phỏng vấn", "Interview feedback"],
  followup: ["Theo dõi phản hồi", "Follow-up"],
  approval: ["Đề xuất chờ tôi duyệt", "My pending approvals"],
  job: ["Job cần xử lý", "Job reminders"],
};
const icons = {
  applications: FileText,
  assigned: ClipboardCheck,
  feedback: CalendarClock,
  followup: CalendarClock,
  approval: ClipboardCheck,
  job: BriefcaseBusiness,
};
export default function BoschHomeDashboard({
  jobs,
  roles,
  userName,
  userId = "",
  onOpenJob,
  onOpenJobs,
  onOpenInterviews,
  onAccessLost,
}: Props) {
  const { locale } = useLanguage(),
    en = locale === "en",
    tr = (vi: string, english: string) => (en ? english : vi);
  const [interviews, setInterviews] = useState<InterviewWorklistItem[]>([]),
    [tasks, setTasks] = useState<RecruitmentTask[]>([]),
    [offers, setOffers] = useState<WorkflowOffer[]>([]);
  const [busy, setBusy] = useState(true),
    [errors, setErrors] = useState<Record<string, boolean>>({}),
    [now, setNow] = useState(Date.now());
  const [recruiters, setRecruiters] = useState<JobRecruiter[] | undefined>(undefined);
  const jobIdsKey = [...new Set(jobs.map(j => j.id))].sort().join(",");
  const [proposalId, setProposalId] = useState("");
  const [selected, setPerspective] = useState<HomePerspective | null>(null),
    [page, setPage] = useState(0),
    [jobPage, setJobPage] = useState(0);
  const [chosen, setChosen] = useState<{
    taskId?: string;
    interview?: InterviewWorklistItem;
  } | null>(null);
  const ticket = useRef(0),
    inflight = useRef(false);
  const load = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    const id = ++ticket.current,
      current = () => ticket.current === id;
    setBusy(true);
    setErrors({});
    setRecruiters(undefined);
    const r = await Promise.allSettled([
      Promise.all([
        allInterviews("SCHEDULED", current),
        allInterviews("COMPLETED", current),
        allInterviews("CANCELLED", current),
      ]).then((p) => [...new Map(p.flat().map((i) => [i.id, i])).values()]),
      allMyTasks(current),
      allHomeOffers(current),
      listJobRecruiters(jobIdsKey ? jobIdsKey.split(",") : []),
    ]);
    if (!current()) return;
    const failed: Record<string, boolean> = {};
    r.forEach((x, index) => {
      if (x.status === "rejected") {
        failed[["interviews", "tasks", "offers", "assignments"][index]] = true;
        if (x.reason instanceof ApiError && x.reason.status === 401)
          onAccessLost();
      }
    });
    setInterviews(r[0].status === "fulfilled" ? r[0].value : []);
    setTasks(r[1].status === "fulfilled" ? r[1].value : []);
    setOffers(r[2].status === "fulfilled" ? r[2].value : []);
    setRecruiters(r[3].status === "fulfilled" ? r[3].value : undefined);
    setErrors(failed);
    setNow(Date.now());
    setBusy(false);
    inflight.current = false;
  }, [onAccessLost, jobIdsKey]);
  useEffect(() => {
    void load();
    const focus = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    const timer = window.setInterval(focus, 60000);
    return () => {
      ticket.current++;
      inflight.current = false;
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
      window.clearInterval(timer);
    };
  }, [load]);
  const mine = offers.filter((o) => o.approver_id === userId),
    perspectives = homePerspectives(roles, mine);
  const perspective =
    selected && perspectives.includes(selected) ? selected : perspectives[0];
  const isPersonal = roles.length === 0 && !mine.length;
  const today = useMemo(
    () => todaysInterviews(interviews, now),
    [interviews, now],
  );
  const agenda =
    perspective === "INTERVIEWER"
      ? today.filter((i) => i.is_participant)
      : today;
  const ownFeedback = interviews.filter(
    (i) =>
      i.status === "COMPLETED" && i.is_participant && !i.feedback_submitted,
  );
  const allTasks = useMemo(
    () =>
      buildHomeTasks({
        perspective,
        recruiters,
        userId,
        userName,
        jobs,
        tasks,
        interviews,
        offers,
        en,
      }),
    [perspective, recruiters, userId, userName, jobs, tasks, interviews, offers, en],
  );
  const taskError =
    !!errors.tasks ||
    (perspective !== "APPROVER" && !!errors.interviews) ||
    (["APPROVER", "ADMIN", "RECRUITER"].includes(perspective) &&
      !!errors.offers);
  const lastPage = Math.max(0, Math.ceil(allTasks.length / SIZE) - 1),
    activePage = Math.min(page, lastPage),
    rows = allTasks.slice(activePage * SIZE, (activePage + 1) * SIZE);
  const attention = jobs.filter(
    (j) =>
      j.status === "DRAFT" ||
      (j.status === "OPEN" && ["HIGH", "CRITICAL"].includes(j.priority || "")),
  );
  const jp = Math.min(
    jobPage,
    Math.max(0, Math.ceil(attention.length / SIZE) - 1),
  );
  const pending = mine.filter((o) => o.status === "PENDING" && o.can_approve),
    approved = mine.filter((o) => o.status === "APPROVED"),
    rejected = mine.filter((o) => o.status === "REJECTED");
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  function openOffer(id?: string) {
    const path = id ? approvalReturnPath(base, id) : `${base}/offer-approval/`;
    if (path) window.location.assign(path);
  }
  function openTask(t: HomeTask) {
    if (t.action === "job" && t.job) onOpenJob(t.job);
    else if (t.action === "offer") openOffer(t.target);
    else if (t.action === "task") setChosen({ taskId: t.target });
    else {
      const i = interviews.find((i) => i.id === t.target);
      if (i) setChosen({ interview: i });
    }
  }
  const todayLabel = new Intl.DateTimeFormat(en ? "en-GB" : "vi-VN", {
    timeZone: HOME_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(now));
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: HOME_TIME_ZONE,
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date(now)),
  );
  const greeting = en
    ? hour < 12
      ? "Good morning"
      : hour < 18
        ? "Good afternoon"
        : "Good evening"
    : "Xin chào";
  const time = (v: string) =>
    new Intl.DateTimeFormat(en ? "en-GB" : "vi-VN", {
      timeZone: HOME_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(v));
  const due = (v: string | null) =>
    !v
      ? tr("Chưa có hạn xử lý", "No due date")
      : localDay(v) === localDay(now)
        ? tr("Đến hạn hôm nay", "Due today")
        : new Intl.DateTimeFormat(en ? "en-GB" : "vi-VN", {
            timeZone: HOME_TIME_ZONE,
            day: "numeric",
            month: "short",
          }).format(new Date(v));
  const screeningCount = jobs.every((j) => j.metrics != null)
    ? jobs.reduce((sum, j) => sum + (j.metrics?.screening_count || 0), 0)
    : null;
  const metrics =
    perspective === "APPROVER"
      ? [
          {
            label: tr("Chờ tôi duyệt", "Awaiting my approval"),
            value: pending.length,
            unknown: errors.offers,
            Icon: ClipboardCheck,
            action: () => openOffer(pending[0]?.id),
          },
          {
            label: tr("Đã duyệt nội bộ", "Internally approved"),
            value: approved.length,
            unknown: errors.offers,
            Icon: CheckCircle2,
            action: () => openOffer(),
          },
          {
            label: tr("Đề xuất không được duyệt", "Declined proposals"),
            value: rejected.length,
            unknown: errors.offers,
            Icon: FileText,
            action: () => openOffer(),
          },
        ]
      : perspective === "HIRING_MANAGER"
        ? [
            {
              label: tr("Hồ sơ ở vòng sơ loại", "Applications at screening"),
              value: screeningCount || 0,
              unknown: screeningCount === null,
              Icon: FileText,
              action: onOpenJobs,
            },
            {
              label: tr("Feedback cần gửi", "Feedback to submit"),
              value: ownFeedback.length,
              unknown: errors.interviews,
              Icon: ClipboardCheck,
              action: () =>
                ownFeedback[0]
                  ? setChosen({ interview: ownFeedback[0] })
                  : onOpenInterviews(),
            },
            {
              label: tr("Phỏng vấn hôm nay", "Interviews today"),
              value: agenda.length,
              unknown: errors.interviews,
              Icon: CalendarClock,
              action: () => document.getElementById("home-agenda")?.focus(),
            },
          ]
        : [
            {
              label: tr("Feedback cần gửi", "Feedback to submit"),
              value: ownFeedback.length,
              unknown: errors.interviews,
              Icon: ClipboardCheck,
              action: () =>
                ownFeedback[0]
                  ? setChosen({ interview: ownFeedback[0] })
                  : onOpenInterviews(),
            },
            {
              label: tr("Phỏng vấn hôm nay", "Interviews today"),
              value: agenda.length,
              unknown: errors.interviews,
              Icon: CalendarClock,
              action: () => document.getElementById("home-agenda")?.focus(),
            },
            ["INTERVIEWER", "PERSONAL"].includes(perspective)
              ? {
                  label: tr("Công việc được giao", "Assigned tasks"),
                  value: tasks.length,
                  unknown: errors.tasks,
                  Icon: BriefcaseBusiness,
                  action: () => document.getElementById("home-tasks")?.focus(),
                }
              : {
                  label: tr("Job cần theo dõi", "Jobs needing attention"),
                  value: attention.length,
                  unknown: false,
                  Icon: BriefcaseBusiness,
                  action: onOpenJobs,
                },
          ];
  return (
    <section
      className={styles.root}
      aria-label={tr("Tổng quan tuyển dụng", "Recruitment overview")}
    >
      <div className={styles.crumb}>
        Home <ChevronRight size={13} />
        {tr("Tổng quan", "Overview")}
      </div>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>
            {isPersonal
              ? tr("KHÔNG GIAN CỦA BẠN", "YOUR WORKSPACE")
              : `${labels[perspective][en ? 1 : 0].toUpperCase()} ${en ? "WORKSPACE" : "· CÔNG VIỆC"}`}
          </p>
          <h1>
            {greeting}, {userName}
          </h1>
          <p className={styles.todayLabel}>{todayLabel}</p>
          <span className={styles.scope}>
            <span className={styles.scopeDot} />
            {perspective === "ADMIN"
              ? tr("Không gian toàn tổ chức", "Organization workspace")
              : perspective === "APPROVER"
                ? tr(
                    "Đề xuất được chỉ định cho bạn",
                    "Proposals assigned to you",
                  )
                : tr(
                    "Công việc được giao và Job bạn được xem",
                    "Your assigned work and accessible jobs",
                  )}
          </span>
        </div>
        <div className={styles.heroActions}>
          <button
            type="button"
            className={styles.outlineAction}
            onClick={() => void load()}
            disabled={busy}
          >
            <RefreshCw size={16} />
            {tr("Tải lại", "Refresh")}
          </button>
          <button
            type="button"
            className={styles.primaryAction}
            disabled={busy || !allTasks.length}
            onClick={() => allTasks[0] && openTask(allTasks[0])}
          >
            {tr("Xử lý việc ưu tiên", "Review priority tasks")}
            <ArrowRight size={16} />
          </button>
        </div>
      </header>
      {perspectives.length > 1 && (
        <div
          className={styles.perspectives}
          role="group"
          aria-label={tr("Góc nhìn Home", "Home perspective")}
        >
          {perspectives.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={p === perspective}
              onClick={() => {
                setPerspective(p);
                setPage(0);
              }}
            >
              {labels[p][en ? 1 : 0]}
            </button>
          ))}
        </div>
      )}
      <section
        className={styles.metrics}
        aria-label={tr("Tóm tắt nhanh", "At a glance")}
      >
        {metrics.map((m) => (
          <button
            type="button"
            className={`${styles.metric} ${styles.metricBlue}`}
            onClick={m.action}
            key={m.label}
          >
            <span className={styles.metricIcon}>
              <m.Icon size={24} />
            </span>
            <span className={styles.metricText}>
              <strong>{busy || m.unknown ? "—" : m.value}</strong>
              <small>{m.label}</small>
            </span>
            <ChevronRight size={18} className={styles.metricArrow} />
          </button>
        ))}
      </section>
      {Object.keys(errors).length > 0 && (
        <div className={styles.inlineError} role="alert">
          <span>
            {tr(
              "Một số công việc chưa tải được. Dấu — nghĩa là chưa có tổng chính xác.",
              "Some work could not be loaded. A dash means its exact total is unavailable.",
            )}{" "}
            {Object.keys(errors)
              .map(
                (k) =>
                  ({
                    tasks: tr("Công việc", "Tasks"),
                    offers: tr("Đề xuất", "Proposals"),
                    interviews: tr("Phỏng vấn", "Interviews"),
                  })[k],
              )
              .join(" · ")}
          </span>
          <button type="button" onClick={() => void load()} disabled={busy}>
            {tr("Thử lại", "Retry")}
          </button>
        </div>
      )}
      <div className={styles.contentGrid}>
        <section
          className={styles.card}
          id="home-tasks"
          tabIndex={-1}
          aria-label={tr("Việc cần làm tiếp theo", "Next actions")}
        >
          <div className={styles.cardHeading}>
            <div>
              <h2>
                {perspective === "APPROVER"
                  ? tr("Đề xuất & việc của tôi", "My approvals & tasks")
                  : tr("Việc cần làm", "My tasks")}
              </h2>
              <p className={styles.subtitle}>
                {tr(
                  "Công việc và phân công thực tế trong phạm vi của bạn.",
                  "Action items and real assignments in your workspace.",
                )}
              </p>
            </div>
            <span className={styles.countBadge}>
              {busy || taskError ? "—" : allTasks.length}
            </span>
          </div>
          {busy && (
            <p role="status" className={styles.loading}>
              {tr("Đang tải đầy đủ công việc…", "Loading all tasks…")}
            </p>
          )}
          {!busy &&
            Object.keys(groups).map((key) => {
              const g = key as HomeTask["group"],
                items = rows.filter((t) => t.group === g),
                Icon = icons[g];
              return items.length ? (
                <div key={g} className={styles.taskGroup}>
                  <h3>
                    <Icon size={18} />
                    {groups[g][en ? 1 : 0]}{" "}
                    <span>
                      ({allTasks.filter((t) => t.group === g).length})
                    </span>
                  </h3>
                  {items.map((t) => (
                    <div key={t.id} className={styles.richTask}>
                      <div className={styles.taskCopy}>
                        <button
                          type="button"
                          className={styles.taskTitle}
                          onClick={() => openTask(t)}
                        >
                          {t.title}
                        </button>
                        <small>{t.context}</small>
                      </div>
                      <span
                        className={`${styles.taskDue} ${t.due && Date.parse(t.due) < now ? styles.overdue : ""}`}
                      >
                        <CalendarClock size={16} />
                        {due(t.due)}
                      </span>
                      <span className={styles.taskOwner}>
                        <UserRound size={18} />
                        <span>
                          {t.owner}
                          <small>{t.role}</small>
                        </span>
                      </span>
                      <button
                        type="button"
                        className={styles.outlineAction}
                        onClick={() => openTask(t)}
                      >
                        {t.action === "offer"
                          ? tr("Xem đề xuất", "View proposal")
                          : t.action === "interview"
                            ? tr("Xem feedback", "View feedback")
                            : t.action === "task"
                              ? tr("Xem công việc", "View task")
                              : tr("Mở Job", "Open job")}
                      </button>
                    </div>
                  ))}
                </div>
              ) : null;
            })}
          {!busy && !allTasks.length && !taskError && (
            <div className={styles.emptyState}>
              <CheckCircle2 size={22} />
              <p>
                {tr(
                  "Bạn đã xử lý hết việc cần chú ý.",
                  "You’re all caught up. No assigned work needs attention.",
                )}
              </p>
            </div>
          )}
          {!busy && allTasks.length > 0 && (
            <div className={styles.pager}>
              <span>
                {tr("Đang xem", "Showing")} {activePage * SIZE + 1}–
                {Math.min((activePage + 1) * SIZE, allTasks.length)} /{" "}
                {allTasks.length}
                {taskError ? tr(" việc đã tải", " loaded tasks") : ""}
              </span>
              <button
                type="button"
                className={styles.outlineAction}
                disabled={activePage === 0}
                onClick={() => setPage(activePage - 1)}
              >
                {tr("Trước", "Previous")}
              </button>
              <span>
                {activePage + 1}/{lastPage + 1}
              </span>
              <button
                type="button"
                className={styles.outlineAction}
                disabled={activePage >= lastPage}
                onClick={() => setPage(activePage + 1)}
              >
                {tr("Tiếp", "Next")}
              </button>
            </div>
          )}
        </section>
        {perspective === "APPROVER" ? (
          <section
            className={styles.card}
            aria-label={tr("Chi tiết đề xuất", "Proposal preview")}
          >
            <div className={styles.cardHeading}>
              <h2>{tr("Xem đề xuất", "Proposal preview")}</h2>
            </div>
            {busy ? (
              <p role="status">
                {tr("Đang tải đề xuất…", "Loading proposals…")}
              </p>
            ) : errors.offers ? (
              <p>
                {tr(
                  "Chưa tải được đề xuất. Vui lòng thử lại.",
                  "Proposals unavailable. Please retry.",
                )}
              </p>
            ) : mine.length ? (
              <>
                <label className={styles.proposalPicker}>
                  {tr("Đề xuất được chỉ định", "Assigned proposal")}
                  <select
                    value={
                      mine.some((o) => o.id === proposalId)
                        ? proposalId
                        : mine[0].id
                    }
                    onChange={(e) => setProposalId(e.target.value)}
                  >
                    {mine.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.candidate_name} · {o.job_title}
                      </option>
                    ))}
                  </select>
                </label>
                {(() => {
                  const o = mine.find((o) => o.id === proposalId) || mine[0],
                    f = o.snapshot || o.fields;
                  return (
                    <>
                      <h3>{o.candidate_name}</h3>
                      <p>{o.job_title}</p>
                      <dl className={styles.proposalFacts}>
                        <dt>{tr("Trạng thái", "Status")}</dt>
                        <dd>
                          {o.status === "PENDING"
                            ? tr(
                                "Chờ duyệt nội bộ",
                                "Pending internal approval",
                              )
                            : o.status === "APPROVED"
                              ? tr("Đã duyệt nội bộ", "Internally approved")
                              : o.status}
                        </dd>
                        <dt>Level</dt>
                        <dd>{f?.level || "—"}</dd>
                        <dt>{tr("Phòng ban", "Department")}</dt>
                        <dd>{f?.department || "—"}</dd>
                        <dt>{tr("Chức năng", "Function")}</dt>
                        <dd>{f?.function || "—"}</dd>
                        <dt>{tr("Lương đề xuất", "Proposed salary")}</dt>
                        <dd>
                          {typeof f?.salary === "number"
                            ? new Intl.NumberFormat(
                                en ? "en-GB" : "vi-VN",
                              ).format(f.salary) +
                              " " +
                              f.currency
                            : "—"}
                        </dd>
                        <dt>Onboard</dt>
                        <dd>{f?.start_date || "—"}</dd>
                      </dl>
                      <button
                        type="button"
                        className={styles.primaryAction}
                        onClick={() => openOffer(o.id)}
                      >
                        {tr("Mở đề xuất để duyệt", "Open proposal to decide")}
                        <ArrowRight size={16} />
                      </button>
                    </>
                  );
                })()}
              </>
            ) : (
              <div className={styles.emptyState}>
                <CheckCircle2 size={22} />
                <p>
                  {tr(
                    "Chưa có đề xuất được chỉ định cho bạn.",
                    "No proposals are assigned to you.",
                  )}
                </p>
              </div>
            )}
          </section>
        ) : (
          <section
            className={styles.card}
            id="home-agenda"
            tabIndex={-1}
            aria-label={tr(
              "Lịch phỏng vấn hôm nay",
              "Today's interview agenda",
            )}
          >
            <div className={styles.cardHeading}>
              <div>
                <h2>{tr("Phỏng vấn hôm nay", "Today's interviews")}</h2>
                <p className={styles.subtitle}>
                  {busy || errors.interviews ? "—" : agenda.length}{" "}
                  {tr("lịch hôm nay", "appointments today")} · GMT+7
                </p>
              </div>
              <button
                type="button"
                className={styles.textAction}
                onClick={onOpenInterviews}
              >
                {tr("Tất cả lịch", "All interviews")}
                <ArrowRight size={15} />
              </button>
            </div>
            {busy ? (
              <p role="status" className={styles.loading}>
                {tr("Đang tải lịch…", "Loading schedule…")}
              </p>
            ) : errors.interviews ? (
              <p>
                {tr(
                  "Chưa tải được lịch. Vui lòng thử lại.",
                  "Schedule unavailable. Please retry.",
                )}
              </p>
            ) : agenda.length ? (
              <>
                <div
                  className={styles.agendaScroll}
                  tabIndex={0}
                  role="region"
                  aria-label={tr(
                    "Cuộn để xem tất cả lịch hôm nay",
                    "Scroll to view all today's interviews",
                  )}
                >
                  {agenda.map((i) => (
                    <div
                      className={`${styles.interviewRow} ${i.status === "CANCELLED" ? styles.cancelled : ""}`}
                      key={i.id}
                    >
                      <span className={styles.dateBlock}>
                        <strong>
                          {time(i.starts_at)}–{time(i.ends_at)}
                        </strong>
                        <small>GMT+7</small>
                      </span>
                      <div className={styles.interviewCopy}>
                        <button
                          className={styles.taskTitle}
                          type="button"
                          onClick={() => setChosen({ interview: i })}
                        >
                          {i.candidate_name}
                        </button>
                        <small>{i.job_title || i.job_code || "—"}</small>
                        <small>
                          {safeMeetingUrl(i.meeting_url) ? (
                            <Video size={14} />
                          ) : (
                            <MapPin size={14} />
                          )}{" "}
                          {interviewKind(i.interview_type, en)} ·{" "}
                          {i.location ||
                            (safeMeetingUrl(i.meeting_url)
                              ? tr("Trực tuyến", "Online")
                              : tr(
                                  "Chưa có địa điểm",
                                  "Location not specified",
                                ))}
                        </small>
                        <small>
                          <UserRound size={14} />
                          {i.participants
                            ?.map((p) => p.display_name)
                            .join(", ") ||
                            tr(
                              "Chưa có thông tin người phỏng vấn",
                              "No interviewer returned",
                            )}
                        </small>
                        <span
                          className={`${styles.appointmentState} ${i.status === "COMPLETED" ? styles.completed : ""}`}
                        >
                          {i.status === "COMPLETED"
                            ? tr("Hoàn tất", "Completed")
                            : i.status === "CANCELLED"
                              ? tr("Đã hủy", "Cancelled")
                              : tr("Đã lên lịch", "Scheduled")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className={styles.cardFootnote}>
                  {agenda.length}{" "}
                  {tr(
                    "lịch · Cuộn để xem tất cả",
                    "appointments · Scroll to see all",
                  )}
                </p>
              </>
            ) : (
              <div className={styles.emptyState}>
                <CalendarClock size={22} />
                <p>
                  {tr(
                    "Hôm nay chưa có lịch phỏng vấn.",
                    "No interviews scheduled for today.",
                  )}
                </p>
              </div>
            )}
            <button
              type="button"
              className={styles.outlineAction}
              onClick={onOpenInterviews}
            >
              <CalendarClock size={17} />
              {tr("Mở lịch phỏng vấn", "View schedule")}
            </button>
          </section>
        )}
      </div>
      {perspective === "APPROVER" ? (
        <section className={styles.jobsCard}>
          <div className={styles.cardHeading}>
            <h2>{tr("Đề xuất được chỉ định", "Assigned proposals")}</h2>
            <button
              type="button"
              className={styles.textAction}
              onClick={() => openOffer()}
            >
              {tr("Tất cả đề xuất", "All proposals")}
              <ArrowRight size={15} />
            </button>
          </div>
          {!busy && !errors.offers && (
            <p>
              {pending.length}{" "}
              {tr(
                "đề xuất đang chờ bạn quyết định. Mở đề xuất để kiểm tra trước khi duyệt.",
                "awaiting your decision. Review the proposal before approving.",
              )}
            </p>
          )}
        </section>
      ) : (
        perspective !== "INTERVIEWER" && (
          <section className={styles.jobsCard}>
            <div className={styles.cardHeading}>
              <h2>{tr("Job cần chú ý", "Jobs needing attention")}</h2>
              <button
                type="button"
                className={styles.textAction}
                onClick={onOpenJobs}
              >
                {tr("Xem tất cả Job", "View all jobs")}
                <ArrowRight size={15} />
              </button>
            </div>
            {attention.slice(jp * SIZE, (jp + 1) * SIZE).map((j) => (
              <button
                type="button"
                key={j.id}
                className={styles.jobRow}
                aria-label={`${tr("Mở pipeline", "Open pipeline")} ${j.title}`}
                onClick={() => onOpenJob(j)}
              >
                <span className={styles.jobBrief}>
                  <strong>{j.title}</strong>
                  <small>
                    {[j.job_code, j.business_unit]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </small>
                </span>
                <span
                  className={`${styles.jobReason} ${j.status === "DRAFT" ? styles.draftReason : ""}`}
                >
                  {j.status === "DRAFT"
                    ? tr("Cần hoàn thiện bản nháp", "Draft needs completion")
                    : tr("Ưu tiên cao", "High priority")}
                </span>
                <span
                  className={`${styles.jobState} ${j.status === "DRAFT" ? styles.jobDraft : ""}`}
                >
                  {j.status === "DRAFT"
                    ? tr("Bản nháp", "Draft")
                    : tr("Đang tuyển", "Open")}
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
            {attention.length > SIZE && (
              <div className={styles.pager}>
                <span>
                  {jp * SIZE + 1}–{Math.min((jp + 1) * SIZE, attention.length)}{" "}
                  / {attention.length}
                </span>
                <button
                  type="button"
                  className={styles.outlineAction}
                  disabled={jp === 0}
                  onClick={() => setJobPage(jp - 1)}
                >
                  {tr("Trước", "Previous")}
                </button>
                <button
                  type="button"
                  className={styles.outlineAction}
                  disabled={(jp + 1) * SIZE >= attention.length}
                  onClick={() => setJobPage(jp + 1)}
                >
                  {tr("Tiếp", "Next")}
                </button>
              </div>
            )}
          </section>
        )
      )}
      {chosen && (
        <HomeWorkDialog
          {...chosen}
          userId={userId}
          roles={roles}
          en={en}
          onClose={() => setChosen(null)}
          onChanged={() => void load()}
          onAccessLost={onAccessLost}
        />
      )}
    </section>
  );
}
