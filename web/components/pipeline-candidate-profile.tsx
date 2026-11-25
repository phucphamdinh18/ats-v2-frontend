"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, BriefcaseBusiness, Building2, GraduationCap, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { candidateProfile, type CandidateProfile } from "@/lib/candidates";
import { driveLink } from "@/lib/policy";
import { ApiError } from "@/lib/supabase";
import styles from "./bosch-v2-pipeline.module.css";

export default function PipelineCandidateProfile({ candidateId, view, en, onSessionLost }: {
  candidateId?: string;
  view: "overview" | "profile";
  en: boolean;
  onSessionLost: () => void;
}) {
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!candidateId) {
      setProfile(null);
      setError("");
      return;
    }
    let active = true;
    void candidateProfile(candidateId).then((result) => {
      if (!active) return;
      if (result.candidate.id !== candidateId) throw new Error(en ? "Could not load the right candidate." : "Chưa tải được hồ sơ ứng viên đã chọn.");
      setProfile(result);
    }).catch((cause: unknown) => {
      if (!active) return;
      setProfile(null);
      if (cause instanceof ApiError && cause.status === 401) onSessionLost();
      setError(cause instanceof Error ? cause.message : en ? "Could not load the candidate profile." : "Chưa tải được hồ sơ ứng viên.");
    });
    return () => { active = false; };
  }, [candidateId, en, onSessionLost, attempt]);

  const candidate = candidateId ? profile?.candidate : undefined;
  const info = !candidateId ? <p className={styles.profileMuted}>{view === "overview"
    ? (en ? "Candidate profile details are available to Admins and TAs assigned to this job." : "Chỉ Admin và TA phụ trách Job này có quyền xem thông tin hồ sơ.")
    : (en ? "Contact details and CV are available to Admins and TAs assigned to this job." : "Chỉ Admin và TA phụ trách Job này có quyền xem thông tin liên hệ và CV.")}</p>
    : error ? <div className={`${styles.notice} ${styles.error}`} role="alert">
      {error}<button type="button" className={styles.retry} onClick={() => { setError(""); setAttempt(attempt + 1); }}>{en ? "Try again" : "Thử lại"}</button>
    </div> : !candidate ? <p role="status">{en ? "Loading candidate profile…" : "Đang tải hồ sơ ứng viên…"}</p> : null;

  const work = [
    { icon: UserRound, label: en ? "Experience" : "Kinh nghiệm", value: candidate?.total_experience_years == null ? null : `${candidate.total_experience_years} ${en ? "yrs" : "năm"}` },
    { icon: BriefcaseBusiness, label: en ? "Current role" : "Vị trí hiện tại", value: candidate?.current_title || candidate?.primary_role },
    { icon: Building2, label: en ? "Current company" : "Công ty hiện tại", value: candidate?.current_company },
  ];
  const facts = view === "overview" ? [...work, { icon: GraduationCap, label: en ? "Education" : "Học vấn", value: null }]
    : [
      { icon: Mail, label: "Email", value: candidate?.email },
      { icon: Phone, label: en ? "Phone" : "Số điện thoại", value: candidate?.phone },
      { icon: MapPin, label: en ? "Location" : "Địa điểm", value: candidate?.location },
      ...work,
    ];

  if (view === "profile" && info) return info;
  const documents = profile?.documents ?? [];
  return <>
    <section className={styles.profileCard}>
      <h3>{view === "overview" ? (en ? "Summary" : "Tóm tắt") : (en ? "Contact and work" : "Liên hệ và công việc")}</h3>
      {view === "overview" && (info ?? <p className={styles.profileMuted}>{en ? "No written summary yet." : "Chưa có nội dung tóm tắt."}</p>)}
      <dl className={styles.professionalFacts}>
        {facts.map(({ icon: Icon, label, value }) => <div key={label} className={styles.fact}>
          <dt><Icon aria-hidden="true" size={17}/><span>{label}</span></dt><dd>{value || "—"}</dd>
        </div>)}
      </dl>
    </section>
    {view === "profile" && <section className={styles.profileCard}>
      <h3>{en ? "CV / Documents" : "CV / Tài liệu"}</h3>
      {documents.length ? <ul className={styles.profileDocuments}>{documents.map((document) => {
        const url = driveLink(document.drive_url);
        return <li key={`${document.drive_file_id}-${document.created_at}`}>
          {url ? <a href={url} target="_blank" rel="noopener noreferrer">{document.original_name} <ArrowUpRight size={14} aria-hidden="true"/></a> : document.original_name}
        </li>;
      })}</ul> : <p>{en ? "No CV documents yet." : "Chưa có CV trong hồ sơ."}</p>}
    </section>}
  </>;
}
