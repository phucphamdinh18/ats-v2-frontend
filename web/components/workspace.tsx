"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getClient } from "@/lib/supabase";
import { authRedirect, canReview, RequestGate, type Job } from "@/lib/policy";
import ReviewQueue from "./review-queue";
import { useLanguage } from "./language";
import Icon from "./icon";
import LoadingState from "./loading-state";
import ApplicationPipeline from "./application-pipeline";
import { format, friendlyError, jobStatusLabel, roleLabel } from "@/lib/i18n";

type Access = {
  userId: string;
  email: string;
  roles: string[];
  active: boolean;
  jobs: Job[];
};
export default function Workspace() {
  const { t, locale, setLocale } = useLanguage();
  const [guideOpen, setGuideOpen] = useState(true);
  const [access, setAccess] = useState<Access | null>(null);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"jobs" | "review">("jobs");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const gate = useRef(new RequestGate());
  const loginStarted = useRef(false);
  const authUser = useRef<string | null>(null);
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
          .select("id,job_code,title,status")
          .order("job_code")
          .limit(100);
        if (result.error) throw result.error;
        jobs = result.data || [];
      }
      if (gate.current.current(ticket))
        setAccess({
          userId: session.user.id,
          email: session.user.email || "",
          active,
          roles: roleNames,
          jobs,
        });
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
  const allowed = access?.active && access.roles.length > 0;
  const jobs = (access?.jobs || []).filter(
    (job) =>
      (status === "ALL" || job.status === status) &&
      `${job.title} ${job.job_code || ""}`
        .toLocaleLowerCase(locale)
        .includes(search.toLocaleLowerCase(locale)),
  );
  const reviewAllowed = !!allowed && canReview(access.roles);
  const adminAllowed = !!allowed && access.roles.includes("ADMIN");
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const adminUrl = process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL
    ? new URL("qa.html", process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL).href
    : basePath + "/qa.html";
  return (
    <div className="shell">
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
            {t.jobs}
          </button>
          {reviewAllowed && (
            <button
              className={tab === "review" ? "nav active" : "nav"}
              aria-current={tab === "review" ? "page" : undefined}
              onClick={() => setTab("review")}
            >
              <Icon name="review" />
              {t.review}
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
          <span>{t.scoped}</span>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="breadcrumb">
            {t.recruiting}
            <span>/</span>
            <strong>{tab === "jobs" ? t.jobs : t.review}</strong>
          </div>
          <div className="header-actions">
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
                  <h1>{tab === "jobs" ? t.jobs : t.review}</h1>
                  <p>{tab === "jobs" ? t.jobsIntro : t.reviewIntro}</p>
                </div>
                <div className="heading-actions">
                  {tab === "jobs" && !guideOpen && (
                    <button
                      className="secondary"
                      onClick={() => setGuideOpen(true)}
                    >
                      <Icon name="help" size={17} />
                      {t.help}
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
              {tab === "review" && reviewAllowed ? (
                <ReviewQueue key={access.userId} onAccessLost={invalidate} />
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
                              onClick={() => setTab("review")}
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
                            <a
                              className="text-link"
                              href={adminUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {t.guideAdminAction}
                              <Icon name="external" size={15} />
                            </a>
                          )}
                        </article>
                      </div>
                    </section>
                  )}
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
                        {t.jobList}
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
                      <select
                        aria-label={t.jobStatus}
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                      >
                        <option value="ALL">{t.allStatuses}</option>
                        {Array.from(
                          new Set([
                            "OPEN",
                            "DRAFT",
                            ...access.jobs.map((j) => j.status),
                          ]),
                        )
                          .sort()
                          .map((s) => (
                            <option key={s} value={s}>
                              {jobStatusLabel(s, t)}
                            </option>
                          ))}
                      </select>
                    </div>
                    {jobs.length ? (
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>{t.colJob}</th>
                              <th>{t.colCode}</th>
                              <th>{t.colStatus}</th>
                              <th>Pipeline</th>
                            </tr>
                          </thead>
                          <tbody>
                            {jobs.map((job) => (
                              <tr key={job.id}>
                                <td>
                                  <div className="job-title">
                                    <span className="job-icon">
                                      <Icon name="jobs" size={18} />
                                    </span>
                                    <strong>{job.title}</strong>
                                  </div>
                                </td>
                                <td>
                                  <button
                                    className="secondary"
                                    aria-label={`Mở pipeline ${job.title}`}
                                    onClick={() => setSelectedJob(job)}
                                  >
                                    Mở pipeline
                                  </button>
                                </td>
                                <td className="muted">
                                  {job.job_code || t.noCode}
                                </td>
                                <td>
                                  <span
                                    className={`badge ${job.status === "OPEN" ? "green" : job.status === "DRAFT" ? "amber-badge" : ""}`}
                                  >
                                    <span className="status-dot" />
                                    {jobStatusLabel(job.status, t)}
                                  </span>
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
                  {selectedJob && (
                    <ApplicationPipeline
                      key={selectedJob.id}
                      job={selectedJob}
                      onSessionLost={invalidate}
                    />
                  )}
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
