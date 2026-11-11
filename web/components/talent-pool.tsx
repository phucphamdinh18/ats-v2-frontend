"use client";
import { useUiText, useUiNotice, useUiError } from "./ui-text";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Job } from "@/lib/policy";
import { ApiError, getClient } from "@/lib/supabase";
import {
  candidateProfile,
  listCandidates,
  type Candidate,
  type CandidateProfile,
} from "@/lib/candidates";
import { createApplication } from "@/lib/applications";
import { driveLink } from "@/lib/policy";
import ReviewQueue from "./review-queue";
const PAGE_SIZE = 25;
type SourceOption = {
  sub_source: string;
  source: string;
  source_ownership: string;
};
export default function TalentPool({
  jobs,
  onAccessLost,
}: {
  jobs: Job[];
  onAccessLost: () => void;
}) {
  const tr = useUiText();
  const notice = useUiNotice();
  const errorText = useUiError();
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
  const requestId = useRef<{
    key: string;
    id: string;
  } | null>(null);
  const listRevision = useRef(0);
  const profileRevision = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openJobs = jobs.filter((job) => job.status === "OPEN");
  useEffect(() => {
    let current = true;
    void getClient()
      .from("hiring_source_catalog")
      .select("sub_source,source,source_ownership")
      .order("source")
      .order("sub_source")
      .then(({ data, error: catalogError }) => {
        if (!current) return;
        if (catalogError)
          setSourceLoadError(tr("Không tải được danh mục nguồn tuyển dụng."));
        else setSourceOptions((data || []) as SourceOption[]);
      });
    return () => {
      current = false;
    };
  }, []);
  const load = useCallback(
    async (nextOffset = offset, nextQuery = query) => {
      const revision = ++listRevision.current;
      setLoading(true);
      setError("");
      try {
        const result = await listCandidates(nextQuery, PAGE_SIZE, nextOffset);
        if (revision !== listRevision.current) return;
        setCandidates(result.candidates || []);
        setOffset(nextOffset);
        setSelectedId((current) =>
          result.candidates.some((candidate) => candidate.id === current)
            ? current
            : (result.candidates[0]?.id ?? null),
        );
      } catch (cause) {
        if (revision !== listRevision.current) return;
        setCandidates([]);
        const apiError = cause instanceof ApiError ? cause : undefined;
        if (apiError?.status === 401) onAccessLost();
        setError(
          cause instanceof Error
            ? cause.message
            : tr("Không tải được Talent Pool."),
        );
      } finally {
        if (revision === listRevision.current) setLoading(false);
      }
    },
    [offset, query, onAccessLost],
  );
  useEffect(() => {
    searchTimer.current = setTimeout(() => void load(0, query), 250);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      listRevision.current += 1;
      profileRevision.current += 1;
    };
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!selectedId) {
      setProfile(null);
      return;
    }
    const revision = ++profileRevision.current;
    setProfile(null);
    setProfileError("");
    setDetailLoading(true);
    void candidateProfile(selectedId)
      .then((result) => {
        if (revision === profileRevision.current) setProfile(result);
      })
      .catch((cause: unknown) => {
        if (revision !== profileRevision.current) return;
        if (cause instanceof ApiError && cause.status === 401) onAccessLost();
        setProfileError(
          cause instanceof Error
            ? cause.message
            : tr("Không tải được hồ sơ ứng viên."),
        );
      })
      .finally(() => {
        if (revision === profileRevision.current) setDetailLoading(false);
      });
    return () => {
      profileRevision.current += 1;
    };
  }, [selectedId, onAccessLost]);
  useEffect(() => {
    if (
      profile &&
      !openJobs.some(
        (job) =>
          job.id === jobId &&
          !profile.applications.some((app) => app.job_id === job.id),
      )
    ) {
      setJobId(
        openJobs.find(
          (job) => !profile.applications.some((app) => app.job_id === job.id),
        )?.id || "",
      );
    }
  }, [profile, jobId, jobs]);
  async function addToJob() {
    if (!profile || !selectedId || !jobId || !subSource || busy) return;
    const sourceOption = sourceOptions.find(
      (item) => item.sub_source === subSource,
    );
    if (!sourceOption) return;
    const job = openJobs.find((item) => item.id === jobId);
    if (
      !job ||
      profile.applications.some((application) => application.job_id === job.id)
    )
      return;
    if (
      !window.confirm(
        tr("Thêm {0} vào {1}? Ứng viên sẽ được đưa vào vòng Mới ứng tuyển.", [
          profile.candidate.full_name,
          job.title,
        ]),
      )
    )
      return;
    const key = `${selectedId}:${jobId}:${subSource}`;
    const request =
      requestId.current?.key === key
        ? requestId.current.id
        : crypto.randomUUID();
    requestId.current = { key, id: request };
    setBusy(true);
    setMessage("");
    setProfileError("");
    try {
      await createApplication(
        selectedId,
        jobId,
        request,
        sourceOption.source,
        sourceOption.sub_source,
      );
      requestId.current = null;
      setMessage(
        tr("Đã thêm vào Job “{0}”. Ứng viên xuất hiện ở vòng Mới ứng tuyển.", [
          job.title,
        ]),
      );
      await load(offset, query);
      const nextProfile = await candidateProfile(selectedId);
      setProfile(nextProfile);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onAccessLost();
      setProfileError(
        cause instanceof Error
          ? cause.message
          : tr("Không thêm được ứng viên vào Job."),
      );
    } finally {
      setBusy(false);
    }
  }
  if (view === "cv-review")
    return (
      <section className="panel talent-page">
        <div className="talent-heading">
          <div>
            <span className="eyebrow">{tr("Talent Pool")}</span>
            <h2>{tr("CV cần duyệt")}</h2>
            <p>
              {tr(
                "Duyệt CV trước; CV được chấp thuận sẽ trở thành hồ sơ trong Talent Pool.",
              )}
            </p>
          </div>
          <button className="secondary" onClick={() => setView("pool")}>
            {tr("Quay lại Talent Pool")}
          </button>
        </div>
        <ReviewQueue fixedKind="cv" onAccessLost={onAccessLost} />
      </section>
    );
  return (
    <section className="panel talent-page" aria-label="Talent Pool">
      <div className="talent-heading">
        <div>
          <span className="eyebrow">{tr("Talent Pool")}</span>
          <h2>{tr("Kho ứng viên")}</h2>
          <p>
            {tr(
              "CV được duyệt sẽ xuất hiện ở đây. Chọn hồ sơ để xem CV và thêm ứng viên vào Job đang mở.",
            )}
          </p>
        </div>
        <button className="primary" onClick={() => setView("cv-review")}>
          {tr("CV chờ duyệt")}
        </button>
      </div>
      <div className="talent-toolbar">
        <label className="search">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label={tr("Tìm trong Talent Pool")}
            placeholder={tr("Tìm tên, kỹ năng, công ty…")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <span className="muted">
          {loading
            ? tr("Đang tải hồ sơ…")
            : tr("{0} hồ sơ trên trang", [candidates.length])}
        </span>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {errorText(error)}
          <button className="quiet" onClick={() => void load()}>
            {tr("Thử lại")}
          </button>
        </div>
      )}
      <div className="talent-grid">
        <div className="talent-list" aria-busy={loading}>
          {loading ? (
            <p className="talent-empty">{tr("Đang tải ứng viên…")}</p>
          ) : candidates.length ? (
            candidates.map((candidate) => (
              <button
                key={candidate.id}
                className={`talent-item ${selectedId === candidate.id ? "selected" : ""}`}
                aria-pressed={selectedId === candidate.id}
                onClick={() => setSelectedId(candidate.id)}
              >
                <span className="talent-avatar" aria-hidden="true">
                  {candidate.full_name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="talent-item-copy">
                  <strong>{candidate.full_name}</strong>
                  <small>
                    {candidate.current_title ||
                      candidate.primary_role ||
                      tr("Chưa có chức danh")}
                  </small>
                  <small>
                    {[candidate.current_company, candidate.location]
                      .filter(Boolean)
                      .join(" · ") ||
                      tr("Chưa có thông tin công ty / địa điểm")}
                  </small>
                </span>
                <span className="talent-chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            ))
          ) : !error ? (
            <div className="talent-empty">
              <h3>{tr("Talent Pool chưa có hồ sơ")}</h3>
              <p>
                {tr(
                  "Thêm CV vào hàng chờ duyệt. Sau khi Admin/TA chấp thuận, ứng viên sẽ được đưa vào kho.",
                )}
              </p>
              <button
                className="secondary"
                onClick={() => setView("cv-review")}
              >
                {tr("Mở CV chờ duyệt")}
              </button>
            </div>
          ) : null}
          <div className="pagination">
            <button
              className="secondary"
              disabled={loading || offset === 0}
              onClick={() => void load(Math.max(0, offset - PAGE_SIZE), query)}
            >
              {tr("Trang trước")}
            </button>
            <span>
              {tr("Trang")} {offset / PAGE_SIZE + 1}
            </span>
            <button
              className="secondary"
              disabled={loading || candidates.length < PAGE_SIZE}
              onClick={() => void load(offset + PAGE_SIZE, query)}
            >
              {tr("Trang sau")}
            </button>
          </div>
        </div>
        <div className="talent-profile" aria-busy={detailLoading}>
          {detailLoading ? (
            <p className="talent-empty">{tr("Đang mở hồ sơ…")}</p>
          ) : profile ? (
            <>
              <div className="talent-profile-heading">
                <span className="talent-avatar large" aria-hidden="true">
                  {profile.candidate.full_name.trim().charAt(0).toUpperCase()}
                </span>
                <div>
                  <h3>{profile.candidate.full_name}</h3>
                  <p>
                    {profile.candidate.current_title ||
                      profile.candidate.primary_role ||
                      tr("Chưa có chức danh")}
                  </p>
                </div>
              </div>
              {profileError && (
                <div className="notice error" role="alert">
                  {errorText(profileError)}
                </div>
              )}
              {message && (
                <div className="notice success" role="status">
                  {notice(message)}
                </div>
              )}
              <dl className="talent-facts">
                <dt>{tr("Email")}</dt>
                <dd>{profile.candidate.email || "—"}</dd>
                <dt>{tr("Điện thoại")}</dt>
                <dd>{profile.candidate.phone || "—"}</dd>
                <dt>{tr("Công ty hiện tại")}</dt>
                <dd>{profile.candidate.current_company || "—"}</dd>
                <dt>{tr("Kinh nghiệm")}</dt>
                <dd>
                  {profile.candidate.total_experience_years == null
                    ? "—"
                    : tr("{0} năm", [profile.candidate.total_experience_years])}
                </dd>
                <dt>{tr("Cấp bậc")}</dt>
                <dd>{profile.candidate.seniority || "—"}</dd>
                <dt>{tr("Địa điểm")}</dt>
                <dd>{profile.candidate.location || "—"}</dd>
              </dl>
              <h3 className="talent-subheading">{tr("CV / tài liệu")}</h3>
              {profile.documents.length ? (
                <ul className="talent-documents">
                  {profile.documents.map((document) => (
                    <li
                      key={`${document.drive_file_id}-${document.created_at}`}
                    >
                      <span>{document.original_name}</span>
                      {driveLink(document.drive_url) ? (
                        <a
                          href={driveLink(document.drive_url)!}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {tr("Mở CV ↗")}
                        </a>
                      ) : (
                        <small>{tr("Link không hợp lệ")}</small>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">
                  {tr("Chưa có CV được lưu trong hồ sơ.")}
                </p>
              )}
              <h3 className="talent-subheading">{tr("Đang tham gia Job")}</h3>
              {profile.applications.filter((application) =>
                jobs.some((job) => job.id === application.job_id),
              ).length ? (
                <ul className="talent-applications">
                  {profile.applications
                    .filter((application) =>
                      jobs.some((job) => job.id === application.job_id),
                    )
                    .map((application) => (
                      <li key={application.id}>
                        <strong>
                          {
                            jobs.find((job) => job.id === application.job_id)
                              ?.title
                          }
                        </strong>
                        <span>
                          {tr(application.stage)} · {tr(application.status)}
                        </span>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="muted">
                  {tr("Chưa được thêm vào Job nào trong phạm vi bạn được xem.")}
                </p>
              )}
              <div className="add-to-job">
                <h3>{tr("Thêm vào Job")}</h3>
                {openJobs.filter(
                  (job) =>
                    !profile.applications.some(
                      (application) => application.job_id === job.id,
                    ),
                ).length ? (
                  <div className="add-to-job-control">
                    <select
                      aria-label={tr("Chọn Job để thêm ứng viên")}
                      value={jobId}
                      onChange={(event) => {
                        setJobId(event.target.value);
                        requestId.current = null;
                      }}
                    >
                      <option value="">{tr("Chọn Job đang mở")}</option>
                      {openJobs
                        .filter(
                          (job) =>
                            !profile.applications.some(
                              (application) => application.job_id === job.id,
                            ),
                        )
                        .map((job) => (
                          <option key={job.id} value={job.id}>
                            {job.job_code ? `${job.job_code} · ` : ""}
                            {job.title}
                          </option>
                        ))}
                    </select>
                    <select
                      aria-label={tr("Chọn nguồn ứng viên")}
                      value={subSource}
                      onChange={(event) => {
                        setSubSource(event.target.value);
                        requestId.current = null;
                      }}
                      disabled={!!sourceLoadError}
                    >
                      <option value="">{tr("Chọn nguồn ứng viên")}</option>
                      {sourceOptions.map((source) => (
                        <option
                          key={source.sub_source}
                          value={source.sub_source}
                        >
                          {source.sub_source} · {source.source} ·{" "}
                          {source.source_ownership}
                        </option>
                      ))}
                    </select>
                    <button
                      className="primary"
                      disabled={
                        !jobId || !subSource || busy || !sourceOptions.length
                      }
                      onClick={() => void addToJob()}
                    >
                      {busy
                        ? tr("Đang thêm…")
                        : requestId.current
                          ? tr("Thử lại")
                          : tr("Thêm vào Job")}
                    </button>
                  </div>
                ) : (
                  <p className="muted">
                    {tr("Không có Job đang mở mà bạn có quyền thêm hồ sơ này.")}
                  </p>
                )}
                {sourceLoadError && (
                  <p className="notice error" role="alert">
                    {errorText(sourceLoadError)}
                  </p>
                )}
              </div>
            </>
          ) : profileError ? (
            <div className="notice error" role="alert">
              {errorText(profileError)}
            </div>
          ) : (
            <div className="talent-empty">
              <h3>{tr("Chọn một hồ sơ")}</h3>
              <p>
                {tr(
                  "Thông tin chi tiết và các Job liên quan sẽ hiển thị tại đây.",
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
