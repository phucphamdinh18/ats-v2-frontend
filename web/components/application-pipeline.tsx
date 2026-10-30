"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Job } from "@/lib/policy";
import {
  applicationDetail,
  listApplications,
  screenApplication,
  searchApplications,
  type Application,
  type ApplicationDetail,
} from "@/lib/applications";
import { ApiError } from "@/lib/supabase";

const PAGE_SIZE = 25;
type State = "loading" | "ready" | "empty" | "forbidden" | "error";

function message(error: unknown) {
  return error instanceof Error ? error.message : "Không tải được dữ liệu. Vui lòng thử lại.";
}

export default function ApplicationPipeline({ job, onSessionLost }: { job: Job; onSessionLost: () => void }) {
  const [items, setItems] = useState<Application[]>([]);
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Application | null>(null);
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [screenRequestId, setScreenRequestId] = useState<string | null>(null);
  const [screenError, setScreenError] = useState("");
  const [screenBusy, setScreenBusy] = useState(false);
  const [dragging, setDragging] = useState<Application | null>(null);
  const screenRequestIds = useRef(new Map<string, string>());
  const listTicket = useRef(0);
  const detailTicket = useRef(0);
  const selectedId = useRef<string | null>(null);

  const load = useCallback(async (nextOffset = offset, nextQuery = query) => {
    const ticket = ++listTicket.current;
    setState("loading");
    setError("");
    try {
      const result = nextQuery.trim()
        ? await searchApplications(job.id, nextQuery.trim(), PAGE_SIZE, nextOffset)
        : await listApplications(job.id, PAGE_SIZE, nextOffset);
      if (ticket !== listTicket.current) return;
      setItems(result.applications);
      setState(result.applications.length ? "ready" : "empty");
    } catch (cause) {
      if (ticket !== listTicket.current) return;
      const apiError = cause instanceof ApiError ? cause : undefined;
      setItems([]);
      if (apiError?.status === 401) onSessionLost();
      if (apiError?.status === 403) setState("forbidden");
      else setState("error");
      setError(message(cause));
    }
  }, [job.id, offset, query, onSessionLost]);

  useEffect(() => {
    // The search effect below performs the first load too, avoiding two initial requests.
    return () => { listTicket.current += 1; detailTicket.current += 1; };
    // A job switch must immediately discard the prior scope, before a new request resolves.
  }, [job.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOffset(0);
      void load(0, query);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const stages = useMemo(() => {
    const grouped = items.reduce<Record<string, Application[]>>((all, application) => {
      (all[application.stage] ??= []).push(application);
      return all;
    }, {});
    // SCREEN is the only additional target the current API exposes. Other stages remain API-driven.
    grouped.SCREEN ??= [];
    return Object.entries(grouped);
  }, [items]);

  const openDetail = useCallback(async (application: Application) => {
    const ticket = ++detailTicket.current;
    setSelected(application);
    selectedId.current = application.application_id;
    setDetail(null);
    setDetailError("");
    setScreenRequestId(null);
    setScreenError("");
    setDetailLoading(true);
    try {
      const result = await applicationDetail(job.id, application.application_id);
      if (ticket !== detailTicket.current) return;
      setDetail(result);
    } catch (cause) {
      if (ticket !== detailTicket.current) return;
      const apiError = cause instanceof ApiError ? cause : undefined;
      if (apiError?.status === 401) onSessionLost();
      if (apiError?.status === 403) {
        setItems([]);
        setDetail(null);
        setSelected(null);
        selectedId.current = null;
        setState("forbidden");
      }
      setDetailError(message(cause));
    } finally {
      if (ticket === detailTicket.current) setDetailLoading(false);
    }
  }, [job.id, onSessionLost]);

  async function screen(application = selected) {
    if (!application || screenBusy) return;
    const existingRequestId = screenRequestIds.current.get(application.application_id);
    const requestId = existingRequestId ?? crypto.randomUUID();
    if (!existingRequestId && !window.confirm(`Chuyển ${application.candidate_name} sang SCREEN?`)) return;
    screenRequestIds.current.set(application.application_id, requestId);
    if (selectedId.current === application.application_id) setScreenRequestId(requestId);
    setScreenBusy(true);
    setScreenError("");
    try {
      const result = await screenApplication(application.application_id, requestId);
      screenRequestIds.current.delete(application.application_id);
      // Update immediately so a completed transition cannot be repeated.
      if (selectedId.current === application.application_id) {
        setScreenRequestId(null);
        setSelected(result.application);
        await openDetail(result.application);
      }
      await load(offset, query);
    } catch (cause) {
      const apiError = cause instanceof ApiError ? cause : undefined;
      if (apiError?.status === 401) onSessionLost();
      if (apiError?.status === 403) {
        setItems([]);
        setDetail(null);
        setSelected(null);
        selectedId.current = null;
        setState("forbidden");
      }
      // Keep the request id per Application: a retry repeats the exact idempotent request.
      if (selectedId.current === application.application_id) {
        setScreenRequestId(requestId);
        setScreenError(message(cause));
      }
    } finally {
      setScreenBusy(false);
    }
  }

  const eligible = selected?.stage === "NEW" && selected.status === "ACTIVE";
  const disabledReason = !selected ? "Chọn một Application để thao tác." : !eligible
    ? "Chỉ Application NEW đang ACTIVE mới có thể chuyển sang SCREEN." : "";

  return <section className="panel pipeline" aria-label={`Pipeline ${job.title}`}>
    <div className="panel-heading"><div><h2>Pipeline: {job.title}</h2><p>{job.job_code || "Không có mã Job"} · Dữ liệu theo quyền Job từ backend.</p></div></div>
    <label className="search"><span aria-hidden="true">⌕</span><input aria-label="Tìm ứng viên trong Job" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên ứng viên" /></label>
    {state === "loading" && <p role="status" aria-live="polite">Đang tải Application…</p>}
    {state === "forbidden" && <div className="notice error" role="alert">Không có quyền. Dữ liệu của Job này đã được xoá khỏi màn hình.</div>}
    {state === "error" && <div className="notice error" role="alert">{error}<button className="quiet" onClick={() => void load()}>Thử lại</button></div>}
    {state === "empty" && <div className="empty"><h3>Chưa có Application</h3><p>Không có kết quả trong phạm vi Job này.</p></div>}
    {state === "ready" && <div className="pipeline-grid">
      {stages.map(([stage, applications]) => {
        const acceptsDrop = stage === "SCREEN" && dragging?.stage === "NEW" && dragging.status === "ACTIVE";
        return <section className={`stage ${acceptsDrop ? "drop-target" : ""}`} key={stage} aria-label={`Giai đoạn ${stage}`}
          onDragOver={(event) => { if (acceptsDrop) event.preventDefault(); }}
          onDrop={(event) => { event.preventDefault(); const candidate = dragging; setDragging(null); if (acceptsDrop && candidate) void screen(candidate); }}>
          <h3>{stage} <span className="count">{applications.length}</span></h3>
          {stage === "SCREEN" && <p className="drop-hint">Kéo Application NEW đang ACTIVE vào đây để chuyển sang SCREEN.</p>}
          {applications.map((application) => {
            const canDrag = application.stage === "NEW" && application.status === "ACTIVE";
            const dragReason = canDrag ? "Kéo sang SCREEN" : "Chỉ Application NEW đang ACTIVE mới có thể kéo sang SCREEN.";
            return <button className="application-card" key={application.application_id}
              draggable={canDrag}
              onDragStart={(event) => { if (!canDrag) { event.preventDefault(); return; } setDragging(application); }}
              onDragEnd={() => setDragging(null)}
              onClick={() => void openDetail(application)}
              title={dragReason}
              aria-label={`Mở Application của ${application.candidate_name}. ${dragReason}`}>
              <strong>{application.candidate_name}</strong><span>{application.status}</span><small>{application.source || "Không có nguồn"}</small>
            </button>;
          })}
        </section>;
      })}
    </div>}
    {state === "ready" && <div className="panel-footer"><button className="secondary" disabled={offset === 0} title={offset === 0 ? "Đang ở trang đầu" : "Trang trước"} onClick={() => { const next = Math.max(0, offset - PAGE_SIZE); setOffset(next); void load(next, query); }}>Trang trước</button><span>Trang {offset / PAGE_SIZE + 1}</span><button className="secondary" disabled={items.length < PAGE_SIZE} title={items.length < PAGE_SIZE ? "Không còn trang sau" : "Trang sau"} onClick={() => { const next = offset + PAGE_SIZE; setOffset(next); void load(next, query); }}>Trang sau</button></div>}
    {selected && <aside className="application-detail" aria-label="Chi tiết Application">
      <div className="panel-heading"><h2>Chi tiết Application</h2><button className="quiet" aria-label="Đóng chi tiết" onClick={() => { detailTicket.current += 1; selectedId.current = null; setSelected(null); }}>Đóng</button></div>
      {detailLoading && <p role="status">Đang tải chi tiết…</p>}
      {detailError && <div className="notice error" role="alert">{detailError}<button className="quiet" onClick={() => void openDetail(selected)}>Thử lại</button></div>}
      {detail && <><dl className="application-fields"><dt>Ứng viên</dt><dd>{detail.application.candidate_name}</dd><dt>Giai đoạn</dt><dd>{detail.application.stage}</dd><dt>Trạng thái</dt><dd>{detail.application.status}</dd><dt>Nguồn</dt><dd>{detail.application.source || "Không có"}</dd></dl>
        <h3>Lịch sử</h3><ol className="timeline">{detail.events.map((event) => <li key={event.event_id}><strong>{event.event_type}</strong><span>{event.from_stage || "—"} → {event.to_stage || "—"}</span><small>{event.actor_display_name || "Tên người thao tác chưa được backend trả về"} · {new Date(event.created_at).toLocaleString()}</small></li>)}</ol>
        {detail.matching_context !== undefined && <details><summary>Matching context</summary><pre>{JSON.stringify(detail.matching_context, null, 2)}</pre></details>}
      </>}
      <button className="primary" aria-label="Chuyển sang SCREEN" disabled={!eligible || screenBusy} title={disabledReason || "Chuyển sang SCREEN"} onClick={() => void screen()}>{screenBusy ? "Đang xử lý…" : screenRequestId ? "Thử lại chuyển SCREEN" : "Chuyển sang SCREEN"}</button>
      {disabledReason && <p className="disabled-explanation">{disabledReason}</p>}
      {screenError && <div className="notice error" role="alert">{screenError}<button className="quiet" onClick={() => void screen()}>Thử lại với cùng request_id</button></div>}
    </aside>}
  </section>;
}
