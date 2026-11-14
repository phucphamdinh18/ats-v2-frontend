"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Job } from "@/lib/policy";
import { ApiError } from "@/lib/supabase";
import { getClient } from "@/lib/supabase";
import { createManualCandidateApplication } from "@/lib/candidates";
import { useLanguage } from "./language";
import styles from "./bosch-v2-candidate-intake.module.css";

type Status = "idle" | "saving" | "success" | "error";
type Form = { fullName: string; email: string; phone: string; currentTitle: string; driveUrl: string; documentName: string; subSource: string };
type SourceOption = { sub_source: string; source: string; source_ownership: string };
const blank: Form = { fullName: "", email: "", phone: "", currentTitle: "", driveUrl: "", documentName: "", subSource: "" };

export default function ManualCandidateForm({ job, onCreated, onSessionLost }: { job: Job; onCreated: () => Promise<void>; onSessionLost: () => void }) {
  const { locale } = useLanguage();
  const en = locale === "en";
  const copy = en ? {
    aria: "Add candidate manually", title: "Add candidate to job", intro: "Save a Google Drive CV link. The CV isn’t uploaded or sent to AI.", onlyOpen: "Candidates can only be added to an open job.", success: "Candidate added to the job at the New stage.", retry: "Retry with the same request_id", name: "Full name", email: "Email", phone: "Phone number", currentTitle: "Current job title", source: "Candidate source", choose: "Choose a source", drive: "Google Drive CV link", fileName: "CV file name", duplicate: "An email address or phone number is required to prevent duplicates.", addPipeline: "Add to pipeline", retryAdd: "Retry adding candidate", saving: "Adding…", addTitle: "Add candidate to the pipeline", required: "Enter a name, email or phone number, Drive CV link, file name and candidate source.", confirm: (title: string) => `Add this candidate to the New stage of ${title}? Their CV will be saved as a Drive link and won’t be sent to AI.`, addError: "Could not add the candidate to the job.", sourceError: "Could not load candidate sources. Reload the page or contact an Admin.",
  } : {
    aria: "Thêm ứng viên thủ công", title: "Thêm ứng viên vào vị trí", intro: "Chỉ lưu liên kết CV trên Google Drive. ATS không tải CV lên hoặc gửi CV sang AI.", onlyOpen: "Chỉ Job đang mở tuyển mới có thể nhận ứng viên.", success: "Đã thêm ứng viên vào vị trí ở vòng Mới ứng tuyển.", retry: "Thử lại với cùng request_id", name: "Họ và tên ứng viên", email: "Email ứng viên", phone: "Số điện thoại ứng viên", currentTitle: "Chức danh hiện tại", source: "Nguồn ứng viên", choose: "Chọn nguồn", drive: "Link CV Google Drive", fileName: "Tên tệp CV", duplicate: "Cần có email hoặc số điện thoại để hạn chế hồ sơ trùng.", addPipeline: "Thêm vào pipeline", retryAdd: "Thử thêm ứng viên lại", saving: "Đang thêm…", addTitle: "Thêm ứng viên vào pipeline", required: "Nhập họ tên, email hoặc số điện thoại, link CV Drive, tên tệp và nguồn ứng viên.", confirm: (title: string) => `Thêm ứng viên vào vòng Mới ứng tuyển của vị trí ${title}? CV chỉ được lưu dưới dạng link Drive, không gửi sang AI.`, addError: "Chưa thêm được ứng viên vào vị trí.", sourceError: "Chưa tải được danh sách nguồn ứng viên. Hãy tải lại trang hoặc báo Admin.",
  };
  const [form, setForm] = useState<Form>(blank);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [sourceOptions, setSourceOptions] = useState<SourceOption[]>([]);
  const [sourceLoadError, setSourceLoadError] = useState("");
  const requestId = useRef<string | null>(null);
  const requestPayload = useRef<string | null>(null);
  const ticket = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    let current = true;
    void getClient().from("hiring_source_catalog").select("sub_source,source,source_ownership").order("source").order("sub_source")
      .then(({ data, error: catalogError }) => {
        if (!current) return;
        if (catalogError) setSourceLoadError(copy.sourceError);
        else setSourceOptions((data || []) as SourceOption[]);
      });
    return () => { current = false; ticket.current += 1; };
  }, [copy.sourceError]);
  const open = job.status === "OPEN";
  const disabledReason = open ? "" : en ? copy.onlyOpen : copy.onlyOpen;
  const update = (field: keyof Form, value: string) => {
    if (form[field] === value) return;
    // A changed payload is a new operation; never reuse an uncertain write's ID.
    requestId.current = null;
    requestPayload.current = null;
    setStatus("idle");
    setError("");
    setForm((current) => ({ ...current, [field]: value }));
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!open || status === "saving") return;
    if (!form.fullName.trim() || (!form.email.trim() && !form.phone.trim()) || !form.driveUrl.trim() || !form.documentName.trim() || !form.subSource) {
      setStatus("error");
      setError(copy.required);
      return;
    }
    const payload = JSON.stringify({ jobId: job.id, ...form });
    if (requestPayload.current !== payload) requestId.current = null;
    const retrying = requestId.current !== null;
    if (!retrying && !window.confirm(copy.confirm(job.title))) return;
    const id = requestId.current ?? crypto.randomUUID();
    requestId.current = id;
    requestPayload.current = payload;
    const currentTicket = ++ticket.current;
    setStatus("saving");
    setError("");
    try {
      await createManualCandidateApplication({ requestId: id, jobId: job.id, ...form });
      if (currentTicket !== ticket.current) return;
      requestId.current = null;
      requestPayload.current = null;
      setStatus("success");
      setForm(blank);
      await onCreated();
    } catch (cause) {
      if (currentTicket !== ticket.current) return;
      const apiError = cause instanceof ApiError ? cause : undefined;
      if (apiError?.status === 401) onSessionLost();
      // Validation/permission/conflict responses are definitive failures. A corrected
      // submission needs a new ID; transport/5xx failures keep the exact retry ID.
      if (apiError?.status && [400, 403, 404, 409, 413].includes(apiError.status)) {
        requestId.current = null;
        requestPayload.current = null;
      }
      setStatus("error");
      setError(cause instanceof Error ? cause.message : copy.addError);
    }
  }

  return <section className={styles.root} aria-label={copy.aria}>
    <div className={styles.header}><div><h3>{copy.title}</h3><p>{copy.intro}</p></div></div>
    {!open && <p className={`${styles.notice} ${styles.disabled}`} role="status">{disabledReason}</p>}
    {status === "success" && <p className={`${styles.notice} ${styles.success}`} role="status">{copy.success}</p>}
    {status === "error" && <div className={`${styles.notice} ${styles.error}`} role="alert">{error}{requestId.current && <button className={styles.retry} type="button" onClick={() => formRef.current?.requestSubmit()}>{copy.retry}</button>}</div>}
    <form ref={formRef} className={styles.form} onSubmit={submit}>
      <label>{copy.name} *<input aria-label={copy.name} value={form.fullName} onChange={(event) => update("fullName", event.target.value)} maxLength={160} disabled={!open || status === "saving"} /></label>
      <label>{copy.email}<input aria-label={copy.email} type="email" value={form.email} onChange={(event) => update("email", event.target.value)} maxLength={254} disabled={!open || status === "saving"} /></label>
      <label>{copy.phone}<input aria-label={copy.phone} value={form.phone} onChange={(event) => update("phone", event.target.value)} maxLength={40} disabled={!open || status === "saving"} /></label>
      <label>{copy.currentTitle}<input aria-label={copy.currentTitle} value={form.currentTitle} onChange={(event) => update("currentTitle", event.target.value)} maxLength={160} disabled={!open || status === "saving"} /></label>
      <label>{copy.source} *<select aria-label={copy.source} value={form.subSource} onChange={(event) => update("subSource", event.target.value)} required disabled={!open || status === "saving" || !!sourceLoadError}><option value="">{copy.choose}</option>{sourceOptions.map((source) => <option key={source.sub_source} value={source.sub_source}>{source.sub_source} · {source.source} · {source.source_ownership}</option>)}</select></label>
      {sourceLoadError && <p className={`${styles.notice} ${styles.error}`} role="alert">{sourceLoadError}</p>}
      <label>{copy.drive} *<input aria-label={copy.drive} type="url" value={form.driveUrl} onChange={(event) => update("driveUrl", event.target.value)} placeholder="https://drive.google.com/file/d/..." disabled={!open || status === "saving"} /></label>
      <label>{copy.fileName} *<input aria-label={copy.fileName} value={form.documentName} onChange={(event) => update("documentName", event.target.value)} maxLength={255} disabled={!open || status === "saving"} /></label>
      <div className={styles.actions}><p>{copy.duplicate}</p><button className={styles.submit} type="submit" disabled={!open || status === "saving"} title={disabledReason || copy.addTitle}>{status === "saving" ? copy.saving : requestId.current ? copy.retryAdd : copy.addPipeline}</button></div>
    </form>
  </section>;
}
