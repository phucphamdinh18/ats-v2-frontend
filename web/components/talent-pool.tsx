"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Job } from "@/lib/policy";
import { ApiError, getClient } from "@/lib/supabase";
import { candidateProfile, listCandidates, type Candidate, type CandidateProfile } from "@/lib/candidates";
import { createApplication } from "@/lib/applications";
import { driveLink } from "@/lib/policy";
import ReviewQueue from "./review-queue";
import { Mail, Phone, MapPin, BriefcaseBusiness, Building2, CalendarDays, Layers3 } from "lucide-react";
import styles from "./bosch-v2-candidates.module.css";
import { useLanguage } from "./language";

const PAGE_SIZE = 25;
type SourceOption = { sub_source: string; source: string; source_ownership: string };
type CandidateAttribution = { candidate_id: string; source: string | null; sub_source: string | null; created_at: string };

export default function TalentPool({ jobs, onAccessLost }: { jobs: Job[]; onAccessLost: () => void }) {
  const { locale } = useLanguage();
  const en = locale === "en";
  const tr = (vi: string, english: string) => en ? english : vi;
  const [view, setView] = useState<"pool" | "cv-review">("pool");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [attributionByCandidate, setAttributionByCandidate] = useState<Record<string, CandidateAttribution>>({});
  const [attributionError, setAttributionError] = useState(false);
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
        if (catalogError) setSourceLoadError("CATALOG_LOAD_FAILED");
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
    let current = true;
    setAttributionByCandidate({});
    setAttributionError(false);
    const ids = candidates.map((candidate) => candidate.id);
    if (!ids.length) return () => { current = false; };
    void getClient().from("applications")
      .select("candidate_id,source,sub_source,created_at")
      .in("candidate_id", ids)
      .order("created_at", { ascending: false })
      .then(({ data, error: queryError }) => {
        if (!current) return;
        if (queryError) {
          setAttributionError(true);
          return;
        }
        const latest: Record<string, CandidateAttribution> = {};
        for (const row of (data || []) as CandidateAttribution[]) {
          if (!latest[row.candidate_id]) latest[row.candidate_id] = row;
        }
        setAttributionByCandidate(latest);
      });
    return () => { current = false; };
  }, [candidates]);

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
    <nav className={styles.breadcrumb} aria-label={tr("Đường dẫn", "Breadcrumb")}>{tr("Ứng viên", "Candidates")} <span aria-hidden="true">›</span> {tr("Danh sách ứng viên", "Candidate Database")}</nav>
    <div className={styles.pageGrid}>
      <div className={styles.pageLeft}>
        <div className={styles.heading}>
          <div><h1>{tr("Ứng viên", "Candidates")}</h1><p>{tr("CV được duyệt sẽ xuất hiện ở đây. Chọn hồ sơ để xem CV và thêm ứng viên vào Job đang mở.", "Approved CVs appear here. Select a profile to view documents and assign the candidate to an open Job.")}</p></div>
          <button className={styles.primary} onClick={() => setView("cv-review")}>{tr("CV chờ duyệt", "Review CVs")}</button>
        </div>
        <nav className={styles.tabs} aria-label={tr("Mục ứng viên", "Candidate section")}>
          <span className={styles.active} aria-current="page">{tr("Danh sách ứng viên", "Candidate Database")}</span>
        </nav>
        <div className={styles.listCard} aria-busy={loading}>
          <div className={styles.toolbar}>
            <h2 className={styles.tableHeading}>{tr("Ứng viên", "Candidates")} ({candidates.length})</h2>
            <label className={styles.search}><span aria-hidden="true">⌕</span><input aria-label={tr("Tìm trong Talent Pool", "Search candidates")} placeholder={tr("Tìm tên, kỹ năng, công ty…", "Search name, skills, company…")} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            <span className={styles.muted}>{loading ? tr("Đang tải hồ sơ…", "Loading profiles…") : tr(`${candidates.length} hồ sơ trên trang`, `${candidates.length} candidates on this page`)}</span>
          </div>
          {error && <div className={`${styles.notice} ${styles.error}`} role="alert">{error}<button className={styles.retry} onClick={() => void load()}>{tr("Thử lại", "Retry")}</button></div>}
        {loading ? <p className={styles.empty}>{tr("Đang tải ứng viên…", "Loading candidates…")}</p> : candidates.length ? <div className={styles.scroll}><table className={styles.table}>
          <colgroup><col className={styles.checkCol}/><col className={styles.nameCol}/><col className={styles.jobCol}/><col className={styles.expCol}/><col className={styles.sourceCol}/></colgroup>
          <thead><tr>
            <th aria-label={tr("Chọn hồ sơ", "Select candidate")}></th>
            <th>{tr("Ứng viên", "Candidate")}</th>
            <th>{tr("Vị trí / Công ty", "Current Job / Company")}</th>
            <th>{tr("Kinh nghiệm", "Experience")}</th>
            <th title={tr("Nguồn và nguồn chi tiết của lần ứng tuyển gần nhất được phép xem", "Source and sub-source of latest accessible application")}>{tr("Nguồn", "Source")}</th>
          </tr></thead>
          <tbody>{candidates.map((candidate) => { const attribution = attributionByCandidate[candidate.id]; return <tr key={candidate.id} className={selectedId === candidate.id ? styles.selected : ""}>
            <td><input type="checkbox" aria-label={`${tr("Chọn", "Select")} ${candidate.full_name}`} checked={selectedId === candidate.id} onChange={()=>setSelectedId(candidate.id)}/></td>
            <td><button type="button" className={styles.candidateLink} title={candidate.full_name} aria-pressed={selectedId === candidate.id} onClick={() => setSelectedId(candidate.id)}>{candidate.full_name}</button></td>
            <td><div className={styles.jobCompany}>
              {(candidate.current_title || candidate.primary_role) ? <strong className={styles.jobTitle} title={candidate.current_title || candidate.primary_role || ""}>{candidate.current_title || candidate.primary_role}</strong> : candidate.current_company ? null : <span className={styles.placeholder}>—</span>}
              {candidate.current_company && ((candidate.current_title || candidate.primary_role) ? <small title={candidate.current_company}>{candidate.current_company}</small> : <strong className={styles.jobTitle} title={candidate.current_company}>{candidate.current_company}</strong>)}
            </div></td>
            <td className={candidate.total_experience_years == null ? styles.placeholder : undefined}>{candidate.total_experience_years == null ? "—" : `${candidate.total_experience_years} ${en ? "yrs" : "năm"}`}</td>
            <td><div className={styles.sourceCell}>
              {attribution?.source ? <span className={styles.sourceMain} title={attribution.source}>{attribution.source}</span> : attribution?.sub_source ? null : <span className={styles.placeholder}>—</span>}
              {attribution?.sub_source && <span className={styles.sourceSub} title={attribution.sub_source}>{attribution.sub_source}</span>}
            </div></td>
          </tr>; })}</tbody></table></div> : !error ? <div className={styles.empty}><h3>{tr("Talent Pool chưa có hồ sơ", "No candidates yet")}</h3><p>{tr("Thêm CV vào hàng chờ duyệt. Sau khi Admin/TA chấp thuận, ứng viên sẽ được đưa vào kho.", "Submit a CV for review. An Admin or Recruiter must approve it before the profile appears here.")}</p><button className={styles.secondary} onClick={() => setView("cv-review")}>{tr("Mở CV chờ duyệt", "Open CV review queue")}</button></div> : null}
        {attributionError && <p className={styles.notice} role="status">{tr("Chưa tải được nguồn ứng tuyển. Hãy thử tải lại trang.", "Could not load application sources. Please refresh the page.")}</p>}
        <div className={styles.pagination}><span className={styles.pageCount}>{candidates.length} {tr("ứng viên", "candidates")}</span><div className={styles.pagerControls}><button className={styles.secondary} aria-label={tr("Trang trước", "Previous")} title={tr("Trang trước", "Previous")} disabled={loading || offset === 0} onClick={() => void load(Math.max(0, offset - PAGE_SIZE), query)}>‹</button><span className={styles.currentPage} aria-label={`${tr("Trang", "Page")} ${offset / PAGE_SIZE + 1}`}>{offset / PAGE_SIZE + 1}</span><button className={styles.secondary} aria-label={tr("Trang sau", "Next")} title={tr("Trang sau", "Next")} disabled={loading || candidates.length < PAGE_SIZE} onClick={() => void load(offset + PAGE_SIZE, query)}>›</button></div></div>
        </div>
      </div>
      <aside className={styles.profileCard} aria-busy={detailLoading}>
        <div className={styles.profileScroll}>
        {detailLoading ? <p className={styles.empty}>{tr("Đang mở hồ sơ…", "Loading candidate profile…")}</p> : profile ? <>
          <div className={styles.profileHeader}><div><h3>{profile.candidate.full_name}</h3><p>{profile.candidate.current_title || profile.candidate.primary_role || tr("Chưa có chức danh", "Title unavailable")}</p></div></div>
          {profileError && <div className={`${styles.notice} ${styles.error}`} role="alert">{profileError}</div>}
          {message && <div className={`${styles.notice} ${styles.success}`} role="status">{message}</div>}
          <div className={styles.section}><h3 className={styles.subheading}>{tr("Liên hệ", "Contact")}</h3>
            <dl className={styles.iconFacts}>
              <dt><Mail size={16} aria-hidden="true"/><span>Email</span></dt><dd>{profile.candidate.email || "—"}</dd>
              <dt><Phone size={16} aria-hidden="true"/><span>{tr("Điện thoại", "Phone")}</span></dt><dd>{profile.candidate.phone || "—"}</dd>
              <dt><MapPin size={16} aria-hidden="true"/><span>{tr("Địa điểm", "Location")}</span></dt><dd>{profile.candidate.location || "—"}</dd>
            </dl></div>
          <div className={styles.section}><h3 className={styles.subheading}>{tr("Công việc hiện tại", "Current Role")}</h3>
            <dl className={styles.iconFacts}>
              <dt><BriefcaseBusiness size={16} aria-hidden="true"/><span>{tr("Vị trí", "Role")}</span></dt><dd>{profile.candidate.current_title || profile.candidate.primary_role || "—"}</dd>
              <dt><Building2 size={16} aria-hidden="true"/><span>{tr("Công ty", "Company")}</span></dt><dd>{profile.candidate.current_company || "—"}</dd>
              <dt><CalendarDays size={16} aria-hidden="true"/><span>{tr("Kinh nghiệm", "Experience")}</span></dt><dd>{profile.candidate.total_experience_years == null ? "—" : `${profile.candidate.total_experience_years} ${en ? "yrs" : "năm"}`}</dd>
              <dt><Layers3 size={16} aria-hidden="true"/><span>{tr("Cấp bậc", "Seniority")}</span></dt><dd>{profile.candidate.seniority || "—"}</dd>
            </dl></div>
          <div className={styles.section}><h3 className={styles.subheading}>{tr("CV / tài liệu", "CV / Documents")}</h3>
          {profile.documents.length ? <ul className={styles.documents}>{profile.documents.map((document) => <li key={`${document.drive_file_id}-${document.created_at}`}><span>{document.original_name}</span>{driveLink(document.drive_url) ? <a href={driveLink(document.drive_url)!} target="_blank" rel="noopener noreferrer">{tr("Mở CV ↗", "Open CV ↗")}</a> : <small>{tr("Link không hợp lệ", "Invalid link")}</small>}</li>)}</ul> : <p className={styles.muted}>{tr("Chưa có CV được lưu trong hồ sơ.", "No CV documents are saved on this profile.")}</p>}
          </div><div className={styles.section}><h3 className={styles.subheading}>{tr("Job đang tham gia", "Jobs")} ({profile.applications.filter((application) => jobs.some((job) => job.id === application.job_id)).length})</h3>
          {profile.applications.filter((application) => jobs.some((job) => job.id === application.job_id)).length ? <ul className={styles.jobAssignments}>{profile.applications.filter((application) => jobs.some((job) => job.id === application.job_id)).map((application) => { const assignedJob = jobs.find((job) => job.id === application.job_id); return <li key={application.id}>
            <strong className={styles.assignedJobTitle} title={assignedJob?.title}>{assignedJob?.title}</strong>
            {assignedJob?.business_unit && <span className={styles.jobDepartment}><BriefcaseBusiness aria-hidden="true" size={14}/>{assignedJob.business_unit}</span>}
            <div className={styles.jobMeta}><span className={`${styles.jobStage} ${application.stage === "INTERVIEW" ? styles.stageInterview : application.stage === "SCREEN" ? styles.stageScreen : styles.stageNeutral}`}>{application.stage}</span><span className={styles.jobStatus}>{application.status}</span></div>
          </li>; })}</ul> : <p className={styles.muted}>{tr("Chưa được thêm vào Job nào trong phạm vi bạn được xem.", "Not assigned to any Job you can access.")}</p>}
          </div><div className={styles.section}><h3 className={styles.subheading}>{tr("Thêm vào Job", "Add to Job")}</h3>{openJobs.filter((job) => !profile.applications.some((application) => application.job_id === job.id)).length ? <div className={styles.addControls}><select aria-label={tr("Chọn Job để thêm ứng viên", "Select Job to add candidate")} value={jobId} onChange={(event) => { setJobId(event.target.value); requestId.current = null; }}><option value="">{tr("Chọn Job đang mở", "Select an open Job")}</option>{openJobs.filter((job) => !profile.applications.some((application) => application.job_id === job.id)).map((job) => <option key={job.id} value={job.id}>{job.job_code ? `${job.job_code} · ` : ""}{job.title}</option>)}</select><select aria-label={tr("Chọn nguồn ứng viên", "Select candidate source")} value={subSource} onChange={(event) => { setSubSource(event.target.value); requestId.current = null; }} disabled={!!sourceLoadError}><option value="">{tr("Chọn nguồn ứng viên", "Select candidate source")}</option>{sourceOptions.map((source) => <option key={source.sub_source} value={source.sub_source}>{source.sub_source} · {source.source} · {source.source_ownership}</option>)}</select><button className={styles.primary} disabled={!jobId || !subSource || busy || !sourceOptions.length} onClick={() => void addToJob()}>{busy ? tr("Đang thêm…", "Adding…") : requestId.current ? tr("Thử lại", "Retry") : tr("Thêm vào Job", "Add to Job")}</button></div> : <p className={styles.muted}>{tr("Không có Job đang mở mà bạn có quyền thêm hồ sơ này.", "No eligible open Job is available for this candidate.")}</p>}{sourceLoadError && <p className={`${styles.notice} ${styles.error}`} role="alert">{tr("Không tải được danh mục nguồn tuyển dụng.", "Could not load the recruitment source catalog.")}</p>}</div>
        </> : profileError ? <div className={`${styles.notice} ${styles.error}`} role="alert">{profileError}</div> : <div className={styles.empty}><h3>{tr("Chọn một hồ sơ", "Select a candidate")}</h3><p>{tr("Thông tin chi tiết và các Job liên quan sẽ hiển thị tại đây.", "Profile details and related Jobs will appear here.")}</p></div>}
        </div>
      </aside>
    </div>
  </section>;
}
