import { ApiError, getClient } from "./supabase";

export type InterviewStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";
export type InterviewWorklistItem = {
  id: string;
  application_id: string;
  job_id: string;
  job_title: string;
  job_code: string | null;
  candidate_name: string;
  interview_type: "PHONE_SCREEN" | "INTERVIEW" | "FINAL" | string;
  status: InterviewStatus;
  starts_at: string;
  ends_at: string;
  timezone: string | null;
  location: string | null;
  meeting_url: string | null;
  can_manage: boolean;
  can_decide: boolean;
  is_participant: boolean;
  feedback_submitted: boolean;
  feedback_count: number;
  participants: { id: string; display_name: string; role: string }[];
};

export async function listInterviewWorklist(
  status: InterviewStatus,
  limit = 25,
  offset = 0,
  applicationId?: string,
): Promise<InterviewWorklistItem[]> {
  if (!["SCHEDULED", "COMPLETED", "CANCELLED"].includes(status) ||
      !Number.isInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isInteger(offset) || offset < 0 ||
      (applicationId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(applicationId)))
    throw new Error("Bộ lọc lịch phỏng vấn không hợp lệ.");

  const { data, error } = await getClient().functions.invoke("interviews", {
    body: { action: "worklist", status, limit, offset, ...(applicationId ? { application_id: applicationId } : {}) },
  });

  if (error) {
    let message = "Không tải được lịch phỏng vấn.";
    try {
      const response = await error.context?.json();
      if (typeof response?.error === "string") message = response.error;
    } catch { /* Transport errors may not return JSON. */ }
    throw new ApiError(message, error.context?.status);
  }
  if (data?.error) throw new ApiError(String(data.error), data.status);
  if (!Array.isArray(data?.interviews)) throw new ApiError("API Interviews trả dữ liệu không đúng định dạng.");
  return data.interviews as InterviewWorklistItem[];
}

export type InterviewBusySlot = {
  participant_id: string;
  starts_at: string;
  ends_at: string;
  source: "ATS" | "GOOGLE";
};
export type InterviewGoogleCalendarStatus = {
  participant_id: string;
  status: "AVAILABLE" | "NO_ACCESS" | "NO_EMAIL" | "NOT_CONFIGURED" | "NOT_CONNECTED" | "EMAIL_MISMATCH" | "REAUTH_REQUIRED" | "UNAVAILABLE";
  can_create_events?: boolean;
};
export type InterviewAvailability = {
  busy_slots: InterviewBusySlot[];
  google_calendars: InterviewGoogleCalendarStatus[];
};

export type InterviewRosterMember = {
  id: string;
  display_name: string;
  email?: string | null;
  role: "INTERVIEWER" | "HIRING_MANAGER" | "TA_RECRUITER";
  can_invite?: boolean;
  is_current_actor?: boolean;
};

export async function listInterviewRoster(applicationId: string): Promise<InterviewRosterMember[]> {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(applicationId)) throw new Error("Application không hợp lệ.");
  const { data, error } = await getClient().functions.invoke("interviews", { body: { action: "roster", application_id: applicationId } });
  if (error) {
    let message = "Không tải được danh sách người tham gia.";
    try { const response = await error.context?.json(); if (typeof response?.error === "string") message = response.error; } catch { /* Network errors may not include JSON. */ }
    throw new ApiError(message, error.context?.status);
  }
  if (data?.error) throw new ApiError(String(data.error), data.status);
  if (!Array.isArray(data?.participants)) throw new ApiError("Danh sách người tham gia không đúng định dạng.");
  return data.participants as InterviewRosterMember[];
}

export async function listInterviewAvailability(
  applicationId: string,
  participantIds: string[],
  startsAt: string,
  endsAt: string,
  timezone = "Asia/Ho_Chi_Minh",
): Promise<InterviewAvailability> {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  if (!uuidPattern.test(applicationId) || participantIds.length < 1 || participantIds.length > 20 ||
      participantIds.some((id) => !uuidPattern.test(id)) ||
      new Set(participantIds).size !== participantIds.length ||
      !Number.isFinite(start) || !Number.isFinite(end) || start >= end || end - start > 14 * 24 * 60 * 60 * 1000) {
    throw new Error("Thông tin xem lịch người tham gia không hợp lệ.");
  }
  const { data, error } = await getClient().functions.invoke("interviews", {
    body: { action: "availability", application_id: applicationId, participant_ids: participantIds, starts_at: startsAt, ends_at: endsAt, timezone },
  });
  if (error) {
    let message = "Không tải được lịch người tham gia.";
    try {
      const response = await error.context?.json();
      if (typeof response?.error === "string") message = response.error;
    } catch { /* Transport errors may not return JSON. */ }
    throw new ApiError(message, error.context?.status);
  }
  if (data?.error) throw new ApiError(String(data.error), data.status);
  if (!Array.isArray(data?.busy_slots) || !Array.isArray(data?.google_calendars)) throw new ApiError("API lịch bận/rảnh trả dữ liệu không đúng định dạng.");
  return { busy_slots: data.busy_slots as InterviewBusySlot[], google_calendars: data.google_calendars as InterviewGoogleCalendarStatus[] };
}

export type CreateInterviewInput = {
  request_id: string;
  application_id: string;
  participant_ids: string[];
  starts_at: string;
  ends_at: string;
  interview_type: "PHONE_SCREEN" | "INTERVIEW" | "FINAL";
  timezone: string;
  location?: string;
  meeting_url?: string;
  notes?: string;
};

export type InterviewCalendarSync = { status: "SYNCED" | "SYNC_FAILED"; invitation_requested?: boolean; event_url?: string | null; code?: string };

