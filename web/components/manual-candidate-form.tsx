"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Job } from "@/lib/policy";
import { ApiError } from "@/lib/supabase";
import { getClient } from "@/lib/supabase";
import { createManualCandidateApplication } from "@/lib/candidates";

type Status = "idle" | "saving" | "success" | "error";
type Form = { fullName: string; email: string; phone: string; currentTitle: string; driveUrl: string; documentName: string; subSource: string };
type SourceOption = { sub_source: string; source: string; source_ownership: string };
const blank: Form = { fullName: "", email: "", phone: "", currentTitle: "", driveUrl: "", documentName: "", subSource: "" };

export default function ManualCandidateForm({ job, onCreated, onSessionLost }: { job: Job; onCreated: () => Promise<void>; onSessionLost: () => void }) {
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
        if (catalogError) setSourceLoadError("Không tải được danh mục nguồn. Hãy tải lại trang hoặc báo Admin.");
        else setSourceOptions((data || []) as SourceOption[]);
      });
    return () => { current = false; ticket.current += 1; };
  }, []);
  const open = job.status === "OPEN";
  const disabledReason = open ? "" : "Chỉ Job đang mở tuyển mới có thể nhận ứng viên.";
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
      setError("Nhập họ tên, email hoặc số điện thoại, link CV Drive, tên tệp và nguồn ứng viên.");
      return;
    }
    const payload = JSON.stringify({ jobId: job.id, ...form });
    if (requestPayload.current !== payload) requestId.current = null;
    const retrying = requestId.current !== null;
    if (!retrying && !window.confirm(`Thêm ứng viên vào vòng NEW của Job ${job.title}? CV chỉ được lưu dưới dạng liên kết Drive, không gửi sang AI.`)) return;
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
      setError(cause instanceof Error ? cause.message : "Không thêm được ứng viên vào Job.");
    }
  }

  return <section className="manual-candidate" aria-label="Thêm ứng viên thủ công">
    <div className="panel-heading"><div><h3>Thêm ứng viên vào Job</h3><p>Chỉ lưu liên kết CV trên Google Drive. ATS không tải CV lên và không gửi CV sang AI ở luồng này.</p></div></div>
    {!open && <p className="disabled-explanation" role="status">{disabledReason}</p>}
    {status === "success" && <p className="notice success" role="status">Đã thêm ứng viên vào Job ở vòng NEW.</p>}
    {status === "error" && <div className="notice error" role="alert">{error}{requestId.current && <button className="quiet" type="button" onClick={() => formRef.current?.requestSubmit()}>Thử lại với cùng request_id</button>}</div>}
    <form ref={formRef} className="manual-candidate-form" onSubmit={submit}>
      <label>Họ và tên *<input aria-label="Họ và tên ứng viên" value={form.fullName} onChange={(event) => update("fullName", event.target.value)} maxLength={160} disabled={!open || status === "saving"} /></label>
      <label>Email<input aria-label="Email ứng viên" type="email" value={form.email} onChange={(event) => update("email", event.target.value)} maxLength={254} disabled={!open || status === "saving"} /></label>
      <label>Số điện thoại<input aria-label="Số điện thoại ứng viên" value={form.phone} onChange={(event) => update("phone", event.target.value)} maxLength={40} disabled={!open || status === "saving"} /></label>
      <label>Chức danh hiện tại<input aria-label="Chức danh hiện tại" value={form.currentTitle} onChange={(event) => update("currentTitle", event.target.value)} maxLength={160} disabled={!open || status === "saving"} /></label>
      <label>Nguồn ứng viên *<select aria-label="Nguồn ứng viên" value={form.subSource} onChange={(event) => update("subSource", event.target.value)} required disabled={!open || status === "saving" || !!sourceLoadError}><option value="">Chọn nguồn</option>{sourceOptions.map((source) => <option key={source.sub_source} value={source.sub_source}>{source.sub_source} · {source.source} · {source.source_ownership}</option>)}</select></label>
      {sourceLoadError && <p className="notice error" role="alert">{sourceLoadError}</p>}
      <label>Link CV trên Drive *<input aria-label="Link CV Google Drive" type="url" value={form.driveUrl} onChange={(event) => update("driveUrl", event.target.value)} placeholder="https://drive.google.com/file/d/..." disabled={!open || status === "saving"} /></label>
      <label>Tên tệp CV *<input aria-label="Tên tệp CV" value={form.documentName} onChange={(event) => update("documentName", event.target.value)} maxLength={255} disabled={!open || status === "saving"} /></label>
      <div className="manual-candidate-action"><p>Email hoặc số điện thoại là bắt buộc để chống tạo trùng.</p><button className="primary" type="submit" disabled={!open || status === "saving"} title={disabledReason || "Thêm ứng viên vào pipeline"}>{status === "saving" ? "Đang tạo…" : requestId.current ? "Thử lại thêm ứng viên" : "Thêm vào pipeline"}</button></div>
    </form>
  </section>;
}
