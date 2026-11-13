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
): Promise<InterviewWorklistItem[]> {
  if (!["SCHEDULED", "COMPLETED", "CANCELLED"].includes(status) ||
      !Number.isInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isInteger(offset) || offset < 0)
    throw new Error("Bộ lọc lịch phỏng vấn không hợp lệ.");

  const { data, error } = await getClient().functions.invoke("interviews", {
    body: { action: "worklist", status, limit, offset },
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
