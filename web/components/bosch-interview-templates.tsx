"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { getClient, ApiError } from "@/lib/supabase";
import { listApplications, type Application } from "@/lib/applications";
import { candidateProfile } from "@/lib/candidates";
import { useLanguage } from "./language";
import { Copy, MailPlus, Pencil, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import styles from "./bosch-interview-templates.module.css";

type Mode = "ONSITE" | "ONLINE";
type InvitationTemplate = { id: string; name: string; delivery_mode: Mode; subject: string; body_text: string; is_active: boolean; created_by: string; updated_at: string };
type Draft = Pick<InvitationTemplate, "name" | "delivery_mode" | "subject" | "body_text" | "is_active">;
const emptyDraft: Draft = { name: "", delivery_mode: "ONSITE", subject: "", body_text: "", is_active: true };
const sampleValues: Record<string, string> = {
  candidate_name: "Nguyen Van A", job_title: "Software Engineer", interview_date: "30 Nov 2026", interview_time: "10:00–11:00 (GMT+7)",
  location: "Bosch office, Ho Chi Minh City", meeting_link: "https://meet.google.com/example", interviewer_names: "Phuc Pham", recruiter_name: "Recruitment Team",
};
const tokens = Object.keys(sampleValues);
function renderPreview(value: string) { return value.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, key: string) => sampleValues[key] ?? match); }

