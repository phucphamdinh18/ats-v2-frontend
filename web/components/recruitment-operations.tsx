"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listApplications, applicationDetail, type Application, type ApplicationDetail } from "@/lib/applications";
import { listOfferBoard, type OfferBoardItem } from "@/lib/offers";
import type { Job } from "@/lib/policy";
import { ApiError } from "@/lib/supabase";
import { useLanguage } from "./language";

const PAGE_SIZE = 25;
type Mode = "interviews" | "offers";
type Row = { key: string; application: Application; status: string };
function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Không tải được dữ liệu.";
}
function stageText(stage: string, locale: "vi" | "en"): string {
  const labels: Record<string, string> = locale === "en"
    ? { NEW: "New application", SCREEN: "Screening", INTERVIEW: "Interview", OFFER: "Offer", HIRED: "Hired", REJECTED: "Rejected" }
    : { NEW: "Mới ứng tuyển", SCREEN: "Sơ loại", INTERVIEW: "Phỏng vấn", OFFER: "Đề nghị tuyển dụng", HIRED: "Đã tuyển", REJECTED: "Từ chối" };
  return labels[stage] || stage;
}

/**
 * Read-only operational views, using only existing job-scoped APIs.
 * Interview rounds and compensation are deliberately not fabricated.
 * Existing application stage transitions and Offer approval logic live elsewhere.
 */
