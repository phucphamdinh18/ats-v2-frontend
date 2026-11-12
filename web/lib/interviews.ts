import { ApiError, getClient } from "./supabase";
export type InterviewPerson = {
  id: string;
  display_name: string;
  role: string;
};
export type InterviewRow = {
  id: string;
  application_id: string;
  job_id: string;
  job_title: string;
  job_code: string | null;
  candidate_name: string;
  interview_type: string;
  status: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  location: string | null;
  meeting_url: string | null;
  can_manage: boolean;
  can_decide: boolean;
  is_participant: boolean;
  feedback_submitted: boolean;
  feedback_count: number;
  participants: InterviewPerson[];
};
export type Feedback = {
  id: string;
  interviewer_id: string;
  score: number;
  recommendation: string;
  strengths: string | null;
  concerns: string | null;
  summary: string | null;
  submitted_at: string;
};
export type Decision = {
  id: string;
  decision: string;
  note: string | null;
  decided_at: string;
};
export async function interviewCall<T>(
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await getClient().functions.invoke("interviews", {
    body,
  });
  if (error) {
    let code = "INTERVIEW_REQUEST_FAILED";
    try {
      const payload = await error.context?.json();
      if (typeof payload?.code === "string") code = payload.code;
    } catch {}
    throw new ApiError(code, error.context?.status);
  }
  if (data?.error)
    throw new ApiError(data.code || "INTERVIEW_REQUEST_FAILED", data.status);
  return data as T;
}
export function safeMeetingUrl(value: string | null) {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export const interviewErrors: Record<string, [string, string]> = {
  INTERVIEW_ACCESS_REQUIRED: [
    "Bạn không có quyền với lịch phỏng vấn này.",
    "You do not have access to this interview.",
  ],
  INTERVIEW_CONTEXT_ACCESS_REQUIRED: [
    "Bạn không có quyền xem buổi phỏng vấn này.",
    "You do not have access to this interview.",
  ],
  INTERVIEW_PARTICIPANT_NOT_FOUND: [
    "Người phỏng vấn không còn thuộc Job. Hãy tải lại danh sách.",
    "An interviewer is no longer assigned to this job. Refresh the roster.",
  ],
  APPLICATION_NOT_READY: [
    "Hồ sơ cần ở vòng Sơ loại hoặc Phỏng vấn và đang xử lý.",
    "The application must be active in Screening or Interview.",
  ],
  INTERVIEW_NOT_READY: [
    "Buổi phỏng vấn chưa bắt đầu hoặc chưa được hoàn tất.",
    "The interview has not started or has not been completed.",
  ],
  INTERVIEW_NOT_COMPLETED: [
    "Hãy hoàn tất buổi phỏng vấn trước.",
    "Complete the interview first.",
  ],
  INTERVIEW_FEEDBACK_REQUIRED: [
    "Cần ít nhất một feedback trước khi ghi quyết định.",
    "At least one feedback is required before recording a decision.",
  ],
  FEEDBACK_ALREADY_SUBMITTED: [
    "Bạn đã gửi feedback cho buổi này.",
    "You have already submitted feedback for this interview.",
  ],
  INVALID_REQUEST_REUSE: [
    "Yêu cầu này đã dùng với nội dung khác. Hãy tải lại lịch.",
    "This request was used with different details. Refresh the interviews.",
  ],
  INVALID_INPUT: [
    "Kiểm tra lại thông tin đã nhập.",
    "Check the information you entered.",
  ],
};
