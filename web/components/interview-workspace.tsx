"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "./language";
import { ApiError } from "@/lib/supabase";
import {
  interviewCall,
  interviewErrors,
  safeMeetingUrl,
  type InterviewRow,
  type Feedback,
  type Decision,
} from "@/lib/interviews";
export default function InterviewWorkspace({
  onAccessLost,
}: {
  onAccessLost: () => void;
}) {
  const { locale } = useLanguage();
  const say = (vi: string, en: string) => (locale === "en" ? en : vi);
  const [status, setStatus] = useState("SCHEDULED"),
    [offset, setOffset] = useState(0),
    [items, setItems] = useState<InterviewRow[]>([]),
    [selected, setSelected] = useState<InterviewRow | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [detailError, setDetailError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState(false),
    [refresh, setRefresh] = useState(0),
    [detailLoading, setDetailLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback[]>([]),
    [decisions, setDecisions] = useState<Decision[]>([]),
    [score, setScore] = useState("3"),
    [recommendation, setRecommendation] = useState("YES"),
    [summary, setSummary] = useState(""),
    [strengths, setStrengths] = useState(""),
    [concerns, setConcerns] = useState(""),
    [decision, setDecision] = useState("HOLD"),
    [note, setNote] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const listTicket = useRef(0),
    detailTicket = useRef(0),
    writing = useRef(false),
    request = useRef<Record<string, unknown> | null>(null),
    lastWrite = useRef<{
      key: string;
      request: Record<string, unknown>;
    } | null>(null);
  const handleError = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403))
        onAccessLost();
      return e instanceof Error ? e.message : "INTERVIEW_REQUEST_FAILED";
    },
    [onAccessLost],
  );
  useEffect(() => {
    const t = ++listTicket.current;
    setLoading(true);
    setError("");
    void interviewCall<{ interviews: InterviewRow[] }>({
      action: "worklist",
      status,
      offset,
      limit: 25,
    })
      .then((r) => {
        if (listTicket.current === t) {
          setItems(r.interviews);
          setSelected(
            (old) =>
              r.interviews.find((i) => i.id === old?.id) ||
              r.interviews[0] ||
              null,
          );
        }
      })
      .catch((e) => {
        if (listTicket.current === t) {
          setError(handleError(e));
          setItems([]);
          setSelected(null);
        }
      })
      .finally(() => {
        if (listTicket.current === t) setLoading(false);
      });
    return () => {
      listTicket.current++;
    };
  }, [status, offset, refresh, handleError]);
  useEffect(() => {
    const t = ++detailTicket.current;
    setFeedback([]);
    setDecisions([]);
    setDetailError("");
    if (!selected) return;
    setDetailLoading(true);
    void Promise.all([
      interviewCall<{ feedback: Feedback[] }>({
        action: "feedback_list",
        interview_id: selected.id,
      }),
      selected.can_decide
        ? interviewCall<{ decisions: Decision[] }>({
            action: "decision_list",
            interview_id: selected.id,
          })
        : Promise.resolve({ decisions: [] }),
    ])
      .then(([f, d]) => {
        if (detailTicket.current === t) {
          setFeedback(f.feedback);
          setDecisions(d.decisions);
        }
      })
      .catch((e) => {
        if (detailTicket.current === t) setDetailError(handleError(e));
      })
      .finally(() => {
        if (detailTicket.current === t) setDetailLoading(false);
      });
    return () => {
      detailTicket.current++;
    };
  }, [selected, handleError]);
  function errorLabel(code: string) {
    return (interviewErrors[code] || [
      "Không tải được dữ liệu hoặc chưa rõ kết quả lưu. Hãy thử lại.",
      "Could not load data or confirm the save. Please retry.",
    ])[locale === "en" ? 1 : 0];
  }
  function choose(row: InterviewRow) {
    if (busy || pending) return;
    setSelected(row);
    setSummary("");
    setStrengths("");
    setConcerns("");
    setNote("");
    setError("");
    setNotice("");
  }
  async function mutate(body: Record<string, unknown>) {
    if (writing.current) return;
    const key = JSON.stringify(body);
    request.current ??=
      lastWrite.current?.key === key
        ? lastWrite.current.request
        : { ...body, request_id: crypto.randomUUID() };
    writing.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await interviewCall(request.current);
      if (!mounted.current) return;
      lastWrite.current = { key, request: request.current };
      request.current = null;
      setPending(false);
      setNotice("saved");
      setSummary("");
      setStrengths("");
      setConcerns("");
      setNote("");
      setRefresh((v) => v + 1);
      if (body.action === "complete") setStatus("COMPLETED");
    } catch (e) {
      if (!mounted.current) return;
      setError(handleError(e));
      if (
        e instanceof ApiError &&
        e.status &&
        e.status >= 400 &&
        e.status < 500
      ) {
        request.current = null;
        setPending(false);
      } else setPending(true);
    } finally {
      writing.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const row = selected;
  const locked = busy || pending || loading;
  const round = (v: string) =>
    v === "PHONE_SCREEN"
      ? say("Trao đổi ban đầu", "Phone screen")
      : v === "FINAL"
        ? say("Vòng cuối", "Final round")
        : say("Phỏng vấn", "Interview");
  const time = (v: string) =>
    new Date(v).toLocaleString(locale === "en" ? "en-GB" : "vi-VN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  return (
    <section
      className="interview-workspace"
      aria-label={say("Lịch phỏng vấn", "Interviews")}
    >
      <div className="panel-heading">
        <div>
          <h2>{say("Lịch phỏng vấn", "Interviews")}</h2>
          <p>
            {say(
              "Lịch bạn được xem và những việc cần xử lý. Giờ hiển thị theo thiết bị của bạn.",
              "Interviews you can access and the actions available to you. Times use your device timezone.",
            )}
          </p>
        </div>
        <button
          className="secondary"
          disabled={locked}
          onClick={() => setRefresh((v) => v + 1)}
        >
          {say("Tải lại lịch", "Refresh interviews")}
        </button>
      </div>
      <label>
        {say("Trạng thái lịch", "Interview status")}
        <select
          aria-label={say("Trạng thái lịch", "Interview status")}
          disabled={busy || pending}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setOffset(0);
            setSelected(null);
            setNotice("");
          }}
        >
          <option value="SCHEDULED">{say("Đã đặt lịch", "Scheduled")}</option>
          <option value="COMPLETED">{say("Đã hoàn tất", "Completed")}</option>
          <option value="CANCELLED">{say("Đã hủy", "Cancelled")}</option>
        </select>
      </label>
      {error && <p role="alert">{errorLabel(error)}</p>}
      {notice && (
        <p role="status">
          {say(
            "Đã lưu. Lịch sử bên dưới phản ánh thông tin đã ghi nhận.",
            "Saved. The history below shows recorded information.",
          )}
        </p>
      )}
      {pending && (
        <div role="status">
          <p>
            {say(
              "Chưa xác nhận được kết quả. Thử lại cùng yêu cầu để tránh ghi trùng.",
              "The result is uncertain. Retry the same request to prevent duplicates.",
            )}
          </p>
          <button
            disabled={busy}
            onClick={() => request.current && void mutate(request.current)}
          >
            {say("Thử lại yêu cầu", "Retry request")}
          </button>
        </div>
      )}
      {loading ? (
        <p role="status">{say("Đang tải lịch…", "Loading interviews…")}</p>
      ) : (
        <div className="interview-columns">
          <div className="interview-list">
            {items.length === 0 && (
              <p>
                {say(
                  "Chưa có lịch ở trạng thái này.",
                  "No interviews with this status.",
                )}
              </p>
            )}
            {items.map((i) => (
              <button
                key={i.id}
                className={`secondary interview-item ${row?.id === i.id ? "selected" : ""}`}
                disabled={busy || pending}
                aria-pressed={row?.id === i.id}
                onClick={() => choose(i)}
              >
                <strong>{i.candidate_name}</strong>
                <span>{i.job_title}</span>
                <span>
                  {round(i.interview_type)} · {time(i.starts_at)}
                </span>
              </button>
            ))}
            <div className="panel-heading">
              <button
                className="secondary"
                disabled={locked || offset === 0}
                onClick={() => setOffset((v) => Math.max(0, v - 25))}
              >
                {say("Trang trước", "Previous page")}
              </button>
              <span>
                {say("Trang", "Page")} {offset / 25 + 1}
              </span>
              <button
                className="secondary"
                disabled={locked || items.length < 25}
                onClick={() => setOffset((v) => v + 25)}
              >
                {say("Trang sau", "Next page")}
              </button>
            </div>
          </div>
          {row && (
            <article
              className="interview-detail"
              aria-label={say("Chi tiết phỏng vấn", "Interview details")}
            >
              <h3>{row.candidate_name}</h3>
              <p>
                {row.job_title} · {round(row.interview_type)}
              </p>
              <p>
                {time(row.starts_at)} → {time(row.ends_at)}
              </p>
              <p>
                {say("Múi giờ khi tạo lịch", "Scheduling timezone")}:{" "}
                {row.timezone}
              </p>
              <p>
                {row.location ||
                  say("Chưa có địa điểm", "No location provided")}
              </p>
              {safeMeetingUrl(row.meeting_url) && (
                <a
                  href={safeMeetingUrl(row.meeting_url)!}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {say("Mở link họp", "Open meeting link")}
                </a>
              )}
              <h4>{say("Người tham dự", "Participants")}</h4>
              <ul>
                {row.participants.map((p) => (
                  <li key={p.id}>{p.display_name}</li>
                ))}
              </ul>
              {row.can_manage && row.status === "SCHEDULED" && (
                <div className="panel-heading">
                  <button
                    disabled={
                      locked || new Date(row.starts_at).getTime() > Date.now()
                    }
                    onClick={() =>
                      void mutate({ action: "complete", interview_id: row.id })
                    }
                  >
                    {say("Đánh dấu đã phỏng vấn", "Mark interview completed")}
                  </button>
                  <button
                    className="secondary"
                    disabled={locked}
                    onClick={() => {
                      if (
                        window.confirm(
                          say(
                            "Hủy buổi phỏng vấn này?",
                            "Cancel this interview?",
                          ),
                        )
                      )
                        void mutate({ action: "cancel", interview_id: row.id });
                    }}
                  >
                    {say("Hủy lịch", "Cancel interview")}
                  </button>
                </div>
              )}
              {detailLoading && (
                <p role="status">
                  {say("Đang tải đánh giá…", "Loading feedback…")}
                </p>
              )}
              {detailError && <p role="alert">{errorLabel(detailError)}</p>}
              {row.status === "COMPLETED" &&
                row.is_participant &&
                !row.feedback_submitted && (
                  <form
                    aria-label={say("Gửi đánh giá", "Submit feedback")}
                    onSubmit={(e) => {
                      e.preventDefault();
                      void mutate({
                        action: "feedback_submit",
                        interview_id: row.id,
                        score: Number(score),
                        recommendation,
                        summary,
                        strengths,
                        concerns,
                      });
                    }}
                  >
                    <fieldset disabled={locked}>
                      <legend>
                        {say("Đánh giá của bạn", "Your feedback")}
                      </legend>
                      <label>
                        {say("Điểm đánh giá", "Score")}
                        <select
                          aria-label={say("Điểm đánh giá", "Score")}
                          value={score}
                          onChange={(e) => setScore(e.target.value)}
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n}>{n}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {say("Đề xuất", "Recommendation")}
                        <select
                          aria-label={say("Đề xuất", "Recommendation")}
                          value={recommendation}
                          onChange={(e) => setRecommendation(e.target.value)}
                        >
                          <option value="STRONG_YES">
                            {say("Rất phù hợp", "Strong yes")}
                          </option>
                          <option value="YES">{say("Phù hợp", "Yes")}</option>
                          <option value="NO">
                            {say("Chưa phù hợp", "No")}
                          </option>
                          <option value="STRONG_NO">
                            {say("Không phù hợp", "Strong no")}
                          </option>
                        </select>
                      </label>
                      <label>
                        {say("Điểm mạnh", "Strengths")}
                        <textarea
                          maxLength={4000}
                          value={strengths}
                          onChange={(e) => setStrengths(e.target.value)}
                        />
                      </label>
                      <label>
                        {say("Điểm cần cân nhắc", "Concerns")}
                        <textarea
                          maxLength={4000}
                          value={concerns}
                          onChange={(e) => setConcerns(e.target.value)}
                        />
                      </label>
                      <label>
                        {say("Nhận xét chung", "Summary")}
                        <textarea
                          maxLength={4000}
                          value={summary}
                          onChange={(e) => setSummary(e.target.value)}
                        />
                      </label>
                      <button>{say("Gửi feedback", "Submit feedback")}</button>
                    </fieldset>
                  </form>
                )}
              <h4>{say("Feedback đã ghi nhận", "Recorded feedback")}</h4>
              {feedback.map((f) => (
                <section key={f.id} className="interview-history">
                  <strong>
                    {row.participants.find((p) => p.id === f.interviewer_id)
                      ?.display_name || say("Thành viên", "Team member")}{" "}
                    · {f.score}/5
                  </strong>
                  <p>
                    {
                      (
                        {
                          STRONG_YES: say("Rất phù hợp", "Strong yes"),
                          YES: say("Phù hợp", "Yes"),
                          NO: say("Chưa phù hợp", "No"),
                          STRONG_NO: say("Không phù hợp", "Strong no"),
                        } as Record<string, string>
                      )[f.recommendation]
                    }
                  </p>
                  <p>{f.strengths}</p>
                  <p>{f.concerns}</p>
                  <p>{f.summary}</p>
                  <small>{time(f.submitted_at)}</small>
                </section>
              ))}
              {row.can_decide && (
                <>
                  <h4>{say("Lịch sử quyết định", "Decision history")}</h4>
                  {decisions.map((d) => (
                    <p key={d.id}>
                      {d.decision === "PROCEED"
                        ? say("Tiếp tục", "Proceed")
                        : d.decision === "HOLD"
                          ? say("Chờ thêm thông tin", "Hold")
                          : say("Không tiếp tục", "Decline")}{" "}
                      · {time(d.decided_at)}
                      <br />
                      {d.note}
                    </p>
                  ))}
                  {row.status === "COMPLETED" && row.feedback_count > 0 && (
                    <form
                      aria-label={say("Ghi quyết định", "Record decision")}
                      onSubmit={(e) => {
                        e.preventDefault();
                        void mutate({
                          action: "decision_submit",
                          interview_id: row.id,
                          decision,
                          note,
                        });
                      }}
                    >
                      <fieldset disabled={locked}>
                        <legend>
                          {say("Ghi nhận quyết định", "Record a decision")}
                        </legend>
                        <p>
                          {say(
                            "Quyết định này được lưu vào lịch sử; không tự chuyển vòng hoặc từ chối hồ sơ.",
                            "This decision is recorded in history; it does not automatically move or reject the application.",
                          )}
                        </p>
                        <label>
                          {say("Kết quả", "Decision")}
                          <select
                            aria-label={say("Kết quả", "Decision")}
                            value={decision}
                            onChange={(e) => setDecision(e.target.value)}
                          >
                            <option value="PROCEED">
                              {say("Tiếp tục", "Proceed")}
                            </option>
                            <option value="HOLD">
                              {say("Chờ thêm thông tin", "Hold")}
                            </option>
                            <option value="DECLINE">
                              {say("Không tiếp tục", "Decline")}
                            </option>
                          </select>
                        </label>
                        <label>
                          {say("Lý do / ghi chú", "Reason / note")}
                          <textarea
                            required={decision === "DECLINE"}
                            maxLength={1000}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                          />
                        </label>
                        <button>
                          {say("Lưu quyết định", "Save decision")}
                        </button>
                      </fieldset>
                    </form>
                  )}
                  {row.status === "COMPLETED" && row.feedback_count === 0 && (
                    <p>
                      {say(
                        "Đang chờ feedback từ người tham dự.",
                        "Waiting for participant feedback.",
                      )}
                    </p>
                  )}
                </>
              )}
            </article>
          )}
        </div>
      )}
    </section>
  );
}
