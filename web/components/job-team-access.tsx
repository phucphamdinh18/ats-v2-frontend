"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { UsersRound, UserPlus, ShieldCheck, RefreshCw } from "lucide-react";
import type { Job } from "@/lib/policy";
import { ApiError } from "@/lib/supabase";
import {
  assignJobMember,
  listJobMembers,
  removeJobMember,
  type JobMember,
} from "@/lib/admin-jobs";
import { offerWorkflow, type OfferSetup } from "@/lib/offer-approval";
import { useLanguage } from "./language";
import styles from "./admin-workspace.module.css";
const names: Record<string, string> = {
  TA_RECRUITER: "TA / Recruiter",
  HIRING_MANAGER: "Hiring Manager",
  INTERVIEWER: "Interviewer",
  OFFER_APPROVER: "Department Head / CEO Approver",
};
type Command =
  | { kind: "assign"; email: string; role: string }
  | { kind: "remove"; member: JobMember }
  | { kind: "removeApprover"; id: string };
export default function JobTeamAccess({
  job,
  onAccessLost,
}: {
  job: Job;
  onAccessLost: () => void;
}) {
  const { locale } = useLanguage(),
    en = locale === "en";
  const tr = (vi: string, english: string) => (en ? english : vi);
  const [members, setMembers] = useState<JobMember[]>([]),
    [approvers, setApprovers] = useState<OfferSetup["approvers"]>([]),
    [email, setEmail] = useState(""),
    [role, setRole] = useState("TA_RECRUITER"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<Command | null>(null),
    [confirm, setConfirm] = useState<JobMember | null>(null);
  const epoch = useRef(0),
    lock = useRef(false),
    read = useRef(0);
  const load = useCallback(async () => {
    const seq = ++read.current;
    setLoading(true);
    try {
      const [r, setup] = await Promise.all([
        listJobMembers(job.id),
        job.status === "DRAFT"
          ? Promise.resolve({ approvers: [] })
          : offerWorkflow<OfferSetup>({ action: "setup", job_id: job.id }),
      ]);
      if (seq === read.current) {
        setMembers(r.members);
        setApprovers(setup.approvers || []);
      }
    } catch (e) {
      if (seq !== read.current) return;
      setMembers([]);
      setApprovers([]);
      setError(e instanceof Error ? e.message : "Không tải được đội ngũ.");
      if (e instanceof ApiError && [401, 403].includes(e.status || 0))
        onAccessLost();
    } finally {
      if (seq === read.current) setLoading(false);
    }
  }, [job.id, job.status, onAccessLost]);
  useEffect(() => {
    epoch.current++;
    void load();
    return () => {
      epoch.current++;
      read.current++;
    };
  }, [load]);
  const frozen = busy || !!pending;
  const assignable = ["DRAFT", "OPEN", "ON_HOLD"].includes(job.status);
  async function write(command: Command) {
    if (lock.current) return;
    lock.current = true;
    const ticket = epoch.current;
    setPending(command);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (command.kind === "removeApprover")
        await offerWorkflow({
          action: "grant_approver",
          job_id: job.id,
          user_id: command.id,
          enabled: false,
        });
      else if (command.kind === "assign" && command.role === "OFFER_APPROVER")
        await offerWorkflow({
          action: "grant_approver_email",
          job_id: job.id,
          email: command.email,
          enabled: true,
        });
      else if (command.kind === "assign")
        await assignJobMember(job.id, command.email, command.role);
      else
        await removeJobMember(
          job.id,
          command.member.user_id,
          command.member.role,
        );
      if (ticket !== epoch.current) return;
      setPending(null);
      setConfirm(null);
      setEmail("");
      setMessage(
        tr(
          "Đã cập nhật phân công trên Job này.",
          "Team assignments updated for this Job.",
        ),
      );
      await load();
    } catch (e) {
      if (ticket !== epoch.current) return;
      if (e instanceof ApiError && e.status && e.status < 500) setPending(null);
      setError(
        e instanceof Error
          ? e.message
          : tr(
              "Không cập nhật được phân công.",
              "Could not update assignments.",
            ),
      );
      if (e instanceof ApiError && [401, 403].includes(e.status || 0)) {
        setMembers([]);
        setApprovers([]);
        onAccessLost();
      }
    } finally {
      lock.current = false;
      if (ticket === epoch.current) setBusy(false);
    }
  }
  function assign(e: FormEvent) {
    e.preventDefault();
    if (
      frozen ||
      !assignable ||
      (role === "OFFER_APPROVER" && job.status === "DRAFT")
    )
      return;
    void write({ kind: "assign", email: email.trim().toLowerCase(), role });
  }
  return (
    <section className={styles.root} aria-label="Team & Access">
      <header className={styles.header}>
        <div className={styles.headingIcon}>
          <UsersRound size={22} />
        </div>
        <div>
          <h2>Team & Access</h2>
          <p>
            {tr("Phân công đội ngũ cho", "Assign the hiring team for")}{" "}
            <strong>{job.title}</strong>
          </p>
        </div>
        <button disabled={frozen || loading} onClick={() => void load()}>
          <RefreshCw size={15} />
          {tr("Tải lại", "Refresh")}
        </button>
      </header>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className={styles.success} role="status">
          {message}
        </p>
      )}
      {pending && (
        <div className={styles.notice}>
          {tr(
            "Chưa xác định kết quả. Chỉ thử lại đúng thao tác này.",
            "Outcome unknown. Retry the same assignment only.",
          )}
          <button disabled={busy} onClick={() => void write(pending)}>
            {tr("Thử lại thao tác", "Retry assignment")}
          </button>
        </div>
      )}
      <div className={styles.teamLayout}>
        <section className={styles.card}>
          <div className={styles.formHead}>
            <UsersRound size={19} />
            <h3>{tr("Thành viên đã phân công", "Assigned team")}</h3>
          </div>
          {loading ? (
            <p role="status">{tr("Đang tải đội ngũ…", "Loading team…")}</p>
          ) : members.length ? (
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>{tr("Thành viên", "Member")}</th>
                    <th>{tr("Vai trò", "Role")}</th>
                    <th>{tr("Thao tác", "Action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.user_id + ":" + m.role}>
                      <td>{m.email}</td>
                      <td>
                        <span className={styles.role}>
                          {names[m.role] || m.role}
                        </span>
                      </td>
                      <td>
                        <button
                          disabled={frozen}
                          onClick={() => setConfirm(m)}
                          aria-label={`${tr("Thu hồi", "Revoke")} ${m.email} ${names[m.role] || m.role}`}
                        >
                          {tr("Thu hồi", "Revoke")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.empty}>
              {tr(
                "Chưa có thành viên được phân công cho Job này.",
                "No team members assigned to this Job yet.",
              )}
            </p>
          )}
          <h3>
            {tr("Người duyệt Offer · DH / CEO", "Offer approvers · DH / CEO")}
          </h3>
          {job.status === "DRAFT" ? (
            <p>
              {tr(
                "Mở Job trước khi gán người duyệt Offer.",
                "Open the Job before assigning Offer approvers.",
              )}
            </p>
          ) : (
            !loading &&
            (approvers.length ? (
              <ul>
                {approvers.map((a) => (
                  <li key={a.id}>
                    {a.display_name || a.id}{" "}
                    <button
                      disabled={frozen}
                      onClick={() => {
                        if (
                          window.confirm(
                            tr(
                              "Thu hồi quyền duyệt Offer trên Job này?",
                              "Revoke Offer approval access on this Job?",
                            ),
                          )
                        )
                          void write({ kind: "removeApprover", id: a.id });
                      }}
                    >
                      {tr("Thu hồi Approver", "Revoke approver")}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                {tr(
                  "Chưa có người duyệt Offer được phân công.",
                  "No Offer approvers assigned.",
                )}
              </p>
            ))
          )}
          {confirm && (
            <div
              className={styles.notice}
              role="alertdialog"
              aria-label={tr(
                "Xác nhận thu hồi quyền",
                "Confirm access removal",
              )}
            >
              <p>
                {tr("Thu hồi", "Remove")} {names[confirm.role]} ·{" "}
                {confirm.email}?
              </p>
              <div className={styles.actions}>
                <button disabled={frozen} onClick={() => setConfirm(null)}>
                  {tr("Hủy", "Cancel")}
                </button>
                <button
                  className={styles.primary}
                  disabled={frozen}
                  onClick={() =>
                    void write({ kind: "remove", member: confirm })
                  }
                >
                  {tr("Xác nhận thu hồi", "Confirm removal")}
                </button>
              </div>
            </div>
          )}
        </section>
        <form className={styles.card} onSubmit={assign}>
          <div className={styles.formHead}>
            <UserPlus size={19} />
            <h3>{tr("Thêm thành viên", "Add team member")}</h3>
          </div>
          <fieldset disabled={frozen || !assignable}>
            <label>
              {tr("Email người dùng", "User email")}
              <input
                type="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                autoComplete="off"
              />
            </label>
            <label>
              {tr("Vai trò trên Job", "Role on this Job")}
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                {Object.entries(names).map(([v, n]) => (
                  <option
                    key={v}
                    value={v}
                    disabled={v === "OFFER_APPROVER" && job.status === "DRAFT"}
                  >
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button className={styles.primary} type="submit">
              <UserPlus size={16} />
              {tr("Gán quyền", "Assign member")}
            </button>
          </fieldset>
          <p className={styles.muted}>
            {tr(
              "Thành viên cần đăng nhập ATS ít nhất một lần. Quyền được giới hạn theo Job và vai trò đã chọn.",
              "The member must sign in to ATS first. Access follows this Job and the selected role.",
            )}
          </p>
          {!assignable && (
            <p className={styles.notice}>
              {tr(
                "Job này không còn cho phép thêm thành viên.",
                "This Job no longer accepts new assignments.",
              )}
            </p>
          )}
          <p className={styles.muted}>
            <ShieldCheck size={14} />
            {tr(
              "Chỉ Admin được thay đổi phân công. Quyền DH / CEO chỉ áp dụng duyệt Offer Proposal của Job này, không tạo vai trò toàn hệ thống.",
              "Only Admin can change assignments. DH / CEO access covers this Job’s Offer Proposals without a global role.",
            )}
          </p>
        </form>
      </div>
    </section>
  );
}
