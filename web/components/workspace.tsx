"use client";
import { useUiText } from "./ui-text";
import { useCallback, useEffect, useRef, useState } from "react";
import { getClient } from "@/lib/supabase";
import {
  authRedirect,
  canManageApplicationStages,
  canReview,
  RequestGate,
  type Job,
  type JobMembership,
} from "@/lib/policy";
import ReviewQueue from "./review-queue";
import { useLanguage } from "./language";
import Icon from "./icon";
import LoadingState from "./loading-state";
import ApplicationPipeline from "./application-pipeline";
import PipelineJobSwitcher from "./pipeline-job-switcher";
import { jobOverview } from "@/lib/applications";
import TalentPool from "./talent-pool";
import InterviewWorkspace from "./interview-workspace";
import AdminConsole, { type JobAdminAction } from "./admin-console";
import { format, friendlyError, jobStatusLabel } from "@/lib/i18n";
type Access = {
  userId: string;
  email: string;
  roles: string[];
  active: boolean;
  jobs: Job[];
  memberships: JobMembership[];
};
export default function Workspace() {
  const tr = useUiText();
  const { t, locale, setLocale } = useLanguage();
  const [guideOpen, setGuideOpen] = useState(false);
  const [access, setAccess] = useState<Access | null>(null);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [localLoginVisible, setLocalLoginVisible] = useState(false);
  const [localLoginOpen, setLocalLoginOpen] = useState(false);
  const [localEmail, setLocalEmail] = useState("");
  const [localPassword, setLocalPassword] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"jobs" | "talent" | "jd" | "interviews">(
    "jobs",
  );
  const [jobAdminAction, setJobAdminAction] = useState<JobAdminAction | null>(
    null,
  );
  const [jobAdminBusy, setJobAdminBusy] = useState(false);
  function openJobAction(kind: JobAdminAction["kind"], jobId?: string) {
    if (jobAdminBusy) return;
    setTab("jobs");
    setJobView("manage");
    setInitialPipelineFilter("ALL");
    setJobAdminAction((previous) => ({
      kind,
      jobId,
      requestId: (previous?.requestId || 0) + 1,
    }));
  }
  function openJobsView(
    view: "master" | "pipeline" | "manage",
    filter = "ALL",
  ) {
    setTab("jobs");
    setJobView(view);
    setInitialPipelineFilter(filter);
  }
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobView, setJobView] = useState<"master" | "pipeline" | "manage">(
    "master",
  );
  const [initialPipelineFilter, setInitialPipelineFilter] = useState("ALL");
  const gate = useRef(new RequestGate());
  const metricsGate = useRef(new RequestGate());
  const loginStarted = useRef(false);
  const globalSearchRef = useRef<HTMLInputElement>(null);
  const authUser = useRef<string | null>(null);
  useEffect(() => {
    const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(
      window.location.hostname,
    );
    setLocalLoginVisible(process.env.NODE_ENV === "development" && isLoopback);
  }, []);
  const invalidate = useCallback(() => {
    metricsGate.current.invalidate();
    gate.current.invalidate();
    setAccess(null);
    setSelectedJob(null);
    setTab("jobs");
    setError("scopeChanged");
  }, []);
  const refresh = useCallback(async (quiet = false) => {
    metricsGate.current.invalidate();
    const ticket = gate.current.next();
    if (!quiet) {
      setLoading(true);
      setAccess(null);
    }
    setError("");
    try {
      const client = getClient();
      const {
        data: { session },
        error: sessionError,
      } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!gate.current.current(ticket)) return;
      authUser.current = session?.user.id || null;
      if (!session) {
        setAccess(null);
        return;
      }
      const [profile, roles] = await Promise.all([
        client
          .from("app_users")
          .select("id,is_active")
          .eq("id", session.user.id)
          .maybeSingle(),
        client.from("user_roles").select("role").eq("user_id", session.user.id),
      ]);
      if (profile.error) throw profile.error;
      if (roles.error) throw roles.error;
      const active = profile.data?.is_active === true;
      const roleNames: string[] = active
        ? (roles.data || []).map((item) => item.role)
        : [];
      let jobs: Job[] = [];
      let memberships: JobMembership[] = [];
      if (active && roleNames.length) {
        if (
          roleNames.includes("TA_RECRUITER") &&
          !roleNames.includes("ADMIN")
        ) {
          const membershipResult = await client
            .from("job_memberships")
            .select("job_id,role")
            .eq("user_id", session.user.id);
          if (membershipResult.error) throw membershipResult.error;
          memberships = (membershipResult.data || []) as JobMembership[];
        }
        const result = await client
          .from("jobs")
          .select(
            "id,job_code,title,status,business_unit,location,level,function_group,hiring_season,req_date,request_type,priority,replacement_for",
          )
          .order("job_code")
          .limit(100);
        if (result.error) throw result.error;
        const rules = await client
          .from("job_sla_rules")
          .select("level,function_group,hiring_season,target_workdays");
        if (rules.error) throw rules.error;
        const overview = await jobOverview();
        const metricsByJob = new Map(
          overview.jobs.map((row) => [row.job_id, row]),
        );
        const byKey = new Map(
          (rules.data || []).map((rule) => [
            `${rule.level}:${rule.function_group}:${rule.hiring_season}`,
            rule.target_workdays,
          ]),
        );
        jobs = (result.data || []).map((job) => ({
          ...job,
          sla_target_workdays:
            job.level != null && job.function_group && job.hiring_season
              ? (byKey.get(
                  `${job.level}:${job.function_group}:${job.hiring_season}`,
                ) ?? null)
              : null,
          metrics: metricsByJob.get(job.id),
        }));
      }
      if (gate.current.current(ticket)) {
        setSelectedJob(
          (current) =>
            jobs.find((job) => job.id === current?.id) || jobs[0] || null,
        );
        setAccess({
          userId: session.user.id,
          email: session.user.email || "",
          active,
          roles: roleNames,
          jobs,
          memberships,
        });
      }
    } catch (err) {
      if (gate.current.current(ticket)) {
        setAccess(null);
        setError(err instanceof Error ? err.message : "requestFailed");
      }
    } finally {
      if (gate.current.current(ticket)) setLoading(false);
    }
  }, []);
  const refreshJobMetrics = useCallback(async () => {
    const userId = authUser.current;
    if (!userId) return;
    const ticket = metricsGate.current.next();
    const result = await jobOverview();
    if (!metricsGate.current.current(ticket) || authUser.current !== userId)
      return;
    const byJob = new Map(result.jobs.map((row) => [row.job_id, row]));
    setAccess((current) =>
      current?.userId === userId
        ? {
            ...current,
            jobs: current.jobs.map((job) => ({
              ...job,
              metrics: byJob.get(job.id),
            })),
          }
        : current,
    );
    setSelectedJob((current) =>
      current ? { ...current, metrics: byJob.get(current.id) } : null,
    );
  }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cleanup = () => {};
    try {
      const { data } = getClient().auth.onAuthStateChange((event, session) => {
        // SIGNED_IN also fires when returning to a tab. Recheck permissions without
        // destroying an unchanged user's draft selection or unsaved review form.
        const nextUser = session?.user.id || null;
        const quiet =
          nextUser !== null &&
          nextUser === authUser.current &&
          event !== "SIGNED_OUT";
        authUser.current = nextUser;
        metricsGate.current.invalidate();
        gate.current.invalidate();
        if (!quiet) {
          setAccess(null);
          setLoading(true);
        }
        // Never await Supabase requests inside its auth storage lock.
        clearTimeout(timer);
        timer = setTimeout(() => void refresh(quiet), 0);
      });
      cleanup = () => data.subscription.unsubscribe();
      void refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
    return () => {
      gate.current.invalidate();
      metricsGate.current.invalidate();
      clearTimeout(timer);
      cleanup();
    };
  }, [refresh]);
  async function login() {
    if (loginStarted.current) return;
    loginStarted.current = true;
    setAuthBusy(true);
    setError("");
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const expired = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error("loginSlow")), 15000);
    });
    try {
      const redirectTo = authRedirect(
        window.location.origin,
        process.env.NEXT_PUBLIC_BASE_PATH || "",
        process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL,
      );
      const { error } = await Promise.race([
        getClient().auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo, queryParams: { prompt: "select_account" } },
        }),
        expired,
      ]);
      if (error) throw error;
    } catch (err) {
      setError((err as Error).message);
      setAuthBusy(false);
    } finally {
      clearTimeout(timeout);
    }
  }
  async function logout() {
    setAuthBusy(true);
    metricsGate.current.invalidate();
    gate.current.invalidate();
    setAccess(null);
    try {
      const { error } = await getClient().auth.signOut();
      if (error) throw error;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAuthBusy(false);
    }
  }
  async function localLogin() {
    const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(
      window.location.hostname,
    );
    if (process.env.NODE_ENV !== "development" || !isLoopback) return;
    setAuthBusy(true);
    setError("");
    try {
      const { error } = await getClient().auth.signInWithPassword({
        email: localEmail.trim(),
        password: localPassword,
      });
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : "requestFailed");
    } finally {
      setAuthBusy(false);
    }
  }
  const allowed = access?.active && access.roles.length > 0;
  const jobs = (access?.jobs || []).filter(
    (job) =>
      (status === "ALL" || job.status === status) &&
      `${job.title} ${job.job_code || ""}`
        .toLocaleLowerCase(locale)
        .includes(search.toLocaleLowerCase(locale)),
  );
  useEffect(() => {
    setSelectedJob(
      (current) =>
        jobs.find((job) => job.id === current?.id) || jobs[0] || null,
    );
  }, [jobs]);
  const reviewAllowed = !!allowed && canReview(access.roles);
  const adminAllowed = !!allowed && access.roles.includes("ADMIN");
  useEffect(() => {
    if (!globalSearchOpen) return;
    const frame = window.requestAnimationFrame(() =>
      globalSearchRef.current?.focus(),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [globalSearchOpen]);
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLocaleLowerCase() === "k"
      ) {
        event.preventDefault();
        setGlobalSearchOpen(true);
      }
      if (event.key === "Escape") {
        setGlobalSearchOpen(false);
        setGlobalSearchQuery("");
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const normalizedGlobalQuery = globalSearchQuery
    .trim()
    .toLocaleLowerCase(locale);
  const globalNavMatches = [
    {
      label: locale === "en" ? "Job Openings" : "Vị trí tuyển dụng",
      description: locale === "en" ? "Browse open and draft jobs" : "Xem các vị trí đang tuyển và bản nháp",
      destination: "jobs" as const,
    },
    ...(reviewAllowed
      ? [
          {
            label: tr("Talent Pool"),
            description: tr("Kho ứng viên đã duyệt"),
            destination: "talent" as const,
          },
          {
            label: locale === "en" ? "Job Review" : "Duyệt Job & JD",
            description: locale === "en" ? "Review job descriptions" : "Kiểm tra mô tả công việc",
            destination: "jd" as const,
          },
          {
            label: locale === "en" ? "Manage Jobs" : "Quản lý Job",
            description: locale === "en" ? "Create jobs and assign your team" : "Tạo Job và phân công đội ngũ",
            destination: "manage" as const,
          },
          {
            label: locale === "en" ? "Candidates" : "Ứng viên",
            description: locale === "en" ? "Candidate database and talent pool" : "Cơ sở dữ liệu và nguồn ứng viên",
            destination: "talent" as const,
          },
          {
            label: locale === "en" ? "Interviews" : "Phỏng vấn",
            description: locale === "en" ? "Schedule and interview feedback" : "Lịch phỏng vấn và đánh giá",
            destination: "interviews" as const,
          },
        ]
      : []),
    {
      label: locale === "en" ? "Hiring Pipeline" : "Tiến độ tuyển dụng",
      description: locale === "en" ? "Track candidates by hiring stage" : "Theo dõi ứng viên theo từng vòng tuyển dụng",
      destination: "pipeline" as const,
    },
  ].filter(
    (item) =>
      !normalizedGlobalQuery ||
      `${item.label} ${item.description}`
        .toLocaleLowerCase(locale)
        .includes(normalizedGlobalQuery),
  );
  const globalJobMatches = (access?.jobs || [])
    .filter(
      (job) =>
        normalizedGlobalQuery &&
        `${job.title} ${job.job_code || ""}`
          .toLocaleLowerCase(locale)
          .includes(normalizedGlobalQuery),
    )
    .slice(0, 5);
  if (loading && !access) {
    return (
      <div className="auth-loading astryx-auth">
        <LoadingState label={t.loading} />
      </div>
    );
  }
  if (!access) {
    return (
      <main className="auth-screen astryx-auth">
        <section className="auth-brand-panel" aria-label={t.workspace}>
          <div className="auth-brand-content">
            <a className="auth-brand" href={`${basePath}/`} aria-label="ATS">
              <span className="auth-brand-mark">
                <Icon name="jobs" size={22} />
              </span>
              <span>
                {tr("ATS")}
                <small>{tr("Applicant Tracking System")}</small>
              </span>
            </a>
            <div className="auth-brand-copy">
              <span className="auth-kicker">{t.workspace}</span>
              <h1>{t.loginTitle}</h1>
              <p>{t.loginIntro}</p>
            </div>
            <div className="auth-brand-footer">
              <Icon name="shield" size={17} />
              <span>{t.securityNote}</span>
            </div>
          </div>
        </section>
        <section className="auth-main-panel">
          <div className="auth-language">
            <Icon name="globe" size={17} />
            <select
              aria-label={t.language}
              value={locale}
              onChange={(event) =>
                setLocale(event.target.value === "en" ? "en" : "vi")
              }
            >
              <option value="vi">{tr("Tiếng Việt")}</option>
              <option value="en">{tr("English")}</option>
            </select>
          </div>
          <div className="auth-login-content">
            <span className="auth-welcome-icon">
              <Icon name="team" size={25} />
            </span>
            <span className="auth-kicker">{t.loginEyebrow}</span>
            <h2>
              {locale === "vi" ? tr("Đăng nhập vào ATS") : "Sign in to ATS"}
            </h2>
            {error && (
              <div className="notice error auth-error" role="alert">
                <Icon name="help" />
                <span>{friendlyError(error, t)}</span>
                <button
                  className="quiet"
                  onClick={() =>
                    loginStarted.current
                      ? window.location.reload()
                      : void refresh()
                  }
                >
                  {loginStarted.current ? t.reload : t.refreshAccess}
                </button>
              </div>
            )}
            <p className="auth-login-note">
              <Icon name="help" size={18} />
              <span>{t.loginNote}</span>
            </p>
            {localLoginVisible && localLoginOpen ? (
              <div className="local-login auth-local-login">
                <label>
                  {tr("Email thử nghiệm")}
                  <input
                    type="email"
                    autoComplete="username"
                    value={localEmail}
                    onChange={(event) => setLocalEmail(event.target.value)}
                    placeholder="admin.test@example.invalid"
                  />
                </label>
                <label>
                  {tr("Mật khẩu thử nghiệm")}
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={localPassword}
                    onChange={(event) => setLocalPassword(event.target.value)}
                  />
                </label>
                <button
                  className="primary google-button"
                  disabled={authBusy || !localEmail || !localPassword}
                  onClick={() => void localLogin()}
                >
                  {authBusy ? tr("Đang đăng nhập…") : tr("Đăng nhập thử")}
                  <Icon name="arrow" size={17} />
                </button>
                <button
                  className="quiet auth-local-toggle"
                  onClick={() => setLocalLoginOpen(false)}
                >
                  {tr("Ẩn đăng nhập thử nghiệm")}
                </button>
              </div>
            ) : (
              <>
                <button
                  className="primary auth-google-button"
                  disabled={authBusy || !!error}
                  onClick={login}
                >
                  <span className="google-mark" aria-hidden="true">
                    {tr("G")}
                  </span>
                  {authBusy ? t.signingIn : t.signIn}
                </button>
                {localLoginVisible && (
                  <button
                    className="quiet auth-local-toggle"
                    onClick={() => setLocalLoginOpen(true)}
                  >
                    {tr("Mở đăng nhập thử nghiệm cục bộ")}
                  </button>
                )}
              </>
            )}
            <div className="auth-scope-note">
              <span className="auth-scope-icon">
                <Icon name="jobs" size={20} />
              </span>
              <span>{t.scoped}</span>
            </div>
          </div>
          <div className="auth-main-footer">
            {tr("ATS ·")} {t.footer}
          </div>
        </section>
      </main>
    );
  }
  return (
    <div
      className={`shell astryx-workspace ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}
    >
      <a className="skip-link" href="#main-content">
        {t.navigation}
      </a>
      <aside className="sidebar">
        <a className="brand" href={`${basePath}/`}>
          <span className="brand-mark">
            <Icon name="jobs" size={23} />
          </span>
          <span>
            {tr("ATS")}
            <span className="brand-caption">{t.workspace}</span>
          </span>
        </a>
        <div className="workspace-label">{t.workspace}</div>
        <nav aria-label={t.navigation}>
          <div className="sidebar-section-label">{locale === "en" ? "Recruitment" : "Tuyển dụng"}</div>
          <button
            className={tab === "jobs" && jobView === "master" ? "nav active" : "nav"}
            aria-current={tab === "jobs" && jobView === "master" ? "page" : undefined}
            onClick={() => openJobsView("master")}
          >
            <Icon name="jobs" />
            <span className="nav-label">{locale === "en" ? "Job Openings" : "Vị trí tuyển dụng"}</span>
          </button>
          <button
            className={tab === "jobs" && jobView === "pipeline" && initialPipelineFilter !== "OFFER" ? "nav active" : "nav"}
            aria-current={tab === "jobs" && jobView === "pipeline" && initialPipelineFilter !== "OFFER" ? "page" : undefined}
            onClick={() => {
              if (!selectedJob && access.jobs[0]) setSelectedJob(access.jobs[0]);
              openJobsView("pipeline");
            }}
          >
            <Icon name="review" />
            <span className="nav-label">{locale === "en" ? "Hiring Pipeline" : "Tiến độ tuyển dụng"}</span>
          </button>
          {reviewAllowed && (
            <button
              className={tab === "talent" ? "nav active" : "nav"}
              aria-current={tab === "talent" ? "page" : undefined}
              onClick={() => setTab("talent")}
            >
              <Icon name="team" />
              <span className="nav-label">{locale === "en" ? "Candidates" : "Ứng viên"}</span>
            </button>
          )}
          {allowed && (
            <button
              className={tab === "interviews" ? "nav active" : "nav"}
              aria-current={tab === "interviews" ? "page" : undefined}
              onClick={() => setTab("interviews")}
            >
              <Icon name="team" />
              <span className="nav-label">
                {locale === "en" ? "Interviews" : "Phỏng vấn"}
              </span>
            </button>
          )}
          {access?.roles.some((role) => role === "ADMIN" || role === "TA_RECRUITER") && (
            <button
              className={tab === "jobs" && jobView === "pipeline" && initialPipelineFilter === "OFFER" ? "nav active" : "nav"}
              aria-current={tab === "jobs" && jobView === "pipeline" && initialPipelineFilter === "OFFER" ? "page" : undefined}
              onClick={() => {
                if (!selectedJob && access.jobs[0]) setSelectedJob(access.jobs[0]);
                openJobsView("pipeline", "OFFER");
              }}
            >
              <Icon name="review" />
              <span className="nav-label">{locale === "en" ? "Offers" : "Thư mời nhận việc"}</span>
            </button>
          )}
          {adminAllowed && <div className="sidebar-section-label">{locale === "en" ? "Administration" : "Quản trị"}</div>}
          {adminAllowed && (
            <button className={tab === "jobs" && jobView === "manage" ? "nav active" : "nav"} aria-current={tab === "jobs" && jobView === "manage" ? "page" : undefined} onClick={() => openJobsView("manage")}>
              <Icon name="shield" />
              <span className="nav-label">{locale === "en" ? "Manage Jobs" : "Quản lý Job"}</span>
            </button>
          )}
          {reviewAllowed && (
            <button
              className={tab === "jd" ? "nav active" : "nav"}
              aria-current={tab === "jd" ? "page" : undefined}
              onClick={() => setTab("jd")}
            >
              <Icon name="review" />
              <span className="nav-label">{locale === "en" ? "Job Review" : "Duyệt Job & JD"}</span>
            </button>
          )}
        </nav>
        <div className="sidebar-help">
          <span className="help-icon">
            <Icon name="help" />
          </span>
          <strong>{t.helpHint}</strong>
          <p>{allowed ? t.guideIntro : t.loginNote}</p>
          {allowed && (
            <button
              className="quiet"
              onClick={() => {
                setTab("jobs");
                setGuideOpen(true);
              }}
            >
              {t.help}
              <Icon name="arrow" size={15} />
            </button>
          )}
        </div>
        <div className="sidebar-note">
          <Icon name="shield" size={16} />
          <span className="sidebar-note-copy">{t.scoped}</span>
        </div>
        <button
          className="sidebar-collapse"
          type="button"
          aria-label={
            sidebarCollapsed
              ? tr("Mở rộng thanh điều hướng")
              : tr("Thu gọn thanh điều hướng")
          }
          aria-expanded={!sidebarCollapsed}
          onClick={() => setSidebarCollapsed((value) => !value)}
        >
          <Icon name={sidebarCollapsed ? "expand" : "collapse"} size={17} />
          <span className="nav-label">
            {sidebarCollapsed ? tr("Mở rộng") : tr("Thu gọn menu")}
          </span>
        </button>
      </aside>
      <div className="main">
        <header className="topbar">
          <a className="bosch-lockup" href={`${basePath}/`} aria-label="Bosch ATS V2">
            <img src={`${basePath}/bosch-ats-lockup.jpg`} alt="Bosch · ATS V2" />
          </a>
          <nav className="global-nav" aria-label={locale === "en" ? "Main navigation" : "Điều hướng chính"}>
            <button type="button" className={tab === "jobs" && initialPipelineFilter !== "OFFER" ? "active" : ""} onClick={() => openJobsView("master")}>{locale === "en" ? "Jobs" : "Việc làm"}</button>
            {reviewAllowed && <button type="button" className={tab === "talent" ? "active" : ""} onClick={() => setTab("talent")}>{locale === "en" ? "Candidates" : "Ứng viên"}</button>}
            {allowed && <button type="button" className={tab === "interviews" ? "active" : ""} onClick={() => setTab("interviews")}>{locale === "en" ? "Interviews" : "Phỏng vấn"}</button>}
            {access?.roles.some((role) => role === "ADMIN" || role === "TA_RECRUITER") && <button type="button" className={tab === "jobs" && jobView === "pipeline" && initialPipelineFilter === "OFFER" ? "active" : ""} onClick={() => { if (!selectedJob && access.jobs[0]) setSelectedJob(access.jobs[0]); openJobsView("pipeline", "OFFER"); }}>{locale === "en" ? "Offers" : "Offer"}</button>}
          </nav>
          <div className="header-actions">
            <div
              className={`global-search ${globalSearchOpen ? "is-open" : ""}`}
            >
              {globalSearchOpen ? (
                <>
                  <label className="global-search-input">
                    <Icon name="search" size={17} />
                    <input
                      ref={globalSearchRef}
                      value={globalSearchQuery}
                      onChange={(event) =>
                        setGlobalSearchQuery(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          setGlobalSearchOpen(false);
                          setGlobalSearchQuery("");
                        }
                      }}
                      placeholder={
                        locale === "en"
                          ? "Search jobs and pages…"
                          : tr("Tìm Job hoặc màn hình…")
                      }
                      aria-label={
                        locale === "en" ? "Search ATS" : tr("Tìm trong ATS")
                      }
                    />
                    <kbd>{tr("ESC")}</kbd>
                  </label>
                  <div
                    className="global-search-results"
                    role="listbox"
                    aria-label={
                      locale === "en"
                        ? "Search results"
                        : tr("Kết quả tìm kiếm")
                    }
                  >
                    {globalJobMatches.map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        role="option"
                        aria-selected="false"
                        onClick={() => {
                          setSelectedJob(job);
                          setTab("jobs");
                          setJobView("pipeline");
                          setInitialPipelineFilter("ALL");
                          setGlobalSearchOpen(false);
                          setGlobalSearchQuery("");
                        }}
                      >
                        <span className="search-result-icon">
                          <Icon name="jobs" size={16} />
                        </span>
                        <span>
                          <strong>{job.title}</strong>
                          <small>
                            {job.job_code || t.noCode} ·{" "}
                            {jobStatusLabel(job.status, t)}
                          </small>
                        </span>
                        <Icon name="arrow" size={15} />
                      </button>
                    ))}
                    {globalNavMatches.map((item) => (
                      <button
                        key={item.destination}
                        type="button"
                        role="option"
                        aria-selected="false"
                        onClick={() => {
                          if (item.destination === "pipeline") {
                            if (!selectedJob && access.jobs[0]) setSelectedJob(access.jobs[0]);
                            openJobsView("pipeline");
                          } else if (item.destination === "manage") {
                            openJobsView("manage");
                          } else {
                            setTab(item.destination);
                          }
                          setGlobalSearchOpen(false);
                          setGlobalSearchQuery("");
                        }}
                      >
                        <span className="search-result-icon">
                          <Icon
                            name={
                              item.destination === "jobs"
                                ? "jobs"
                                : item.destination === "talent"
                                  ? "team"
                                  : item.destination === "jd"
                                    ? "review"
                                    : "shield"
                            }
                            size={16}
                          />
                        </span>
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </span>
                        <Icon name="arrow" size={15} />
                      </button>
                    ))}
                    {!globalJobMatches.length && !globalNavMatches.length && (
                      <p className="global-search-empty">
                        {locale === "en"
                          ? "No matching Jobs or pages."
                          : tr("Không tìm thấy Job hoặc màn hình phù hợp.")}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <button
                  className="global-search-trigger"
                  type="button"
                  onClick={() => setGlobalSearchOpen(true)}
                >
                  <Icon name="search" size={17} />
                  <span>{locale === "en" ? "Search" : tr("Tìm nhanh")}</span>
                  <kbd>{tr("⌘ K")}</kbd>
                </button>
              )}
            </div>
            <label className="language-picker">
              <Icon name="globe" size={17} />
              <select
                aria-label={t.language}
                value={locale}
                onChange={(e) =>
                  setLocale(e.target.value === "en" ? "en" : "vi")
                }
              >
                <option value="vi">{tr("Tiếng Việt")}</option>
                <option value="en">{tr("English")}</option>
              </select>
            </label>
            {access && (
              <div className="account">
                <span className="avatar" aria-hidden="true">
                  {access.email[0]?.toUpperCase() || "A"}
                </span>
                <span className="account-email">{access.email}</span>
                <button
                  className="icon-button"
                  aria-label={t.signOut}
                  title={t.signOut}
                  onClick={logout}
                  disabled={authBusy}
                >
                  <Icon name="logout" size={18} />
                </button>
              </div>
            )}
          </div>
        </header>
        <main id="main-content" className={tab === "jobs" && jobView === "pipeline" ? `is-job-pipeline ${initialPipelineFilter === "OFFER" ? "is-offers-page" : ""}` : ""}>
          {error && (
            <div className="notice error" role="alert">
              <Icon name="help" />
              {friendlyError(error, t)}
              <button
                className="quiet"
                onClick={() =>
                  loginStarted.current
                    ? window.location.reload()
                    : void refresh()
                }
              >
                {loginStarted.current ? t.reload : t.refreshAccess}
              </button>
            </div>
          )}
          {loading ? (
            <LoadingState label={t.loading} />
          ) : !access ? (
            <section className="login-layout">
              <div className="login-story">
                <span className="eyebrow">{t.workspace}</span>
                <h1>{t.loginTitle}</h1>
                <p>{t.loginIntro}</p>
                <ul className="login-benefits">
                  {[t.loginFeature1, t.loginFeature2, t.loginFeature3].map(
                    (text) => (
                      <li key={text}>
                        <span>
                          <Icon name="check" size={16} />
                        </span>
                        {text}
                      </li>
                    ),
                  )}
                </ul>
                <div className="login-trust">
                  <Icon name="shield" size={18} />
                  {t.securityNote}
                </div>
              </div>
              <div className="login-card">
                <span className="welcome-icon">
                  <Icon name="team" size={26} />
                </span>
                <div className="eyebrow">{t.loginEyebrow}</div>
                <h2>{t.signIn}</h2>
                <p>{t.loginNote}</p>
                {localLoginVisible ? (
                  <div className="local-login">
                    <label>
                      {tr("Email thử nghiệm")}
                      <input
                        type="email"
                        autoComplete="username"
                        value={localEmail}
                        onChange={(event) => setLocalEmail(event.target.value)}
                        placeholder="admin.test@example.invalid"
                      />
                    </label>
                    <label>
                      {tr("Mật khẩu thử nghiệm")}
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={localPassword}
                        onChange={(event) =>
                          setLocalPassword(event.target.value)
                        }
                      />
                    </label>
                    <button
                      className="primary google-button"
                      disabled={authBusy || !localEmail || !localPassword}
                      onClick={() => void localLogin()}
                    >
                      {authBusy ? tr("Đang đăng nhập…") : tr("Đăng nhập thử")}
                      <Icon name="arrow" size={17} />
                    </button>
                    <div className="local-login-note">
                      {tr(
                        "Chế độ thử trên máy này. Quyền Admin/TA vẫn được kiểm tra bằng dữ liệu thử.",
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    className="primary google-button"
                    disabled={authBusy || !!error}
                    onClick={login}
                  >
                    <span className="google-mark" aria-hidden="true">
                      {tr("G")}
                    </span>
                    {authBusy ? t.signingIn : t.signIn}
                    <Icon name="arrow" size={17} />
                  </button>
                )}
                <div className="login-footnote">
                  <Icon name="shield" size={15} />
                  {t.scoped}
                </div>
              </div>
            </section>
          ) : !allowed ? (
            <section className="waiting-card">
              <span className="welcome-icon">
                <Icon name="clock" size={28} />
              </span>
              <h1>{t.waiting}</h1>
              <p>{t.waitingBody}</p>
              <button className="primary" onClick={() => void refresh()}>
                <Icon name="refresh" size={17} />
                {t.checkAccess}
              </button>
            </section>
          ) : (
            <>
              <div className={`page-heading ${tab === "jobs" && jobView === "pipeline" ? "page-heading-pipeline" : ""}`}>
                <div>
                  <span className="eyebrow">
                    {t.workspace}
                    <span className="workspace-preview-label">
                      {tr("Preview")}
                    </span>
                  </span>
                  <h1>
                    {tab === "jobs"
                      ? jobView === "manage"
                        ? locale === "en" ? "Manage Jobs" : "Quản lý Job"
                        : jobView === "pipeline"
                          ? initialPipelineFilter === "OFFER"
                            ? locale === "en" ? "Offers" : "Offer"
                                  : tr("Hiring Pipeline")
                          : t.jobs
                      : tab === "talent"
                        ? locale === "en" ? "Candidates" : "Ứng viên"
                        : tab === "interviews"
                          ? locale === "en" ? "Interviews" : "Phỏng vấn"
                          : locale === "en" ? "Job Review" : "Duyệt Job & JD"}
                  </h1>
                  <p>
                    {tab === "jobs"
                      ? jobView === "manage"
                        ? locale === "en"
                          ? "Create job openings, set requirements and assign your team."
                          : "Tạo vị trí tuyển dụng, thiết lập yêu cầu và phân công đội ngũ."
                        : jobView === "pipeline"
                          ? initialPipelineFilter === "OFFER"
                            ? locale === "en"
                              ? "Track pending and approved offers for this Job."
                              : "Theo dõi Offer đang chờ duyệt hoặc đã được duyệt theo Job."
                            : selectedJob
                              ? locale === "en"
                                ? "Review candidates and move them through the hiring stages."
                                : "Xem hồ sơ và theo dõi ứng viên qua từng vòng tuyển dụng."
                              : locale === "en"
                                ? "Choose a Job to see its hiring progress."
                                : "Chọn Job để xem tiến độ tuyển dụng."
                          : t.jobsIntro
                      : tab === "talent"
                        ? tr(
                            "Quản lý hồ sơ ứng viên đã được duyệt và đưa ứng viên vào Job phù hợp.",
                          )
                        : tab === "interviews"
                          ? locale === "en"
                            ? "Your interview schedule, feedback and decisions."
                            : "Lịch phỏng vấn, feedback và các quyết định cần xử lý."
                          : tab === "jd"
                            ? locale === "en"
                              ? "Review job descriptions before creating a job opening."
                              : "Kiểm tra và duyệt mô tả công việc trước khi tạo vị trí tuyển dụng."
                            : tr("Quản lý vị trí tuyển dụng và phân công đội ngũ của bạn.")}
                  </p>
                </div>
                <div className="heading-actions">
                  {tab === "jobs" && (
                    <button
                      className="secondary"
                      aria-label={
                        guideOpen ? tr("Ẩn hướng dẫn") : tr("Hiện hướng dẫn")
                      }
                      onClick={() => setGuideOpen((open) => !open)}
                    >
                      <Icon name={guideOpen ? "close" : "help"} size={17} />
                      {guideOpen ? t.hideGuide : t.help}
                    </button>
                  )}
                  <button className="secondary" onClick={() => void refresh()}>
                    <Icon name="refresh" size={17} />
                    {t.refreshAccess}
                  </button>
                </div>
              </div>
              {adminAllowed && (
                <div hidden={tab !== "jobs" || jobView !== "manage"}>
                  <AdminConsole
                    key={access.userId}
                    compact
                    action={jobAdminAction}
                    onBusyChange={setJobAdminBusy}
                    jobs={access.jobs}
                    onRefresh={() => refresh(true)}
                    onAccessLost={invalidate}
                  />
                </div>
              )}

              {tab === "interviews" ? (
                <InterviewWorkspace
                  key={`${access.userId}:${access.roles.join(",")}:${access.memberships.map((m) => m.job_id + m.role).join(",")}`}
                  onAccessLost={invalidate}
                />
              ) : tab === "talent" && reviewAllowed ? (
                <TalentPool
                  key={access.userId}
                  jobs={access.jobs}
                  onAccessLost={invalidate}
                />
              ) : tab === "jd" && reviewAllowed ? (
                <ReviewQueue
                  key={`${access.userId}-jd`}
                  fixedKind="jd"
                  onAccessLost={invalidate}
                />
              ) : (
                <>
                  {guideOpen && (
                    <section className="guide" aria-label={t.help}>
                      <div className="guide-heading">
                        <div>
                          <h2>{t.guideTitle}</h2>
                          <p>{t.guideIntro}</p>
                        </div>
                        <button
                          className="quiet"
                          onClick={() => setGuideOpen(false)}
                        >
                          <Icon name="close" size={15} />
                          {t.hideGuide}
                        </button>
                      </div>
                      <div className="guide-grid">
                        <article>
                          <span className="step-number">01</span>
                          <h3>{t.guideJobs}</h3>
                          <p>{t.guideJobsBody}</p>
                          <button
                            className="text-link"
                            onClick={() => {
                              setSearch("");
                              setStatus("OPEN");
                              setGuideOpen(false);
                            }}
                          >
                            {t.guideJobsAction}
                            <Icon name="arrow" size={16} />
                          </button>
                        </article>
                        {reviewAllowed && (
                          <article>
                            <span className="step-number">02</span>
                            <h3>{t.guideReview}</h3>
                            <p>{t.guideReviewBody}</p>
                            <button
                              className="text-link"
                              onClick={() => setTab("talent")}
                            >
                              {t.guideReviewAction}
                              <Icon name="arrow" size={16} />
                            </button>
                          </article>
                        )}
                        <article>
                          <span className="step-number">
                            {reviewAllowed ? "03" : "02"}
                          </span>
                          <h3>{adminAllowed ? t.guideAdmin : t.guideAccess}</h3>
                          <p>
                            {adminAllowed
                              ? t.guideAdminBody
                              : t.guideAccessBody}
                          </p>
                          {adminAllowed && (
                            <button
                              className="text-link"
                              onClick={() => openJobAction("create")}
                            >
                              {tr("Tạo Job")}
                              <Icon name="external" size={15} />
                            </button>
                          )}
                        </article>
                      </div>
                    </section>
                  )}
                  {jobView === "manage" && adminAllowed ? null : jobView ===
                    "master" ? (
                    <>
                      <section
                        className="metrics workspace-bento"
                        aria-label={t.totalJobs}
                      >
                        <div className="bento-total">
                          <div className="metric-top">
                            <small>{t.totalJobs}</small>
                            <span className="metric-icon purple">
                              <Icon name="jobs" />
                            </span>
                          </div>
                          <strong>{access.jobs.length}</strong>
                          <span>{t.totalHint}</span>
                          <div className="bento-foot">
                            <span>
                              <i className="bento-dot green" />
                              {
                                access.jobs.filter((j) => j.status === "OPEN")
                                  .length
                              }{" "}
                              {t.openJobs}
                            </span>
                            <span>
                              <i className="bento-dot amber" />
                              {
                                access.jobs.filter((j) => j.status === "DRAFT")
                                  .length
                              }{" "}
                              {t.draftJobs}
                            </span>
                          </div>
                        </div>
                        <div className="bento-health">
                          <div className="bento-health-copy">
                            <div className="metric-top">
                              <small>
                                {locale === "en"
                                  ? "Candidate overview"
                                  : tr("Tình hình tuyển dụng")}
                              </small>
                              <span className="metric-icon mint">
                                <Icon name="team" />
                              </span>
                            </div>
                            <strong>
                              {access.jobs.some((j) => j.metrics)
                                ? access.jobs.reduce(
                                    (n, j) =>
                                      n + (j.metrics?.total_candidates ?? 0),
                                    0,
                                  )
                                : "—"}
                            </strong>
                            <span>
                              {locale === "en"
                                ? "Applications across loaded Jobs"
                                : tr("Hồ sơ trong các Job đã tải")}
                            </span>
                          </div>
                          <div className="bento-stages">
                            {(
                              [
                                [
                                  locale === "en" ? "New" : tr("Mới"),
                                  "new_count",
                                ],
                                [
                                  locale === "en" ? "Screening" : tr("Sơ loại"),
                                  "screening_count",
                                ],
                                [
                                  locale === "en"
                                    ? "Interview"
                                    : tr("Phỏng vấn"),
                                  "interview_count",
                                ],
                                [
                                  locale === "en" ? "Hired" : tr("Đã tuyển"),
                                  "hired_count",
                                ],
                              ] as const
                            ).map(([label, key]) => {
                              const count = access.jobs.reduce(
                                (n, j) => n + (j.metrics?.[key] ?? 0),
                                0,
                              );
                              const total = access.jobs.reduce(
                                (n, j) =>
                                  n + (j.metrics?.total_candidates ?? 0),
                                0,
                              );
                              return (
                                <div key={key}>
                                  <span>{label}</span>
                                  <b>
                                    {access.jobs.some((j) => j.metrics)
                                      ? count
                                      : "—"}
                                  </b>
                                  <i>
                                    <em
                                      style={{
                                        width: `${total ? (count / total) * 100 : 0}%`,
                                      }}
                                    />
                                  </i>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="bento-attention">
                          <div className="metric-top">
                            <small>
                              {locale === "en"
                                ? "SLA setup needed"
                                : tr("Cần hoàn thiện SLA")}
                            </small>
                            <span className="metric-icon amber">
                              <Icon name="clock" />
                            </span>
                          </div>
                          <strong>
                            {
                              access.jobs.filter(
                                (j) => j.sla_target_workdays == null,
                              ).length
                            }
                          </strong>
                          <span>
                            {locale === "en"
                              ? "Jobs without an SLA target"
                              : tr("Job chưa xác định được SLA tổng")}
                          </span>
                          <p>
                            {locale === "en"
                              ? "Check Level, Function and Season."
                              : tr(
                                  "Kiểm tra Level, nhóm chức năng và mùa tuyển dụng.",
                                )}
                          </p>
                        </div>
                      </section>
                      <p className="scope-note">
                        <Icon name="shield" size={14} />
                        {t.scopeHint}
                      </p>
                      <section className="panel">
                        <div className="panel-heading">
                          <h2>
                            {t.jobList} {tr("· Master")}
                            <span className="count">{jobs.length}</span>
                          </h2>
                        </div>
                        <div className="toolbar">
                          <label className="search">
                            <Icon name="search" size={18} />
                            <input
                              aria-label={t.searchJobs}
                              placeholder={t.searchPlaceholder}
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                            />
                          </label>
                          <div
                            className="job-status-filters"
                            role="group"
                            aria-label={t.jobStatus}
                          >
                            <button
                              type="button"
                              className={`job-filter-chip filter-all ${status === "ALL" ? "selected" : ""}`}
                              aria-label={`${t.allStatuses} (${access.jobs.length})`}
                              aria-pressed={status === "ALL"}
                              onClick={() => setStatus("ALL")}
                            >
                              {t.allStatuses}
                              <span>{access.jobs.length}</span>
                            </button>
                            {Array.from(
                              new Set([
                                "OPEN",
                                "DRAFT",
                                ...access.jobs.map((j) => j.status),
                              ]),
                            )
                              .sort()
                              .map((s) => {
                                const count = access.jobs.filter(
                                  (job) => job.status === s,
                                ).length;
                                return (
                                  <button
                                    key={s}
                                    type="button"
                                    className={`job-filter-chip status-${s.toLowerCase().replace(/_/g, "-")} ${status === s ? "selected" : ""}`}
                                    aria-label={`${jobStatusLabel(s, t)} (${count})`}
                                    aria-pressed={status === s}
                                    onClick={() => setStatus(s)}
                                  >
                                    {jobStatusLabel(s, t)}
                                    <span>{count}</span>
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                        {jobs.length ? (
                          <div className="table-scroll">
                            <table className="workspace-master-table">
                              <thead>
                                <tr>
                                  <th>{tr("1. Định danh & vị trí")}</th>
                                  <th>{tr("2. Đơn vị & chức năng")}</th>
                                  <th>{tr("3. Loại yêu cầu & ngày Req")}</th>
                                  <th>{tr("4. Trạng thái & SLA")}</th>
                                  <th>{tr("5. Ứng viên & nguồn")}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {jobs.map((job) => (
                                  <tr
                                    key={job.id}
                                    className={
                                      selectedJob?.id === job.id
                                        ? "selected-job-row"
                                        : undefined
                                    }
                                  >
                                    <td>
                                      <div className="job-title">
                                        <span className="job-icon">
                                          <Icon name="jobs" size={18} />
                                        </span>
                                        <button
                                          className="job-title-link"
                                          aria-pressed={
                                            selectedJob?.id === job.id
                                          }
                                          aria-label={tr("Chọn Job {0}", [
                                            job.title,
                                          ])}
                                          onClick={() => setSelectedJob(job)}
                                        >
                                          {job.title}
                                        </button>
                                      </div>
                                      <small className="job-code-subtitle">
                                        {job.job_code || t.noCode}
                                      </small>
                                      <small className="job-code-subtitle">
                                        {job.level == null
                                          ? `${tr("Level")} —`
                                          : `${tr("Level")} ${job.level}`}{" "}
                                        ·{" "}
                                        {job.priority
                                          ? tr(job.priority)
                                          : tr("Chưa có ưu tiên")}
                                      </small>
                                    </td>
                                    <td>
                                      <strong>
                                        {job.business_unit || tr("Chưa có BU")}
                                      </strong>
                                      <small className="job-code-subtitle">
                                        {job.function_group
                                          ? tr(job.function_group)
                                          : tr("Chưa phân nhóm")}
                                        {job.location
                                          ? ` · ${job.location}`
                                          : ""}
                                      </small>
                                    </td>
                                    <td>
                                      <strong>
                                        {job.request_type === "REPLACEMENT"
                                          ? tr("Thay thế")
                                          : job.request_type === "NEW"
                                            ? tr("Tuyển mới")
                                            : tr("Chưa xác định")}
                                      </strong>
                                      <small className="job-code-subtitle">
                                        {tr("Req:")} {job.req_date || "—"}
                                      </small>
                                    </td>
                                    <td>
                                      <span
                                        className={`badge ${job.status === "OPEN" ? "green" : job.status === "DRAFT" ? "amber-badge" : ""}`}
                                      >
                                        <span className="status-dot" />
                                        {jobStatusLabel(job.status, t)}
                                      </span>
                                      <div className="master-sla">
                                        {job.sla_target_workdays == null ? (
                                          <span className="muted">
                                            {tr(
                                              "Thiếu Level / Function / Season",
                                            )}
                                          </span>
                                        ) : (
                                          <span className="badge blue">
                                            ≤ {job.sla_target_workdays}{" "}
                                            {tr("ngày làm việc")}
                                          </span>
                                        )}
                                        <small className="job-code-subtitle">
                                          {job.hiring_season
                                            ? tr(job.hiring_season)
                                            : tr("Chưa chọn mùa tuyển dụng")}
                                        </small>
                                      </div>
                                    </td>
                                    <td>
                                      <strong>
                                        {job.metrics?.total_candidates ?? "—"}{" "}
                                        {tr("ứng viên")}
                                      </strong>
                                      {job.metrics && (
                                        <small className="job-code-subtitle">
                                          {tr("NEW")} {job.metrics.new_count}{" "}
                                          {tr("· Sơ loại")}{" "}
                                          {job.metrics.screening_count}{" "}
                                          {tr("· Phỏng vấn")}{" "}
                                          {job.metrics.interview_count}{" "}
                                          {tr("· Đã tuyển")}{" "}
                                          {job.metrics.hired_count}
                                        </small>
                                      )}
                                      {job.metrics?.source_summary?.length ? (
                                        <details className="job-source-summary">
                                          <summary>
                                            {tr("Nguồn (")}{" "}
                                            {job.metrics.source_summary.length})
                                          </summary>
                                          <ul>
                                            {job.metrics.source_summary.map(
                                              (source) => (
                                                <li
                                                  key={`${source.source}:${source.sub_source}:${source.source_ownership}`}
                                                >
                                                  {source.sub_source
                                                    ? `${source.sub_source} · `
                                                    : ""}
                                                  {source.source}:{" "}
                                                  {source.count}
                                                </li>
                                              ),
                                            )}
                                          </ul>
                                        </details>
                                      ) : (
                                        <small className="job-code-subtitle">
                                          {tr("Nguồn: chưa có dữ liệu")}
                                        </small>
                                      )}
                                      <button
                                        className="job-pipeline-action"
                                        aria-label={tr("Mở pipeline {0}", [
                                          job.title,
                                        ])}
                                        onClick={() => {
                                          setSelectedJob(job);
                                          setJobView("pipeline");
                                          setInitialPipelineFilter("ALL");
                                        }}
                                      >
                                        {tr("Pipeline")}
                                        <Icon name="arrow" size={14} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="empty">
                            <span className="empty-icon">
                              <Icon name="search" size={25} />
                            </span>
                            <h3>{t.noJobs}</h3>
                            <p>{t.noJobsBody}</p>
                            <button
                              className="secondary"
                              onClick={() => {
                                setSearch("");
                                setStatus("ALL");
                              }}
                            >
                              {t.clearFilters}
                            </button>
                          </div>
                        )}
                        <div className="panel-footer">
                          {format(t.jobsShown, {
                            shown: jobs.length,
                            total: access.jobs.length,
                          })}
                        </div>
                      </section>
                    </>
                  ) : selectedJob ? (
                    <section className="job-pipeline-view">
                      <div className="job-pipeline-toolbar">
                        <PipelineJobSwitcher
                          jobs={access.jobs}
                          selected={selectedJob}
                          onChange={setSelectedJob}
                        />
                        <span
                          className={`badge ${selectedJob.status === "OPEN" ? "green" : selectedJob.status === "DRAFT" ? "amber-badge" : ""}`}
                        >
                          {jobStatusLabel(selectedJob.status, t)}
                        </span>
                      </div>
                  <ApplicationPipeline
                        key={`${selectedJob.id}:${initialPipelineFilter}`}
                        job={selectedJob}
                        initialStageFilter={initialPipelineFilter}
                        onSessionLost={invalidate}
                        onDataChanged={refreshJobMetrics}
                        canViewOffers={access.roles.some(
                          (role) => role === "ADMIN" || role === "TA_RECRUITER",
                        )}
                        canManageApplications={canManageApplicationStages(
                          access.roles,
                          access.memberships,
                          selectedJob.id,
                        )}
                      />
                    </section>
                  ) : (
                    <div className="empty">
                      <h3>{tr("Chưa có Job được cấp quyền")}</h3>
                      <p>
                        {tr(
                          "Job sẽ xuất hiện tại đây khi được chia sẻ cho tài khoản của bạn.",
                        )}
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </main>
        <footer>
          <strong>{tr("ATS Workspace")}</strong>
          <span>{t.footer}</span>
        </footer>
      </div>
    </div>
  );
}
