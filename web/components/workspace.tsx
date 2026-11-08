"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getClient } from "@/lib/supabase";
import { authRedirect, canReview, RequestGate, type Job } from "@/lib/policy";
import ReviewQueue from "./review-queue";
import { useLanguage } from "./language";
import Icon from "./icon";
import LoadingState from "./loading-state";
import ApplicationPipeline from "./application-pipeline";
import { jobOverview } from "@/lib/applications";
import TalentPool from "./talent-pool";
import AdminConsole from "./admin-console";
import { format, friendlyError, jobStatusLabel, roleLabel } from "@/lib/i18n";

type Access = {
  userId: string;
  email: string;
  roles: string[];
  active: boolean;
  jobs: Job[];
};

function DemoWorkspace({ onExit }: { onExit: () => void }) {
  const stages = [
    { label: "Mới", count: 18, color: "new", names: ["Linh N.", "Minh T."] },
    { label: "Sơ loại", count: 12, color: "screen", names: ["An P.", "Vy H."] },
    { label: "Phỏng vấn", count: 7, color: "interview", names: ["Huy Q.", "Trang L."] },
    { label: "Offer", count: 3, color: "offer", names: ["Mai T."] },
    { label: "Đã tuyển", count: 2, color: "hired", names: ["Nam V."] },
  ];
  const demoJobs = [
    { title: "Senior Embedded Software Engineer", code: "EPC-4-2026", team: "Embedded · HCMC", status: "Đang tuyển", count: 8, sla: "Còn 6 ngày" },
    { title: "Senior AI Engineer", code: "EAF-12-2026", team: "AI Engineering · HCMC", status: "Đang tuyển", count: 6, sla: "Còn 3 ngày" },
    { title: "Technical Operations Coordinator", code: "OPS-03-2026", team: "Operations · Remote", status: "Bản nháp", count: 0, sla: "Chưa bắt đầu" },
  ];
  return (
    <div className="demo-shell">
      <aside className="demo-sidebar">
        <div className="demo-brand"><span className="demo-brand-mark"><Icon name="jobs" size={20} /></span><span>ATS<small>HIRING WORKSPACE</small></span></div>
        <span className="demo-nav-caption">KHÔNG GIAN LÀM VIỆC</span>
        <nav aria-label="Điều hướng bản demo">
          <span className="demo-nav-item active"><Icon name="jobs" size={18} />Vị trí tuyển dụng</span>
          <span className="demo-nav-item"><Icon name="review" size={18} />Hiring Pipeline</span>
          <span className="demo-nav-item"><Icon name="team" size={18} />Talent Pool</span>
          <span className="demo-nav-item"><Icon name="review" size={18} />JD tuyển dụng</span>
          <span className="demo-nav-item"><Icon name="shield" size={18} />Quản trị & quyền</span>
        </nav>
        <div className="demo-sidebar-bottom"><span className="demo-avatar">P</span><span>Recruiter demo<small>Chỉ xem · dữ liệu minh họa</small></span></div>
      </aside>
      <main className="demo-main">
        <header className="demo-topbar"><span>Tuyển dụng <b>/</b> Vị trí tuyển dụng</span><button type="button" onClick={onExit}>Thoát bản demo</button></header>
        <div className="demo-content">
          <div className="demo-notice"><Icon name="help" size={17} /><span><strong>BẢN DEMO ·</strong> Dữ liệu minh họa, chỉ xem. Không kết nối Supabase và không lưu thay đổi.</span></div>
          <div className="demo-heading"><div><span className="demo-eyebrow">TỔNG QUAN TUYỂN DỤNG</span><h1>Vị trí tuyển dụng</h1><p>Theo dõi nhu cầu tuyển dụng và tiến độ của từng Job tại một nơi.</p></div><button type="button" disabled><Icon name="jobs" size={16} />Tạo Job</button></div>
          <section className="demo-metrics" aria-label="Chỉ số tuyển dụng minh họa">
            <article><span className="demo-metric-icon violet"><Icon name="jobs" size={19} /></span><small>Tổng Job</small><strong>18</strong><em>Trong danh sách được giao</em></article>
            <article><span className="demo-metric-icon green"><Icon name="team" size={19} /></span><small>Đang tuyển</small><strong>12</strong><em>Đang nhận ứng viên</em></article>
            <article><span className="demo-metric-icon amber"><Icon name="review" size={19} /></span><small>Cần xử lý</small><strong>5</strong><em>2 Job nháp · 3 lịch phỏng vấn</em></article>
          </section>
          <section className="demo-panel demo-pipeline">
            <div className="demo-panel-heading"><div><h2>Hiring Pipeline</h2><p>Tổng quan ứng viên qua các vòng tuyển dụng</p></div><span>Tháng này <Icon name="arrow" size={14} /></span></div>
            <div className="demo-stage-grid">{stages.map((stage) => <article className={`demo-stage ${stage.color}`} key={stage.label}><div><span>{stage.label}</span><strong>{stage.count}</strong></div><div className="demo-stage-track"><span style={{ width: `${Math.min(stage.count * 5, 100)}%` }} /></div><small>ứng viên</small>{stage.names.map((name) => <span className="demo-candidate" key={name}>{name}<span>•••</span></span>)}</article>)}</div>
          </section>
          <section className="demo-panel demo-job-panel">
            <div className="demo-panel-heading"><div><h2>Danh sách Job</h2><p>Thông tin chính, SLA và ứng viên theo từng vị trí</p></div><span className="demo-count">18 vị trí</span></div>
            <div className="demo-job-filters"><span className="demo-search"><Icon name="search" size={17} />Tìm theo tên Job hoặc mã</span><span className="demo-filter active">Tất cả <b>18</b></span><span className="demo-filter">Đang tuyển <b>12</b></span><span className="demo-filter">Bản nháp <b>6</b></span></div>
            <div className="demo-table-wrap"><table className="demo-table"><thead><tr><th>VỊ TRÍ & MÃ JOB</th><th>ĐƠN VỊ</th><th>TRẠNG THÁI</th><th>SLA</th><th>ỨNG VIÊN</th><th></th></tr></thead><tbody>{demoJobs.map((job) => <tr key={job.code}><td><strong>{job.title}</strong><small>{job.code}</small></td><td>{job.team}</td><td><span className={`demo-status ${job.status === "Đang tuyển" ? "open" : "draft"}`}><i />{job.status}</span></td><td>{job.sla}</td><td><strong>{job.count}</strong><small>ứng viên</small></td><td><span className="demo-open-pipeline">Mở Pipeline <Icon name="arrow" size={14} /></span></td></tr>)}</tbody></table></div>
          </section>
          <p className="demo-footnote"><Icon name="shield" size={14} />Các con số và tên trong màn hình này chỉ phục vụ xem thử.</p>
        </div>
      </main>
    </div>
  );
}

