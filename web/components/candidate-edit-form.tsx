"use client";

import { useEffect, useState, type FormEvent } from "react";
import { candidateProfile, updateCandidateProfile, type CandidateEditFields } from "@/lib/candidates";
import { ApiError } from "@/lib/supabase";
import styles from "./bosch-v2-pipeline.module.css";

const FIELDS = [
  { name: "full_name", vi: "Họ và tên", en: "Full name", max: 160, autoComplete: "name" },
  { name: "email", vi: "Email", en: "Email", max: 254, autoComplete: "email", inputMode: "email" },
  { name: "phone", vi: "Số điện thoại", en: "Phone", max: 40, autoComplete: "tel", inputMode: "tel" },
  { name: "current_title", vi: "Vị trí hiện tại", en: "Current role", max: 160, autoComplete: "organization-title" },
  { name: "current_company", vi: "Công ty", en: "Current company", max: 160, autoComplete: "organization" },
] as const;

type Props = {
  candidateId: string;
  applicationId: string;
  jobId: string;
  en: boolean;
  onSessionLost: () => void;
  onClose: () => void;
  onSave: (name: string) => void;
};

export default function CandidateEditForm({ candidateId, applicationId, jobId, en, onSessionLost, onClose, onSave }: Props) {
  const [values, setValues] = useState<CandidateEditFields | null>(null);
  const [updatedAt, setUpdatedAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void candidateProfile(candidateId).then(({ candidate }) => {
      if (!active) return;
      if (candidate.id !== candidateId || !candidate.updated_at) throw new Error(en ? "Could not load the profile version." : "Chưa tải được phiên bản hồ sơ.");
      setUpdatedAt(candidate.updated_at);
      setValues({
        full_name: candidate.full_name, email: candidate.email ?? "", phone: candidate.phone ?? "",
        current_title: candidate.current_title ?? "", current_company: candidate.current_company ?? "",
      });
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) onSessionLost();
      setError(cause instanceof Error ? cause.message : en ? "Could not load candidate details." : "Chưa tải được hồ sơ ứng viên.");
    });
    return () => { active = false; };
  }, [candidateId, en, onSessionLost]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values || saving) return;
    if (!values.full_name.trim()) {
      setError(en ? "Enter the candidate’s full name." : "Nhập họ và tên ứng viên.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await updateCandidateProfile(jobId, applicationId, updatedAt, values);
      onSave(result.full_name);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onSessionLost();
      setError(cause instanceof Error ? cause.message : en ? "Could not save candidate details." : "Chưa lưu được hồ sơ ứng viên.");
    } finally {
      setSaving(false);
    }
  }

  return <form className={`${styles.profileCard} ${styles.editForm}`} onSubmit={(event) => void save(event)}>
    <h3>{en ? "Edit candidate profile" : "Sửa hồ sơ ứng viên"}</h3>
    <p>{en ? "Changes apply to this candidate across all linked jobs." : "Thay đổi áp dụng cho hồ sơ ứng viên ở tất cả vị trí liên kết."}</p>
    {values ? <fieldset disabled={saving}>
      {FIELDS.map((field) => <label key={field.name}>
        {en ? field.en : field.vi}
        <input value={values[field.name]} maxLength={field.max} required={field.name === "full_name"}
          autoComplete={field.autoComplete} inputMode={"inputMode" in field ? field.inputMode : undefined}
          onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}/>
      </label>)}
    </fieldset> : !error && <p role="status">{en ? "Loading candidate details…" : "Đang tải hồ sơ ứng viên…"}</p>}
    {error && <p className={`${styles.notice} ${styles.error}`} role="alert">{error}</p>}
    {values && <button type="submit" className={styles.actionPrimary} disabled={saving}>{saving ? (en ? "Saving…" : "Đang lưu…") : (en ? "Save changes" : "Lưu thay đổi")}</button>}
    <button type="button" className={styles.actionSecondary} disabled={saving} onClick={onClose}>{en ? "Close" : "Đóng"}</button>
  </form>;
}
