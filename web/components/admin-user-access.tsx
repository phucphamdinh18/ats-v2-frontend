"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, ShieldCheck, UserRoundCheck, UserRoundX } from "lucide-react";
import { ApiError } from "@/lib/supabase";
import { listAdminUserAccess, setAdminUserActive, type AdminUserAccess } from "@/lib/admin-jobs";
import { useLanguage } from "./language";
import styles from "./admin-user-access.module.css";

const roleNames: Record<string, [string, string]> = {
  ADMIN: ["Admin", "Admin"],
  TA_RECRUITER: ["TA / Recruiter", "TA / Recruiter"],
  HIRING_MANAGER: ["Hiring Manager", "Hiring Manager"],
  INTERVIEWER: ["Interviewer", "Interviewer"],
};

export default function AdminUserAccess({ userId, onAccessLost }: { userId: string; onAccessLost: () => void }) {
  const { locale } = useLanguage();
  const en = locale === "en";
  const tr = (vi: string, english: string) => en ? english : vi;
  const [users, setUsers] = useState<AdminUserAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await listAdminUserAccess();
      setUsers(Array.isArray(result.users) ? result.users : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr("Không tải được danh sách tài khoản.", "Could not load user accounts."));
      if (cause instanceof ApiError && [401, 403].includes(cause.status || 0)) onAccessLost();
    } finally {
      setLoading(false);
    }
  }, [onAccessLost, en]);

  useEffect(() => { void refresh(); }, [refresh]);

  const activeAdminCount = users.filter((item) => item.is_active && item.roles.includes("ADMIN")).length;
  const visibleUsers = useMemo(() => {
    const term = query.trim().toLocaleLowerCase(en ? "en" : "vi");
    if (!term) return users;
    return users.filter((item) => `${item.email} ${item.display_name || ""} ${item.roles.join(" ")}`.toLocaleLowerCase(en ? "en" : "vi").includes(term));
  }, [users, query, en]);

  async function toggle(item: AdminUserAccess) {
    const enabled = !item.is_active;
    const prompt = enabled
      ? tr(`Kích hoạt lại ${item.email}? Người này sẽ lấy lại quyền Job đã được phân công trước đó.`, `Reactivate ${item.email}? They will regain their existing Job assignments.`)
      : tr(`Vô hiệu hóa ${item.email} trên toàn ATS? Người này sẽ mất quyền truy cập tất cả Job; dữ liệu và lịch sử vẫn được giữ.`, `Deactivate ${item.email} across ATS? They will lose access to every Job; their data and history will be retained.`);
    if (!window.confirm(prompt)) return;
    setBusyUser(item.user_id);
    setError("");
    setNotice("");
    try {
      await setAdminUserActive(item.user_id, enabled);
      setNotice(enabled
        ? tr(`Đã kích hoạt lại ${item.email}.`, `Reactivated ${item.email}.`)
        : tr(`Đã vô hiệu hóa ${item.email} trên toàn ATS.`, `Deactivated ${item.email} across ATS.`));
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr("Không cập nhật được tài khoản.", "Could not update this account."));
      if (cause instanceof ApiError && [401, 403].includes(cause.status || 0)) onAccessLost();
    } finally {
      setBusyUser(null);
    }
  }

  function formatDate(value: string | null) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(en ? "en-GB" : "vi-VN", { dateStyle: "medium" }).format(date);
  }

  return <section className={styles.root} aria-label={tr("Quản lý tài khoản ATS", "ATS user access management")}>
    <header className={styles.header}>
      <div className={styles.icon}><ShieldCheck size={23}/></div>
      <div><p className={styles.eyebrow}>ADMINISTRATION</p><h1>{tr("Tài khoản ATS", "ATS accounts")}</h1>
        <p>{tr("Vô hiệu hóa một người trên toàn ATS mà không xóa Job, ứng viên hoặc lịch sử.", "Disable a person across ATS without deleting Jobs, candidates, or history.")}</p>
      </div>
      <button type="button" className={styles.refresh} onClick={() => void refresh()} disabled={loading || !!busyUser}>
        <RefreshCw size={16} className={loading ? styles.spinning : undefined}/>{tr("Làm mới", "Refresh")}
      </button>
    </header>

    <div className={styles.notice}><strong>{tr("Vô hiệu hóa sẽ:", "Deactivation will:")}</strong> {tr("chặn người này dùng ATS và mọi Job được phân công. Các phân công được giữ lại để có thể khôi phục nếu kích hoạt lại.", "block ATS and all assigned Jobs. Existing assignments are retained so they can be restored if the account is reactivated.")}</div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p className={styles.success} role="status">{notice}</p>}

    <div className={styles.toolbar}>
      <label className={styles.search}><Search size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr("Tìm theo tên hoặc email", "Search name or email")}/></label>
      <span>{visibleUsers.length} {tr("tài khoản", "accounts")}</span>
    </div>

    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead><tr><th>{tr("TÀI KHOẢN", "ACCOUNT")}</th><th>{tr("VAI TRÒ ATS", "ATS ROLES")}</th><th>{tr("JOB ĐƯỢC GÁN", "ASSIGNED JOBS")}</th><th>{tr("ĐĂNG NHẬP GẦN NHẤT", "LAST SIGN IN")}</th><th>{tr("TRẠNG THÁI", "STATUS")}</th><th>{tr("THAO TÁC", "ACTION")}</th></tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={6} className={styles.empty}>{tr("Đang tải tài khoản…", "Loading accounts…")}</td></tr>
            : visibleUsers.length === 0 ? <tr><td colSpan={6} className={styles.empty}>{tr("Không có tài khoản phù hợp.", "No matching accounts.")}</td></tr>
            : visibleUsers.map((item) => {
              const self = item.user_id === userId;
              const lastAdmin = item.is_active && item.roles.includes("ADMIN") && activeAdminCount <= 1;
              return <tr key={item.user_id}>
                <td><strong>{item.display_name || item.email}</strong><small>{item.email}</small></td>
                <td><div className={styles.roles}>{item.roles.length ? item.roles.map((role) => <span key={role}>{roleNames[role]?.[en ? 1 : 0] || role}</span>) : <span>{tr("Chưa có role", "No role")}</span>}</div></td>
                <td>{item.job_count}</td><td>{formatDate(item.last_sign_in_at)}</td>
                <td><span className={`${styles.status} ${item.is_active ? styles.active : styles.inactive}`}>{item.is_active ? tr("Đang hoạt động", "Active") : tr("Đã vô hiệu hóa", "Deactivated")}</span></td>
                <td>{item.is_active ? <button type="button" className={styles.deactivate} disabled={!!busyUser || self || lastAdmin} title={self ? tr("Không thể tự vô hiệu hóa tài khoản đang dùng.", "You cannot deactivate your current account.") : lastAdmin ? tr("Cần giữ lại ít nhất một Admin hoạt động.", "At least one active Admin must remain.") : undefined} onClick={() => void toggle(item)}>{busyUser === item.user_id ? tr("Đang lưu…", "Saving…") : <><UserRoundX size={15}/>{tr("Vô hiệu hóa", "Deactivate")}</>}</button>
                  : <button type="button" className={styles.activate} disabled={!!busyUser} onClick={() => void toggle(item)}>{busyUser === item.user_id ? tr("Đang lưu…", "Saving…") : <><UserRoundCheck size={15}/>{tr("Kích hoạt lại", "Reactivate")}</>}</button>}</td>
              </tr>;
            })}
        </tbody>
      </table>
    </div>
  </section>;
}
