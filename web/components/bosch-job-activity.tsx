"use client";

import { useEffect, useRef, useState } from "react";
import { applicationDetail, listApplications, type Application, type ApplicationDetail } from "@/lib/applications";
import { ApiError } from "@/lib/supabase";
import { useLanguage } from "./language";
import styles from "./bosch-v2-job-detail.module.css";

const PAGE_SIZE = 25;
/** Audited application activity for a single authorized Job. Never infer events from stage counts. */
export default function BoschJobActivity({ jobId, onAccessLost }: { jobId: string; onAccessLost: () => void }) {
  const { locale } = useLanguage();
  const en = locale === "en";
  const [records, setRecords] = useState<Application[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [offset, setOffset] = useState(0);
  const revision = useRef(0);
  const detailRevision = useRef(0);

  useEffect(() => {
    const id = ++revision.current;
    detailRevision.current += 1;
    setRecords([]); setSelectedId(null); setDetail(null); setError(""); setDetailError(""); setLoading(true);
    void listApplications(jobId, PAGE_SIZE, offset).then((result) => {
      if (id !== revision.current) return;
      setRecords(result.applications);
    }).catch((reason: unknown) => {
      if (id !== revision.current) return;
      setError(reason instanceof Error ? reason.message : (en ? "Could not load application history." : "Không tải được lịch sử hồ sơ."));
      if (reason instanceof ApiError && (reason.status === 401 || reason.status === 403)) onAccessLost();
    }).finally(() => { if (id === revision.current) setLoading(false); });
    return () => { revision.current += 1; detailRevision.current += 1; };
  }, [jobId, offset, onAccessLost]);

  async function select(item: Application) {
    const id = ++detailRevision.current;
    setSelectedId(item.application_id); setDetail(null); setDetailError(""); setDetailLoading(true);
    try {
      const result = await applicationDetail(jobId, item.application_id);
      if (id === detailRevision.current) setDetail(result);
    } catch (reason) {
      if (id !== detailRevision.current) return;
      setDetailError(reason instanceof Error ? reason.message : (en ? "Could not load timeline." : "Không tải được lịch sử."));
      if (reason instanceof ApiError && (reason.status === 401 || reason.status === 403)) onAccessLost();
    } finally { if (id === detailRevision.current) setDetailLoading(false); }
  }

  return <section className={styles.aux} aria-label={en ? "Job activity" : "Hoạt động theo Job"}>
    <div className={styles.sectionHead}><div><h2>{en ? "Application Activity" : "Lịch sử hồ sơ theo Job"}</h2>
      <p>{en ? "Select a candidate to view the actual recorded timeline and actor names." : "Chọn ứng viên để xem lịch sử thao tác có ghi nhận và người thực hiện."}</p></div></div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {loading ? <p role="status">{en ? "Loading applications…" : "Đang tải hồ sơ…"}</p> :
      <div className={styles.twoColumn}>
        <div className={styles.tableScroll}><table className={styles.nativeTable}><thead><tr><th>{en ? "Candidate" : "Ứng viên"}</th><th>{en ? "Stage" : "Giai đoạn"}</th><th>{en ? "Status" : "Trạng thái"}</th></tr></thead><tbody>
          {records.map((item) => <tr key={item.application_id}><td><button type="button" className={styles.linkButton} aria-pressed={selectedId === item.application_id} onClick={() => void select(item)}>{item.candidate_name}</button></td><td>{item.stage}</td><td>{item.status}</td></tr>)}
        </tbody></table>{!records.length && !error && <p className={styles.empty}>{en ? "No applications on this page." : "Không có hồ sơ trên trang này."}</p>}</div>
        <aside className={styles.detailPane} aria-label={en ? "Application timeline" : "Lịch sử hồ sơ"}>
          <h3>{records.find((item) => item.application_id === selectedId)?.candidate_name || (en ? "Activity Timeline" : "Lịch sử hoạt động")}</h3>
          {detailLoading && <p role="status">{en ? "Loading timeline…" : "Đang tải lịch sử…"}</p>}
          {detailError && <p className={styles.error} role="alert">{detailError}</p>}
          {detail && (detail.events.length ? <ol className={styles.timeline}>{detail.events.map((event) =>
            <li key={event.event_id}><strong>{event.event_type}</strong><span>{event.from_stage || "—"} → {event.to_stage || "—"}</span><small>{event.actor_display_name || "—"} · {new Date(event.created_at).toLocaleString(en ? "en-GB" : "vi-VN")}</small></li>)}</ol>
            : <p className={styles.empty}>{en ? "No events recorded." : "Chưa có lịch sử được ghi nhận."}</p>)}
          {!selectedId && <p className={styles.empty}>{en ? "Choose a candidate to see recorded events." : "Chọn ứng viên để xem lịch sử."}</p>}
        </aside>
      </div>}
    <div className={styles.pager}>
      <span>{en ? "Page" : "Trang"} {Math.floor(offset / PAGE_SIZE) + 1} · {records.length} {en ? "records" : "hồ sơ"}</span>
      <button type="button" className={styles.outline} disabled={loading || offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>{en ? "Previous" : "Trước"}</button>
      <button type="button" className={styles.outline} disabled={loading || records.length < PAGE_SIZE} onClick={() => setOffset(offset + PAGE_SIZE)}>{en ? "Next" : "Tiếp"}</button>
    </div>
    <p className={styles.footnote}>{en ? "This timeline shows only the selected application's events, not a complete Job-wide event log." : "Timeline chỉ hiển thị lịch sử của hồ sơ đã chọn, không phải toàn bộ sự kiện của Job."}</p>
  </section>;
}
