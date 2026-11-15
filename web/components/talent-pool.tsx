"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Job } from "@/lib/policy";
import { ApiError, getClient } from "@/lib/supabase";
import { candidateProfile, listCandidates, type Candidate, type CandidateProfile } from "@/lib/candidates";
import { createApplication } from "@/lib/applications";
import { driveLink } from "@/lib/policy";
import ReviewQueue from "./review-queue";
import styles from "./bosch-v2-candidates.module.css";

const PAGE_SIZE = 25;
type SourceOption = { sub_source: string; source: string; source_ownership: string };

export default function TalentPool({ jobs, onAccessLost }: { jobs: Job[]; onAccessLost: () => void }) {
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
        if (catalogError) setSourceLoadError("Không tải được danh mục nguồn tuyển dụng.");
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
      setError(cause instanceof Error ? cause.message : "Không tải được Talent Pool.");
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
      setProfileError(cause instanceof Error ? cause.message : "Không tải được hồ sơ ứng viên.");
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
    if (!window.confirm(`Thêm ${profile.candidate.full_name} vào ${job.title}? Ứng viên sẽ được đưa vào vòng Mới ứng tuyển.`)) return;
    const key = `${selectedId}:${jobId}:${subSource}`;
    const request = requestId.current?.key === key ? requestId.current.id : crypto.randomUUID();
    requestId.current = { key, id: request };
    setBusy(true);
    setMessage("");
    setProfileError("");
    try {
      await createApplication(selectedId, jobId, request, sourceOption.source, sourceOption.sub_source);
      requestId.current = null;
      setMessage(`Đã thêm vào Job “${job.title}”. Ứng viên xuất hiện ở vòng Mới ứng tuyển.`);
      await load(offset, query);
      const nextProfile = await candidateProfile(selectedId);
      setProfile(nextProfile);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onAccessLost();
      setProfileError(cause instanceof Error ? cause.message : "Không thêm được ứng viên vào Job.");
    } finally {
      setBusy(false);
    }
  }

  if (view === "cv-review") return <section className={styles.root}>
    <div className={styles.heading}><div><span className={styles.eyebrow}>Talent Pool</span><h2>CV cần duyệt</h2><p>Duyệt CV trước; CV được chấp thuận sẽ trở thành hồ sơ trong Talent Pool.</p></div><button className={styles.secondary} onClick={() => setView("pool")}>Quay lại Talent Pool</button></div>
    <ReviewQueue fixedKind="cv" onAccessLost={onAccessLost} />
  </section>;

  return <section className={styles.root} aria-label="Talent Pool">
    <div className={styles.heading}><div><span className={styles.eyebrow}>CANDIDATE DATABASE</span><h2>Candidates</h2><p>CV được duyệt sẽ xuất hiện ở đây. Chọn hồ sơ để xem CV và thêm ứng viên vào Job đang mở.</p></div><button className={styles.primary} onClick={() => setView("cv-review")}>CV chờ duyệt</button></div>
    <div className={styles.toolbar}>
      <label className={styles.search}><span aria-hidden="true">⌕</span><input aria-label="Tìm trong Talent Pool" placeholder="Tìm tên, kỹ năng, công ty…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <span className={styles.muted}>{loading ? "Đang tải hồ sơ…" : `${candidates.length} hồ sơ trên trang`}</span>
    </div>
    {error && <div className={`${styles.notice} ${styles.error}`} role="alert">{error}<button className={styles.retry} onClick={() => void load()}>Thử lại</button></div>}
    <div className={styles.layout}>
      <div className={styles.listCard} aria-busy={loading}>
        {loading ? <p className={styles.empty}>Đang tải ứng viên…</p> : candidates.length ? <div className={styles.scroll}><table className={styles.table}><thead><tr><th aria-label="Selection"></th><th>Candidate</th><th>Current Job / Company</th><th>Stage</th><th>Interview Round</th><th>Matching</th><th>Experience</th><th>Source</th><th>Last Activity</th></tr></thead><tbody>{candidates.map((candidate) => <tr key={candidate.id} className={selectedId === candidate.id ? styles.selected : ""}><td><input type="checkbox" aria-label={`Chọn ${candidate.full_name}`} checked={selectedId === candidate.id} onChange={()=>setSelectedId(candidate.id)}/></td><td><button type="button" className={styles.candidateLink} aria-pressed={selectedId === candidate.id} onClick={() => setSelectedId(candidate.id)}>{candidate.full_name}</button></td><td><strong className={styles.jobTitle}>{candidate.current_title || candidate.primary_role || "—"}</strong><small>{candidate.current_company || "—"}</small></td><td title="Stage is Job-specific and not returned by Candidate list API">—</td><td title="Interview rounds are Job-specific">—</td><td title="No matching score in Candidate list API">—</td><td>{candidate.total_experience_years == null ? "—" : `${candidate.total_experience_years} yrs`}</td><td>—</td><td>—</td></tr>)}</tbody></table></div> : !error ? <div className={styles.empty}><h3>Talent Pool chưa có hồ sơ</h3><p>Thêm CV vào hàng chờ duyệt. Sau khi Admin/TA chấp thuận, ứng viên sẽ được đưa vào kho.</p><button className={styles.secondary} onClick={() => setView("cv-review")}>Mở CV chờ duyệt</button></div> : null}
        <div className={styles.pagination}><button className={styles.secondary} disabled={loading || offset === 0} onClick={() => void load(Math.max(0, offset - PAGE_SIZE), query)}>Trang trước</button><span>Trang {offset / PAGE_SIZE + 1}</span><button className={styles.secondary} disabled={loading || candidates.length < PAGE_SIZE} onClick={() => void load(offset + PAGE_SIZE, query)}>Trang sau</button></div>
      </div>
      <div className={styles.profileCard} aria-busy={detailLoading}>
        {detailLoading ? <p className={styles.empty}>Đang mở hồ sơ…</p> : profile ? <>
          <div className={styles.profileHeader}><span className={styles.avatar} aria-hidden="true">{profile.candidate.full_name.trim().charAt(0).toUpperCase()}</span><div><h3>{profile.candidate.full_name}</h3><p>{profile.candidate.current_title || profile.candidate.primary_role || "Chưa có chức danh"}</p></div></div>
          {profileError && <div className={`${styles.notice} ${styles.error}`} role="alert">{profileError}</div>}
          {message && <div className={`${styles.notice} ${styles.success}`} role="status">{message}</div>}
          <div className={styles.section}><h3 className={styles.subheading}>Thông tin ứng viên</h3><dl className={styles.facts}>
            <dt>Email</dt><dd>{profile.candidate.email || "—"}</dd>
            <dt>Điện thoại</dt><dd>{profile.candidate.phone || "—"}</dd>
            <dt>Công ty hiện tại</dt><dd>{profile.candidate.current_company || "—"}</dd>
            <dt>Kinh nghiệm</dt><dd>{profile.candidate.total_experience_years == null ? "—" : `${profile.candidate.total_experience_years} năm`}</dd>
            <dt>Cấp bậc</dt><dd>{profile.candidate.seniority || "—"}</dd>
            <dt>Địa điểm</dt><dd>{profile.candidate.location || "—"}</dd>
          </dl></div>
          <div className={styles.section}><h3 className={styles.subheading}>CV / tài liệu</h3>
          {profile.documents.length ? <ul className={styles.documents}>{profile.documents.map((document) => <li key={`${document.drive_file_id}-${document.created_at}`}><span>{document.original_name}</span>{driveLink(document.drive_url) ? <a href={driveLink(document.drive_url)!} target="_blank" rel="noopener noreferrer">Mở CV ↗</a> : <small>Link không hợp lệ</small>}</li>)}</ul> : <p className={styles.muted}>Chưa có CV được lưu trong hồ sơ.</p>}
          </div><div className={styles.section}><h3 className={styles.subheading}>Đang tham gia Job</h3>
          {profile.applications.filter((application) => jobs.some((job) => job.id === application.job_id)).length ? <ul className={styles.applications}>{profile.applications.filter((application) => jobs.some((job) => job.id === application.job_id)).map((application) => <li key={application.id}><strong>{jobs.find((job) => job.id === application.job_id)?.title}</strong><span>{application.stage} · {application.status}</span></li>)}</ul> : <p className={styles.muted}>Chưa được thêm vào Job nào trong phạm vi bạn được xem.</p>}
          </div><div className={styles.section}><h3 className={styles.subheading}>Thêm vào Job</h3>{openJobs.filter((job) => !profile.applications.some((application) => application.job_id === job.id)).length ? <div className={styles.addControls}><select aria-label="Chọn Job để thêm ứng viên" value={jobId} onChange={(event) => { setJobId(event.target.value); requestId.current = null; }}><option value="">Chọn Job đang mở</option>{openJobs.filter((job) => !profile.applications.some((application) => application.job_id === job.id)).map((job) => <option key={job.id} value={job.id}>{job.job_code ? `${job.job_code} · ` : ""}{job.title}</option>)}</select><select aria-label="Chọn nguồn ứng viên" value={subSource} onChange={(event) => { setSubSource(event.target.value); requestId.current = null; }} disabled={!!sourceLoadError}><option value="">Chọn nguồn ứng viên</option>{sourceOptions.map((source) => <option key={source.sub_source} value={source.sub_source}>{source.sub_source} · {source.source} · {source.source_ownership}</option>)}</select><button className={styles.primary} disabled={!jobId || !subSource || busy || !sourceOptions.length} onClick={() => void addToJob()}>{busy ? "Đang thêm…" : requestId.current ? "Thử lại" : "Thêm vào Job"}</button></div> : <p className={styles.muted}>Không có Job đang mở mà bạn có quyền thêm hồ sơ này.</p>}{sourceLoadError && <p className={`${styles.notice} ${styles.error}`} role="alert">{sourceLoadError}</p>}</div>
        </> : profileError ? <div className={`${styles.notice} ${styles.error}`} role="alert">{profileError}</div> : <div className={styles.empty}><h3>Chọn một hồ sơ</h3><p>Thông tin chi tiết và các Job liên quan sẽ hiển thị tại đây.</p></div>}
      </div>
    </div>
  </section>;
}
