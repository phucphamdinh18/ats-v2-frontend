"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "./language";
import { ApiError, getClient } from "@/lib/supabase";
import { listApplications, searchApplications, type Application } from "@/lib/applications";
import {
  offerWorkflow,
  offerError,
  offerUuid,
  OFFER_RETURN_KEY,
  type ProposalFields,
  type WorkflowOffer,
  type OfferSetup,
} from "@/lib/offer-approval";
import type { Job } from "@/lib/policy";
import styles from "./offer-approval-workspace.module.css";
const emptyFields = {
  level: "",
  department: "",
  function: "",
  salary: "",
  currency: "VND",
  salary_period: "MONTH",
  start_date: "",
  benefits: "",
  notes: "",
};
type DraftForm = typeof emptyFields;
type Identity = { id: string; email: string; roles: string[]; active: boolean };
export default function OfferApprovalWorkspace() {
  const { locale, setLocale } = useLanguage();
  const en = locale === "en";
  const tr = (vi: string, english: string) => (en ? english : vi);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState("");
  const [setup, setSetup] = useState<OfferSetup>({
    approvers: [],
    templates: [],
  });
  const [rows, setRows] = useState<WorkflowOffer[]>([]);
  const [selected, setSelected] = useState<WorkflowOffer | null>(null);
  const [offset, setOffset] = useState(0);
  const [candidates, setCandidates] = useState<Application[]>([]);
  const [candidateQuery, setCandidateQuery] = useState("");
  const [candidateOffset, setCandidateOffset] = useState(0);
  const [candidatePageFull, setCandidatePageFull] = useState(false);
  const [applicationId, setApplicationId] = useState("");
  const [form, setForm] = useState<DraftForm>(emptyFields);
  const [editing, setEditing] = useState<WorkflowOffer | null>(null);
  const [approverId, setApproverId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [withdrawNote, setWithdrawNote] = useState("");
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [grantEmail, setGrantEmail] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateDrive, setTemplateDrive] = useState("");
  const [templateVersion, setTemplateVersion] = useState("1");
  const epoch = useRef(0);
  const candidateTicket = useRef(0);
  const detailTicket = useRef(0);
  const initialOffer = useRef<string | null>(null);
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const manager =
    !!identity?.active &&
    identity.roles.some((r) => r === "ADMIN" || r === "TA_RECRUITER");
  const admin = !!identity?.active && identity.roles.includes("ADMIN");
  const loseAccess = useCallback(() => {
    epoch.current++;
    candidateTicket.current++;
    detailTicket.current++;
    setRows([]);
    setSelected(null);
    setJobs([]);
    setCandidates([]);
    setSetup({ approvers: [], templates: [] });
    setIdentity(null);
    setPending(null);
    setSaving(false);
    setEditing(null);
    setForm(emptyFields);
    setApplicationId("");
  }, []);
  const refreshRows = useCallback(async (page = 0, focus?: string) => {
    const ticket = epoch.current;
    const detail = ++detailTicket.current;
    const list = await offerWorkflow<WorkflowOffer[]>({
      action: "list",
      limit: 25,
      offset: page,
    });
    if (ticket !== epoch.current) return;
    setRows(list);
    if (focus) {
      const result = await offerWorkflow<WorkflowOffer[]>({
        action: "detail",
        offer_id: focus,
      });
      if (ticket === epoch.current && detail === detailTicket.current)
        setSelected(result[0] || null);
    }
  }, []);
  useEffect(() => {
    const id = new URL(window.location.href).searchParams.get("offer");
    initialOffer.current = id && offerUuid.test(id) ? id : null;
    let mounted = true;
    async function init() {
      const ticket = ++epoch.current;
      setLoading(true);
      setIdentity(null);
      setRows([]);
      setSelected(null);
      setJobs([]);
      setCandidates([]);
      setPending(null);
      setEditing(null);
      setForm(emptyFields);
      setError("");
      try {
        const client = getClient();
        const {
          data: { session },
          error: authError,
        } = await client.auth.getSession();
        if (authError) throw authError;
        if (!mounted || ticket !== epoch.current) return;
        if (!session) {
          loseAccess();
          return;
        }
        const [profile, roles] = await Promise.all([
          client
            .from("app_users")
            .select("is_active")
            .eq("id", session.user.id)
            .maybeSingle(),
          client
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id),
        ]);
        if (profile.error) throw profile.error;
        if (roles.error) throw roles.error;
        if (!mounted || ticket !== epoch.current) return;
        const roleNames = (roles.data || []).map((x) => x.role as string);
        const active = profile.data?.is_active === true;
        setIdentity({
          id: session.user.id,
          email: session.user.email || "",
          roles: roleNames,
          active,
        });
        if (!active) {
          setRows([]);
          setSelected(null);
          return;
        }
        if (roleNames.some((r) => r === "ADMIN" || r === "TA_RECRUITER")) {
          const result = await client
            .from("jobs")
            .select("id,job_code,title,status,business_unit")
            .order("job_code")
            .limit(100);
          if (result.error) throw result.error;
          if (!mounted || ticket !== epoch.current) return;
          setJobs(result.data as Job[]);
          setJobId(result.data[0]?.id || "");
        }
        await refreshRows(0, initialOffer.current || undefined);
      } catch (e) {
        if (mounted) {
          if (e instanceof ApiError && (e.status === 401 || e.status === 403))
            loseAccess();
          setError(
            e instanceof Error ? e.message : "Không tải được quyền truy cập.",
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void init();
    let unsubscribe = () => {};
    try {
      const {
        data: { subscription },
      } = getClient().auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
          loseAccess();
          setLoading(false);
        } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
          setTimeout(() => {
            if (mounted) void init();
          }, 0);
        }
      });
      unsubscribe = () => subscription.unsubscribe();
    } catch (e) {
      setError(offerError(e, en));
      setLoading(false);
    }
    return () => {
      mounted = false;
      epoch.current++;
      candidateTicket.current++;
      detailTicket.current++;
      unsubscribe();
    };
  }, [loseAccess, refreshRows]);
  useEffect(() => {
    const ticket = ++candidateTicket.current;
    setSetup({ approvers: [], templates: [] });
    setCandidates([]);
    setApplicationId("");
    setApproverId("");
    setTemplateId("");
    setCandidateOffset(0);
    setEditing(null);
    setForm(emptyFields);
    if (!manager || !jobId) return;
    void Promise.all([
      offerWorkflow<OfferSetup>({ action: "setup", job_id: jobId }),
      listApplications(jobId, 25, 0),
    ])
      .then(([config, result]) => {
        if (ticket !== candidateTicket.current) return;
        setSetup(config);
        setApproverId(
          config.approvers.find((a) => a.id !== identity?.id)?.id || "",
        );
        setTemplateId(config.templates[0]?.id || "");
        setCandidatePageFull(result.applications.length === 25);
        setCandidates(
          result.applications.filter(
            (x) => x.status === "ACTIVE" && x.stage === "INTERVIEW",
          ),
        );
      })
      .catch((e) => {
        if (ticket === candidateTicket.current) {
          if (e instanceof ApiError && (e.status === 401 || e.status === 403))
            loseAccess();
          setError(e instanceof Error ? e.message : "Không tải được Job.");
        }
      });
  }, [jobId, manager, loseAccess, identity?.id]);
  useEffect(() => {
    if (manager && selected?.can_edit && selected.job_id)
      setJobId(selected.job_id);
  }, [manager, selected?.can_edit, selected?.job_id]);
  async function choose(id: string) {
    const ticket = epoch.current;
    const seq = ++detailTicket.current;
    setSelected(null);
    setDecisionNote("");
    setWithdrawNote("");
    try {
      const result = await offerWorkflow<WorkflowOffer[]>({
        action: "detail",
        offer_id: id,
      });
      if (ticket === epoch.current && seq === detailTicket.current)
        setSelected(result[0] || null);
    } catch (e) {
      if (ticket !== epoch.current) return;
      if (e instanceof ApiError && (e.status === 401 || e.status === 403))
        loseAccess();
      setError(offerError(e, en));
    }
  }
  async function mutate(command: Record<string, unknown>) {
    if (saving) return;
    const ticket = epoch.current;
    setPending(command);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await offerWorkflow<{ offer_id?: string }>(command);
      if (ticket !== epoch.current) return;
      setPending(null);
      setSelected(null);
      if (command.action === "draft") {
        setEditing(null);
        setForm(emptyFields);
        setApplicationId("");
      }
      setNotice(tr("Đã lưu kết quả.", "Result saved."));
      try {
        await refreshRows(offset, result?.offer_id || selected?.id);
        if (
          command.action === "grant_approver_email" ||
          command.action === "register_template"
        ) {
          const config = await offerWorkflow<OfferSetup>({
            action: "setup",
            job_id: jobId,
          });
          if (ticket === epoch.current) setSetup(config);
        }
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          loseAccess();
          return;
        }
        if (ticket === epoch.current)
          setError(
            tr(
              "Đã lưu, nhưng chưa tải lại được dữ liệu. Hãy tải lại danh sách; không gửi lại thao tác.",
              "Saved, but refresh failed. Reload the list without resubmitting.",
            ),
          );
      }
    } catch (e) {
      if (ticket !== epoch.current) return;
      if (e instanceof ApiError && e.status && e.status < 500) {
        setPending(null);
        if (e.status === 401 || e.status === 403) loseAccess();
      }
      setError(offerError(e, en));
    } finally {
      if (ticket === epoch.current) setSaving(false);
    }
  }
  async function reload() {
    setError("");
    try {
      await refreshRows(offset, selected?.id);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403))
        loseAccess();
      setError(offerError(e, en));
    }
  }
  async function findCandidates(page: number) {
    const ticket = ++candidateTicket.current;
    try {
      const query = candidateQuery.trim();
      const result = query ? await searchApplications(jobId, query, 25, page) : await listApplications(jobId, 25, page);
      if (ticket !== candidateTicket.current) return;
      setCandidateOffset(page);
      setCandidatePageFull(result.applications.length === 25);
      setCandidates(
        result.applications.filter(
          (x) => x.status === "ACTIVE" && x.stage === "INTERVIEW",
        ),
      );
      setApplicationId("");
    } catch (e) {
      if (ticket === candidateTicket.current) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403))
          loseAccess();
        setError(offerError(e, en));
      }
    }
  }
  function edit(o: WorkflowOffer) {
    setEditing(o);
    setApplicationId(o.application_id);
    setForm({ ...emptyFields, ...o.fields, salary: String(o.fields.salary) });
    setNotice("");
  }
  async function login() {
    try {
      sessionStorage.setItem(OFFER_RETURN_KEY, initialOffer.current || "inbox");
      const { error } = await getClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + base + "/" },
      });
      if (error) throw error;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đăng nhập được.");
    }
  }
  function status(value: string) {
    const labels: Record<string, [string, string]> = {
      DRAFT: ["Nháp", "Draft"],
      PENDING: ["Chờ duyệt", "Pending Approval"],
      APPROVED: ["Đã duyệt nội bộ", "Approved"],
      REJECTED: ["Bị từ chối duyệt", "Rejected"],
      SENT: ["Đã gửi ứng viên", "Sent"],
      ACCEPTED: ["Ứng viên đồng ý", "Accepted"],
      DECLINED: ["Ứng viên từ chối", "Declined"],
      EXPIRED: ["Hết hạn", "Expired"],
      WITHDRAWN:["Đã rút đề xuất","Withdrawn"],
    };
    return labels[value]?.[en ? 1 : 0] || value;
  }
  const frozen = !!pending || saving;
  return (
    <main className={styles.root}>
      <header className={styles.header}>
        <h1>
          ATS V2 ·{" "}
          {tr("Đề xuất và phê duyệt Offer", "Offer Proposal & Approval")}
        </h1>
        <div>
          <a href={`${base}/`}>{tr("Về ATS", "Back to ATS")}</a> ·{" "}
          <button type="button" onClick={() => setLocale(en ? "vi" : "en")}>
            {en ? "Tiếng Việt" : "English"}
          </button>
        </div>
      </header>
      {error && (
        <p role="alert" className={`${styles.notice} ${styles.error}`}>
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">
          {tr("Đang kiểm tra phiên đăng nhập…", "Checking session…")}
        </p>
      ) : !identity ? (
        <section className={`${styles.panel} ${styles.login}`}>
          <h2>{tr("Đăng nhập để xem đề xuất", "Sign in to view proposals")}</h2>
          <p>
            {tr(
              "Dùng đúng tài khoản được cấp quyền duyệt.",
              "Use your assigned approval account.",
            )}
          </p>
          <button className={styles.primary} onClick={() => void login()}>
            {tr("Đăng nhập bằng Google", "Sign in with Google")}
          </button>
        </section>
      ) : !identity.active ? (
        <p className={styles.notice}>
          {tr(
            "Tài khoản chưa được cấp quyền hoặc đã ngừng hoạt động. Liên hệ Admin.",
            "Account inactive or not provisioned. Contact Admin.",
          )}
        </p>
      ) : (
        <>
          <div className={styles.bar}>
            <span>{identity.email}</span>
            <button disabled={saving} onClick={() => void reload()}>
              {tr("Tải lại danh sách", "Refresh list")}
            </button>
            <button
              disabled={saving}
              onClick={() => void getClient().auth.signOut()}
            >
              {tr("Đăng xuất", "Sign out")}
            </button>
          </div>
          {pending && (
            <div role="status" className={styles.notice}>
              {tr(
                "Chưa xác định được kết quả ghi. Nội dung đang được giữ nguyên.",
                "Write outcome is unknown. The payload is frozen.",
              )}{" "}
              <button disabled={saving} onClick={() => void mutate(pending)}>
                {tr("Thử lại đúng yêu cầu", "Retry same request")}
              </button>
            </div>
          )}
          <div className={styles.grid}>
            <section className={styles.panel}>
              <h2>
                {tr("Danh sách đề xuất được phép xem", "Authorized proposals")}
              </h2>
              <div className={styles.scroll}>
                <table>
                  <thead>
                    <tr>
                      <th>{tr("Ứng viên", "Candidate")}</th>
                      <th>Job</th>
                      <th>Level</th>
                      <th>{tr("Trạng thái", "Status")}</th>
                      <th>{tr("Phiên bản", "Version")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <button
                            className={styles.link}
                            disabled={frozen}
                            onClick={() => void choose(o.id)}
                          >
                            {o.snapshot?.candidate_name || o.candidate_name}
                          </button>
                        </td>
                        <td>{o.snapshot?.job_title || o.job_title}</td>
                        <td>{o.fields.level}</td>
                        <td>{status(o.status)}</td>
                        <td>{o.version}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!rows.length && (
                <p>
                  {tr(
                    "Không có đề xuất trong phạm vi được cấp.",
                    "No proposals in your authorized scope.",
                  )}
                </p>
              )}
              <div className={styles.bar}>
                <button
                  disabled={frozen || offset === 0}
                  onClick={() => {
                    const n = Math.max(0, offset - 25);
                    setOffset(n);
                    void refreshRows(n).catch((e) => setError(String(e)));
                  }}
                >
                  {tr("Trước", "Previous")}
                </button>
                <span>{offset / 25 + 1}</span>
                <button
                  disabled={frozen || rows.length < 25}
                  onClick={() => {
                    const n = offset + 25;
                    setOffset(n);
                    void refreshRows(n).catch((e) => setError(String(e)));
                  }}
                >
                  {tr("Tiếp", "Next")}
                </button>
              </div>
              {manager && (
                <>
                  <hr />
                  <h2>
                    {editing
                      ? tr("Chỉnh bản nháp", "Edit draft")
                      : tr("Tạo Offer Proposal", "Create Offer Proposal")}
                  </h2>
                  <label>
                    Job
                    <select
                      value={jobId}
                      disabled={frozen || !!editing}
                      onChange={(e) => setJobId(e.target.value)}
                    >
                      <option value="">{tr("Chọn Job", "Select Job")}</option>
                      {jobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.job_code} · {j.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!editing && (
                    <>
                      <div className={styles.bar}>
                        <label>
                          {tr(
                            "Tìm ứng viên trong Job",
                            "Find candidate in Job",
                          )}
                          <input
                            value={candidateQuery}
                            disabled={frozen}
                            onChange={(e) => setCandidateQuery(e.target.value)}
                          />
                        </label>
                        <button
                          disabled={frozen || !jobId}
                          onClick={() => void findCandidates(0)}
                        >
                          {tr("Tìm", "Search")}
                        </button>
                      </div>
                      <label>
                        {tr(
                          "Ứng viên đang ở vòng Phỏng vấn",
                          "Active Interview application",
                        )}
                        <select
                          disabled={frozen}
                          required
                          value={applicationId}
                          onChange={(e) => setApplicationId(e.target.value)}
                        >
                          <option value="">
                            {tr("Chọn ứng viên", "Select candidate")}
                          </option>
                          {candidates.map((a) => (
                            <option
                              key={a.application_id}
                              value={a.application_id}
                            >
                              {a.candidate_name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className={styles.bar}>
                        <button
                          disabled={frozen || candidateOffset === 0}
                          onClick={() =>
                            void findCandidates(
                              Math.max(0, candidateOffset - 25),
                            )
                          }
                        >
                          {tr("Trang ứng viên trước", "Previous candidates")}
                        </button>
                        <button
                          disabled={frozen || !candidatePageFull}
                          onClick={() =>
                            void findCandidates(candidateOffset + 25)
                          }
                        >
                          {tr("Trang ứng viên tiếp", "Next candidates")}
                        </button>
                      </div>
                    </>
                  )}
                  <form
                    className={styles.form}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fields: ProposalFields = {
                        ...form,
                        salary: Number(form.salary),
                        salary_period: form.salary_period as "MONTH" | "YEAR",
                      };
                      void mutate({
                        action: "draft",
                        request_id: crypto.randomUUID(),
                        application_id: applicationId,
                        fields,
                        ...(editing
                          ? {
                              offer_id: editing.id,
                              expected_revision: editing.revision,
                            }
                          : {}),
                      });
                    }}
                  >
                    {(
                      [
                        "level",
                        "department",
                        "function",
                        "salary",
                        "currency",
                        "start_date",
                      ] as const
                    ).map((key) => (
                      <label key={key}>
                        {
                          {
                            level: "Level",
                            department: tr("Bộ phận", "Department"),
                            function: "Function",
                            salary: tr("Mức lương", "Salary"),
                            currency: tr("Tiền tệ", "Currency"),
                            start_date: tr(
                              "Ngày dự kiến onboard",
                              "Expected onboarding date",
                            ),
                          }[key]
                        }
                        <input
                          required
                          disabled={frozen}
                          type={
                            key === "salary"
                              ? "number"
                              : key === "start_date"
                                ? "date"
                                : "text"
                          }
                          min={key === "salary" ? "0.01" : undefined}
                          step={key === "salary" ? "0.01" : undefined}
                          maxLength={key === "currency" ? 3 : 160}
                          value={form[key]}
                          onChange={(e) =>
                            setForm((v) => ({
                              ...v,
                              [key]:
                                key === "currency"
                                  ? e.target.value.toUpperCase()
                                  : e.target.value,
                            }))
                          }
                        />
                      </label>
                    ))}
                    <label>
                      {tr("Kỳ lương", "Salary period")}
                      <select
                        disabled={frozen}
                        value={form.salary_period}
                        onChange={(e) =>
                          setForm((v) => ({
                            ...v,
                            salary_period: e.target.value,
                          }))
                        }
                      >
                        <option value="MONTH">{tr("Tháng", "Month")}</option>
                        <option value="YEAR">{tr("Năm", "Year")}</option>
                      </select>
                    </label>
                    <label>
                      {tr("Phúc lợi", "Benefits")}
                      <textarea
                        disabled={frozen}
                        maxLength={4000}
                        value={form.benefits}
                        onChange={(e) =>
                          setForm((v) => ({ ...v, benefits: e.target.value }))
                        }
                      />
                    </label>
                    <label className={styles.wide}>
                      {tr(
                        "Lý do đề xuất / Ghi chú",
                        "Proposal rationale / Notes",
                      )}
                      <textarea
                        disabled={frozen}
                        maxLength={4000}
                        value={form.notes}
                        onChange={(e) =>
                          setForm((v) => ({ ...v, notes: e.target.value }))
                        }
                      />
                    </label>
                    <button
                      className={styles.primary}
                      disabled={frozen || !applicationId}
                      type="submit"
                    >
                      {tr("Lưu nháp", "Save draft")}
                    </button>
                    {editing && (
                      <button
                        disabled={frozen}
                        type="button"
                        onClick={() => {
                          setEditing(null);
                          setForm(emptyFields);
                          setApplicationId("");
                        }}
                      >
                        {tr("Đóng chỉnh sửa", "Close editor")}
                      </button>
                    )}
                  </form>
                </>
              )}
            </section>
            <aside className={styles.panel}>
              <h2>
                {selected?.snapshot?.candidate_name ||
                  selected?.candidate_name ||
                  tr("Chi tiết đề xuất", "Proposal details")}
              </h2>
              {!selected ? (
                <p>
                  {tr(
                    "Chọn đề xuất để xem thông tin và kết quả duyệt.",
                    "Select a proposal to review its details.",
                  )}
                </p>
              ) : (
                <>
                  <p className={styles.badge}>
                    {status(selected.status)} · v{selected.version}
                  </p>
                  <dl className={styles.facts}>
                    {Object.entries(selected.snapshot || selected.fields)
                      .filter(
                        ([k]) =>
                          ![
                            "candidate_email",
                            "job_id",
                            "offer_id",
                            "notes",
                          ].includes(k),
                      )
                      .map(([k, v]) => (
                        <div key={k}>
                          <dt>
                            {(
                              {
                                candidate_name: tr("Ứng viên", "Candidate"),
                                job_title: "Job",
                                level: "Level",
                                department: tr("Bộ phận", "Department"),
                                function: "Function",
                                salary: tr("Mức lương", "Salary"),
                                currency: tr("Tiền tệ", "Currency"),
                                salary_period: tr("Kỳ lương", "Salary period"),
                                start_date: tr(
                                  "Ngày dự kiến onboard",
                                  "Expected onboarding",
                                ),
                                benefits: tr("Phúc lợi", "Benefits"),
                                version: tr("Phiên bản", "Version"),
                              } as Record<string, string>
                            )[k] || k}
                          </dt>
                          <dd>{String(v ?? "—")}</dd>
                        </div>
                      ))}
                  </dl>
                  {selected.fields.notes && <p>{selected.fields.notes}</p>}
                  {selected.can_edit && manager && (
                    <>
                      <button disabled={frozen} onClick={() => edit(selected)}>
                        {tr("Chỉnh bản nháp", "Edit draft")}
                      </button>
                      <div className={styles.bar}>
                        <label>
                          {tr("Người duyệt DH / CEO", "DH / CEO approver")}
                          <select
                            disabled={frozen}
                            value={approverId}
                            onChange={(e) => setApproverId(e.target.value)}
                          >
                            <option value="">
                              {tr("Chọn người duyệt", "Select approver")}
                            </option>
                            {setup.approvers
                              .filter((a) => a.id !== identity.id)
                              .map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.display_name ||
                                    tr(
                                      "Người duyệt chưa có tên",
                                      "Unnamed approver",
                                    )}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label>
                          {tr("Mẫu Offer Letter", "Offer Letter template")}
                          <select
                            disabled={frozen}
                            value={templateId}
                            onChange={(e) => setTemplateId(e.target.value)}
                          >
                            <option value="">
                              {tr("Chọn mẫu", "Select template")}
                            </option>
                            {setup.templates.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} · v{t.version}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <button
                        className={styles.primary}
                        disabled={
                          frozen ||
                          !approverId ||
                          !templateId ||
                          editing !== null
                        }
                        onClick={() =>
                          void mutate({
                            action: "submit",
                            request_id: crypto.randomUUID(),
                            offer_id: selected.id,
                            expected_revision: selected.revision,
                            approver_id: approverId,
                            template_id: templateId,
                          })
                        }
                      >
                        {tr(
                          "Gửi đề xuất cho người duyệt",
                          "Submit proposal for approval",
                        )}
                      </button>
                    </>
                  )}
                  {manager &&
                    ["DRAFT", "PENDING", "APPROVED"].includes(
                      selected.status,
                    ) && (
                      <section>
                        <label>
                          {tr(
                            "Lý do rút đề xuất để sửa",
                            "Reason to withdraw and revise",
                          )}
                          <textarea
                            disabled={frozen}
                            maxLength={4000}
                            value={withdrawNote}
                            onChange={(e) => setWithdrawNote(e.target.value)}
                          />
                        </label>
                        <button
                          disabled={frozen || !withdrawNote.trim()}
                          onClick={() =>
                            void mutate({
                              action: "withdraw",
                              request_id: crypto.randomUUID(),
                              offer_id: selected.id,
                              note: withdrawNote,
                            })
                          }
                        >
                          {tr(
                            "Rút đề xuất để lập bản mới",
                            "Withdraw to create a revised proposal",
                          )}
                        </button>
                      </section>
                    )}
                  {selected.can_approve && (
                    <>
                      <label>
                        {tr(
                          "Nhận xét; bắt buộc khi từ chối",
                          "Comment; required for rejection",
                        )}
                        <textarea
                          maxLength={4000}
                          disabled={frozen}
                          value={decisionNote}
                          onChange={(e) => setDecisionNote(e.target.value)}
                        />
                      </label>
                      <p className={styles.small}>
                        {tr(
                          "Duyệt sẽ tự xếp hàng gửi Offer Letter cho ứng viên.",
                          "Approval automatically queues the Offer Letter to the candidate.",
                        )}
                      </p>
                      <div className={styles.bar}>
                        <button
                          className={styles.primary}
                          disabled={frozen}
                          onClick={() =>
                            void mutate({
                              action: "decide",
                              request_id: crypto.randomUUID(),
                              offer_id: selected.id,
                              approve: true,
                              note: decisionNote,
                            })
                          }
                        >
                          {tr("Phê duyệt", "Approve")}
                        </button>
                        <button
                          disabled={frozen || !decisionNote.trim()}
                          onClick={() =>
                            void mutate({
                              action: "decide",
                              request_id: crypto.randomUUID(),
                              offer_id: selected.id,
                              approve: false,
                              note: decisionNote,
                            })
                          }
                        >
                          {tr("Từ chối", "Reject")}
                        </button>
                      </div>
                    </>
                  )}
                  {selected.decision_note && (
                    <p>
                      {tr("Nhận xét duyệt", "Decision note")}:{" "}
                      {selected.decision_note}
                    </p>
                  )}
                  <h3>{tr("Email và tài liệu", "Email and documents")}</h3>
                  {selected.deliveries.map((d) => (
                    <div className={styles.notice} key={d.id}>
                      <strong>
                        {d.kind === "APPROVAL_REQUEST"
                          ? tr("Đề xuất nội bộ", "Internal proposal")
                          : tr(
                              "Offer Letter cho ứng viên",
                              "Candidate Offer Letter",
                            )}
                      </strong>
                      <p>{d.state}</p>
                      {d.state === "UNCERTAIN" && (
                        <p>
                          {tr(
                            "Chưa rõ kết quả gửi. Cần đối soát hộp thư trước khi gửi lại.",
                            "Send outcome uncertain. Reconcile mailbox evidence before any resend.",
                          )}
                        </p>
                      )}
                      {manager && d.state === "FAILED" && (
                        <button
                          disabled={frozen}
                          onClick={() =>
                            void mutate({
                              action: "retry_delivery",
                              delivery_id: d.id,
                            })
                          }
                        >
                          {tr("Thử lại tác vụ chưa gửi", "Retry unsent task")}
                        </button>
                      )}
                      {d.drive_pdf_id &&
                        /^[A-Za-z0-9_-]+$/.test(d.drive_pdf_id) && (
                          <a
                            target="_blank"
                            rel="noopener noreferrer"
                            href={`https://drive.google.com/file/d/${d.drive_pdf_id}/view`}
                          >
                            {tr(
                              "Mở Offer Letter trên Drive",
                              "Open Offer Letter in Drive",
                            )}
                          </a>
                        )}
                    </div>
                  ))}
                  <h3>{tr("Lịch sử", "History")}</h3>
                  <ol className={styles.events}>
                    {selected.events.map((e, i) => (
                      <li key={`${e.at}-${i}`}>
                        {e.type} · {e.actor_name || "—"} ·{" "}
                        {new Date(e.at).toLocaleString(en ? "en-GB" : "vi-VN")}
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </aside>
          </div>
          {admin && (
            <section className={`${styles.panel} ${styles.admin}`}>
              <h2>
                {tr(
                  "Admin: Người duyệt và mẫu thư",
                  "Admin: approvers and templates",
                )}
              </h2>
              <p>
                {tr(
                  "Quyền người duyệt áp dụng cho Job đang chọn. Tài khoản phải đăng nhập ATS ít nhất một lần.",
                  "Approval grants apply to the selected Job. The user must have signed in to ATS at least once.",
                )}
              </p>
              <div className={styles.form}>
                <label>
                  Email DH / CEO
                  <input
                    type="email"
                    disabled={frozen}
                    value={grantEmail}
                    onChange={(e) => setGrantEmail(e.target.value)}
                  />
                </label>
                <div className={styles.bar}>
                  <button
                    disabled={frozen || !jobId || !grantEmail}
                    onClick={() =>
                      void mutate({
                        action: "grant_approver_email",
                        job_id: jobId,
                        email: grantEmail,
                        enabled: true,
                      })
                    }
                  >
                    {tr("Cấp quyền", "Grant")}
                  </button>
                  <button
                    disabled={frozen || !jobId || !grantEmail}
                    onClick={() =>
                      void mutate({
                        action: "grant_approver_email",
                        job_id: jobId,
                        email: grantEmail,
                        enabled: false,
                      })
                    }
                  >
                    {tr("Thu hồi", "Revoke")}
                  </button>
                </div>
                <label>
                  {tr("Tên mẫu thư", "Template name")}
                  <input
                    disabled={frozen}
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                </label>
                <label>
                  {tr(
                    "Link Google Docs của mẫu thư",
                    "Template Google Docs URL",
                  )}
                  <input
                    disabled={frozen}
                    value={templateDrive}
                    onChange={(e) => setTemplateDrive(e.target.value)}
                  />
                </label>
                <label>
                  {tr("Phiên bản mẫu", "Template version")}
                  <input
                    type="number"
                    min="1"
                    disabled={frozen}
                    value={templateVersion}
                    onChange={(e) => setTemplateVersion(e.target.value)}
                  />
                </label>
                <button
                  disabled={frozen || !templateName || !templateDrive}
                  onClick={() => {
                    const id = templateDrive.match(
                      /^https:\/\/docs\.google\.com\/document\/d\/([A-Za-z0-9_-]+)/,
                    )?.[1];
                    if (!id) {
                      setError(
                        tr(
                          "Nhập link Google Docs hợp lệ.",
                          "Enter a valid Google Docs URL.",
                        ),
                      );
                      return;
                    }
                    void mutate({
                      action: "register_template",
                      name: templateName,
                      drive_file_id: id,
                      version: Number(templateVersion),
                    });
                  }}
                >
                  {tr("Đăng ký mẫu thư", "Register template")}
                </button>
              </div>
              <p className={styles.small}>
                {tr(
                  "Mỗi phiên bản dùng một file mẫu riêng. Đăng ký mẫu không tự cấp quyền Drive hoặc bật gửi email.",
                  "Use a separate source document per template version. Registration does not grant Drive access or enable email.",
                )}
              </p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
