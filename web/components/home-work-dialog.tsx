"use client";
import { useEffect, useRef, useState } from "react";
import { X, UserRound, CalendarClock, Video, MapPin } from "lucide-react";
import { ApiError, getClient } from "@/lib/supabase";
import {
  taskCall,
  safeMeetingUrl,
  interviewKind,
  HOME_TIME_ZONE,
  type TaskDetail,
} from "@/lib/home-data";
import { listJobMembers, type JobMember } from "@/lib/admin-jobs";
import type { InterviewWorklistItem } from "@/lib/interviews";
import styles from "./bosch-home-dashboard.module.css";
type Props = {
  taskId?: string;
  interview?: InterviewWorklistItem;
  userId: string;
  roles: string[];
  en: boolean;
  onClose: () => void;
  onChanged: () => void;
  onAccessLost: () => void;
};
export default function HomeWorkDialog({
  taskId,
  interview,
  userId,
  roles,
  en,
  onClose,
  onChanged,
  onAccessLost,
}: Props) {
  const [detail, setDetail] = useState<TaskDetail | null>(null),
    [members, setMembers] = useState<JobMember[]>([]),
    [owner, setOwner] = useState("");
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [feedback, setFeedback] = useState<
      {
        interviewer_id: string;
        score: number;
        recommendation: string;
        summary: string | null;
      }[]
    >([]);
  const [score, setScore] = useState("3"),
    [recommendation, setRecommendation] = useState("YES"),
    [summary, setSummary] = useState("");
  const [memberError, setMemberError] = useState(false);
  const pending = useRef<Record<string, unknown> | null>(null),
    active = useRef(true),
    closeButton = useRef<HTMLButtonElement>(null),
    dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    active.current = true;
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => {
      active.current = false;
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    async function load() {
      try {
        if (taskId) {
          const r = await taskCall<TaskDetail>({
            action: "detail",
            task_id: taskId,
          });
          if (!mounted) return;
          setDetail(r);
          setOwner(r.task.owner_id);
          if (r.task.job_id) {
            try {
              const roster = await listJobMembers(r.task.job_id);
              if (mounted) setMembers(roster.members);
            } catch {
              if (mounted) setMemberError(true);
            }
          }
        } else if (interview) {
          const { data, error: e } = await getClient().functions.invoke(
            "interviews",
            { body: { action: "feedback_list", interview_id: interview.id } },
          );
          if (e) throw new ApiError("Feedback unavailable", e.context?.status);
          if (data?.error) throw new Error(data.error);
          if (mounted) setFeedback(data?.feedback || []);
        }
      } catch (e) {
        if (mounted) {
          setError(
            en
              ? "Could not load details. Close and try again."
              : "Chưa tải được chi tiết. Đóng và thử lại.",
          );
          if (e instanceof ApiError && e.status === 401) onAccessLost();
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [taskId, interview, en, onAccessLost]);
  async function mutate(body: Record<string, unknown>, task: boolean) {
    if (saving) return;
    const command = pending.current || {
      ...body,
      request_id: crypto.randomUUID(),
    };
    pending.current = command;
    setSaving(true);
    setError("");
    try {
      if (task) await taskCall(command);
      else {
        const { data, error: e } = await getClient().functions.invoke(
          "interviews",
          { body: command },
        );
        if (e)
          throw new ApiError("Feedback submission failed", e.context?.status);
        if (data?.error) throw new Error(data.error);
      }
      pending.current = null;
      if (active.current) {
        onChanged();
        onClose();
      }
    } catch (e) {
      if (active.current) {
        setError(
          en
            ? "Could not confirm this update. Retry retains the same request."
            : "Chưa xác nhận được cập nhật. Thử lại sẽ giữ nguyên yêu cầu.",
        );
        if (e instanceof ApiError && e.status === 401) onAccessLost();
      }
    } finally {
      if (active.current) setSaving(false);
    }
  }
  const canReassign =
    !!detail &&
    detail.task.status === "OPEN" &&
    (roles.includes("ADMIN") ||
      detail.task.created_by === userId ||
      roles.includes("TA_RECRUITER"));
  const mine =
    interview?.is_participant &&
    !interview.feedback_submitted &&
    interview.status === "COMPLETED";
  const url = safeMeetingUrl(interview?.meeting_url || null);
  function trap(e: React.KeyboardEvent) {
    if (e.key === "Escape" && !saving) onClose();
    if (e.key !== "Tab") return;
    const nodes = dialog.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
    );
    if (!nodes?.length) return;
    const first = nodes[0],
      last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  return (
    <div className={styles.backdrop}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-work-heading"
        className={styles.dialog}
        onKeyDown={trap}
      >
        <header className={styles.dialogHead}>
          <h2 id="home-work-heading">
            {taskId
              ? en
                ? "Assigned task"
                : "Công việc được giao"
              : interview?.candidate_name}
          </h2>
          <button
            ref={closeButton}
            type="button"
            aria-label={en ? "Close details" : "Đóng chi tiết"}
            onClick={onClose}
            disabled={saving}
          >
            <X size={20} />
          </button>
        </header>
        {loading && (
          <p role="status">{en ? "Loading details…" : "Đang tải chi tiết…"}</p>
        )}
        {error && (
          <p role="alert" className={styles.inlineError}>
            {error}
          </p>
        )}
        {detail && (
          <>
            <h3>{detail.task.title}</h3>
            <p>
              <UserRound size={16} />{" "}
              {detail.task.owner_id === userId
                ? en
                  ? "Assigned to you"
                  : "Được giao cho bạn"
                : members.find((m) => m.user_id === detail.task.owner_id)
                    ?.email ||
                  (en ? "Assigned colleague" : "Đồng nghiệp được giao")}
            </p>
            <p>
              <CalendarClock size={16} />{" "}
              {detail.task.due_at
                ? new Intl.DateTimeFormat(en ? "en-GB" : "vi-VN", {
                    timeZone: HOME_TIME_ZONE,
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(detail.task.due_at))
                : en
                  ? "No due date"
                  : "Chưa có hạn xử lý"}
            </p>
            {canReassign && members.length > 0 && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void mutate(
                    {
                      action: "reassign",
                      task_id: detail.task.id,
                      owner_id: owner,
                    },
                    true,
                  );
                }}
              >
                <label>
                  {en ? "Assign to" : "Giao cho"}
                  <select
                    value={owner}
                    disabled={saving || !!pending.current}
                    onChange={(e) => setOwner(e.target.value)}
                  >
                    {!members.some(
                      (m) => m.user_id === detail.task.owner_id,
                    ) && (
                      <option value={detail.task.owner_id}>
                        {en ? "Current owner" : "Người phụ trách hiện tại"}
                      </option>
                    )}
                    {[
                      ...new Map(members.map((m) => [m.user_id, m])).values(),
                    ].map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.email} · {m.role}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  className={styles.primaryAction}
                  disabled={saving || owner === detail.task.owner_id}
                >
                  {en ? "Reassign task" : "Giao lại công việc"}
                </button>
              </form>
            )}
            {canReassign && memberError && (
              <p>
                {en
                  ? "The colleague list is unavailable with your current access. The task assignment is unchanged."
                  : "Chưa tải được danh sách đồng nghiệp theo quyền hiện tại. Phân công chưa thay đổi."}
              </p>
            )}
            {detail.task.status === "OPEN" &&
              (detail.task.owner_id === userId || roles.includes("ADMIN")) && (
                <button
                  type="button"
                  className={styles.outlineAction}
                  disabled={saving || !!pending.current}
                  onClick={() =>
                    void mutate(
                      { action: "complete", task_id: detail.task.id },
                      true,
                    )
                  }
                >
                  {en ? "Mark task complete" : "Hoàn tất công việc"}
                </button>
              )}
          </>
        )}
        {interview && (
          <>
            <p>
              {interview.job_title} ·{" "}
              {interviewKind(interview.interview_type, en)}
            </p>
            <p>
              <CalendarClock size={16} />
              {new Intl.DateTimeFormat(en ? "en-GB" : "vi-VN", {
                timeZone: HOME_TIME_ZONE,
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(interview.starts_at))}{" "}
              · GMT+7
            </p>
            <p>
              <MapPin size={16} />
              {interview.location ||
                (en ? "Location not specified" : "Chưa có địa điểm")}
            </p>
            {url && (
              <a
                className={styles.outlineAction}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Video size={16} />
                {en ? "Join meeting" : "Mở cuộc họp"}
              </a>
            )}
            <h3>{en ? "Interview team" : "Nhóm phỏng vấn"}</h3>
            <ul>
              {interview.participants?.map((p) => (
                <li key={p.id}>
                  {p.display_name} · {p.role}
                </li>
              ))}
            </ul>
            {!!feedback.length && (
              <>
                <h3>Feedback</h3>
                {feedback.map((f, i) => (
                  <p key={`${f.interviewer_id}-${i}`}>
                    {interview.participants.find(
                      (p) => p.id === f.interviewer_id,
                    )?.display_name || "—"}{" "}
                    · {f.score}/5 · {f.recommendation}
                    <br />
                    {f.summary}
                  </p>
                ))}
              </>
            )}
            {mine && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void mutate(
                    {
                      action: "feedback_submit",
                      interview_id: interview.id,
                      score: Number(score),
                      recommendation,
                      summary: summary.trim(),
                    },
                    false,
                  );
                }}
              >
                <h3>{en ? "Submit your feedback" : "Gửi đánh giá của bạn"}</h3>
                <label>
                  {en ? "Score" : "Điểm"}
                  <select
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    disabled={saving || !!pending.current}
                  >
                    {[1, 2, 3, 4, 5].map((s) => (
                      <option key={s} value={s}>
                        {s}/5
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {en ? "Recommendation" : "Đề xuất"}
                  <select
                    value={recommendation}
                    onChange={(e) => setRecommendation(e.target.value)}
                    disabled={saving || !!pending.current}
                  >
                    <option value="STRONG_YES">Strong yes</option>
                    <option value="YES">Yes</option>
                    <option value="NO">No</option>
                    <option value="STRONG_NO">Strong no</option>
                  </select>
                </label>
                <label>
                  {en ? "Summary" : "Nhận xét"}
                  <textarea
                    value={summary}
                    maxLength={4000}
                    onChange={(e) => setSummary(e.target.value)}
                    disabled={saving || !!pending.current}
                  />
                </label>
                <button
                  className={styles.primaryAction}
                  disabled={saving || loading}
                  type="submit"
                >
                  {en ? "Submit feedback" : "Gửi feedback"}
                </button>
              </form>
            )}
            {!mine && (
              <p>
                {en
                  ? "Feedback can be submitted by an assigned participant after the interview is marked complete."
                  : "Người tham gia được phân công có thể gửi feedback khi buổi phỏng vấn được đánh dấu hoàn tất."}
              </p>
            )}
          </>
        )}
        {pending.current && !saving && (
          <button
            type="button"
            className={styles.outlineAction}
            onClick={() => void mutate(pending.current!, !!taskId)}
          >
            {en ? "Retry update" : "Thử lại cập nhật"}
          </button>
        )}
      </div>
    </div>
  );
}
