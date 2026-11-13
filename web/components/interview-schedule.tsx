"use client";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "./language";
import { ApiError } from "@/lib/supabase";
import {
  interviewCall,
  interviewErrors,
  safeMeetingUrl,
  type InterviewPerson,
} from "@/lib/interviews";
type Props = {
  applicationId: string;
  onSaved: () => Promise<void>;
  onAccessLost: () => void;
};
export default function InterviewSchedule(props: Props) {
  const [open, setOpen] = useState(false);
  const { locale } = useLanguage();
  return open ? (
    <ScheduleForm {...props} />
  ) : (
    <button className="secondary" onClick={() => setOpen(true)}>
      {locale === "en" ? "Schedule interview" : "Đặt lịch phỏng vấn"}
    </button>
  );
}
function ScheduleForm({ applicationId, onSaved, onAccessLost }: Props) {
  const { locale } = useLanguage();
  const say = (vi: string, en: string) => (locale === "en" ? en : vi);
  const [people, setPeople] = useState<InterviewPerson[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(false);
  const [type, setType] = useState("INTERVIEW"),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [location, setLocation] = useState(""),
    [url, setUrl] = useState(""),
    [notes, setNotes] = useState(""),
    [ids, setIds] = useState<string[]>([]),
    [revision, setRevision] = useState(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const ticket = useRef(0),
    write = useRef(false),
    request = useRef<Record<string, unknown> | null>(null);
  useEffect(() => {
    const t = ++ticket.current;
    setLoading(true);
    setError("");
    void interviewCall<{ participants: InterviewPerson[] }>({
      action: "roster",
      application_id: applicationId,
    })
      .then((r) => {
        if (ticket.current === t) setPeople(r.participants);
      })
      .catch((e) => {
        if (ticket.current === t) {
          setError(e instanceof Error ? e.message : "INTERVIEW_REQUEST_FAILED");
          if (e instanceof ApiError && (e.status === 401 || e.status === 403))
            onAccessLost();
        }
      })
      .finally(() => {
        if (ticket.current === t) setLoading(false);
      });
    return () => {
      ticket.current++;
    };
  }, [applicationId, revision, onAccessLost]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (write.current) return;
    setError("");
    if (!request.current) {
      const a = new Date(start),
        b = new Date(end);
      if (
        !Number.isFinite(+a) ||
        !Number.isFinite(+b) ||
        a >= b ||
        ids.length < 1 ||
        ids.length > 20 ||
        (url && !safeMeetingUrl(url))
      ) {
        setError("INVALID_INPUT");
        return;
      }
      request.current = {
        action: "create",
        request_id: crypto.randomUUID(),
        application_id: applicationId,
        interview_type: type,
        starts_at: a.toISOString(),
        ends_at: b.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        location,
        meeting_url: url,
        notes,
        participant_ids: ids,
      };
    }
    write.current = true;
    setBusy(true);
    try {
      await interviewCall(request.current);
      if (!mounted.current) return;
      setSaved(true);
      void onSaved().catch(() => {
        if (mounted.current) setError("INTERVIEW_REFRESH_FAILED");
      });
      setRetry(false);
      request.current = null;
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof Error ? e.message : "INTERVIEW_REQUEST_FAILED");
      const definite =
        e instanceof ApiError &&
        !!e.status &&
        e.status >= 400 &&
        e.status < 500;
      if (definite) {
        request.current = null;
        setRetry(false);
      } else setRetry(true);
      if (e instanceof ApiError && (e.status === 401 || e.status === 403))
        onAccessLost();
    } finally {
      write.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  if (saved)
    return (
      <div role="status">
        {error && (
          <p>
            {say(
              "Đã đặt lịch nhưng chưa tải lại được hồ sơ. Dùng nút cập nhật bên dưới.",
              "Interview saved, but the application could not refresh. Use the refresh button below.",
            )}
          </p>
        )}
        <p>
          {say(
            "Đã đặt lịch. Xem lịch trong mục Phỏng vấn.",
            "Interview scheduled. Find it in Interviews.",
          )}
        </p>
        <button
          className="secondary"
          onClick={() =>
            void onSaved().catch(() => setError("INTERVIEW_REFRESH_FAILED"))
          }
        >
          {say("Cập nhật hồ sơ", "Refresh application")}
        </button>
      </div>
    );
  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="interview-form"
      aria-label={say("Đặt lịch phỏng vấn", "Schedule interview")}
    >
      <h3>{say("Đặt lịch phỏng vấn", "Schedule interview")}</h3>
      <p>
        {say(
          "Giờ theo múi giờ trên thiết bị của bạn. Đặt lịch từ Sơ loại sẽ chuyển hồ sơ sang Phỏng vấn. Chưa gửi email hoặc tạo lịch ngoài ATS.",
          "Times use your device timezone. Scheduling from Screening moves the application to Interview. No email or external calendar event is sent.",
        )}
      </p>
      {error && (
        <p role="alert">
          {
            (interviewErrors[error] || [
              "Không xử lý được yêu cầu. Thử lại với cùng yêu cầu để tránh tạo trùng.",
              "Could not process the request. Retry the same request to prevent duplicates.",
            ])[locale === "en" ? 1 : 0]
          }
        </p>
      )}
      <fieldset disabled={busy || retry || loading}>
        <label>
          {say("Vòng phỏng vấn", "Interview round")}
          <select
            aria-label={say("Vòng phỏng vấn", "Interview round")}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="PHONE_SCREEN">
              {say("Trao đổi ban đầu", "Phone screen")}
            </option>
            <option value="INTERVIEW">{say("Phỏng vấn", "Interview")}</option>
            <option value="FINAL">{say("Vòng cuối", "Final round")}</option>
          </select>
        </label>
        <label>
          {say("Bắt đầu", "Starts at")}
          <input
            required
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          {say("Kết thúc", "Ends at")}
          <input
            required
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <fieldset>
          <legend>
            {say(
              "Người phỏng vấn thuộc Job",
              "Interviewers assigned to this job",
            )}
          </legend>
          {loading ? (
            <p role="status">{say("Đang tải…", "Loading…")}</p>
          ) : (
            people.map((p) => (
              <label key={p.id}>
                <input
                  type="checkbox"
                  checked={ids.includes(p.id)}
                  onChange={(e) =>
                    setIds((old) =>
                      e.target.checked
                        ? [...old, p.id]
                        : old.filter((id) => id !== p.id),
                    )
                  }
                />
                {p.display_name} ·{" "}
                {p.role === "HIRING_MANAGER"
                  ? say("Quản lý tuyển dụng", "Hiring manager")
                  : say("Người phỏng vấn", "Interviewer")}
              </label>
            ))
          )}
          {!loading && people.length === 0 && (
            <p>
              {say(
                "Chưa có người phỏng vấn được gán. Nhờ Admin phân công trong Quản lý Job.",
                "No interviewers assigned. Ask an admin to assign them in Manage jobs.",
              )}
            </p>
          )}
        </fieldset>
        <label>
          {say("Địa điểm", "Location")}
          <input
            maxLength={240}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </label>
        <label>
          {say("Link họp HTTPS", "HTTPS meeting link")}
          <input
            type="url"
            maxLength={2048}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <label>
          {say("Ghi chú", "Notes")}
          <textarea
            maxLength={4000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </fieldset>
      {retry && (
        <p>
          {say(
            "Kết quả chưa rõ. Thử lại cùng nội dung; không đặt lịch lần nữa ở cửa sổ khác.",
            "The result is uncertain. Retry the same details; do not create another interview in a different window.",
          )}
        </p>
      )}
      <button disabled={busy || loading || (!retry && people.length === 0)}>
        {busy
          ? say("Đang lưu…", "Saving…")
          : retry
            ? say("Thử lại yêu cầu", "Retry request")
            : say("Xác nhận đặt lịch", "Confirm schedule")}
      </button>
      {!busy && !retry && (
        <button
          type="button"
          className="secondary"
          onClick={() => setRevision((v) => v + 1)}
        >
          {say("Tải lại danh sách người", "Refresh roster")}
        </button>
      )}
    </form>
  );
}
