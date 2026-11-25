"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  BriefcaseBusiness,
  FilePlus2,
  ShieldCheck,
  Save,
  ArrowRight,
  Building2,
  CalendarClock,
} from "lucide-react";
import type { Job } from "@/lib/policy";
import { ApiError } from "@/lib/supabase";
import {
  getJobOpening,
  saveJobOpening,
  type JobOpeningCommand,
  type JobOpeningEditor,
  type JobOpeningFields,
} from "@/lib/admin-jobs";
import { useLanguage } from "./language";
import styles from "./admin-workspace.module.css";
const blank: JobOpeningFields = {
  title: "",
  business_unit: "",
  location: "",
  level: 3,
  function_group: "Tech/Product",
  hiring_season: "Normal Time",
  req_date: null,
  request_type: "NEW",
  priority: "NORMAL",
  replacement_for: "",
  status: "DRAFT",
};
export default function AdminConsole({
  jobs,
  onRefresh,
  onAccessLost,
}: {
  jobs: Job[];
  onRefresh: () => Promise<void>;
  onAccessLost: () => void;
}) {
  const { locale } = useLanguage();
  const en = locale === "en";
  const tr = (vi: string, english: string) => (en ? english : vi);
  const [form, setForm] = useState<JobOpeningFields>(blank),
    [editing, setEditing] = useState<JobOpeningEditor | null>(null),
    [draftId, setDraftId] = useState(""),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState<JobOpeningCommand | null>(null);
  const ticket = useRef(0),
    lock = useRef(false);
  useEffect(
    () => () => {
      ticket.current++;
    },
    [],
  );
  const frozen = busy || loading || !!pending;
  function change<K extends keyof JobOpeningFields>(
    key: K,
    value: JobOpeningFields[K],
  ) {
    setForm((v) => ({ ...v, [key]: value }));
  }
  async function choose(id: string) {
    const seq = ++ticket.current;
    setDraftId(id);
    setEditing(null);
    setForm(blank);
    setError("");
    setMessage("");
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { job } = await getJobOpening(id);
      if (seq !== ticket.current) return;
      setEditing(job);
      setForm({
        ...blank,
        title: job.title,
        business_unit: job.business_unit || "",
        location: job.location || "",
        level: job.level ?? 3,
        function_group: job.function_group || "Tech/Product",
        hiring_season: job.hiring_season || "Normal Time",
        req_date: job.req_date || null,
        request_type: job.request_type || "NEW",
        priority: job.priority || "NORMAL",
        replacement_for: job.replacement_for || "",
      });
    } catch (e) {
      if (seq !== ticket.current) return;
      setError(
        e instanceof Error
          ? e.message
          : tr("Không tải được Job nháp.", "Could not load draft."),
      );
      if (e instanceof ApiError && e.status === 401)
        onAccessLost();
    } finally {
      if (seq === ticket.current) setLoading(false);
    }
  }
  async function save(command: JobOpeningCommand) {
    if (lock.current) return;
    lock.current = true;
    setPending(command);
    setBusy(true);
    setError("");
    setMessage("");
    const seq = ticket.current;
    try {
      const { job } = await saveJobOpening(command);
      if (seq !== ticket.current) return;
      setPending(null);
      setEditing(null);
      setDraftId("");
      setForm(blank);
      setMessage(
        `${job.job_code} · ${job.job_title} · ${job.job_status === "OPEN" ? tr("Đã mở tuyển", "Open") : tr("Đã lưu nháp", "Draft saved")}`,
      );
      try {
        await onRefresh();
      } catch {
        if (seq === ticket.current)
          setError(
            tr(
              "Đã lưu Job. Danh sách chưa tải lại được; hãy tải lại trang, không tạo lại.",
              "Job saved. The list could not refresh; reload without resubmitting.",
            ),
          );
      }
    } catch (e) {
      if (seq !== ticket.current) return;
      if (e instanceof ApiError && e.status && e.status < 500) setPending(null);
      setError(
        e instanceof Error
          ? e.message
          : tr("Không lưu được Job.", "Could not save Job."),
      );
      if (e instanceof ApiError && e.status === 401)
        onAccessLost();
    } finally {
      lock.current = false;
      if (seq === ticket.current) setBusy(false);
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (frozen || (draftId && !editing)) return;
    const action = (e.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    void save({
      requestId: crypto.randomUUID(),
      jobId: editing?.id || null,
      expectedUpdatedAt: editing?.updated_at || null,
      fields: { ...form, status: action?.value === "OPEN" ? "OPEN" : "DRAFT" },
    });
  }
  return (
    <section
      className={styles.root}
      aria-label={tr("Tạo Job", "Create Job")}
    >
      <header className={styles.header}>
        <div className={styles.headingIcon}>
          <BriefcaseBusiness size={24} />
        </div>
        <div>
          <h1>{tr("Tạo Job", "Create Job")}</h1>
          <p>
            {tr(
              "Thông tin vị trí, yêu cầu tuyển dụng và SLA trong một form.",
              "Job information, hiring requirements and SLA in one form.",
            )}
          </p>
        </div>
        <span className={styles.adminBadge}>
          <ShieldCheck size={14} />
          Admin
        </span>
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
        <div className={styles.notice} role="status">
          {tr(
            "Chưa xác định được kết quả lưu. Nội dung được giữ nguyên để thử lại an toàn.",
            "The save outcome is unknown. Your original request is retained for a safe retry.",
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void save(pending)}
          >
            {tr("Thử lại yêu cầu cũ", "Retry original request")}
          </button>
        </div>
      )}
      <div className={styles.layout}>
        <form className={styles.card} onSubmit={submit}>
          <div className={styles.formHead}>
            <FilePlus2 size={20} />
            <h3>
              {editing
                ? tr("Hoàn thiện Job nháp", "Complete a draft")
                : tr("Vị trí tuyển dụng mới", "New requisition")}
            </h3>
          </div>
          <label className={styles.draftPicker}>
            {tr("Bắt đầu từ", "Start from")}
            <select
              aria-label={tr(
                "Chọn Job nháp để tiếp tục",
                "Continue an existing draft",
              )}
              disabled={frozen}
              value={draftId}
              onChange={(e) => void choose(e.target.value)}
            >
              <option value="">
                {tr("Tạo vị trí mới", "Create a new position")}
              </option>
              {jobs
                .filter((j) => j.status === "DRAFT")
                .map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.job_code ? j.job_code + " · " : ""}
                    {j.title}
                  </option>
                ))}
            </select>
          </label>
          {loading && (
            <p role="status">{tr("Đang tải Job nháp…", "Loading draft…")}</p>
          )}
          <fieldset disabled={frozen || (!!draftId && !editing)}>
            <legend>
              <Building2 size={17} />
              {tr("Thông tin vị trí", "Position details")}
            </legend>
            <div className={styles.fields}>
              <label className={styles.wide}>
                {tr("Tên vị trí", "Job title")}
                <input
                  required
                  minLength={3}
                  maxLength={180}
                  value={form.title}
                  onChange={(e) => change("title", e.target.value)}
                  placeholder={tr(
                    "Ví dụ: Embedded Software Engineer",
                    "e.g. Embedded Software Engineer",
                  )}
                />
              </label>
              <label>
                {tr("Bộ phận", "Department")}
                <input
                  maxLength={120}
                  value={form.business_unit}
                  onChange={(e) => change("business_unit", e.target.value)}
                />
              </label>
              <label>
                {tr("Địa điểm", "Location")}
                <input
                  maxLength={120}
                  value={form.location}
                  onChange={(e) => change("location", e.target.value)}
                />
              </label>
              <label className={styles.wide}>
                {tr("Mã Job", "Job code")}
                <input
                  readOnly
                  value={
                    editing?.job_code ||
                    tr(
                      "Hệ thống tự động cấp khi lưu",
                      "Automatically assigned when saved",
                    )
                  }
                />
              </label>
            </div>
          </fieldset>
          <fieldset disabled={frozen || (!!draftId && !editing)}>
            <legend>
              <CalendarClock size={17} />
              {tr("Yêu cầu tuyển dụng & SLA", "Hiring requirements & SLA")}
            </legend>
            <div className={styles.fields}>
              <label>
                Level
                <select
                  value={form.level}
                  onChange={(e) => change("level", Number(e.target.value))}
                >
                  {Array.from({ length: 16 }, (_, i) => 15 - i).map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {tr("Nhóm chức năng", "Function group")}
                <select
                  value={form.function_group}
                  onChange={(e) => change("function_group", e.target.value)}
                >
                  <option>Tech/Product</option>
                  <option>Non-Tech/Non-Product</option>
                </select>
              </label>
              <label>
                {tr("Mùa tuyển dụng", "Hiring season")}
                <select
                  value={form.hiring_season}
                  onChange={(e) => change("hiring_season", e.target.value)}
                >
                  <option>Normal Time</option>
                  <option>High Time</option>
                </select>
              </label>
              <label>
                {tr("Ngày yêu cầu", "Requisition date")}
                <input
                  type="date"
                  value={form.req_date || ""}
                  onChange={(e) => change("req_date", e.target.value || null)}
                />
              </label>
              <label>
                {tr("Loại yêu cầu", "Request type")}
                <select
                  value={form.request_type}
                  onChange={(e) => {
                    change("request_type", e.target.value);
                    if (e.target.value === "NEW") change("replacement_for", "");
                  }}
                >
                  <option value="NEW">{tr("Tuyển mới", "New hire")}</option>
                  <option value="REPLACEMENT">
                    {tr("Thay thế", "Replacement")}
                  </option>
                </select>
              </label>
              <label>
                {tr("Ưu tiên", "Priority")}
                <select
                  value={form.priority}
                  onChange={(e) => change("priority", e.target.value)}
                >
                  {["CRITICAL", "HIGH", "NORMAL", "LOW"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              {form.request_type === "REPLACEMENT" && (
                <label className={styles.wide}>
                  {tr("Thay thế vị trí", "Replacement for")}
                  <input
                    required
                    maxLength={180}
                    value={form.replacement_for}
                    onChange={(e) => change("replacement_for", e.target.value)}
                  />
                </label>
              )}
            </div>
          </fieldset>
          <footer className={`${styles.actions} ${styles.saveActions}`}>
            <button
              type="submit"
              value="DRAFT"
              disabled={frozen || (!!draftId && !editing)}
            >
              <Save size={22} aria-hidden="true" />
              {tr("Lưu nháp", "Save draft")}
            </button>
            <button
              className={styles.primary}
              type="submit"
              value="OPEN"
              disabled={frozen || (!!draftId && !editing)}
            >
              {tr("Lưu & mở tuyển", "Save & open")}
              <ArrowRight size={22} aria-hidden="true" />
            </button>
          </footer>
        </form>
        <aside className={styles.side}>
          <section className={styles.card}>
            <h3>
              {tr("Một lần nhập, sẵn sàng tuyển", "One form, ready to hire")}
            </h3>
            <ol className={styles.steps}>
              <li>
                <strong>{tr("Thông tin vị trí", "Position details")}</strong>
                <span>
                  {tr(
                    "Tên, bộ phận và địa điểm",
                    "Title, department and location",
                  )}
                </span>
              </li>
              <li>
                <strong>
                  {tr("Yêu cầu tuyển dụng", "Hiring requirements")}
                </strong>
                <span>
                  {tr(
                    "Level, nhóm chức năng và mục tiêu SLA",
                    "Level, function group and SLA target",
                  )}
                </span>
              </li>
              <li>
                <strong>
                  {tr("Lưu nháp hoặc mở tuyển", "Save draft or open")}
                </strong>
                <span>
                  {tr(
                    "Mã Job được cấp tự động",
                    "Job code is assigned automatically",
                  )}
                </span>
              </li>
            </ol>
            <p className={styles.muted}>
              {tr(
                "Mục tiêu SLA được tra từ cấu hình Level × nhóm chức năng × mùa tuyển dụng hiện có.",
                "The SLA target follows the configured level, function group and hiring season.",
              )}
            </p>
          </section>
          <section className={styles.info}>
            <ShieldCheck size={20} />
            <h3>Team & Access</h3>
            <p>
              {tr(
                "Sau khi lưu, mở Job → Team & Access để phân công TA, Hiring Manager và Interviewer.",
                "After saving, open Job → Team & Access to assign the recruiter, Hiring Manager and Interviewer.",
              )}
            </p>
          </section>
        </aside>
      </div>
    </section>
  );
}