export default function RecruitmentOperations({ mode, jobs, onAccessLost }: {
  mode: Mode; jobs: Job[]; onAccessLost: () => void;
}) {
  const { locale } = useLanguage();
  const en = locale === "en";
  const [jobId, setJobId] = useState(jobs[0]?.id || "");
  const [offset, setOffset] = useState(0);
  const [pageResultCount, setPageResultCount] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const revision = useRef(0);
  const detailRevision = useRef(0);
  const job = jobs.find((item) => item.id === jobId) || null;

  const load = useCallback(async (id: string, nextOffset: number) => {
    const ticket = ++revision.current;
    detailRevision.current += 1;
    setSelectedId(null);
    setDetail(null);
    setDetailError("");
    setLoading(true);
    setError("");
    setRows([]);
    setPageResultCount(0);
    if (!id) { setLoading(false); return; }
    try {
      let result: Row[];
      if (mode === "offers") {
        const response = await listOfferBoard(id);
        result = response.applications.map((item: OfferBoardItem) => ({
          key: item.application_id, application: item.application, status: item.offer_status,
        }));
      } else {
        const response = await listApplications(id, PAGE_SIZE, nextOffset);
        if (ticket === revision.current) setPageResultCount(response.applications.length);
        result = response.applications.filter((item) => item.stage === "INTERVIEW").map((item) => ({
          key: item.application_id, application: item, status: item.status,
        }));
      }
      if (ticket !== revision.current) return;
      setRows(result);
      setOffset(nextOffset);
    } catch (cause) {
      if (ticket !== revision.current) return;
      setError(safeMessage(cause));
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) onAccessLost();
    } finally {
      if (ticket === revision.current) setLoading(false);
    }
  }, [mode, onAccessLost]);

  useEffect(() => {
    const current = jobs.some((item) => item.id === jobId) ? jobId : (jobs[0]?.id || "");
    if (current !== jobId) setJobId(current);
    void load(current, 0);
    return () => { revision.current += 1; detailRevision.current += 1; };
    // jobId changes from the controlled selector; load is explicitly invoked there
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, jobs]);

  async function selectRow(row: Row) {
    const ticket = ++detailRevision.current;
    setSelectedId(row.key);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const result = await applicationDetail(jobId, row.key);
      if (ticket === detailRevision.current) setDetail(result);
    } catch (cause) {
      if (ticket === detailRevision.current) {
        setDetailError(safeMessage(cause));
        if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) onAccessLost();
      }
    } finally {
      if (ticket === detailRevision.current) setDetailLoading(false);
    }
  }
  const isOffers = mode === "offers";
  const pending = rows.filter((item) => item.status === "PENDING").length;
  const approved = rows.filter((item) => item.status === "APPROVED").length;
  const chosen = rows.find((item) => item.key === selectedId);
  return <section className="ops-workspace" aria-label={isOffers ? "Offer workspace" : "Interview workspace"}>
    <div className="ops-controls">
      <div>
        <h2>{isOffers ? (en ? "Offers" : "Đề nghị tuyển dụng") : (en ? "Interviews" : "Phỏng vấn")}</h2>
        <p>{isOffers ? (en ? "Offers for Jobs you can access." : "Danh sách đề nghị tuyển dụng trong phạm vi bạn được xem.") : (en ? "Candidates currently at the Interview stage for each Job." : "Danh sách ứng viên đang ở vòng phỏng vấn theo từng vị trí.")}</p>
      </div>
      <label className="ops-job-selector">
        <span>{en ? "Job opening" : "Vị trí tuyển dụng"}</span>
        <select aria-label="Chọn Job" value={jobId} onChange={(event) => {
          setJobId(event.target.value);
          void load(event.target.value, 0);
        }}>
          {jobs.length === 0 && <option value="">{en ? "No assigned job openings" : "Chưa có vị trí được phân công"}</option>}
          {jobs.map((item) => <option key={item.id} value={item.id}>{item.job_code || "—"} · {item.title}</option>)}
        </select>
      </label>
    </div>
    <div className="ops-content">
      <div className="ops-primary">
        <div className="ops-summary" aria-label="Tóm tắt trạng thái trên trang">
          {isOffers ? <>
            <div><span>{en ? "Offers returned" : "Đề nghị tuyển dụng"}</span><strong>{rows.length}</strong></div>
            <div><span>{en ? "Pending approval" : "Chờ duyệt"}</span><strong>{pending}</strong></div>
            <div><span>{en ? "Approved" : "Đã duyệt"}</span><strong>{approved}</strong></div>
          </> : <>
            <div><span>{en ? "Interviews on this page" : "Lịch trong trang"}</span><strong>{rows.length}</strong></div>
            <div><span>{en ? "Job" : "Vị trí"}</span><strong>{job?.job_code || "—"}</strong></div>
            <div><span>{en ? "Showing" : "Hiển thị"}</span><strong>{PAGE_SIZE} / {en ? "page" : "trang"}</strong></div>
          </>}
        </div>
        {error && <div className="notice error" role="alert">{error} <button type="button" className="quiet" onClick={() => void load(jobId, offset)}>Thử lại</button></div>}
        {loading ? <p role="status" className="ops-empty">Đang tải dữ liệu…</p> : <div className="ops-table-wrap">
          <table className="ops-table">
            <thead><tr><th>{en ? "Candidate" : "Ứng viên"}</th><th>{en ? "Job opening" : "Vị trí tuyển dụng"}</th><th>{isOffers ? (en ? "Offer status" : "Trạng thái đề nghị") : (en ? "Stage" : "Vòng tuyển dụng")}</th><th>{en ? "Application status" : "Trạng thái hồ sơ"}</th><th>{en ? "Source" : "Nguồn"}</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.key} className={selectedId === row.key ? "selected" : ""}>
              <td><button type="button" onClick={() => void selectRow(row)}>{row.application.candidate_name}</button></td>
              <td>{job?.job_code || job?.title || "—"}</td>
              <td><span className="ops-status">{isOffers ? (row.status === "PENDING" ? (en ? "Pending" : "Chờ duyệt") : row.status === "APPROVED" ? (en ? "Approved" : "Đã duyệt") : row.status) : stageText(row.application.stage, locale)}</span></td>
              <td>{row.application.status}</td>
              <td>{row.application.source || "—"}</td>
            </tr>)}</tbody>
          </table>
          {rows.length === 0 && !error && <div className="ops-empty">{en ? "No records found for this job and page." : "Không tìm thấy dữ liệu ở vị trí hoặc trang này."}</div>}
        </div>}
        {!isOffers && <div className="ops-pagination">
          <button className="secondary" type="button" disabled={loading || offset === 0} onClick={() => void load(jobId, Math.max(0, offset - PAGE_SIZE))}>{en ? "Previous" : "Trang trước"}</button>
          <span>{en ? `Page ${Math.floor(offset / PAGE_SIZE) + 1} · Stage filter applies to returned records` : `Trang ${Math.floor(offset / PAGE_SIZE) + 1} · Lọc vòng trên dữ liệu được trả về`}</span>
          <button className="secondary" type="button" disabled={loading || pageResultCount < PAGE_SIZE} onClick={() => void load(jobId, offset + PAGE_SIZE)}>{en ? "Next" : "Trang sau"}</button>
        </div>}
        <p className="ops-disclaimer">{isOffers
          ? (en ? "The current Offer API returns only PENDING / APPROVED status. Compensation, approvers, and expiry dates are not shown because the API does not provide them." : "API đề nghị hiện chỉ trả trạng thái chờ duyệt hoặc đã duyệt. Hệ thống chưa hiển thị lương, người duyệt hay hạn phản hồi vì API chưa cung cấp các thông tin này.")
          : (en ? "The Interview stage is not the same as a scheduled interview or interview round. Use the Interviews module to see actual appointments and feedback." : "Vòng Phỏng vấn không đồng nghĩa với một lịch hẹn hay vòng phỏng vấn cụ thể. Mở mục Phỏng vấn để xem lịch hẹn và feedback thực tế.")}</p>
      </div>
      <aside className="ops-detail" aria-label="Chi tiết hồ sơ">
        <h3>{chosen?.application.candidate_name || (en ? "Candidate details" : "Chi tiết ứng viên")}</h3>
        {detailLoading && <p role="status">{en ? "Loading candidate details…" : "Đang tải hồ sơ…"}</p>}
        {detailError && <div className="notice error" role="alert">{detailError}</div>}
        {!chosen && <p className="ops-muted">{en ? "Choose a candidate from the table to view their history for this job." : "Chọn ứng viên trong bảng để xem lịch sử tuyển dụng ở vị trí này."}</p>}
        {chosen && <>
          <dl className="ops-fields"><dt>{en ? "Job" : "Vị trí"}</dt><dd>{job?.title || "—"}</dd><dt>{en ? "Stage" : "Vòng"}</dt><dd>{stageText(chosen.application.stage, locale)}</dd><dt>{en ? "Status" : "Trạng thái"}</dt><dd>{chosen.status}</dd><dt>{en ? "Source" : "Nguồn"}</dt><dd>{chosen.application.source || "—"}</dd></dl>
          {detail && <><h4>{en ? "Application timeline" : "Lịch sử hồ sơ"}</h4>
            {detail.events.length ? <ol className="ops-events">{detail.events.map((event) => <li key={event.event_id}><strong>{event.event_type}</strong><span>{stageText(event.from_stage || "—", locale)} → {stageText(event.to_stage || "—", locale)}</span><small>{event.actor_display_name || "—"} · {new Date(event.created_at).toLocaleString()}</small></li>)}</ol> : <p className="ops-muted">{en ? "No history is available yet." : "Chưa có lịch sử được trả về."}</p>}
          </>}
        </>}
      </aside>
    </div>
  </section>;
}
