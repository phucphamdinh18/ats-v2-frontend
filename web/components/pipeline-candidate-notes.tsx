"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { addApplicationNote, APPLICATION_NOTE_LIMIT, listApplicationNotes, type ApplicationNote, type ApplicationNoteScope } from "@/lib/applications";
import { ApiError } from "@/lib/supabase";
import styles from "./bosch-v2-pipeline.module.css";

export default function PipelineCandidateNotes({ jobId, applicationId, en, onSessionLost, canWriteShared }: {
  jobId: string;
  applicationId: string;
  en: boolean;
  onSessionLost: () => void;
  canWriteShared: boolean;
}) {
  const [scope, setScope] = useState<ApplicationNoteScope>("SHARED");
  const [notes, setNotes] = useState<ApplicationNote[] | null>(null);
  const [nextBeforeId, setNextBeforeId] = useState<string>();
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ticket = useRef(0);
  const request = useRef<{ id: string; body: string } | null>(null);

  const showError = useCallback((cause: unknown) => {
    if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403 || cause.status === 404)) {
      setNotes(null);
      setNextBeforeId(undefined);
      setDraft("");
      request.current = null;
      if (cause.status === 401) onSessionLost();
    }
    setError(cause instanceof Error ? cause.message : "");
  }, [onSessionLost]);

  const load = useCallback(async (beforeId?: string) => {
    const current = ++ticket.current;
    setLoading(true);
    setError(null);
    try {
      const page = await listApplicationNotes(jobId, applicationId, beforeId, scope);
      if (ticket.current !== current) return;
      setNextBeforeId(page.nextBeforeId);
      setNotes((previous) => beforeId && previous ? [...previous, ...page.notes] : page.notes);
    } catch (cause) {
      if (ticket.current === current) showError(cause);
    } finally {
      if (ticket.current === current) setLoading(false);
    }
  }, [jobId, applicationId, showError, scope]);

  useEffect(() => {
    setNotes(null);
    setNextBeforeId(undefined);
    setDraft("");
    request.current = null;
    void load();
    return () => { ticket.current += 1; };
  }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || body.length > APPLICATION_NOTE_LIMIT || saving || loading || !notes || (scope === "SHARED" && !canWriteShared)) return;
    const retry = request.current?.body === body ? request.current : { id: crypto.randomUUID(), body };
    request.current = retry;
    const current = ticket.current;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const note = await addApplicationNote(jobId, applicationId, retry.id, body, scope);
      if (ticket.current !== current) return;
      setNotes((previous) => [note, ...(previous ?? []).filter((item) => item.id !== note.id)]);
      setDraft("");
      request.current = null;
      setSaved(true);
    } catch (cause) {
      if (ticket.current === current) showError(cause);
    } finally {
      if (ticket.current === current) setSaving(false);
    }
  }

  return <section className={styles.profileCard}>
    <nav className={styles.profileTabs} aria-label={en ? "Note visibility" : "Phạm vi ghi chú"}>
      <button type="button" className={scope === "SHARED" ? styles.active : undefined} aria-pressed={scope === "SHARED"} onClick={() => { if (scope !== "SHARED") { setNotes(null); setDraft(""); request.current = null; setScope("SHARED"); } }}>{en ? "Shared with job team" : "Ghi chú chung cho team"}</button>
      <button type="button" className={scope === "PRIVATE" ? styles.active : undefined} aria-pressed={scope === "PRIVATE"} onClick={() => { if (scope !== "PRIVATE") { setNotes(null); setDraft(""); request.current = null; setScope("PRIVATE"); } }}>{en ? "Only me" : "Chỉ mình tôi"}</button>
    </nav>
    <p className={styles.profileMuted}>{scope === "SHARED" ? (en ? "Visible to people who can access this Job." : "Người có quyền truy cập Job này có thể xem.") : (en ? "Private to your account. Other ATS users cannot view it." : "Chỉ tài khoản của bạn xem được; người khác trong ATS không thể xem.")}</p>
    {notes && <form className={styles.noteForm} onSubmit={(event) => void save(event)}>
      <label>{en ? "New note" : "Ghi chú mới"}
        <textarea rows={4} maxLength={APPLICATION_NOTE_LIMIT} value={draft} disabled={saving}
          onChange={(event) => { setDraft(event.target.value); setSaved(false); }}/>
      </label>
      <button type="submit" className={styles.actionPrimary} disabled={!draft.trim() || loading || saving || (scope === "SHARED" && !canWriteShared)}>
        {saving ? (en ? "Saving…" : "Đang lưu…") : (en ? "Add note" : "Thêm ghi chú")}
      </button>
      {saved && <p role="status">{en ? "Note saved." : "Đã lưu ghi chú."}</p>}
    </form>}
    {error !== null && <div className={`${styles.notice} ${styles.error}`} role="alert">{error || (en ? "Could not process the notes." : "Chưa xử lý được ghi chú.")}
      {!notes && <button type="button" className={styles.retry} onClick={() => void load()}>{en ? "Try again" : "Thử lại"}</button>}
    </div>}
    {loading && <p role="status">{en ? "Loading notes…" : "Đang tải ghi chú…"}</p>}
    {notes && (notes.length ? <ul className={styles.noteList}>
      {notes.map((note) => <li key={note.id}>
        <p>{note.body}</p>
        <small>{note.author_name || (en ? "ATS user" : "Người dùng ATS")} · <time dateTime={note.created_at}>{new Date(note.created_at).toLocaleString(en ? "en-GB" : "vi-VN")}</time></small>
      </li>)}
    </ul> : <p>{en ? "No notes yet." : "Chưa có ghi chú."}</p>)}
    {nextBeforeId && <button type="button" className={styles.actionSecondary} disabled={loading || saving} onClick={() => void load(nextBeforeId)}>{en ? "Load older notes" : "Xem ghi chú cũ hơn"}</button>}
  </section>;
}