export default function Workspace() {
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
  const [showDemo, setShowDemo] = useState(false);
  const [tab, setTab] = useState<"jobs" | "talent" | "jd" | "admin">("jobs");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobView, setJobView] = useState<"master" | "pipeline">("master");
  const gate = useRef(new RequestGate());
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
    gate.current.invalidate();
    setAccess(null);
    setSelectedJob(null);
    setTab("jobs");
    setError("scopeChanged");
  }, []);
  const refresh = useCallback(async (quiet = false) => {
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
      if (active && roleNames.length) {
        const result = await client
          .from("jobs")
          .select("id,job_code,title,status,business_unit,location,level,function_group,hiring_season,req_date,request_type,priority,replacement_for")
          .order("job_code")
          .limit(100);
        if (result.error) throw result.error;
        const rules = await client.from("job_sla_rules")
          .select("level,function_group,hiring_season,target_workdays");
        if (rules.error) throw rules.error;
        const overview = await jobOverview();
        const metricsByJob = new Map(overview.jobs.map((row) => [row.job_id, row]));
        const byKey = new Map((rules.data || []).map((rule) =>
          [`${rule.level}:${rule.function_group}:${rule.hiring_season}`, rule.target_workdays],
        ));
        jobs = (result.data || []).map((job) => ({
          ...job,
          sla_target_workdays: job.level != null && job.function_group && job.hiring_season
            ? byKey.get(`${job.level}:${job.function_group}:${job.hiring_season}`) ?? null
            : null,
          metrics: metricsByJob.get(job.id),
        }));
      }
      if (gate.current.current(ticket)) {
        setSelectedJob((current) =>
          jobs.find((job) => job.id === current?.id) || jobs[0] || null,
        );
        setAccess({
          userId: session.user.id,
          email: session.user.email || "",
          active,
          roles: roleNames,
          jobs,
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
    setSelectedJob((current) =>
      jobs.find((job) => job.id === current?.id) || jobs[0] || null,
    );
  }, [jobs]);
  const reviewAllowed = !!allowed && canReview(access.roles);
  const adminAllowed = !!allowed && access.roles.includes("ADMIN");
  useEffect(() => {
    if (!globalSearchOpen) return;
    const frame = window.requestAnimationFrame(() => globalSearchRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [globalSearchOpen]);
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
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
  useEffect(() => {
    if (tab === "admin" && !adminAllowed) setTab("jobs");
  }, [tab, adminAllowed]);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const normalizedGlobalQuery = globalSearchQuery.trim().toLocaleLowerCase(locale);
  const globalNavMatches = [
    { label: t.jobs, description: "Job Master & Hiring Pipeline", destination: "jobs" as const },
    ...(reviewAllowed ? [
      { label: "Talent Pool", description: "Kho ứng viên đã duyệt", destination: "talent" as const },
      { label: locale === "en" ? "Job descriptions" : "JD tuyển dụng", description: "Hàng chờ duyệt mô tả công việc", destination: "jd" as const },
    ] : []),
    ...(adminAllowed ? [{ label: locale === "en" ? "Admin & permissions" : "Quản trị & quyền", description: "Quản lý Job và phân quyền", destination: "admin" as const }] : []),
  ].filter((item) => !normalizedGlobalQuery || `${item.label} ${item.description}`.toLocaleLowerCase(locale).includes(normalizedGlobalQuery));
  const globalJobMatches = (access?.jobs || []).filter((job) =>
    normalizedGlobalQuery && `${job.title} ${job.job_code || ""}`.toLocaleLowerCase(locale).includes(normalizedGlobalQuery),
  ).slice(0, 5);
  if (!access && showDemo) return <DemoWorkspace onExit={() => setShowDemo(false)} />;
  if (loading && !access) {
    return (
      <div className="auth-loading">
        <LoadingState label={t.loading} />
      </div>
    );
  }
  if (!access) {
    return (
      <main className="auth-screen">
        <section className="auth-brand-panel" aria-label={t.workspace} style={{ backgroundImage: `linear-gradient(135deg, rgb(19 24 68 / 84%), rgb(57 39 143 / 82%)), url("${basePath}/login-brand-background.webp")` }}>
          <div className="auth-brand-content">
            <a className="auth-brand" href={`${basePath}/`} aria-label="ATS">
              <span className="auth-brand-mark"><Icon name="jobs" size={22} /></span>
              <span>ATS<small>Applicant Tracking System</small></span>
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
              onChange={(event) => setLocale(event.target.value === "en" ? "en" : "vi")}
            >
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className="auth-login-content">
            <span className="auth-welcome-icon"><Icon name="team" size={25} /></span>
            <span className="auth-kicker">{t.loginEyebrow}</span>
            <h2>{locale === "vi" ? "Đăng nhập vào ATS" : "Sign in to ATS"}</h2>
            {error && (
              <div className="notice error auth-error" role="alert">
                <Icon name="help" />
                <span>{friendlyError(error, t)}</span>
                <button className="quiet" onClick={() => loginStarted.current ? window.location.reload() : void refresh()}>
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
                  Email thử nghiệm
                  <input type="email" autoComplete="username" value={localEmail} onChange={(event) => setLocalEmail(event.target.value)} placeholder="admin.test@example.invalid" />
                </label>
                <label>
                  Mật khẩu thử nghiệm
                  <input type="password" autoComplete="current-password" value={localPassword} onChange={(event) => setLocalPassword(event.target.value)} />
                </label>
                <button className="primary google-button" disabled={authBusy || !localEmail || !localPassword} onClick={() => void localLogin()}>
                  {authBusy ? "Đang đăng nhập…" : "Đăng nhập thử"}<Icon name="arrow" size={17} />
                </button>
                <button className="quiet auth-local-toggle" onClick={() => setLocalLoginOpen(false)}>Ẩn đăng nhập thử nghiệm</button>
              </div>
            ) : (
              <>
                <button className="primary auth-google-button" disabled={authBusy || !!error} onClick={login}>
                  <span className="google-mark" aria-hidden="true">G</span>
                  {authBusy ? t.signingIn : t.signIn}
                </button>
                {localLoginVisible && <button className="quiet auth-local-toggle" onClick={() => setLocalLoginOpen(true)}>Mở đăng nhập thử nghiệm cục bộ</button>}
              </>
            )}
            <div className="auth-scope-note">
              <span className="auth-scope-icon"><Icon name="jobs" size={20} /></span>
              <span>{t.scoped}</span>
            </div>
            <button className="auth-demo-button" type="button" onClick={() => setShowDemo(true)}>
              Xem thử giao diện ATS <Icon name="arrow" size={15} />
            </button>
            <span className="auth-demo-caption">Bản xem trước chỉ dùng dữ liệu minh họa</span>
          </div>
          <div className="auth-main-footer">ATS · {t.footer}</div>
        </section>
      </main>
    );
  }
  return (
    <div className={`shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <a className="skip-link" href="#main-content">
        {t.navigation}
      </a>
      <aside className="sidebar">
        <a className="brand" href={`${basePath}/`}>
          <span className="brand-mark">
            <Icon name="jobs" size={23} />
          </span>
          <span>
            ATS<span className="brand-caption">{t.workspace}</span>
          </span>
        </a>
        <div className="workspace-label">{t.workspace}</div>
        <nav aria-label={t.navigation}>
          <button
            className={tab === "jobs" ? "nav active" : "nav"}
            aria-current={tab === "jobs" ? "page" : undefined}
            onClick={() => setTab("jobs")}
          >
            <Icon name="jobs" />
            <span className="nav-label">{t.jobs}</span>
          </button>
          {reviewAllowed && (
            <button
              className={tab === "talent" ? "nav active" : "nav"}
              aria-current={tab === "talent" ? "page" : undefined}
              onClick={() => setTab("talent")}
            >
              <Icon name="team" />
              <span className="nav-label">Talent Pool</span>
            </button>
          )}
          {adminAllowed && (
            <button
              className={tab === "admin" ? "nav active" : "nav"}
              aria-current={tab === "admin" ? "page" : undefined}
              onClick={() => setTab("admin")}
            >
              <Icon name="shield" />
              <span className="nav-label">{locale === "en" ? "Admin & permissions" : "Quản trị & quyền"}</span>
            </button>
          )}
          {reviewAllowed && (
            <button
              className={tab === "jd" ? "nav active" : "nav"}
              aria-current={tab === "jd" ? "page" : undefined}
              onClick={() => setTab("jd")}
            >
              <Icon name="review" />
              <span className="nav-label">{locale === "en" ? "Job descriptions" : "JD tuyển dụng"}</span>
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
        <button className="sidebar-collapse" type="button" aria-label={sidebarCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"} aria-expanded={!sidebarCollapsed} onClick={() => setSidebarCollapsed((value) => !value)}>
          <Icon name={sidebarCollapsed ? "expand" : "collapse"} size={17} />
          <span className="nav-label">{sidebarCollapsed ? "Mở rộng" : "Thu gọn menu"}</span>
        </button>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="breadcrumb">
            {t.recruiting}
            <span>/</span>
            <strong>{tab === "jobs" ? (selectedJob?.title || t.jobs) : tab === "talent" ? "Talent Pool" : tab === "jd" ? "JD" : "Quản trị & quyền"}</strong>
          </div>
          <div className="header-actions">
            <div className={`global-search ${globalSearchOpen ? "is-open" : ""}`}>
              {globalSearchOpen ? (
                <>
                  <label className="global-search-input">
                    <Icon name="search" size={17} />
                    <input ref={globalSearchRef} value={globalSearchQuery} onChange={(event) => setGlobalSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { setGlobalSearchOpen(false); setGlobalSearchQuery(""); } }} placeholder={locale === "en" ? "Search jobs and pages…" : "Tìm Job hoặc màn hình…"} aria-label={locale === "en" ? "Search ATS" : "Tìm trong ATS"} />
                    <kbd>ESC</kbd>
                  </label>
                  <div className="global-search-results" role="listbox" aria-label={locale === "en" ? "Search results" : "Kết quả tìm kiếm"}>
                    {globalJobMatches.map((job) => <button key={job.id} type="button" role="option" aria-selected="false" onClick={() => { setSelectedJob(job); setTab("jobs"); setJobView("pipeline"); setGlobalSearchOpen(false); setGlobalSearchQuery(""); }}><span className="search-result-icon"><Icon name="jobs" size={16} /></span><span><strong>{job.title}</strong><small>{job.job_code || t.noCode} · {jobStatusLabel(job.status, t)}</small></span><Icon name="arrow" size={15} /></button>)}
                    {globalNavMatches.map((item) => <button key={item.destination} type="button" role="option" aria-selected="false" onClick={() => { setTab(item.destination); setGlobalSearchOpen(false); setGlobalSearchQuery(""); }}><span className="search-result-icon"><Icon name={item.destination === "jobs" ? "jobs" : item.destination === "talent" ? "team" : item.destination === "jd" ? "review" : "shield"} size={16} /></span><span><strong>{item.label}</strong><small>{item.description}</small></span><Icon name="arrow" size={15} /></button>)}
                    {!globalJobMatches.length && !globalNavMatches.length && <p className="global-search-empty">{locale === "en" ? "No matching Jobs or pages." : "Không tìm thấy Job hoặc màn hình phù hợp."}</p>}
                  </div>
                </>
              ) : <button className="global-search-trigger" type="button" onClick={() => setGlobalSearchOpen(true)}><Icon name="search" size={17} /><span>{locale === "en" ? "Search" : "Tìm nhanh"}</span><kbd>⌘ K</kbd></button>}
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
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
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
        <main id="main-content">
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
                      Email thử nghiệm
                      <input
                        type="email"
                        autoComplete="username"
                        value={localEmail}
                        onChange={(event) => setLocalEmail(event.target.value)}
                        placeholder="admin.test@example.invalid"
                      />
                    </label>
                    <label>
                      Mật khẩu thử nghiệm
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
                      {authBusy ? "Đang đăng nhập…" : "Đăng nhập thử"}
                      <Icon name="arrow" size={17} />
                    </button>
                    <div className="local-login-note">
                      Chế độ thử trên máy này. Quyền Admin/TA vẫn được
                      kiểm tra bằng dữ liệu thử.
                    </div>
                  </div>
                ) : (
                  <button
                    className="primary google-button"
                    disabled={authBusy || !!error}
                    onClick={login}
                  >
                    <span className="google-mark" aria-hidden="true">
                      G
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
              <div className="page-heading">
                <div>
                  <span className="eyebrow">{t.workspace}</span>
                  <h1>{tab === "jobs" ? t.jobs : tab === "talent" ? "Talent Pool" : tab === "jd" ? "JD tuyển dụng" : "Quản trị ATS"}</h1>
                  <p>{tab === "jobs" ? t.jobsIntro : tab === "talent" ? "Quản lý hồ sơ ứng viên đã được duyệt và đưa ứng viên vào Job phù hợp." : tab === "jd" ? "Kiểm tra, duyệt và theo dõi mô tả công việc trước khi tạo Job nháp." : "Tạo Job và cấp quyền theo từng Job; backend kiểm tra lại trước khi lưu."}</p>
                </div>
                <div className="heading-actions">
                  {tab === "jobs" && (
                    <button
                      className="secondary"
                      aria-label={guideOpen ? "Ẩn hướng dẫn" : "Hiện hướng dẫn"}
                      onClick={() => setGuideOpen((open) => !open)}
                    >
                      <Icon name={guideOpen ? "close" : "help"} size={17} />
                      {guideOpen ? t.hideGuide : t.help}
                    </button>
                  )}
                  {tab === "jobs" && adminAllowed && (
                    <button className="primary" onClick={() => setTab("admin")}>
                      Quản trị Job
                      <Icon name="shield" size={15} />
                    </button>
                  )}
                  <button className="secondary" onClick={() => void refresh()}>
                    <Icon name="refresh" size={17} />
                    {t.refreshAccess}
                  </button>
                </div>
              </div>
              <div className="role-line">
                {access.roles.map((role) => (
                  <span className="role" key={role}>
                    {roleLabel(role, t)}
                  </span>
                ))}
              </div>
              {tab === "talent" && reviewAllowed ? (
                <TalentPool key={access.userId} jobs={access.jobs} onAccessLost={invalidate} />
              ) : tab === "jd" && reviewAllowed ? (
                <ReviewQueue key={`${access.userId}-jd`} fixedKind="jd" onAccessLost={invalidate} />
              ) : tab === "admin" && adminAllowed ? (
                <AdminConsole jobs={access.jobs} onRefresh={() => refresh(true)} onAccessLost={invalidate} />
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
                            <button className="text-link" onClick={() => setTab("admin")}>
                              {t.guideAdminAction}
                              <Icon name="external" size={15} />
                            </button>
                          )}
                        </article>
                      </div>
                    </section>
                  )}
                  <div className="job-view-tabs" role="tablist" aria-label="Chế độ xem Job">
                    <button type="button" role="tab" aria-selected={jobView === "master"} className={jobView === "master" ? "active" : ""} onClick={() => setJobView("master")}>
                      <Icon name="jobs" size={16} /> 1.1 Bảng Master <span>{access.jobs.length} Job</span>
                    </button>
                    <button type="button" role="tab" aria-selected={jobView === "pipeline"} className={jobView === "pipeline" ? "active" : ""} onClick={() => setJobView("pipeline")}>
                      <Icon name="review" size={16} /> 1.2 Hiring Pipeline <span>{selectedJob?.job_code || "Chọn Job"}</span>
                    </button>
                  </div>
                  {jobView === "master" ? <>
                  <section className="metrics" aria-label={t.totalJobs}>
                    <div>
                      <div className="metric-top">
                        <small>{t.totalJobs}</small>
                        <span className="metric-icon purple">
                          <Icon name="jobs" />
                        </span>
                      </div>
                      <strong>{access.jobs.length}</strong>
                      <span>{t.totalHint}</span>
                    </div>
                    <div>
                      <div className="metric-top">
                        <small>{t.openJobs}</small>
                        <span className="metric-icon mint">
                          <Icon name="team" />
                        </span>
                      </div>
                      <strong>
                        {access.jobs.filter((j) => j.status === "OPEN").length}
                      </strong>
                      <span>{t.openHint}</span>
                    </div>
                    <div>
                      <div className="metric-top">
                        <small>{t.draftJobs}</small>
                        <span className="metric-icon amber">
                          <Icon name="review" />
                        </span>
                      </div>
                      <strong>
                        {access.jobs.filter((j) => j.status === "DRAFT").length}
                      </strong>
                      <span>{t.draftHint}</span>
                    </div>
                  </section>
                  <p className="scope-note">
                    <Icon name="shield" size={14} />
                    {t.scopeHint}
                  </p>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>
                        {t.jobList} · Master
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
                      <div className="job-status-filters" role="group" aria-label={t.jobStatus}>
                        <button
                          type="button"
                          className={`job-filter-chip filter-all ${status === "ALL" ? "selected" : ""}`}
                          aria-label={`${t.allStatuses} (${access.jobs.length})`}
                          aria-pressed={status === "ALL"}
                          onClick={() => setStatus("ALL")}
                        >
                          {t.allStatuses}<span>{access.jobs.length}</span>
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
                            const count = access.jobs.filter((job) => job.status === s).length;
                            return (
                              <button
                                key={s}
                                type="button"
                                className={`job-filter-chip status-${s.toLowerCase().replace(/_/g, "-")} ${status === s ? "selected" : ""}`}
                                aria-label={`${jobStatusLabel(s, t)} (${count})`}
                                aria-pressed={status === s}
                                onClick={() => setStatus(s)}
                              >
                                {jobStatusLabel(s, t)}<span>{count}</span>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                    {jobs.length ? (
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Vị trí tuyển dụng</th>
                              <th>Đơn vị</th>
                              <th>Trạng thái & yêu cầu</th>
                              <th>SLA & ưu tiên</th>
                              <th>Ứng viên & tiến độ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {jobs.map((job) => (
                              <tr key={job.id} className={selectedJob?.id === job.id ? "selected-job-row" : undefined}>
                                <td>
                                  <div className="job-title">
                                    <span className="job-icon">
                                      <Icon name="jobs" size={18} />
                                    </span>
                                    <button
                                      className="job-title-link"
                                      aria-pressed={selectedJob?.id === job.id}
                                      aria-label={`Chọn Job ${job.title}`}
                                      onClick={() => setSelectedJob(job)}
                                    >
                                      {job.title}
                                    </button>
                                  </div>
                                  <small className="job-code-subtitle">{job.job_code || t.noCode}</small>
                                </td>
                                <td><strong>{job.business_unit || "Chưa có đơn vị"}</strong><small className="job-row-meta">{job.function_group || "Chưa phân nhóm"}{job.location ? ` · ${job.location}` : ""}</small></td>
                                <td>
                                  <span
                                    className={`badge ${job.status === "OPEN" ? "green" : job.status === "DRAFT" ? "amber-badge" : ""}`}
                                  >
                                    <span className="status-dot" />
                                    {jobStatusLabel(job.status, t)}
                                  </span>
                                  <small className="job-row-meta">{job.request_type === "REPLACEMENT" ? "Thay thế" : job.request_type === "NEW" ? "Tuyển mới" : "Chưa xác định"}{job.req_date ? ` · Req ${job.req_date}` : ""}</small>
                                </td>
                                <td>{job.sla_target_workdays == null ? <span className="muted">Chưa thiết lập</span> : <span className="badge blue">≤ {job.sla_target_workdays} ngày làm việc</span>}<small className="job-row-meta">{job.level == null ? "Chưa có Level" : `Level ${job.level}`}{job.priority ? ` · ${job.priority}` : ""}{job.hiring_season ? ` · ${job.hiring_season}` : ""}</small></td>
                                <td>
                                  <strong>{job.metrics?.total_candidates ?? 0} ứng viên</strong>
                                  {job.metrics && <small className="job-row-meta">Mới {job.metrics.new_count} · Sơ loại {job.metrics.screening_count} · Phỏng vấn {job.metrics.interview_count} · Đã tuyển {job.metrics.hired_count}</small>}
                                  {job.metrics?.source_summary?.length ? <details className="job-source-summary"><summary>Nguồn ({job.metrics.source_summary.length})</summary><ul>{job.metrics.source_summary.map((source) => <li key={`${source.source}:${source.sub_source}:${source.source_ownership}`}>{source.sub_source ? `${source.sub_source} · ` : ""}{source.source}: {source.count}</li>)}</ul></details> : <small className="job-code-subtitle">Nguồn: chưa có dữ liệu</small>}
                                  <button className="job-pipeline-action" aria-label={`Mở pipeline ${job.title}`} onClick={() => { setSelectedJob(job); setJobView("pipeline"); }}>Pipeline <Icon name="arrow" size={14} /></button>
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
                  </> : selectedJob ? <section className="job-pipeline-view">
                    <div className="job-pipeline-toolbar">
                      <button className="secondary" onClick={() => setJobView("master")}><Icon name="arrow" size={15} /> Quay lại Bảng Master</button>
                      <label>Requisition
                        <select aria-label="Chọn Job cho Hiring Pipeline" value={selectedJob.id} onChange={(event) => setSelectedJob(access.jobs.find((job) => job.id === event.target.value) || null)}>
                          {access.jobs.map((job) => <option key={job.id} value={job.id}>[{job.job_code || "Chưa có mã"}] {job.title}</option>)}
                        </select>
                      </label>
                    </div>
                    <ApplicationPipeline key={selectedJob.id} job={selectedJob} onSessionLost={invalidate} canViewOffers={access.roles.some((role) => role === "ADMIN" || role === "TA_RECRUITER")} />
                  </section> : <div className="empty"><h3>Chưa có Job được cấp quyền</h3><p>Job sẽ xuất hiện tại đây khi được chia sẻ cho tài khoản của bạn.</p></div>}
                </>
              )}
            </>
          )}
        </main>
        <footer>
          <strong>ATS Workspace</strong>
          <span>{t.footer}</span>
        </footer>
      </div>
    </div>
  );
}
