import { ApiError, getClient } from "./supabase";

export type ManualCandidateInput = {
  requestId: string;
  jobId: string;
  fullName: string;
  email: string;
  phone: string;
  currentTitle: string;
  driveUrl: string;
  documentName: string;
};

export type ManualCandidateResult = {
  candidate_id: string;
  application_id: string;
  created: boolean;
};

export async function createManualCandidateApplication(input: ManualCandidateInput) {
  const { data, error } = await getClient().functions.invoke("candidates", {
    body: {
      action: "create_and_apply",
      request_id: input.requestId,
      job_id: input.jobId,
      full_name: input.fullName,
      email: input.email || null,
      phone: input.phone || null,
      current_title: input.currentTitle || null,
      drive_url: input.driveUrl,
      document_name: input.documentName,
    },
  });
  if (error) {
    let message = "Không tạo được Candidate và Application. Vui lòng thử lại.";
    try {
      const payload = await error.context?.json();
      if (typeof payload?.error === "string") message = payload.error;
    } catch {
      // Network failures do not necessarily include a JSON response.
    }
    throw new ApiError(message, error.context?.status);
  }
  if (data?.error) throw new ApiError(data.error, data.status);
  return data?.result as ManualCandidateResult;
}