export default function BoschInterviewTemplates({ onAccessLost, jobId, jobTitle, initialApplication }: { onAccessLost: () => void; jobId: string; jobTitle: string; initialApplication: Application | null }) {
  const { locale } = useLanguage();
  const en = locale === "en";
  const [rows, setRows] = useState<InvitationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationId, setApplicationId] = useState(initialApplication?.application_id || "");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [emailFields, setEmailFields] = useState({ interview_date: "", interview_time: "", location: "", meeting_link: "", interviewer_names: "", recruiter_name: "" });
  const previewSubject = useMemo(() => renderPreview(draft.subject), [draft.subject]);
  const previewBody = useMemo(() => renderPreview(draft.body_text), [draft.body_text]);

  const load = useCallback(async () => {
    setLoading(true); setError(""); setNotice("");
    try {
      const { data, error: queryError } = await getClient().from("interview_invitation_templates").select("id,name,delivery_mode,subject,body_text,is_active,created_by,updated_at").order("updated_at", { ascending: false });
      if (queryError) throw queryError;
      setRows((data || []) as InvitationTemplate[]);
    } catch (cause) {
      const code = (cause as { code?: string })?.code;
      if ((cause as ApiError)?.status === 401) onAccessLost();
      setRows([]);
      setError(code === "42P01"
        ? (en ? "The template table is missing in the Preview database. Apply the ATS backend migration first." : "Cơ sở dữ liệu Preview chưa có bảng mẫu thư. Cần áp dụng migration backend ATS trước.")
        : code === "42501"
          ? (en ? "Your ATS account does not have access to the template library." : "Tài khoản ATS chưa được cấp quyền truy cập thư viện mẫu.")
          : (en ? "Could not load invitation templates." : "Không tải được mẫu thư mời."));
    } finally { setLoading(false); }
  }, [en, onAccessLost]);

  useEffect(() => { void load(); }, [load, refresh]);
  useEffect(() => {
    let active = true;
    void listApplications(jobId, 100, 0).then(({ applications: rows }) => {
      if (!active) return;
      const available = rows.filter((row) => row.status === "ACTIVE");
      setApplications(available);
      setApplicationId(initialApplication && available.some((row) => row.application_id === initialApplication.application_id)
        ? initialApplication.application_id : "");
    }).catch((cause) => {
      if (!active) return;
      setError(cause instanceof Error ? cause.message : (en ? "Could not load Job candidates." : "Không tải được danh sách ứng viên của Job."));
      if ((cause as ApiError)?.status === 401) onAccessLost();
    });
    return () => { active = false; };
  }, [en, initialApplication, jobId, onAccessLost]);
  useEffect(() => {
    let active = true;
    const selected = applications.find((row) => row.application_id === applicationId);
    setCandidateEmail("");
    if (!selected) return () => { active = false; };
    setCandidateLoading(true);
    void candidateProfile(selected.candidate_id).then(({ candidate }) => {
      if (active) setCandidateEmail(candidate.email || "");
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : (en ? "Could not load candidate email." : "Không tải được email ứng viên."));
      if ((cause as ApiError)?.status === 401) onAccessLost();
    }).finally(() => { if (active) setCandidateLoading(false); });
    return () => { active = false; };
  }, [applicationId, applications, en, onAccessLost]);
  useEffect(() => {
    if (!selectedTemplateId || !rows.some((row) => row.id === selectedTemplateId && row.is_active))
      setSelectedTemplateId(rows.find((row) => row.is_active)?.id || "");
  }, [rows, selectedTemplateId]);
  function startCreate(mode: Mode = "ONSITE") { setDraft({ ...emptyDraft, delivery_mode: mode }); setEditing(null); setFormOpen(true); setNotice(""); setError(""); }
  function startEdit(row: InvitationTemplate) { setDraft({ name: row.name, delivery_mode: row.delivery_mode, subject: row.subject, body_text: row.body_text, is_active: row.is_active }); setEditing(row.id); setFormOpen(true); setNotice(""); setError(""); }
  function closeForm() { setFormOpen(false); setEditing(null); setDraft(emptyDraft); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draft.name.trim(); const subject = draft.subject.trim(); const body = draft.body_text.trim();
    if (!name || !subject || !body) { setError(en ? "Enter a name, subject, and message." : "Nhập tên mẫu, tiêu đề và nội dung thư."); return; }
    if (name.length > 120 || subject.length > 240 || body.length > 12000) { setError(en ? "The template is too long." : "Nội dung mẫu vượt quá độ dài cho phép."); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      const { data: auth, error: authError } = await getClient().auth.getUser();
      if (authError || !auth.user) throw new ApiError(en ? "Sign in again to continue." : "Vui lòng đăng nhập lại để tiếp tục.", 401);
      const payload = { name, delivery_mode: draft.delivery_mode, subject, body_text: body, is_active: draft.is_active, created_by: auth.user.id, updated_at: new Date().toISOString() };
      const result = editing
        ? await getClient().from("interview_invitation_templates").update({ name, delivery_mode: draft.delivery_mode, subject, body_text: body, is_active: draft.is_active, updated_at: payload.updated_at }).eq("id", editing)
        : await getClient().from("interview_invitation_templates").insert(payload);
      if (result.error) throw result.error;
      closeForm(); setNotice(en ? "Template saved." : "Đã lưu mẫu thư mời."); setRefresh((value) => value + 1);
    } catch (cause) {
      const code = (cause as { code?: string })?.code;
      if ((cause as ApiError)?.status === 401) onAccessLost();
      setError(code === "42501" ? (en ? "You don't have permission to save this template." : "Tài khoản không có quyền lưu mẫu này.") : (cause instanceof Error ? cause.message : (en ? "Could not save the template." : "Không lưu được mẫu thư mời.")));
    } finally { setSaving(false); }
  }
  async function remove(row: InvitationTemplate) {
    if (!window.confirm(en ? `Delete “${row.name}”?` : `Xóa mẫu “${row.name}”?`)) return;
    setError(""); setNotice("");
    const { error: deleteError } = await getClient().from("interview_invitation_templates").delete().eq("id", row.id);
    if (deleteError) { setError(en ? "Could not delete this template. Check that you own it or have Admin access." : "Không xóa được mẫu này. Kiểm tra bạn là người tạo mẫu hoặc có quyền Admin."); return; }
    setRows((current) => current.filter((item) => item.id !== row.id));
    setNotice(en ? "Template deleted." : "Đã xóa mẫu thư mời.");
  }
  async function copyTemplate(row: InvitationTemplate) {
    const content = `Subject: ${row.subject}\n\n${row.body_text}`;
    try { await navigator.clipboard.writeText(content); setNotice(en ? "Template text copied with placeholders ready to fill in." : "Đã sao chép nội dung mẫu; hãy điền các biến còn trống trước khi gửi."); }
    catch { setNotice(en ? "Clipboard access is unavailable in this browser." : "Trình duyệt chưa cấp quyền sao chép nội dung."); }
  }

  const selectedApplication = applications.find((row) => row.application_id === applicationId);
  const selectedTemplate = rows.find((row) => row.id === selectedTemplateId && row.is_active);
  const renderedEmail = selectedTemplate ? {
    subject: renderEmailText(selectedTemplate.subject, { ...sampleValues, ...emailFields, candidate_name: selectedApplication?.candidate_name || "", job_title: jobTitle }),
    body: renderEmailText(selectedTemplate.body_text, { ...sampleValues, ...emailFields, candidate_name: selectedApplication?.candidate_name || "", job_title: jobTitle }),
  } : null;
  function openEmailDraft() {
    if (!selectedApplication || !selectedTemplate || !candidateEmail || !renderedEmail) return;
    const params = new URLSearchParams({ subject: renderedEmail.subject, body: renderedEmail.body });
    window.location.href = `mailto:${encodeURIComponent(candidateEmail)}?${params.toString()}`;
    setNotice(en ? "A draft addressed only to the candidate was opened in your email app. Review it and press Send there." : "Đã mở email nháp gửi riêng cho ứng viên. Kiểm tra nội dung rồi nhấn Gửi trong ứng dụng email.");
  }
  return <section className={styles.root} aria-label={en ? "Candidate email invitations" : "Thư mời email cho ứng viên"}>
    <header className={styles.header}><div><p className={styles.eyebrow}>{en ? "FLOW 1 · CANDIDATE EMAIL" : "LUỒNG 1 · EMAIL CHO ỨNG VIÊN"}</p><h2>{en ? "Candidate email invitations" : "Thư mời email cho ứng viên"}</h2><p>{en ? "Prepare reusable email messages for on-site and online interviews." : "Chuẩn bị mẫu email cho phỏng vấn tại văn phòng hoặc online."}</p></div><button type="button" className={styles.refresh} onClick={() => setRefresh((value) => value + 1)} disabled={loading}><RefreshCw size={16}/>{en ? "Refresh" : "Tải lại"}</button></header>
    <aside className={styles.workflowNotice} aria-label={en ? "Candidate email workflow" : "Luồng email cho ứng viên"}><MailPlus size={18}/><p>{en ? "Candidate email only. This does not require selecting interviewers and will not invite internal ATS users." : "Chỉ gửi email cho ứng viên. Không cần chọn interviewer và luồng này không mời người nội bộ ATS."}</p></aside>
    <section className={styles.composer} aria-label={en ? "Prepare candidate invitation" : "Soạn thư mời ứng viên"}>
      <h3>{en ? "Prepare invitation email" : "Soạn email thư mời"}</h3>
      <div className={styles.composerGrid}>
        <label>{en ? "Candidate" : "Ứng viên"}<select value={applicationId} onChange={(event) => setApplicationId(event.target.value)}><option value="">{en ? "Choose a candidate" : "Chọn ứng viên"}</option>{applications.map((row) => <option key={row.application_id} value={row.application_id}>{row.candidate_name}</option>)}</select></label>
        <label>{en ? "Email template" : "Mẫu email"}<select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}><option value="">{en ? "Choose a template" : "Chọn mẫu thư"}</option>{rows.filter((row) => row.is_active).map((row) => <option key={row.id} value={row.id}>{row.name} · {row.delivery_mode === "ONLINE" ? "Online" : (en ? "On-site" : "Tại văn phòng")}</option>)}</select></label>
        {(["interview_date", "interview_time", "location", "meeting_link", "interviewer_names", "recruiter_name"] as const).map((key) => <label key={key}>{en ? ({ interview_date: "Interview date", interview_time: "Interview time", location: "Location", meeting_link: "Meeting link", interviewer_names: "Interviewer names", recruiter_name: "Recruiter name" } as const)[key] : ({ interview_date: "Ngày phỏng vấn", interview_time: "Giờ phỏng vấn", location: "Địa điểm", meeting_link: "Link họp", interviewer_names: "Người phỏng vấn", recruiter_name: "Tên recruiter" } as const)[key]}<input value={emailFields[key]} onChange={(event) => setEmailFields((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
      </div>
      {selectedApplication && <p className={styles.emailRecipient}>{en ? "To" : "Người nhận"}: {candidateLoading ? (en ? "Loading candidate email…" : "Đang tải email ứng viên…") : candidateEmail || (en ? "No candidate email on file" : "Ứng viên chưa có email trong hồ sơ")}</p>}
      {renderedEmail && <section className={styles.preview} aria-label={en ? "Candidate email preview" : "Xem trước email ứng viên"}><h4>{en ? "Email preview" : "Xem trước email"}</h4><strong>{renderedEmail.subject}</strong><p>{renderedEmail.body}</p></section>}
      <button type="button" className={styles.primary} onClick={openEmailDraft} disabled={!selectedApplication || !selectedTemplate || candidateLoading || !candidateEmail}>{en ? "Open email draft" : "Mở email nháp để gửi"}</button>
      <p className={styles.note}>{en ? "The email app opens with the candidate as the only recipient. You still review and send it there; ATS does not send or record this email yet." : "Ứng dụng email sẽ mở với ứng viên là người nhận duy nhất. Bạn kiểm tra và nhấn Gửi tại đó; ATS hiện chưa tự gửi hoặc lưu lịch sử email này."}</p>
    </section>
    <div className={styles.actions}><button type="button" className={styles.primary} onClick={() => startCreate("ONSITE")}><Plus size={17}/>{en ? "Create template" : "Tạo mẫu thư"}</button><span>{en ? "Available across authorized Jobs" : "Dùng chung cho các Job bạn được cấp quyền"}</span></div>
    {error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.notice} role="status">{notice}</p>}
    {formOpen && <form className={styles.editor} onSubmit={(event) => void save(event)}>
      <div className={styles.editorHeader}><div><h3>{editing ? (en ? "Edit template" : "Sửa mẫu thư") : (en ? "New invitation template" : "Mẫu thư mời mới")}</h3><p>{en ? "Use the placeholders below; the preview shows sample values." : "Chèn các biến bên dưới; phần xem trước hiển thị dữ liệu ví dụ."}</p></div><button type="button" className={styles.iconButton} aria-label={en ? "Close editor" : "Đóng biểu mẫu"} onClick={closeForm}><X size={18}/></button></div>
      <div className={styles.formGrid}><label>{en ? "Template name" : "Tên mẫu"}<input maxLength={120} required value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder={en ? "On-site interview invitation" : "Thư mời phỏng vấn tại văn phòng"}/></label><label>{en ? "Interview format" : "Hình thức phỏng vấn"}<select value={draft.delivery_mode} onChange={(event) => setDraft((current) => ({ ...current, delivery_mode: event.target.value as Mode }))}><option value="ONSITE">{en ? "On-site / Office" : "Tại văn phòng"}</option><option value="ONLINE">Online</option></select></label><label className={styles.full}>{en ? "Email subject" : "Tiêu đề email"}<input maxLength={240} required value={draft.subject} onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))} placeholder={en ? "Interview invitation – {{job_title}}" : "Thư mời phỏng vấn – {{job_title}}"}/></label><label className={styles.full}>{en ? "Message" : "Nội dung thư"}<textarea maxLength={12000} rows={9} required value={draft.body_text} onChange={(event) => setDraft((current) => ({ ...current, body_text: event.target.value }))} placeholder={en ? "Dear {{candidate_name}}, ..." : "Chào {{candidate_name}}, ..."}/></label></div>
      <div className={styles.tokenBox}><strong>{en ? "Available placeholders" : "Biến có thể dùng"}</strong><div>{tokens.map((token) => <button type="button" key={token} onClick={() => setDraft((current) => ({ ...current, body_text: `${current.body_text}${current.body_text && !current.body_text.endsWith(" ") ? " " : ""}{{${token}}}` }))}>{`{{${token}}}`}</button>)}</div></div>
      <section className={styles.preview} aria-label={en ? "Message preview" : "Xem trước thư"}><h4>{en ? "Preview with sample details" : "Xem trước với thông tin ví dụ"}</h4><strong>{previewSubject || (en ? "Email subject" : "Tiêu đề email")}</strong><p>{previewBody || (en ? "Your message will appear here." : "Nội dung thư sẽ hiển thị tại đây.")}</p></section>
      <label className={styles.checkbox}><input type="checkbox" checked={draft.is_active} onChange={(event) => setDraft((current) => ({ ...current, is_active: event.target.checked }))}/>{en ? "Active and available to recruiters" : "Đang bật để recruiter sử dụng"}</label>
      <div className={styles.footer}><button type="button" className={styles.secondary} onClick={closeForm}>{en ? "Cancel" : "Hủy"}</button><button type="submit" className={styles.primary} disabled={saving}><Save size={16}/>{saving ? (en ? "Saving…" : "Đang lưu…") : (en ? "Save template" : "Lưu mẫu thư")}</button></div>
    </form>}
    {loading ? <p className={styles.empty}>{en ? "Loading templates…" : "Đang tải mẫu thư…"}</p> : rows.length ? <div className={styles.cards}>{rows.map((row) => <article className={styles.card} key={row.id}><div className={styles.cardTop}><div className={styles.mailIcon}><MailPlus size={19}/></div><div className={styles.cardTitle}><h3>{row.name}</h3><span className={`${styles.badge} ${row.delivery_mode === "ONLINE" ? styles.online : ""}`}>{row.delivery_mode === "ONLINE" ? "Online" : (en ? "On-site" : "Tại văn phòng")}</span></div><span className={`${styles.status} ${row.is_active ? styles.active : styles.inactive}`}>{row.is_active ? (en ? "Active" : "Đang dùng") : (en ? "Inactive" : "Đã tắt")}</span></div><p className={styles.subject}><strong>{en ? "Subject" : "Tiêu đề"}:</strong> {row.subject}</p><p className={styles.excerpt}>{row.body_text}</p><div className={styles.cardActions}><button type="button" className={styles.secondary} onClick={() => void copyTemplate(row)}><Copy size={15}/>{en ? "Copy email" : "Sao chép thư"}</button><button type="button" className={styles.secondary} onClick={() => startEdit(row)}><Pencil size={15}/>{en ? "Edit" : "Sửa"}</button><button type="button" className={styles.danger} onClick={() => void remove(row)}><Trash2 size={15}/>{en ? "Delete" : "Xóa"}</button></div></article>)}</div> : !formOpen && <div className={styles.emptyState}><div><MailPlus size={22}/></div><h3>{en ? "No invitation templates yet" : "Chưa có mẫu thư mời"}</h3><p>{en ? "Create one for office interviews and another for online interviews." : "Bạn có thể tạo riêng mẫu phỏng vấn tại văn phòng và mẫu phỏng vấn online."}</p><button type="button" className={styles.primary} onClick={() => startCreate("ONSITE")}><Plus size={16}/>{en ? "Create first template" : "Tạo mẫu đầu tiên"}</button></div>}

    <p className={styles.note}>{en ? "Templates are shared and saved in the ATS Preview database." : "Mẫu được lưu dùng chung trong cơ sở dữ liệu ATS Preview."}</p>
  </section>;
}

function renderEmailText(value: string, values: Record<string, string>) {
  return value.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, key: string) => values[key] ?? match);
}
