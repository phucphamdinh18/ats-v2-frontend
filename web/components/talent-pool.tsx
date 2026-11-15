"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Job } from "@/lib/policy";
import { ApiError, getClient } from "@/lib/supabase";
import { candidateProfile, listCandidates, type Candidate, type CandidateProfile } from "@/lib/candidates";
import { createApplication } from "@/lib/applications";
import { driveLink } from "@/lib/policy";
import ReviewQueue from "./review-queue";
import styles from "./bosch-v2-candidates.module.css";
import { useLanguage } from "./language";

const PAGE_SIZE = 25;
type SourceOption = { sub_source: string; source: string; source_ownership: string };

export default function TalentPool({ jobs, onAccessLost }: { jobs: Job[]; onAccessLost: () => void }) {
  const { locale } = useLanguage();
  const en = locale === "en";
  const tr = (vi: string, english: string) => en ? english : vi;
  const [view, setView] = useState<"pool" | "cv-review">("pool");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [jobId, setJobId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [sourceOptions, setSourceOptions] = useState<SourceOption[]>([]);
  const [subSource, setSubSource] = useState("");
  const [sourceLoadError, setSourceLoadError] = useState("");
  const requestId = useRef<{ key: string; id: string } | null>(null);
  const listRevision = useRef(0);
  const profileRevision = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openJobs = jobs.filter((job) => job.status === "OPEN");

  useEffect(() => {
    let current = true;
    void getClient().from("hiring_source_catalog").select("sub_source,source,source_ownership").order("source").order("sub_source")
      .then(({ data, error: catalogError }) => {
        if (!current) return;
        if (catalogError) setSourceLoadError(tr("Không tải được danh mục nguồn tuyển dụng.", "Could not load the recruitment source catalog."));
        else setSourceOptions((data || []) as SourceOption[]);
      });
    return () => { current = false; };
  }, []);

  const load = useCallback(async (nextOffset = offset, nextQuery = query) => {
    const revision = ++listRevision.current;
    setLoading(true);
    setError("");
    try {
      const result = await listCandidates(nextQuery, PAGE_SIZE, nextOffset);
      if (revision !== listRevision.current) return;
      setCandidates(result.candidates || []);
      setOffset(nextOffset);
      setSelectedId((current) => result.candidates.some((candidate) => candidate.id === current) ? current : result.candidates[0]?.id ?? null);
    } catch (cause) {
      if (revision !== listRevision.current) return;
      setCandidates([]);
      const apiError = cause instanceof ApiError ? cause : undefined;
      if (apiError?.status === 401) onAccessLost();
      setError(cause instanceof Error ? cause.message : tr("Không tải được Talent Pool.", "Could not load the candidate directory."));
    } finally {
      if (revision === listRevision.current) setLoading(false);
    }
  }, [offset, query, onAccessLost]);

  useEffect(() => {
    searchTimer.current = setTimeout(() => void load(0, query), 250);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      listRevision.current += 1;
      profileRevision.current += 1;
    };
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId) { setProfile(null); return; }
    const revision = ++profileRevision.current;
    setProfile(null);
    setProfileError("");
    setDetailLoading(true);
    void candidateProfile(selectedId).then((result) => {
      if (revision === profileRevision.current) setProfile(result);
    }).catch((cause: unknown) => {
      if (revision !== profileRevision.current) return;
      if (cause instanceof ApiError && cause.status === 401) onAccessLost();
      setProfileError(cause instanceof Error ? cause.message : tr("Không tải được hồ sơ ứng viên.", "Could not load candidate profile."));
    }).finally(() => {
      if (revision === profileRevision.current) setDetailLoading(false);
    });
    return () => { profileRevision.current += 1; };
  }, [selectedId, onAccessLost]);

  useEffect(() => {
    if (profile && !openJobs.some((job) => job.id === jobId && !profile.applications.some((app) => app.job_id === job.id))) {
      setJobId(openJobs.find((job) => !profile.applications.some((app) => app.job_id === job.id))?.id || "");
    }
  }, [profile, jobId, jobs]);

  async function addToJob() {
    if (!profile || !selectedId || !jobId || !subSource || busy) return;
    const sourceOption = sourceOptions.find((item) => item.sub_source === subSource);
    if (!sourceOption) return;
    const job = openJobs.find((item) => item.id === jobId);
    if (!job || profile.applications.some((application) => application.job_id === job.id)) return;
    if (!window.confirm(tr(`Thêm ${profile.candidate.full_name} vào ${job.title}? Ứng viên sẽ được đưa vào vòng Mới ứng tuyển.`, `Add ${profile.candidate.full_name} to ${job.title}? The application will enter the New stage.`))) return;
    const key = `${selectedId}:${jobId}:${subSource}`;
    const request = requestId.current?.key === key ? requestId.current.id : crypto.randomUUID();
    requestId.current = { key, id: request };
    setBusy(true);
    setMessage("");
    setProfileError("");
    try {
      await createApplication(selectedId, jobId, request, sourceOption.source, sourceOption.sub_source);
      requestId.current = null;
      setMessage(tr(`Đã thêm vào Job “${job.title}”. Ứng viên xuất hiện ở vòng Mới ứng tuyển.`, `Added to Job “${job.title}”. The application is now in the New stage.`));
      await load(offset, query);
      const nextProfile = await candidateProfile(selectedId);
      setProfile(nextProfile);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onAccessLost();
      setProfileError(cause instanceof Error ? cause.message : tr("Không thêm được ứng viên vào Job.", "Could not add candidate to this Job."));
    } finally {
      setBusy(false);
    }
  }

  if (view === "cv-review") return <section className={styles.root}>
    <div className={styles.heading}><div><span className={styles.eyebrow}>Talent Pool</span><h2>{tr("CV cần duyệt", "CVs Awaiting Review")}</h2><p>{tr("Duyệt CV trước; CV được chấp thuận sẽ trở thành hồ sơ trong Talent Pool.", "Review CVs before their profiles enter the Candidate Database.")}</p></div><button className={styles.secondary} onClick={() => setView("pool")}>{tr("Quay lại Talent Pool", "Back to Candidate Database")}</button></div>
    <ReviewQueue fixedKind="cv" onAccessLost={onAccessLost} />
  </section>;

  return <section className={styles.root} aria-label={tr("Talent Pool", "Candidate Database")}>
    <div className={styles.heading}><div><span className={styles.eyebrow}>{tr("DANH SÁCH ỨNG VIÊN", "CANDIDATE DATABASE")}</span><h2>{tr("Ứng viên", "Candidates")}</h2><p>{tr("CV được duyệt sẽ xuất hiện ở đây. Chọn hồ sơ để xem CV và thêm ứng viên vào Job đang mở.", "Approved CVs appear here. Select a profile to view documents and assign the candidate to an open Job.")}</p></div><button className={styles.primary} onClick={() => setView("cv-review")}>{tr("CV chờ duyệt", "Review CVs")}</button></div>
    <div className={styles.toolbar}>
      <label className={styles.search}><span aria-hidden="true">⌕</span><input aria-label={tr("Tìm trong Talent Pool", "Search candidates")} placeholder={tr("Tìm tên, kỹ năng, công ty…", "Search name, skills, company…")} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <span className={styles.muted}>{loading ? tr("Đang tải hồ sơ…", "Loading profiles…") : tr(`${candidates.length} hồ sơ trên trang`, `${candidates.length} candidates on this page`)}</span>
    </div>
    {error && <div className={`${styles.notice} ${styles.error}`} role="alert">{error}<button className={styles.retry} onClick={() => void load()}>{tr("Thử lại", "Retry")}</button></div>}
    <div className={styles.layout}>
      <div className={styles.listCard} aria-busy={loading}>
        {loading ? <p className={styles.empty}>{tr("Đang tải ứng viên…", "Loading candidates…")}</p> : candidates.length ? <div className={styles.scroll}><table className={styles.table}><thead><tr><th aria-label={tr("Chọn hồ sơ", "Select candidate")}></th><th>{tr("Ứng viên", "Candidate")}</th><th>{tr("Vị trí / Công ty", "Current Job / Company")}</th><th>{tr("Giai đoạn", "Stage")}</th><th>{tr("Vòng phỏng vấn", "Interview Round")}</th><th>{tr("Độ phù hợp", "Matching")}</th><th>{tr("Kinh nghiệm", "Experience")}</th><th>{tr("Nguồn", "Source")}</th><th>{tr("Hoạt động gần nhất", "Last Activity")}</th></tr></thead><tbody>{candidates.map((candidate) => <tr key={candidate.id} className={selectedId === candidate.id ? styles.selected : ""}><td><input type="checkbox" aria-label={`${tr("Chọn", "Select")} ${candidate.full_name}`} checked={selectedId === candidate.id} onChange={()=>setSelectedId(candidate.id)}/></td><td><button type="button" className={styles.candidateLink} aria-pressed={selectedId === candidate.id} onClick={() => setSelectedId(candidate.id)}>{candidate.full_name}</button></td><td><strong className={styles.jobTitle}>{candidate.current_title || candidate.primary_role || "—"}</strong><small>{candidate.current_company || "—"}</small></td><td title={tr("Giai đoạn theo Job không có trong API danh sách ứng viên", "Stage is Job-specific and not returned by Candidate list API")}>—</td><td title={tr("Vòng phỏng vấn chỉ có theo từng Job", "Interview rounds are Job-specific")}>—</td><td title={tr("API danh sách ứng viên không có điểm phù hợp", "No matching score in Candidate list API")}>—</td><td>{candidate.total_experience_years == null ? "—" : `${candidate.total_experience_years} ${en ? "yrs" : "năm"}`}</td><td>—</td><td>—</td></tr>)}</tbody></table></div> : !error ? <div className={styles.empty}><h3>{tr("Talent Pool chưa có hồ sơ", "No candidates yet")}</h3><p>{tr("Thêm CV vào hàng chờ duyệt. Sau khi Admin/TA chấp thuận, ứng viên sẽ được đưa vào kho.", "Submit a CV for review. An Admin or Recruiter must approve it before the profile appears here.")}</p><button className={styles.secondary} onClick={() => setView("cv-review")}>{tr("Mở CV chờ duyệt", "Open CV review queue")}</button></div> : null}
        <div className={styles.pagination}><button className={styles.secondary} disabled={loading || offset === 0} onClick={() => void load(Math.max(0, offset - PAGE_SIZE), query)}>{tr("Trang trước", "Previous")}</button><span>{tr("Trang", "Page")} {offset / PAGE_SIZE + 1}</span><button className={styles.secondary} disabled={loading || candidates.length < PAGE_SIZE} onClick={() => void load(offset + PAGE_SIZE, query)}>{tr("Trang sau", "Next")}</button></div>
      </div>
      <div className={styles.profileCard} aria-busy={detailLoading}>
        {detailLoading ? <p className={styles.empty}>{tr("Đang mở hồ sơ…", "Loading candidate profile…")}</p> : profile ? <>
          <div className={styles.profileHeader}><span className={styles.avatar} aria-hidden="true">{profile.candidate.full_name.trim().charAt(0).toUpperCase()}</span><div><h3>{profile.candidate.full_name}</h3><p>{profile.candidate.current_title || profile.candidate.primary_role || tr("Chưa có chức danh", "Title unavailable")}</p></div></div>
          {profileError && <div className={`${styles.notice} ${styles.error}`} role="alert">{profileError}</div>}
          {message && <div className={`${styles.notice} ${styles.success}`} role="status">{message}</div>}
          <div className={styles.section}><h3 className={styles.subheading}>{tr("Thông tin ứng viên", "Candidate Information")}</h3><dl className={styles.facts}>
            <dt>Email</dt><dd>{profile.candidate.email || "—"}</dd>
            <dt>{tr("Điện thoại", "Phone")}</dt><dd>{profile.candidate.phone || "—"}</dd>
            <dt>{tr("Công ty hiện tại", "Current Company")}</dt><dd>{profile.candidate.current_company || "—"}</dd>
            <dt>{tr("Kinh nghiệm", "Experience")}</dt><dd>{profile.candidate.total_experience_years == null ? "—" : `${profile.candidate.total_experience_years} ${en ? "yrs" : "năm"}`}</dd>
            <dt>{tr("Cấp bậc", "Seniority")}</dt><dd>{profile.candidate.seniority || "—"}</dd>
            <dt>{tr("Địa điểm", "Location")}</dt><dd>{profile.candidate.location || "—"}</dd>
          </dl></div>
          <div className={styles.section}><h3 className={styles.subheading}>{tr("CV / tài liệu", "CV / Documents")}</h3>
          {profile.documents.length ? <ul className={styles.documents}>{profile.documents.map((document) => <li key={`${document.drive_file_id}-${document.created_at}`}><span>{document.original_name}</span>{driveLink(document.drive_url) ? <a href={driveLink(document.drive_url)!} target="_blank" rel="noopener noreferrer">{tr("Mở CV ↗", "Open CV ↗")}</a> : <small>{tr("Link không hợp lệ", "Invalid link")}</small>}</li>)}</ul> : <p className={styles.muted}>{tr("Chưa có CV được lưu trong hồ sơ.", "No CV documents are saved on this profile.")}</p>}
          </div><div className={styles.section}><h3 className={styles.subheading}>{tr("Đang tham gia Job", "Assigned Jobs")}</h3>
          {profile.applications.filter((application) => jobs.some((job) => job.id === application.job_id)).length ? <ul className={styles.applications}>{profile.applications.filter((application) => jobs.some((job) => job.id === application.job_id)).map((application) => <li key={application.id}><strong>{jobs.find((job) => job.id === application.job_id)?.title}</strong><span>{application.stage} · {application.status}</span></li>)}</ul> : <p className={styles.muted}>{tr("Chưa được thêm vào Job nào trong phạm vi bạn được xem.", "Not assigned to any Job you can access.")}</p>}
          </div><div className={styles.section}><h3 className={styles.subheading}>{tr("Thêm vào Job", "Add to Job")}</h3>{openJobs.filter((job) => !profile.applications.some((application) => application.job_id === job.id)).length ? <div className={styles.addControls}><select aria-label={tr("Chọn Job để thêm ứng viên", "Select Job to add candidate")} value={jobId} onChange={(event) => { setJobId(event.target.value); requestId.current = null; }}><option value="">{tr("Chọn Job đang mở", "Select an open Job")}</option>{openJobs.filter((job) => !profile.applications.some((application) => application.job_id === job.id)).map((job) => <option key={job.id} value={job.id}>{job.job_code ? `${job.job_code} · ` : ""}{job.title}</option>)}</select><select aria-label={tr("Chọn nguồn ứng viên", "Select candidate source")} value={subSource} onChange={(event) => { setSubSource(event.target.value); requestId.current = null; }} disabled={!!sourceLoadError}><option value="">{tr("Chọn nguồn ứng viên", "Select candidate source")}</option>{sourceOptions.map((source) => <option key={source.sub_source} value={source.sub_source}>{source.sub_source} · {source.source} · {source.source_ownership}</option>)}</select><button className={styles.primary} disabled={!jobId || !subSource || busy || !sourceOptions.length} onClick={() => void addToJob()}>{busy ? tr("Đang thêm…", "Adding…") : requestId.current ? tr("Thử lại", "Retry") : tr("Thêm vào Job", "Add to Job")}</button></div> : <p className={styles.muted}>{tr("Không có Job đang mở mà bạn có quyền thêm hồ sơ này.", "No eligible open Job is available for this candidate.")}</p>}{sourceLoadError && <p className={`${styles.notice} ${styles.error}`} role="alert">{sourceLoadError}</p>}</div>
        </> : profileError ? <div className={`${styles.notice} ${styles.error}`} role="alert">{profileError}</div> : <div className={styles.empty}><h3>{tr("Chọn một hồ sơ", "Select a candidate")}</h3><p>{tr("Thông tin chi tiết và các Job liên quan sẽ hiển thị tại đây.", "Profile details and related Jobs will appear here.")}</p></div>}
      </div>
    </div>
  </section>;
}