export async function createInterview(input: CreateInterviewInput): Promise<{ interview_id: string; created: boolean; calendar_sync: InterviewCalendarSync }> {
  const { data, error } = await getClient().functions.invoke("interviews", { body: { action: "create", ...input } });
  if (error) {
    let message = "Không thể đặt lịch phỏng vấn.";
    try { const response = await error.context?.json(); if (typeof response?.error === "string") message = response.error; } catch { /* Network errors may not include JSON. */ }
    throw new ApiError(message, error.context?.status);
  }
  if (data?.error) throw new ApiError(String(data.error), data.status);
  if (typeof data?.interview?.interview_id !== "string" || typeof data?.interview?.created !== "boolean" ||
      !data?.interview?.calendar_sync || !["SYNCED", "SYNC_FAILED"].includes(data.interview.calendar_sync.status)) {
    throw new ApiError("Backend trả kết quả đặt lịch không đúng định dạng.");
  }
  return data.interview as { interview_id: string; created: boolean; calendar_sync: InterviewCalendarSync };
}

export async function syncInterviewGoogleCalendar(interviewId: string): Promise<InterviewCalendarSync> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(interviewId)) throw new Error("Lịch phỏng vấn không hợp lệ.");
  const { data, error } = await getClient().functions.invoke("interviews", { body: { action: "sync_google", interview_id: interviewId } });
  if (error) {
    let message = "Không thể đồng bộ lịch Google.";
    try { const response = await error.context?.json(); if (typeof response?.error === "string") message = response.error; } catch { /* Network failures may not include JSON. */ }
    throw new ApiError(message, error.context?.status);
  }
  if (data?.error) throw new ApiError(String(data.error), data.status);
  if (!data?.calendar_sync || !["SYNCED", "SYNC_FAILED"].includes(data.calendar_sync.status)) throw new ApiError("Backend trả trạng thái đồng bộ không đúng định dạng.");
  return data.calendar_sync as InterviewCalendarSync;
}

export type InterviewFeedback = {
  id: string;
  interview_id: string;
  interviewer_id: string;
  score: number;
  recommendation: "STRONG_YES" | "YES" | "NO" | "STRONG_NO";
  strengths: string | null;
  concerns: string | null;
  summary: string | null;
  submitted_at: string;
};
export type InterviewDecision = {
  id: string;
  decision: "PROCEED" | "HOLD" | "DECLINE";
  note: string | null;
  decided_by: string;
  decided_at: string;
};

async function interviewCommand<T>(body: Record<string, unknown>, key: string): Promise<T> {
  const { data, error } = await getClient().functions.invoke("interviews", { body });
  if (error) {
    let message = "Không thể xử lý lịch phỏng vấn.";
    try { const response = await error.context?.json(); if (typeof response?.error === "string") message = response.error; } catch { /* Transport errors may not include JSON. */ }
    throw new ApiError(message, error.context?.status);
  }
  if (data?.error) throw new ApiError(String(data.error), data.status);
  if (!data || !(key in data)) throw new ApiError("Backend trả kết quả lịch phỏng vấn không đúng định dạng.");
  return data[key] as T;
}

function assertInterviewId(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error("Lịch phỏng vấn không hợp lệ.");
}

export async function completeInterview(interviewId: string) {
  assertInterviewId(interviewId);
  return interviewCommand<{ interview_id: string; completed: boolean }>({ action: "complete", request_id: crypto.randomUUID(), interview_id: interviewId }, "interview");
}

export async function cancelInterview(interviewId: string) {
  assertInterviewId(interviewId);
  return interviewCommand<{ interview_id: string; cancelled: boolean; calendar_sync?: { status: string; code?: string } }>({ action: "cancel", request_id: crypto.randomUUID(), interview_id: interviewId }, "interview");
}

export async function listInterviewFeedback(interviewId: string) {
  assertInterviewId(interviewId);
  return interviewCommand<InterviewFeedback[]>({ action: "feedback_list", interview_id: interviewId }, "feedback");
}

export async function submitInterviewFeedback(input: {
  interviewId: string;
  score: number;
  recommendation: InterviewFeedback["recommendation"];
  strengths?: string;
  concerns?: string;
  summary?: string;
}) {
  assertInterviewId(input.interviewId);
  if (!Number.isInteger(input.score) || input.score < 1 || input.score > 5 ||
      [input.strengths, input.concerns, input.summary].some((value) => value !== undefined && value.length > 4000)) throw new Error("Feedback chưa hợp lệ.");
  return interviewCommand<{ feedback_id: string; submitted: boolean }>({
    action: "feedback_submit", request_id: crypto.randomUUID(), interview_id: input.interviewId,
    score: input.score, recommendation: input.recommendation, strengths: input.strengths || null,
    concerns: input.concerns || null, summary: input.summary || null,
  }, "feedback");
}

export async function listInterviewDecisions(interviewId: string) {
  assertInterviewId(interviewId);
  return interviewCommand<InterviewDecision[]>({ action: "decision_list", interview_id: interviewId }, "decisions");
}

export async function submitInterviewDecision(input: {
  interviewId: string;
  decision: InterviewDecision["decision"];
  note?: string;
}) {
  assertInterviewId(input.interviewId);
  if (!(["PROCEED", "HOLD", "DECLINE"] as string[]).includes(input.decision) || (input.note?.length ?? 0) > 1000 || (input.decision === "DECLINE" && !input.note?.trim())) throw new Error("Cần nhập lý do khi từ chối ứng viên.");
  return interviewCommand<{ decision_id: string; created: boolean }>({
    action: "decision_submit", request_id: crypto.randomUUID(), interview_id: input.interviewId,
    decision: input.decision, note: input.note || null,
  }, "decision");
}
