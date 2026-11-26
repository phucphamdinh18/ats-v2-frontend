"use client";
import { readViewState, writeViewState } from "@/lib/view-state";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Job } from "@/lib/policy";
import { ApiError, getClient } from "@/lib/supabase";
import { candidateProfile, listCandidates, type Candidate, type CandidateProfile } from "@/lib/candidates";
import { createApplication } from "@/lib/applications";
import BoschCandidateDetail from "./bosch-candidate-detail";
import styles from "./bosch-v2-candidates.module.css";
import { useLanguage } from "./language";

const PAGE_SIZE = 25;
type SourceOption = { sub_source: string; source: string; source_ownership: string };
type CandidateAttribution = { candidate_id: string; source: string | null; sub_source: string | null; created_at: string };

export default function TalentPool({ jobs, onAccessLost, onOpenJob }: { jobs: Job[]; onAccessLost: () => void; onOpenJob?: (job: Job) => void }) {
  const { locale } = useLanguage();
  const en = locale === "en";
  const tr = (vi: string, english: string) => en ? english : vi;
  const [query, setQuery] = useState(() => readViewState("ats-v2:candidate-database-query", ""));
  const [offset, setOffset] = useState(0);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [attributionByCandidate, setAttributionByCandidate] = useState<Record<string, CandidateAttribution>>({});
  const [attributionError, setAttributionError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(() => readViewState("ats-v2:candidate-database-selection", null));
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
  useEffect(() => { writeViewState("ats-v2:candidate-database-query", query); }, [query]);
  useEffect(() => { writeViewState("ats-v2:candidate-database-selection", selectedId); }, [selectedId]);

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

  return <section className={styles.root} aria-label={tr("Talent Pool", "Candidate Database")}>
    <nav className={styles.breadcrumb} aria-label={tr("Đường dẫn", "Breadcrumb")}>{tr("Ứng viên", "Candidates")} <span aria-hidden="true">›</span> {tr("Danh sách ứng viên", "Candidate Database")}</nav>
    <div className={styles.pageGrid}>
      <div className={styles.pageLeft}>
        <div className={styles.heading}>
          <div><h1>{tr("Ứng viên", "Candidates")}</h1><p>{tr("Chọn hồ sơ để xem CV và thêm ứng viên vào Job đang mở.", "Select a profile to view documents and assign the candidate to an open Job.")}</p></div>
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
          </tr>; })}</tbody></table></div> : !error ? <div className={styles.empty}><h3>{tr("Talent Pool chưa có hồ sơ", "No candidates yet")}</h3><p>{tr("Bạn có thể thêm ứng viên từ một Job đang mở tuyển.", "Add a candidate from an open Job to get started.")}</p></div> : null}
        {attributionError && <p className={styles.notice} role="status">{tr("Chưa tải được nguồn ứng tuyển. Hãy thử tải lại trang.", "Could not load application sources. Please refresh the page.")}</p>}
        <div className={styles.pagination}><span className={styles.pageCount}>{candidates.length} {tr("ứng viên", "candidates")}</span><div className={styles.pagerControls}><button className={styles.secondary} aria-label={tr("Trang trước", "Previous")} title={tr("Trang trước", "Previous")} disabled={loading || offset === 0} onClick={() => void load(Math.max(0, offset - PAGE_SIZE), query)}>‹</button><span className={styles.currentPage} aria-label={`${tr("Trang", "Page")} ${offset / PAGE_SIZE + 1}`}>{offset / PAGE_SIZE + 1}</span><button className={styles.secondary} aria-label={tr("Trang sau", "Next")} title={tr("Trang sau", "Next")} disabled={loading || candidates.length < PAGE_SIZE} onClick={() => void load(offset + PAGE_SIZE, query)}>›</button></div></div>
        </div>
      </div>
      <aside className={styles.profileCard} aria-busy={detailLoading}>
        <div className={styles.profileScroll}>
        {detailLoading ? <p className={styles.empty}>{tr("Đang mở hồ sơ…", "Loading candidate profile…")}</p>
          : profile ? <BoschCandidateDetail
              key={selectedId || profile.candidate.id}
              profile={profile} jobs={jobs} openJobs={openJobs} en={en}
              jobId={jobId} subSource={subSource} sourceOptions={sourceOptions}
              sourceLoadError={sourceLoadError} busy={busy} message={message}
              profileError={profileError} requestRetry={!!requestId.current}
              onJobChange={(value) => { setJobId(value); requestId.current = null; }}
              onSourceChange={(value) => { setSubSource(value); requestId.current = null; }}
              onAddToJob={() => void addToJob()}
              onOpenJob={onOpenJob}
              hasPrevious={candidates.findIndex((candidate) => candidate.id === selectedId) > 0}
              hasNext={candidates.findIndex((candidate) => candidate.id === selectedId) >= 0 && candidates.findIndex((candidate) => candidate.id === selectedId) < candidates.length - 1}
              onPrevious={() => { const ix = candidates.findIndex((candidate) => candidate.id === selectedId); if (ix > 0) setSelectedId(candidates[ix - 1].id); }}
              onNext={() => { const ix = candidates.findIndex((candidate) => candidate.id === selectedId); if (ix >= 0 && ix < candidates.length - 1) setSelectedId(candidates[ix + 1].id); }}
            />
          : profileError ? <div className={`${styles.notice} ${styles.error}`} role="alert">{profileError}</div>
          : <div className={styles.empty}><h3>{tr("Chọn một hồ sơ", "Select a candidate")}</h3><p>{tr("Thông tin chi tiết và các Job liên quan sẽ hiển thị tại đây.", "Profile details and related Jobs will appear here.")}</p></div>}
        </div>
      </aside>
    </div>
  </section>;
}
