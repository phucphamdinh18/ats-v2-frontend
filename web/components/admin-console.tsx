"use client";
import { useUiText, useUiNotice, useUiError } from "./ui-text";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Job } from "@/lib/policy";
import { jobStatusLabel } from "@/lib/i18n";
import { useLanguage } from "./language";
import { ApiError } from "@/lib/supabase";
import {
  assignJobMember,
  createJobDraft,
  listJobMembers,
  openJob,
  removeJobMember,
  updateJobMetadata,
  type JobMember,
} from "@/lib/admin-jobs";
const roleNames: Record<string, string> = {
  TA_RECRUITER: "TA / Recruiter",
  HIRING_MANAGER: "Hiring Manager",
  INTERVIEWER: "Interviewer",
};
type Requirements = {
  level: string;
  functionGroup: string;
  season: string;
  reqDate: string;
  requestType: string;
  priority: string;
  replacementFor: string;
};
const newRequirements: Requirements = {
  level: "",
  functionGroup: "",
  season: "",
  reqDate: "",
  requestType: "NEW",
  priority: "NORMAL",
  replacementFor: "",
};
function RequirementsFields({
  value,
  onChange,
}: {
  value: Requirements;
  onChange: (next: Requirements) => void;
}) {
  const tr = useUiText();
  return (
    <div className="job-meta-fields">
      <label>
        {tr("Level")}
        <select
          aria-label={tr("Level")}
          required
          value={value.level}
          onChange={(event) =>
            onChange({ ...value, level: event.target.value })
          }
        >
          <option value="">{tr("Chọn thông tin")}</option>
          {Array.from({ length: 16 }, (_, i) => 15 - i).map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </label>
      <label>
        {tr("Nhóm chức năng")}
        <select
          aria-label={tr("Nhóm chức năng")}
          required
          value={value.functionGroup}
          onChange={(event) =>
            onChange({
              ...value,
              functionGroup: event.target.value,
            })
          }
        >
          <option value="">{tr("Chọn thông tin")}</option>
          <option value="Tech/Product">{tr("Tech/Product")}</option>
          <option value="Non-Tech/Non-Product">
            {tr("Non-Tech/Non-Product")}
          </option>
        </select>
      </label>
      <label>
        {tr("Mùa tuyển dụng")}
        <select
          aria-label={tr("Mùa tuyển dụng")}
          required
          value={value.season}
          onChange={(event) =>
            onChange({ ...value, season: event.target.value })
          }
        >
          <option value="">{tr("Chọn thông tin")}</option>
          <option value="Normal Time">{tr("Normal Time")}</option>
          <option value="High Time">{tr("High Time")}</option>
        </select>
      </label>
      <details className="admin-extra-fields">
        <summary>{tr("Thông tin bổ sung")}</summary>
        <div className="job-meta-fields">
          <label>
            {tr("Ngày yêu cầu")}
            <input
              type="date"
              value={value.reqDate}
              onChange={(event) =>
                onChange({ ...value, reqDate: event.target.value })
              }
            />
          </label>
          <label>
            {tr("Loại yêu cầu")}
            <select
              value={value.requestType}
              onChange={(event) =>
                onChange({
                  ...value,
                  requestType: event.target.value,
                })
              }
            >
              <option value="NEW">{tr("Tuyển mới")}</option>
              <option value="REPLACEMENT">{tr("Thay thế")}</option>
            </select>
          </label>
          <label>
            {tr("Ưu tiên")}
            <select
              value={value.priority}
              onChange={(event) =>
                onChange({ ...value, priority: event.target.value })
              }
            >
              <option value="CRITICAL">{tr("Critical")}</option>
              <option value="HIGH">{tr("High")}</option>
              <option value="NORMAL">{tr("Normal")}</option>
              <option value="LOW">{tr("Low")}</option>
            </select>
          </label>
          {value.requestType === "REPLACEMENT" && (
            <label>
              {tr("Thay thế vị trí")}
              <input
                value={value.replacementFor}
                onChange={(event) =>
                  onChange({
                    ...value,
                    replacementFor: event.target.value,
                  })
                }
                maxLength={180}
                required
              />
            </label>
          )}
        </div>
      </details>
    </div>
  );
}

export type JobAdminAction = {
  kind: "create" | "details" | "open" | "team";
  jobId?: string;
  requestId: number;
};

export default function AdminConsole({
  jobs,
  onRefresh,
  onAccessLost,
  editorOnly = false,
  compact = false,
  action,
  onBusyChange,
}: {
  editorOnly?: boolean;
  compact?: boolean;
  action?: JobAdminAction | null;
  onBusyChange?: (busy: boolean) => void;
  jobs: Job[];
  onRefresh: () => Promise<void>;
  onAccessLost: () => void;
}) {
  const tr = useUiText();
  const { t } = useLanguage();
  const notice = useUiNotice();
  const errorText = useUiError();
  const [section, setSection] = useState<
    "list" | "create" | "details" | "open" | "team"
  >("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [createRequirements, setCreateRequirements] = useState<Requirements>({
    ...newRequirements,
  });
  const [partialDraft, setPartialDraft] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const createdDraftRef = useRef<{ id: string; title: string } | null>(null);
  const memberTicket = useRef(0);
  const editorRef = useRef<HTMLElement>(null);

  const [title, setTitle] = useState("");
  const [unit, setUnit] = useState("");
  const [location, setLocation] = useState("");
  const [jobId, setJobId] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("TA_RECRUITER");
  const [metadata, setMetadata] = useState({
    level: "3",
    functionGroup: "Tech/Product",
    season: "Normal Time",
    reqDate: "",
    requestType: "NEW",
    priority: "NORMAL",
    replacementFor: "",
  });
  const [members, setMembers] = useState<JobMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (section !== "list") {
      editorRef.current?.focus({ preventScroll: true });
      editorRef.current?.scrollIntoView?.({
        block: "start",
        behavior: "smooth",
      });
    }
  }, [section, jobId]);
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  useEffect(() => {
    if (!action || actionLock.current) return;
    if (action.kind === "create") {
      setSection("create");
      setError("");
      setMessage("");
    } else {
      const target = jobs.find((job) => job.id === action.jobId);
      if (target) showAction(action.kind, target);
    }
    // Each explicit click selects a target; refresh must not reset in-progress input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action?.requestId]);
  const draftRequest = useRef<{ key: string; id: string } | null>(null);
  const actionLock = useRef(false);
  const selectedJob = jobs.find((job) => job.id === jobId) || null;
  const draftJobs = jobs.filter((job) => job.status === "DRAFT");
  const assignableJobs = jobs.filter((job) =>
    ["DRAFT", "OPEN", "ON_HOLD"].includes(job.status),
  );
  useEffect(() => {
    if (jobId && !jobs.some((job) => job.id === jobId)) {
      setJobId("");
      setSection("list");
    }
  }, [jobs, jobId]);
  useEffect(() => {
    if (!selectedJob) return;
    setMetadata({
      level: selectedJob.level == null ? "3" : String(selectedJob.level),
      functionGroup: selectedJob.function_group || "Tech/Product",
      season: selectedJob.hiring_season || "Normal Time",
      reqDate: selectedJob.req_date || "",
      requestType: selectedJob.request_type || "NEW",
      priority: selectedJob.priority || "NORMAL",
      replacementFor: selectedJob.replacement_for || "",
    });
  }, [selectedJob?.id]); // initialize on Job changes
  const loadMembers = useCallback(async () => {
    if (!jobId || section !== "team") {
      setMembers([]);
      return;
    }
    const ticket = ++memberTicket.current;
    setLoadingMembers(true);
    setError("");
    try {
      const result = await listJobMembers(jobId);
      if (ticket === memberTicket.current) setMembers(result.members || []);
    } catch (cause) {
      if (ticket !== memberTicket.current) return;
      if (cause instanceof ApiError && [401, 403].includes(cause.status || 0))
        onAccessLost();
      setMembers([]);
      setError(
        cause instanceof Error
          ? cause.message
          : tr("Không tải được danh sách quyền của Job."),
      );
    } finally {
      if (ticket === memberTicket.current) setLoadingMembers(false);
    }
  }, [jobId, section, onAccessLost]);
  useEffect(() => {
    void loadMembers();
    return () => {
      memberTicket.current += 1;
    };
  }, [loadMembers]);
  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      actionLock.current ||
      !title.trim() ||
      !createRequirements.level ||
      !createRequirements.functionGroup ||
      !createRequirements.season
    )
      return;
    actionLock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    let saved = createdDraftRef.current;
    try {
      if (!saved) {
        const key = JSON.stringify({
          title: title.trim(),
          unit: unit.trim(),
          location: location.trim(),
        });
        if (draftRequest.current?.key !== key)
          draftRequest.current = { key, id: crypto.randomUUID() };
        const result = await createJobDraft({
          requestId: draftRequest.current.id,
          title: title.trim(),
          businessUnit: unit.trim(),
          location: location.trim(),
        });
        saved = { id: result.job.job_id, title: result.job.job_title };
        createdDraftRef.current = saved;
        setPartialDraft(saved);
        draftRequest.current = null;
      }
      await updateJobMetadata({
        jobId: saved.id,
        level: Number(createRequirements.level),
        functionGroup: createRequirements.functionGroup,
        hiringSeason: createRequirements.season,
        reqDate: createRequirements.reqDate || null,
        requestType: createRequirements.requestType,
        priority: createRequirements.priority,
        replacementFor: createRequirements.replacementFor,
      });
      setMessage(
        tr(
          "Đã tạo Job nháp và lưu yêu cầu cho “{0}”. Chọn Quản lý rồi Mở tuyển khi sẵn sàng.",
          [saved.title],
        ),
      );
      createdDraftRef.current = null;
      setPartialDraft(null);
      setTitle("");
      setUnit("");
      setLocation("");
      setCreateRequirements({ ...newRequirements });
      setSection("list");
      await onRefresh();
    } catch (cause) {
      if (cause instanceof ApiError && [401, 403].includes(cause.status || 0))
        onAccessLost();
      if (
        !saved &&
        cause instanceof ApiError &&
        [400, 404, 409, 413].includes(cause.status || 0)
      )
        draftRequest.current = null;
      setError(
        cause instanceof Error ? cause.message : tr("Không tạo được Job nháp."),
      );
      if (saved) await onRefresh().catch(() => {});
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  async function activateDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !selectedJob ||
      selectedJob.status !== "DRAFT" ||
      busy ||
      actionLock.current
    )
      return;
    const normalizedCode = code.trim().toUpperCase();
    if (
      !window.confirm(
        tr(
          "Mở Job “{0}” với mã {1}? Job sẽ chuyển sang trạng thái đang tuyển.",
          [selectedJob.title, normalizedCode],
        ),
      )
    )
      return;
    actionLock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await openJob(
        selectedJob.id,
        selectedJob.title,
        normalizedCode,
      );
      setCode("");
      setMessage(
        result.job.opened
          ? tr("Đã mở tuyển Job “{0}” với mã {1}.", [
              selectedJob.title,
              normalizedCode,
            ])
          : tr("Job “{0}” đã được mở với mã này trước đó.", [
              selectedJob.title,
            ]),
      );
      setSection("list");
      await onRefresh();
    } catch (cause) {
      if (cause instanceof ApiError && [401, 403].includes(cause.status || 0))
        onAccessLost();
      setError(
        cause instanceof Error ? cause.message : tr("Không mở được Job."),
      );
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  async function saveMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedJob || busy || actionLock.current || !metadata.level) return;
    actionLock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await updateJobMetadata({
        jobId: selectedJob.id,
        level: Number(metadata.level),
        functionGroup: metadata.functionGroup,
        hiringSeason: metadata.season,
        reqDate: metadata.reqDate || null,
        requestType: metadata.requestType,
        priority: metadata.priority,
        replacementFor: metadata.replacementFor,
      });
      setMessage(
        tr("Đã lưu SLA Master và thông tin vị trí cho “{0}”.", [
          selectedJob.title,
        ]),
      );
      setSection("list");
      await onRefresh();
    } catch (cause) {
      if (cause instanceof ApiError && [401, 403].includes(cause.status || 0))
        onAccessLost();
      setError(
        cause instanceof Error
          ? cause.message
          : tr("Không lưu được thông tin SLA của Job."),
      );
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!jobId || !email.trim() || busy || actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await assignJobMember(jobId, email.trim(), role);
      setEmail("");
      setMessage(
        result.member.added
          ? tr("Đã gán {0} cho {1}.", [
              tr(roleNames[role]),
              result.member.target_email,
            ])
          : tr("Người này đã có quyền tương ứng trên Job."),
      );
      await loadMembers();
    } catch (cause) {
      if (cause instanceof ApiError && [401, 403].includes(cause.status || 0))
        onAccessLost();
      setError(
        cause instanceof Error ? cause.message : tr("Không gán được quyền."),
      );
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  async function revoke(member: JobMember) {
    if (
      !jobId ||
      busy ||
      actionLock.current ||
      !window.confirm(
        tr("Thu hồi quyền {0} của {1} trên Job này?", [
          tr(roleNames[member.role] || member.role),
          member.email,
        ]),
      )
    )
      return;
    actionLock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await removeJobMember(jobId, member.user_id, member.role);
      setMessage(tr("Đã thu hồi quyền của {0} trên Job này.", [member.email]));
      await loadMembers();
    } catch (cause) {
      if (cause instanceof ApiError && [401, 403].includes(cause.status || 0))
        onAccessLost();
      setError(
        cause instanceof Error
          ? cause.message
          : tr("Không thu hồi được quyền."),
      );
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  const visibleJobs = jobs.filter(
    (job) =>
      (statusFilter === "ALL" || job.status === statusFilter) &&
      `${job.title} ${job.job_code || ""} ${job.business_unit || ""}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  const editable =
    selectedJob && assignableJobs.some((job) => job.id === selectedJob.id);
  function showAction(next: "details" | "open" | "team", job: Job) {
    if (busy) return;
    if (next === "open" && job.id === createdDraftRef.current?.id) {
      setSection("create");
      return;
    }
    if (next === "details" && job.id === createdDraftRef.current?.id) {
      setSection("create");
      return;
    }
    memberTicket.current += 1;
    setRole("TA_RECRUITER");
    setJobId(job.id);
    setSection(next);
    setCode("");
    setEmail("");
    setMembers([]);
    setError("");
    setMessage("");
  }
  return (
    <section
      className={
        editorOnly ? "admin-console admin-embedded" : "panel admin-console"
      }
      aria-label={tr("Quản lý Job")}
    >
      {!editorOnly && !compact && (
        <div className="metrics admin-overview">
          <div>
            <small>{tr("Vị trí tuyển dụng")}</small>
            <strong>{jobs.length}</strong>
            <span>{tr("Trong phạm vi quản lý")}</span>
          </div>
          <div>
            <small>{tr("Đang tuyển")}</small>
            <strong>
              {jobs.filter((job) => job.status === "OPEN").length}
            </strong>
            <span>{tr("Sẵn sàng nhận ứng viên")}</span>
          </div>
          <div>
            <small>{tr("Bản nháp")}</small>
            <strong>{draftJobs.length}</strong>
            <span>{tr("Chưa mở tuyển")}</span>
          </div>
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {errorText(error)}
        </div>
      )}
      {message && (
        <div className="notice success" role="status">
          {notice(message)}
        </div>
      )}
      {!editorOnly && section === "list" && (
        <div className="admin-list-heading">
          <div>
            <h2>{tr("Danh sách Job")}</h2>
            <p>{tr("Tạo Job mới hoặc chọn Quản lý để cập nhật một Job.")}</p>
          </div>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => {
              setSection("create");
              setError("");
              setMessage("");
            }}
          >
            {partialDraft ? tr("Tiếp tục Job nháp") : tr("Tạo Job")}
          </button>
        </div>
      )}
      {section !== "list" && (
        <section
          ref={editorRef}
          tabIndex={-1}
          className="admin-task admin-editor"
          aria-label={
            section === "create"
              ? tr("Tạo Job")
              : section === "details"
                ? tr("Chỉnh yêu cầu")
                : section === "open"
                  ? tr("Mở tuyển")
                  : tr("Phân công đội ngũ")
          }
        >
          <header className="admin-editor-heading">
            <div>
              <h3>
                {section === "create"
                  ? tr("Tạo Job")
                  : section === "details"
                    ? tr("Chỉnh yêu cầu")
                    : section === "open"
                      ? tr("Mở tuyển")
                      : tr("Phân công đội ngũ")}
              </h3>
              {section !== "create" && selectedJob && (
                <p>
                  <strong>{selectedJob.title}</strong> ·{" "}
                  {selectedJob.job_code || tr("Chưa có mã")} ·{" "}
                  <span
                    className={`badge ${selectedJob.status === "OPEN" ? "green" : "amber-badge"}`}
                  >
                    {jobStatusLabel(selectedJob.status, t)}
                  </span>
                </p>
              )}
            </div>
            <button
              className="secondary"
              type="button"
              disabled={busy}
              onClick={() => setSection("list")}
            >
              {tr("Đóng")}
            </button>
          </header>
          {section !== "create" && selectedJob && (
            <nav
              className="admin-job-actions"
              aria-label={tr("Thao tác cho Job đã chọn")}
            >
              <button
                type="button"
                className={section === "details" ? "primary" : "secondary"}
                aria-pressed={section === "details"}
                disabled={busy || !editable}
                onClick={() => showAction("details", selectedJob)}
              >
                {tr("Chỉnh yêu cầu")}
              </button>
              <button
                type="button"
                className={section === "team" ? "primary" : "secondary"}
                aria-pressed={section === "team"}
                disabled={busy || !editable}
                onClick={() => showAction("team", selectedJob)}
              >
                {tr("Phân công đội ngũ")}
              </button>
              {selectedJob.status === "DRAFT" && (
                <button
                  type="button"
                  className={section === "open" ? "primary" : "secondary"}
                  aria-pressed={section === "open"}
                  disabled={busy}
                  onClick={() => showAction("open", selectedJob)}
                >
                  {tr("Mở tuyển")}
                </button>
              )}
            </nav>
          )}
          {section === "create" && (
            <>
              <p>
                {tr(
                  "Nhập thông tin và yêu cầu tại đây. Lưu sẽ tạo Job nháp; Job chỉ nhận ứng viên sau khi bạn chọn Mở tuyển.",
                )}
              </p>
              {partialDraft && (
                <div className="notice" role="status">
                  {tr(
                    "Job nháp đã được lưu. Hoàn tất phần yêu cầu bên dưới; thử lại sẽ không tạo thêm Job.",
                  )}
                </div>
              )}
              <form onSubmit={(event) => void createDraft(event)}>
                <fieldset
                  disabled={busy || !!partialDraft}
                  className="admin-identity-fields"
                >
                  <legend>{tr("Thông tin Job")}</legend>
                  <label>
                    {tr("Tên vị trí")}
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      required
                      minLength={3}
                      maxLength={180}
                    />
                  </label>
                  <label>
                    {tr("Bộ phận")}
                    <input
                      value={unit}
                      onChange={(event) => setUnit(event.target.value)}
                      maxLength={120}
                    />
                  </label>
                  <label>
                    {tr("Địa điểm")}
                    <input
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                      maxLength={120}
                    />
                  </label>
                </fieldset>
                <fieldset disabled={busy} className="admin-requirement-fields">
                  <legend>{tr("Yêu cầu tuyển dụng")}</legend>
                  <RequirementsFields
                    value={createRequirements}
                    onChange={setCreateRequirements}
                  />
                </fieldset>
                <button className="primary" type="submit" disabled={busy}>
                  {busy
                    ? tr("Đang lưu…")
                    : partialDraft
                      ? tr("Lưu tiếp yêu cầu")
                      : tr("Lưu Job nháp")}
                </button>
              </form>
            </>
          )}
          {section === "open" && selectedJob?.status === "DRAFT" && (
            <>
              <p>
                {tr(
                  "Mở tuyển cho phép tiếp nhận ứng viên. Thao tác này không phân công hay cấp quyền cho thành viên.",
                )}
              </p>
              <form onSubmit={(event) => void activateDraft(event)}>
                <label>
                  {tr("Mã Job")}
                  <input
                    value={code}
                    onChange={(event) =>
                      setCode(event.target.value.toUpperCase())
                    }
                    required
                    minLength={3}
                    maxLength={40}
                    pattern="[A-Za-z0-9][A-Za-z0-9-]{2,39}"
                    placeholder="ATS-SENIOR-EMBEDDED-2026"
                    disabled={busy}
                  />
                </label>
                <button className="primary" type="submit" disabled={busy}>
                  {busy ? tr("Đang xử lý…") : tr("Xác nhận mở tuyển")}
                </button>
              </form>
            </>
          )}
          {section === "details" && editable && (
            <>
              <p>
                {tr(
                  "Chỉnh yêu cầu và thời hạn tuyển dụng cho Job đang chọn. Lưu thông tin không đổi trạng thái Job hoặc quyền của đội ngũ.",
                )}
              </p>
              <form onSubmit={(event) => void saveMetadata(event)}>
                <fieldset disabled={busy} className="admin-requirement-fields">
                  <legend>{tr("Yêu cầu tuyển dụng")}</legend>
                  <RequirementsFields value={metadata} onChange={setMetadata} />
                </fieldset>
                {selectedJob.sla_target_workdays != null && (
                  <p className="selected-job-preview">
                    {tr("SLA tổng:")} {selectedJob.sla_target_workdays}{" "}
                    {tr("ngày làm việc")}
                  </p>
                )}
                <button className="primary" type="submit" disabled={busy}>
                  {busy ? tr("Đang lưu…") : tr("Lưu yêu cầu")}
                </button>
              </form>
            </>
          )}
          {section === "team" && editable && (
            <>
              <p>
                {tr(
                  "Phân công chỉ quyết định ai được làm việc trên Job này. Thao tác này không mở tuyển và không cấp quyền Admin toàn hệ thống.",
                )}
              </p>
              <form onSubmit={(event) => void assign(event)}>
                <label>
                  {tr("Email người dùng")}
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    maxLength={254}
                    autoComplete="off"
                    disabled={busy}
                    placeholder="name@company.com"
                  />
                </label>
                <label>
                  {tr("Vai trò trên Job")}
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    disabled={busy}
                  >
                    <option value="TA_RECRUITER">{tr("TA / Recruiter")}</option>
                    <option value="HIRING_MANAGER">
                      {tr("Hiring Manager")}
                    </option>
                    <option value="INTERVIEWER">{tr("Interviewer")}</option>
                  </select>
                </label>
                <button className="primary" type="submit" disabled={busy}>
                  {busy ? tr("Đang xử lý…") : tr("Gán quyền")}
                </button>
              </form>
              <div className="admin-members">
                <h4>{tr("Người đã được gán")}</h4>
                {loadingMembers ? (
                  <p role="status">{tr("Đang tải…")}</p>
                ) : members.length ? (
                  <ul>
                    {members.map((member) => (
                      <li key={`${member.user_id}:${member.role}`}>
                        <span>
                          <strong>{member.email}</strong>
                          <small>
                            {tr(roleNames[member.role] || member.role)}
                          </small>
                        </span>
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() => void revoke(member)}
                        >
                          {tr("Thu hồi")}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{tr("Chưa có người được gán trên Job này.")}</p>
                )}
              </div>
              <p className="admin-security-note">
                {tr(
                  "Thành viên cần đăng nhập ATS ít nhất một lần trước khi được phân công.",
                )}
              </p>
            </>
          )}
        </section>
      )}
      {!editorOnly && section === "list" && (
        <section
          className="panel admin-job-list"
          aria-label={tr("Danh sách Job")}
        >
          <div className="toolbar">
            <label className="search">
              <input
                aria-label={tr("Tìm Job")}
                placeholder={tr("Tìm tên vị trí hoặc mã…")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="admin-status-filter">
              {tr("Trạng thái")}
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="ALL">{tr("Tất cả trạng thái")}</option>
                {[...new Set(jobs.map((job) => job.status))].map((status) => (
                  <option key={status} value={status}>
                    {jobStatusLabel(status, t)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="table-scroll">
            <table className="workspace-master-table admin-job-table admin-simple-table">
              <thead>
                <tr>
                  <th>{tr("Job")}</th>
                  <th>{tr("Trạng thái tuyển dụng")}</th>
                  <th>{tr("Quản lý")}</th>
                </tr>
              </thead>
              <tbody>
                {visibleJobs.map((job) => {
                  const canEdit = assignableJobs.some(
                    (item) => item.id === job.id,
                  );
                  return (
                    <tr key={job.id}>
                      <td>
                        <strong>{job.title}</strong>
                        <small className="job-code-subtitle">
                          {job.job_code || tr("Chưa có mã")}
                        </small>
                        <small className="job-code-subtitle">
                          {job.business_unit || tr("Chưa có bộ phận")}
                          {job.location ? ` · ${job.location}` : ""}
                        </small>
                      </td>
                      <td>
                        <span
                          className={`badge ${job.status === "OPEN" ? "green" : job.status === "DRAFT" ? "amber-badge" : ""}`}
                        >
                          {jobStatusLabel(job.status, t)}
                        </span>
                        <small className="job-code-subtitle">
                          {job.status === "OPEN"
                            ? tr("Đang nhận ứng viên")
                            : job.status === "DRAFT"
                              ? tr("Chưa mở tuyển")
                              : tr("Theo trạng thái hiện tại")}
                        </small>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="secondary"
                          disabled={busy || !canEdit}
                          onClick={() => showAction("details", job)}
                        >
                          {tr("Quản lý")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!visibleJobs.length && (
            <div className="empty">
              <h3>{tr("Không tìm thấy Job phù hợp")}</h3>
              <p>{tr("Thử tên khác hoặc đổi trạng thái.")}</p>
            </div>
          )}
        </section>
      )}
    </section>
  );
}
