"use client";
import { useUiText, useUiNotice } from "./ui-text";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Job } from "@/lib/policy";
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
export default function AdminConsole({
  jobs,
  onRefresh,
  onAccessLost,
}: {
  jobs: Job[];
  onRefresh: () => Promise<void>;
  onAccessLost: () => void;
}) {
  const tr = useUiText();
  const notice = useUiNotice();
  const [section, setSection] = useState("create");
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
  const draftRequest = useRef<string | null>(null);
  const actionLock = useRef(false);
  const selectedJob = jobs.find((job) => job.id === jobId) || null;
  const draftJobs = jobs.filter((job) => job.status === "DRAFT");
  const assignableJobs = jobs.filter((job) =>
    ["DRAFT", "OPEN", "ON_HOLD"].includes(job.status),
  );
  useEffect(() => {
    if (!assignableJobs.some((job) => job.id === jobId))
      setJobId(assignableJobs[0]?.id || "");
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
    if (!jobId) {
      setMembers([]);
      return;
    }
    setLoadingMembers(true);
    setError("");
    try {
      const result = await listJobMembers(jobId);
      setMembers(result.members || []);
    } catch (cause) {
      if (cause instanceof ApiError && [401, 403].includes(cause.status || 0))
        onAccessLost();
      setMembers([]);
      setError(
        cause instanceof Error
          ? cause.message
          : tr("Không tải được danh sách quyền của Job."),
      );
    } finally {
      setLoadingMembers(false);
    }
  }, [jobId, onAccessLost]);
  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);
  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    const requestId = draftRequest.current ?? crypto.randomUUID();
    draftRequest.current = requestId;
    try {
      const result = await createJobDraft({
        requestId,
        title,
        businessUnit: unit,
        location,
      });
      draftRequest.current = null;
      setTitle("");
      setUnit("");
      setLocation("");
      setMessage(tr("Đã tạo Job nháp “{0}”.", [result.job.job_title]));
      await onRefresh();
      setJobId(result.job.job_id);
    } catch (cause) {
      if (cause instanceof ApiError && [401, 403].includes(cause.status || 0))
        onAccessLost();
      setError(
        cause instanceof Error ? cause.message : tr("Không tạo được Job nháp."),
      );
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  async function activateDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedJob || selectedJob.status !== "DRAFT" || busy) return;
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
      await onRefresh();
    } catch (cause) {
      if (cause instanceof ApiError && [401, 403].includes(cause.status || 0))
        onAccessLost();
      setError(
        cause instanceof Error ? cause.message : tr("Không mở được Job."),
      );
    } finally {
      setBusy(false);
    }
  }
  async function saveMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedJob || busy || !metadata.level) return;
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
      setBusy(false);
    }
  }
  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!jobId || !email.trim() || busy) return;
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
      setBusy(false);
    }
  }
  async function revoke(member: JobMember) {
    if (
      !jobId ||
      busy ||
      !window.confirm(
        tr("Thu hồi quyền {0} của {1} trên Job này?", [
          tr(roleNames[member.role] || member.role),
          member.email,
        ]),
      )
    )
      return;
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
      setBusy(false);
    }
  }
  return (
    <section
      className="panel admin-console"
      aria-label={tr("Quản trị Job và quyền")}
    >
      <div className="metrics admin-overview">
        <div>
          <small>{tr("Vị trí tuyển dụng")}</small>
          <strong>{jobs.length}</strong>
          <span>{tr("Trong phạm vi quản lý")}</span>
        </div>
        <div>
          <small>{tr("Đang tuyển")}</small>
          <strong>{jobs.filter((job) => job.status === "OPEN").length}</strong>
          <span>{tr("Sẵn sàng nhận ứng viên")}</span>
        </div>
        <div>
          <small>{tr("Bản nháp")}</small>
          <strong>{draftJobs.length}</strong>
          <span>{tr("Cần hoàn thiện trước khi mở tuyển")}</span>
        </div>
      </div>
      <div className="admin-console-heading">
        <h2>{tr("Quản lý vị trí & đội ngũ")}</h2>
        <p>{tr("Chọn việc bạn muốn thực hiện bên dưới.")}</p>
      </div>
      <div
        className="job-view-tabs admin-tabs"
        role="tablist"
        aria-label={tr("Công cụ quản trị")}
      >
        {[
          ["create", tr("Tạo vị trí")],
          ["open", tr("Mở tuyển")],
          ["details", tr("Yêu cầu tuyển dụng")],
          ["team", tr("Phân công đội ngũ")],
        ].map(([id, label]) => (
          <button
            id={`admin-tab-${id}`}
            aria-controls={`admin-panel-${id}`}
            key={id}
            role="tab"
            aria-selected={section === id}
            tabIndex={section === id ? 0 : -1}
            onKeyDown={(event) => {
              const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
              if (!keys.includes(event.key)) return;
              event.preventDefault();
              const tabs = Array.from(
                event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>(
                  "[role=tab]",
                ),
              );
              const current = tabs.indexOf(event.currentTarget);
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? tabs.length - 1
                    : (current +
                        (event.key === "ArrowRight" ? 1 : -1) +
                        tabs.length) %
                      tabs.length;
              tabs[next].click();
              tabs[next].focus();
            }}
            onClick={() => setSection(id)}
          >
            {tr(label)}
          </button>
        ))}
      </div>
      {error && (
        <div className="notice error" role="alert">
          {notice(error)}
        </div>
      )}
      {message && (
        <div className="notice success" role="status">
          {notice(message)}
        </div>
      )}
      <div className="admin-console-grid">
        <section
          className="admin-task"
          id="admin-panel-create"
          role="tabpanel"
          aria-labelledby="admin-tab-create"
          hidden={section !== "create"}
        >
          <span className="admin-step">01</span>
          <h3>{tr("Tạo Job nháp")}</h3>
          <p>
            {tr("Tạo vị trí ở trạng thái nháp. Mã Job được đặt khi mở tuyển.")}
          </p>
          <form onSubmit={(event) => void createDraft(event)}>
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
            <button className="primary" type="submit" disabled={busy}>
              {busy ? tr("Đang lưu…") : tr("Tạo Job nháp")}
            </button>
          </form>
        </section>
        <section
          className="admin-task"
          id="admin-panel-open"
          role="tabpanel"
          aria-labelledby="admin-tab-open"
          hidden={section !== "open"}
        >
          <span className="admin-step">02</span>
          <h3>{tr("Mở tuyển Job")}</h3>
          <p>
            {tr(
              "Chọn Job nháp, kiểm tra lại tên và cấp mã Job trước khi xác nhận.",
            )}
          </p>
          <form onSubmit={(event) => void activateDraft(event)}>
            <label>
              {tr("Job nháp")}
              <select
                value={draftJobs.some((job) => job.id === jobId) ? jobId : ""}
                onChange={(event) => setJobId(event.target.value)}
                required
              >
                <option value="">{tr("Chọn Job nháp")}</option>
                {draftJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
            </label>
            {selectedJob?.status === "DRAFT" && (
              <div className="selected-job-preview">
                <strong>{selectedJob.title}</strong>
                <small>
                  {selectedJob.business_unit || tr("Chưa có bộ phận")} ·{" "}
                  {selectedJob.location || tr("Chưa có địa điểm")}
                </small>
              </div>
            )}
            <label>
              {tr("Mã Job")}
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                required
                minLength={3}
                maxLength={40}
                pattern="[A-Za-z0-9][A-Za-z0-9-]{2,39}"
                placeholder="ATS-SENIOR-EMBEDDED-2026"
              />
            </label>
            <button
              className="primary"
              type="submit"
              disabled={busy || !draftJobs.length}
            >
              {busy ? tr("Đang xử lý…") : tr("Xác nhận mở tuyển")}
            </button>
          </form>
        </section>
        <section
          className="admin-task"
          id="admin-panel-details"
          role="tabpanel"
          aria-labelledby="admin-tab-details"
          hidden={section !== "details"}
        >
          <span className="admin-step">03</span>
          <h3>{tr("Thông tin SLA và yêu cầu")}</h3>
          <p>
            {tr(
              "Chọn cấp độ, nhóm công việc và mùa tuyển dụng để xác định thời hạn tuyển dụng mục tiêu.",
            )}
          </p>
          <form onSubmit={(event) => void saveMetadata(event)}>
            <label>
              {tr("Job")}
              <select
                value={jobId}
                onChange={(event) => setJobId(event.target.value)}
                required
              >
                <option value="">{tr("Chọn Job")}</option>
                {assignableJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.job_code ? `${job.job_code} · ` : ""}
                    {job.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="job-meta-fields">
              <label>
                {tr("Level")}
                <select
                  value={metadata.level}
                  onChange={(event) =>
                    setMetadata({ ...metadata, level: event.target.value })
                  }
                >
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
                  value={metadata.functionGroup}
                  onChange={(event) =>
                    setMetadata({
                      ...metadata,
                      functionGroup: event.target.value,
                    })
                  }
                >
                  <option value="Tech/Product">{tr("Tech/Product")}</option>
                  <option value="Non-Tech/Non-Product">
                    {tr("Non-Tech/Non-Product")}
                  </option>
                </select>
              </label>
              <label>
                {tr("Mùa tuyển dụng")}
                <select
                  value={metadata.season}
                  onChange={(event) =>
                    setMetadata({ ...metadata, season: event.target.value })
                  }
                >
                  <option value="Normal Time">{tr("Normal Time")}</option>
                  <option value="High Time">{tr("High Time")}</option>
                </select>
              </label>
              <label>
                {tr("Ngày yêu cầu")}
                <input
                  type="date"
                  value={metadata.reqDate}
                  onChange={(event) =>
                    setMetadata({ ...metadata, reqDate: event.target.value })
                  }
                />
              </label>
              <label>
                {tr("Loại yêu cầu")}
                <select
                  value={metadata.requestType}
                  onChange={(event) =>
                    setMetadata({
                      ...metadata,
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
                  value={metadata.priority}
                  onChange={(event) =>
                    setMetadata({ ...metadata, priority: event.target.value })
                  }
                >
                  <option value="CRITICAL">{tr("Critical")}</option>
                  <option value="HIGH">{tr("High")}</option>
                  <option value="NORMAL">{tr("Normal")}</option>
                  <option value="LOW">{tr("Low")}</option>
                </select>
              </label>
              {metadata.requestType === "REPLACEMENT" && (
                <label>
                  {tr("Thay thế vị trí")}
                  <input
                    value={metadata.replacementFor}
                    onChange={(event) =>
                      setMetadata({
                        ...metadata,
                        replacementFor: event.target.value,
                      })
                    }
                    maxLength={180}
                    required
                  />
                </label>
              )}
            </div>
            {selectedJob?.sla_target_workdays != null && (
              <div className="selected-job-preview">
                <strong>
                  {tr("SLA tổng:")} {selectedJob.sla_target_workdays}{" "}
                  {tr("ngày làm việc")}
                </strong>
                <small>
                  {tr("Tra theo Level × nhóm chức năng × mùa tuyển dụng.")}
                </small>
              </div>
            )}
            <button
              className="primary"
              type="submit"
              disabled={busy || !selectedJob}
            >
              {busy ? tr("Đang lưu…") : tr("Lưu thông tin Job")}
            </button>
          </form>
        </section>
        <section
          className="admin-task admin-access-task"
          id="admin-panel-team"
          role="tabpanel"
          aria-labelledby="admin-tab-team"
          hidden={section !== "team"}
        >
          <span className="admin-step">04</span>
          <h3>{tr("Gán quyền theo Job")}</h3>
          <p>
            {tr(
              "Chọn vị trí, nhập email và phân công vai trò. Thành viên cần đăng nhập ATS ít nhất một lần trước khi được phân công.",
            )}
          </p>
          <form onSubmit={(event) => void assign(event)}>
            <label>
              {tr("Job")}
              <select
                value={jobId}
                onChange={(event) => setJobId(event.target.value)}
                required
              >
                <option value="">{tr("Chọn Job")}</option>
                {assignableJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title} · {tr(job.status)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {tr("Email người dùng")}
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                maxLength={254}
                autoComplete="off"
                placeholder="name@company.com"
              />
            </label>
            <label>
              {tr("Vai trò trên Job")}
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                <option value="TA_RECRUITER">{tr("TA / Recruiter")}</option>
                <option value="HIRING_MANAGER">{tr("Hiring Manager")}</option>
                <option value="INTERVIEWER">{tr("Interviewer")}</option>
              </select>
            </label>
            <button
              className="primary"
              type="submit"
              disabled={busy || !assignableJobs.length}
            >
              {busy ? tr("Đang xử lý…") : tr("Gán quyền")}
            </button>
          </form>
          <div className="admin-members">
            <h4>
              {tr("Người đã được gán")}{" "}
              {selectedJob ? `· ${selectedJob.title}` : ""}
            </h4>
            {loadingMembers ? (
              <p className="muted">{tr("Đang tải…")}</p>
            ) : members.length ? (
              <ul>
                {members.map((member) => (
                  <li key={`${member.user_id}:${member.role}`}>
                    <span>
                      <strong>{member.email}</strong>
                      <small>{tr(roleNames[member.role] || member.role)}</small>
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
              <p className="muted">
                {tr("Chưa có người được gán trên Job này.")}
              </p>
            )}
          </div>
          <p className="admin-security-note">
            {tr(
              "Bạn đang phân công quyền cho từng vị trí. Cần cấp quyền quản trị toàn hệ thống? Liên hệ người quản lý ATS.",
            )}
          </p>
        </section>
      </div>
    </section>
  );
}
