"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Job } from "@/lib/policy";
import { ApiError } from "@/lib/supabase";
import { createManualCandidateApplication } from "@/lib/candidates";

type Status = "idle" | "saving" | "success" | "error";
type Form = { fullName: string; email: string; phone: string; currentTitle: string; driveUrl: string; documentName: string };
const blank: Form = { fullName: "", email: "", phone: "", currentTitle: "", driveUrl: "", documentName: "" };

export default function ManualCandidateForm({ job, onCreated, onSessionLost }: { job: Job; onCreated: () => Promise<void>; onSessionLost: () => void }) {
  const [form, setForm] = useState<Form>(blank);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const requestId = useRef<string | null>(null);
  const ticket = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => () => { ticket.current += 1; }, []);
  const open = job.status === "OPEN";
  const disabledReason = open ? "" : "Chỉ Job đang mở tuyển mới có thể nhận Candidate và tạo Application.";
  const update = (field: keyof Form, value: string) => setForm((current) => ({ ...current, [field]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!open || status === "saving") return;
    if (!form.fullName.trim() || (!form.email.trim() && !form.phone.trim()) || !form.driveUrl.trim() || !form.documentName.trim()) {
      setStatus("error");
      setError("Nhập họ tên, ít nhất email hoặc số điện thoại, link CV Drive và tên tệp.");
      return;
    }
    const retrying = requestId.current !== null;
    if (!retrying && !window.confirm(`Tạo Candidate và Application NEW cho Job ${job.title}? CV chỉ được lưu dưới dạng liên kết Drive, không gửi sang AI.`)) return;
    const id = requestId.current ?? crypto.randomUUID();
    requestId.current = id;
    const currentTicket = ++ticket.current;
    setStatus("saving");
    setError("");
    try {
      await createManualCandidateApplication({ requestId: id, jobId: job.id, ...form });
      if (currentTicket !== ticket.current) return;
      requestId.current = null;
      setStatus("success");
      setForm(blank);
      await onCreated();
    } catch (cause) {
      if (currentTicket !== ticket.current) return;
      const apiError = cause instanceof ApiError ? cause : undefined;
      if (apiError?.status === 401) onSessionLost();
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Không tạo được Candidate và Application.");
    }
  }

  return <section className="manual-candidate" aria-label="Thêm ứng viên thủ công">
    <div className="panel-heading"><div><h3>Thêm ứng viên vào Job</h3><p>Chỉ lưu liên kết CV trên Google Drive. ATS không tải CV lên và không gửi CV sang AI ở luồng này.</p></div></div>
    {!open && <p className="disabled-explanation" role="status">{disabledReason}</p>}
    {status === "success" && <p className="notice success" role="status">Đã tạo Candidate và Application ở giai đoạn NEW.</p>}
    {status === "error" && <div className="notice error" role="alert">{error}{requestId.current && <button className="quiet" type="button" onClick={() => formRef.current?.requestSubmit()}>Thử lại với cùng request_id</button>}</div>}
    <form ref={formRef} className="manual-candidate-form" onSubmit={submit}>
      <label>Họ và tên *<input aria-label="Họ và tên ứng viên" value={form.fullName} onChange={(event) => update("fullName", event.target.value)} maxLength={160} disabled={!open || status === "saving"} /></label>
      <label>Email<input aria-label="Email ứng viên" type="email" value={form.email} onChange={(event) => update("email", event.target.value)} maxLength={254} disabled={!open || status === "saving"} /></label>
      <label>Số điện thoại<input aria-label="Số điện thoại ứng viên" value={form.phone} onChange={(event) => update("phone", event.target.value)} maxLength={40} disabled={!open || status === "saving"} /></label>
      <label>Chức danh hiện tại<input aria-label="Chức danh hiện tại" value={form.currentTitle} onChange={(event) => update("currentTitle", event.target.value)} maxLength={160} disabled={!open || status === "saving"} /></label>
      <label>Link CV trên Drive *<input aria-label="Link CV Google Drive" type="url" value={form.driveUrl} onChange={(event) => update("driveUrl", event.target.value)} placeholder="https://drive.google.com/file/d/..." disabled={!open || status === "saving"} /></label>
      <label>Tên tệp CV *<input aria-label="Tên tệp CV" value={form.documentName} onChange={(event) => update("documentName", event.target.value)} maxLength={255} disabled={!open || status === "saving"} /></label>
      <div className="manual-candidate-action"><p>Email hoặc số điện thoại là bắt buộc để chống tạo trùng.</p><button className="primary" type="submit" disabled={!open || status === "saving"} title={disabledReason || "Tạo Candidate và Application NEW"}>{status === "saving" ? "Đang tạo…" : requestId.current ? "Thử lại tạo Application" : "Tạo Candidate và Application"}</button></div>
    </form>
  </section>;
}
