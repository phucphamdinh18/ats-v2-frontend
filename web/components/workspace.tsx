"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getClient } from "@/lib/supabase";
import { authRedirect, canReview, RequestGate, type Job } from "@/lib/policy";
import ReviewQueue from "./review-queue";

type Access = {
  userId: string;
  email: string;
  roles: string[];
  active: boolean;
  jobs: Job[];
};
export default function Workspace() {
  const [access, setAccess] = useState<Access | null>(null);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"jobs" | "review">("jobs");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const gate = useRef(new RequestGate());
  const loginStarted = useRef(false);
  const authUser = useRef<string | null>(null);
  const invalidate = useCallback(() => {
    gate.current.invalidate();
    setAccess(null);
    setTab("jobs");
    setError(
      "Quyền truy cập đã thay đổi hoặc phiên đã hết hạn. Hãy tải lại quyền.",
    );
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
        setError(
          err instanceof Error
            ? err.message
            : "Không tải được quyền truy cập ATS.",
        );
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
      timeout = setTimeout(
        () =>
          reject(
            new Error(
              "Đăng nhập phản hồi chậm. Hãy tải lại trang trước khi thử lại.",
            ),
          ),
        15000,
      );
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
        .toLocaleLowerCase("vi")
        .includes(search.toLocaleLowerCase("vi")),
  );
  return (
    <div className="shell">
      <aside className="sidebar">
        <a
          className="brand"
          href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/`}
        >
          <span className="brand-mark">a</span> ATS <small>WORKSPACE</small>
        </a>
        <div className="workspace-label">KHÔNG GIAN TUYỂN DỤNG</div>
        <nav aria-label="Điều hướng chính">
          <button
            className={tab === "jobs" ? "nav active" : "nav"}
            onClick={() => setTab("jobs")}
          >
            <span aria-hidden="true">▦</span> Vị trí tuyển dụng
          </button>
          {allowed && canReview(access.roles) && (
            <button
              className={tab === "review" ? "nav active" : "nav"}
              onClick={() => setTab("review")}
            >
              <span aria-hidden="true">▤</span> Duyệt CV & JD
            </button>
          )}
        </nav>
        <div className="sidebar-note">
          <span className="dot" /> ATS V2 độc lập
          <br />
          <small>Dữ liệu theo quyền của bạn</small>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <span>
            Tuyển dụng <span className="slash">/</span>{" "}
            {tab === "jobs" ? "Vị trí tuyển dụng" : "Duyệt CV & JD"}
          </span>
          <div className="account">
            <span>{access?.email || "ATS Workspace"}</span>
            {access && (
              <button className="quiet" onClick={logout} disabled={authBusy}>
                Đăng xuất
              </button>
            )}
          </div>
        </header>
        <main id="main-content">
          {error && (
            <div className="notice error" role="alert">
              {error}{" "}
              <button
                className="quiet"
                onClick={() =>
                  loginStarted.current
                    ? window.location.reload()
                    : void refresh()
                }
              >
                {loginStarted.current ? "Tải lại trang" : "Tải lại quyền"}
              </button>
            </div>
          )}
          {loading ? (
            <section className="empty" role="status">
              <span className="spinner" />
              Đang tải không gian làm việc…
            </section>
          ) : !access ? (
            <section className="login-card">
              <div className="eyebrow">CHÀO MỪNG ĐẾN ATS</div>
              <h1>
                Mỗi cơ hội bắt đầu
                <br />
                từ một kết nối.
              </h1>
              <p>
                Đăng nhập để quản lý các vị trí tuyển dụng
                <br />
                và duyệt hồ sơ trong phạm vi được giao.
              </p>
              <button
                className="primary"
                disabled={authBusy || !!error}
                onClick={login}
              >
                {authBusy ? "Đang chuyển tới Google…" : "Đăng nhập bằng Google"}
              </button>
            </section>
          ) : !allowed ? (
            <section className="empty">
              <h1>Đang chờ cấp quyền</h1>
              <p>
                Tài khoản đã đăng nhập. Admin cần kích hoạt hồ sơ và cấp vai trò
                ATS.
              </p>
              <button className="secondary" onClick={() => void refresh()}>
                Kiểm tra lại quyền
              </button>
            </section>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">ATS WORKSPACE</div>
                  <h1>
                    {tab === "jobs" ? "Vị trí tuyển dụng" : "Duyệt CV & JD"}
                  </h1>
                  <p>
                    {tab === "jobs"
                      ? "Theo dõi các vị trí trong phạm vi bạn được xem."
                      : "Đối chiếu bản nháp với tệp gốc trước khi đưa vào ATS."}
                  </p>
                </div>
                <button className="secondary" onClick={() => void refresh()}>
                  ↻ Tải lại quyền
                </button>
              </div>
              <div className="role-line">
                {access.roles.map((role) => (
                  <span className="role" key={role}>
                    {role}
                  </span>
                ))}
              </div>
              {tab === "review" && canReview(access.roles) ? (
                <ReviewQueue key={access.userId} onAccessLost={invalidate} />
              ) : (
                <>
                  <section
                    className="metrics"
                    aria-label="Tóm tắt danh sách đã tải"
                  >
                    <div>
                      <small>Vị trí đã tải</small>
                      <strong>{access.jobs.length}</strong>
                      <span>Tối đa 100 vị trí được phép xem</span>
                    </div>
                    <div>
                      <small>Đang tuyển</small>
                      <strong>
                        {access.jobs.filter((j) => j.status === "OPEN").length}
                      </strong>
                      <span>Trong danh sách đã tải</span>
                    </div>
                    <div>
                      <small>Bản nháp</small>
                      <strong>
                        {access.jobs.filter((j) => j.status === "DRAFT").length}
                      </strong>
                      <span>Chờ hoàn thiện thông tin</span>
                    </div>
                  </section>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>
                        Danh sách vị trí{" "}
                        <span className="count">{jobs.length}</span>
                      </h2>
                    </div>
                    <div className="toolbar">
                      <label className="search">
                        <span aria-hidden="true">⌕</span>
                        <input
                          aria-label="Tìm vị trí"
                          placeholder="Tìm tên vị trí hoặc mã Job…"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </label>
                      <select
                        aria-label="Trạng thái Job"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                      >
                        <option value="ALL">Tất cả trạng thái</option>
                        {Array.from(new Set(access.jobs.map((j) => j.status)))
                          .sort()
                          .map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                      </select>
                    </div>
                    {jobs.length ? (
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>VỊ TRÍ</th>
                              <th>MÃ JOB</th>
                              <th>TRẠNG THÁI</th>
                            </tr>
                          </thead>
                          <tbody>
                            {jobs.map((job) => (
                              <tr key={job.id}>
                                <td>
                                  <div className="job-title">
                                    <span
                                      className="job-icon"
                                      aria-hidden="true"
                                    >
                                      ▦
                                    </span>
                                    <strong>{job.title}</strong>
                                  </div>
                                </td>
                                <td className="muted">
                                  {job.job_code || "Chưa cấp mã"}
                                </td>
                                <td>
                                  <span
                                    className={`badge ${job.status === "OPEN" ? "green" : ""}`}
                                  >
                                    {job.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="empty">
                        <h3>Chưa có vị trí phù hợp</h3>
                        <p>Thử đổi bộ lọc hoặc kiểm tra phạm vi được giao.</p>
                      </div>
                    )}
                    <div className="panel-footer">
                      Hiển thị {jobs.length} / {access.jobs.length} vị trí đã
                      tải · Thông tin được lọc theo quyền ATS
                    </div>
                  </section>
                </>
              )}
            </>
          )}
        </main>
        <footer>
          ATS V2 <span>Không gian tuyển dụng của bạn</span>
        </footer>
      </div>
    </div>
  );
}
