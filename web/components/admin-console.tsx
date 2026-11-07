"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Job } from "@/lib/policy";
import { ApiError } from "@/lib/supabase";
import { assignJobMember, createJobDraft, listJobMembers, openJob, removeJobMember, updateJobMetadata, type JobMember } from "@/lib/admin-jobs";

const roleNames: Record<string, string> = {
  TA_RECRUITER: "TA / Recruiter",
  HIRING_MANAGER: "Hiring Manager",
  INTERVIEWER: "Interviewer",
};

export default function AdminConsole({ jobs, onRefresh, onAccessLost }: {
  jobs: Job[];
  onRefresh: () => Promise<void>;
  onAccessLost: () => void;
}) {
  const [title, setTitle] = useState("");
  const [unit, setUnit] = useState("");
  const [location, setLocation] = useState("");
  const [jobId, setJobId] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("TA_RECRUITER");
  const [metadata, setMetadata] = useState({ level: "3", functionGroup: "Tech/Product", season: "Normal Time", reqDate: "", requestType: "NEW", priority: "NORMAL", replacementFor: "" });
  const [members, setMembers] = useState<JobMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const draftRequest = useRef<string | null>(null);
  const actionLock = useRef(false);
  const selectedJob = jobs.find((job) => job.id === jobId) || null;
  const draftJobs = jobs.filter((job) => job.status === "DRAFT");
  const assignableJobs = jobs.filter((job) => ["DRAFT", "OPEN", "ON_HOLD"].includes(job.status));

  useEffect(() => {
    if (!assignableJobs.some((job) => job.id === jobId)) setJobId(assignableJobs[0]?.id || "");
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
    if (!jobId) { setMembers([]); return; }
    setLoadingMembers(true);
    setError("");
    try {
      const result = await listJobMembers(jobId);
      setMembers(result.members || []);
    } catch (cause) {
      if (cause instanceof ApiError && [401, 403].includes(cause.status || 0)) onAccessLost();
      setMembers([]);
      setError(cause instanceof Error ? cause.message : "Không tải được danh sách quyền của Job.");
    } finally { setLoadingMembers(false); }
  }, [jobId, onAccessLost]);

  useEffect(() => { void loadMembers(); }, [loadMembers]);

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true); setError(""); setMessage("");
    const requestId = draftRequest.current ?? crypto.randomUUID();
    draftRequest.current = requestId;
    try {
      const result = await createJobDraft({ requestId, title, businessUnit: unit, location });
      draftRequest.current = null;
      setTitle(""); setUnit(""); setLocation("");
      setMessage(`Đã tạo Job nháp “${result.job.job_title}”.`);
      await onRefresh();
      setJobId(result.job.job_id);
    } catch (cause) {
      if (cause instanceof ApiError && [401, 403].includes(cause.status || 0)) onAccessLost();
      setError(cause instanceof Error ? cause.message : "Không tạo được Job nháp.");
    } finally { actionLock.current = false; setBusy(false); }
  }

  async function activateDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedJob || selectedJob.status !== "DRAFT" || busy) return;
    const normalizedCode = code.trim().toUpperCase();
    if (!window.confirm(`Mở Job “${selectedJob.title}” với mã ${normalizedCode}? Job sẽ chuyển sang trạng thái đang tuyển.`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await openJob(selectedJob.id, selectedJob.title, normalizedCode);
      setCode("");
      setMessage(result.job.opened ? `Đã mở tuyển Job “${selectedJob.title}” với mã ${normalizedCode}.` : `Job “${selectedJob.title}” đã được mở với mã này trước đó.`);
      await onRefresh();
    } catch (cause) {
      if (cause instanceof ApiError && [401, 403].includes(cause.status || 0)) onAccessLost();
      setError(cause instanceof Error ? cause.message : "Không mở được Job.");
    } finally { setBusy(false); }
  }

  async function saveMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedJob || busy || !metadata.level) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await updateJobMetadata({ jobId: selectedJob.id, level: Number(metadata.level),
        functionGroup: metadata.functionGroup, hiringSeason: metadata.season,
        reqDate: metadata.reqDate || null, requestType: metadata.requestType,
        priority: metadata.priority, replacementFor: metadata.replacementFor });
      setMessage(`Đã lưu SLA Master và thông tin vị trí cho “${selectedJob.title}”.`);
      await onRefresh();
    } catch (cause) {
      if (cause instanceof ApiError && [401, 403].includes(cause.status || 0)) onAccessLost();
      setError(cause instanceof Error ? cause.message : "Không lưu được thông tin SLA của Job.");
    } finally { setBusy(false); }
  }

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!jobId || !email.trim() || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await assignJobMember(jobId, email.trim(), role);
      setEmail("");
      setMessage(result.member.added ? `Đã gán ${roleNames[role]} cho ${result.member.target_email}.` : "Người này đã có quyền tương ứng trên Job.");
      await loadMembers();
    } catch (cause) {
      if (cause instanceof ApiError && [401, 403].includes(cause.status || 0)) onAccessLost();
      setError(cause instanceof Error ? cause.message : "Không gán được quyền.");
    } finally { setBusy(false); }
  }

  async function revoke(member: JobMember) {
    if (!jobId || busy || !window.confirm(`Thu hồi quyền ${roleNames[member.role] || member.role} của ${member.email} trên Job này?`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await removeJobMember(jobId, member.user_id, member.role);
      setMessage(`Đã thu hồi quyền của ${member.email} trên Job này.`);
      await loadMembers();
    } catch (cause) {
      if (cause instanceof ApiError && [401, 403].includes(cause.status || 0)) onAccessLost();
      setError(cause instanceof Error ? cause.message : "Không thu hồi được quyền.");
    } finally { setBusy(false); }
  }

  return <section className="panel admin-console" aria-label="Quản trị Job và quyền">
    <header className="admin-console-heading"><div><span className="eyebrow">Chỉ Admin</span><h2>Quản trị Job & quyền truy cập</h2><p>Thay đổi được kiểm tra ở backend và ghi lại. Thành viên phải đăng nhập ATS ít nhất một lần trước khi được gán.</p></div></header>
    {error && <div className="notice error" role="alert">{error}</div>}
    {message && <div className="notice success" role="status">{message}</div>}
    <div className="admin-console-grid">
      <section className="admin-task">
        <span className="admin-step">01</span><h3>Tạo Job nháp</h3><p>Tạo vị trí ở trạng thái nháp. Mã Job được đặt khi mở tuyển.</p>
        <form onSubmit={(event) => void createDraft(event)}>
          <label>Tên vị trí<input value={title} onChange={(event) => setTitle(event.target.value)} required minLength={3} maxLength={180} /></label>
          <label>Bộ phận<input value={unit} onChange={(event) => setUnit(event.target.value)} maxLength={120} /></label>
          <label>Địa điểm<input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={120} /></label>
          <button className="primary" type="submit" disabled={busy}>{busy ? "Đang lưu…" : "Tạo Job nháp"}</button>
        </form>
      </section>
      <section className="admin-task">
        <span className="admin-step">02</span><h3>Mở tuyển Job</h3><p>Chọn Job nháp, kiểm tra lại tên và cấp mã Job trước khi xác nhận.</p>
        <form onSubmit={(event) => void activateDraft(event)}>
          <label>Job nháp<select value={draftJobs.some((job) => job.id === jobId) ? jobId : ""} onChange={(event) => setJobId(event.target.value)} required><option value="">Chọn Job nháp</option>{draftJobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label>
          {selectedJob?.status === "DRAFT" && <div className="selected-job-preview"><strong>{selectedJob.title}</strong><small>{selectedJob.business_unit || "Chưa có bộ phận"} · {selectedJob.location || "Chưa có địa điểm"}</small></div>}
          <label>Mã Job<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} required minLength={3} maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9-]{2,39}" placeholder="ATS-SENIOR-EMBEDDED-2026" /></label>
          <button className="primary" type="submit" disabled={busy || !draftJobs.length}>{busy ? "Đang xử lý…" : "Xác nhận mở tuyển"}</button>
        </form>
      </section>
      <section className="admin-task">
        <span className="admin-step">03</span><h3>Thông tin SLA và yêu cầu</h3><p>Chọn Level, nhóm chức năng và mùa tuyển dụng để tra mục tiêu SLA tổng trong TA-SLA Master.</p>
        <form onSubmit={(event) => void saveMetadata(event)}>
          <label>Job<select value={jobId} onChange={(event) => setJobId(event.target.value)} required><option value="">Chọn Job</option>{assignableJobs.map((job) => <option key={job.id} value={job.id}>{job.job_code ? `${job.job_code} · ` : ""}{job.title}</option>)}</select></label>
          <div className="job-meta-fields">
            <label>Level<select value={metadata.level} onChange={(event) => setMetadata({ ...metadata, level: event.target.value })}>{Array.from({ length: 16 }, (_, i) => 15 - i).map((level) => <option key={level} value={level}>{level}</option>)}</select></label>
            <label>Nhóm chức năng<select value={metadata.functionGroup} onChange={(event) => setMetadata({ ...metadata, functionGroup: event.target.value })}><option value="Tech/Product">Tech/Product</option><option value="Non-Tech/Non-Product">Non-Tech/Non-Product</option></select></label>
            <label>Mùa tuyển dụng<select value={metadata.season} onChange={(event) => setMetadata({ ...metadata, season: event.target.value })}><option value="Normal Time">Normal Time</option><option value="High Time">High Time</option></select></label>
            <label>Ngày yêu cầu<input type="date" value={metadata.reqDate} onChange={(event) => setMetadata({ ...metadata, reqDate: event.target.value })} /></label>
            <label>Loại yêu cầu<select value={metadata.requestType} onChange={(event) => setMetadata({ ...metadata, requestType: event.target.value })}><option value="NEW">Tuyển mới</option><option value="REPLACEMENT">Thay thế</option></select></label>
            <label>Ưu tiên<select value={metadata.priority} onChange={(event) => setMetadata({ ...metadata, priority: event.target.value })}><option value="CRITICAL">Critical</option><option value="HIGH">High</option><option value="NORMAL">Normal</option><option value="LOW">Low</option></select></label>
            {metadata.requestType === "REPLACEMENT" && <label>Thay thế vị trí<input value={metadata.replacementFor} onChange={(event) => setMetadata({ ...metadata, replacementFor: event.target.value })} maxLength={180} required /></label>}
          </div>
          {selectedJob?.sla_target_workdays != null && <div className="selected-job-preview"><strong>SLA tổng: {selectedJob.sla_target_workdays} ngày làm việc</strong><small>Tra theo Level × nhóm chức năng × mùa tuyển dụng.</small></div>}
          <button className="primary" type="submit" disabled={busy || !selectedJob}>{busy ? "Đang lưu…" : "Lưu thông tin Job"}</button>
        </form>
      </section>
      <section className="admin-task admin-access-task">
        <span className="admin-step">04</span><h3>Gán quyền theo Job</h3><p>TA chỉ thấy hồ sơ thuộc Job được giao; Hiring Manager và Interviewer giữ giới hạn theo quyền hiện có.</p>
        <form onSubmit={(event) => void assign(event)}>
          <label>Job<select value={jobId} onChange={(event) => setJobId(event.target.value)} required><option value="">Chọn Job</option>{assignableJobs.map((job) => <option key={job.id} value={job.id}>{job.title} · {job.status}</option>)}</select></label>
          <label>Email người dùng<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} autoComplete="off" placeholder="name@company.com" /></label>
          <label>Vai trò trên Job<select value={role} onChange={(event) => setRole(event.target.value)}><option value="TA_RECRUITER">TA / Recruiter</option><option value="HIRING_MANAGER">Hiring Manager</option><option value="INTERVIEWER">Interviewer</option></select></label>
          <button className="primary" type="submit" disabled={busy || !assignableJobs.length}>{busy ? "Đang xử lý…" : "Gán quyền"}</button>
        </form>
        <div className="admin-members"><h4>Người đã được gán {selectedJob ? `· ${selectedJob.title}` : ""}</h4>
          {loadingMembers ? <p className="muted">Đang tải…</p> : members.length ? <ul>{members.map((member) => <li key={`${member.user_id}:${member.role}`}><span><strong>{member.email}</strong><small>{roleNames[member.role] || member.role}</small></span><button className="secondary" disabled={busy} onClick={() => void revoke(member)}>Thu hồi</button></li>)}</ul> : <p className="muted">Chưa có người được gán trên Job này.</p>}
        </div>
        <p className="admin-security-note">Vai trò Admin toàn hệ thống chỉ được cấp bởi người quản trị cơ sở dữ liệu. Trang này chỉ gán quyền công việc, không thể tự nâng một người thành Admin.</p>
      </section>
    </div>
  </section>;
}
