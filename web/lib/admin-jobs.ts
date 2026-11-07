import { ApiError, getClient } from "./supabase";

export type JobMember = { user_id: string; email: string; role: string; assigned_at: string };

async function adminCall<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getClient().functions.invoke("admin-jobs", { body });
  if (error) {
    let message = "Không thực hiện được thao tác quản trị. Vui lòng thử lại.";
    try {
      const payload = await error.context?.json();
      if (typeof payload?.error === "string") message = payload.error;
    } catch { /* Network failures may not include a response body. */ }
    throw new ApiError(message, error.context?.status);
  }
  if (data?.error) throw new ApiError(data.error, data.status);
  return data as T;
}

export function createJobDraft(input: { requestId: string; title: string; businessUnit: string; location: string }) {
  return adminCall<{ job: { job_id: string; job_title: string; job_status: string; created: boolean } }>({
    action: "create_job_draft", request_id: input.requestId, title: input.title,
    business_unit: input.businessUnit, location: input.location,
  });
}

export function openJob(jobId: string, expectedTitle: string, jobCode: string) {
  return adminCall<{ job: { job_id: string; job_status: string; opened: boolean } }>({
    action: "open_job", job_id: jobId, expected_title: expectedTitle, job_code: jobCode,
  });
}

export function assignJobMember(jobId: string, email: string, role: string) {
  return adminCall<{ member: { target_user_id: string; target_email: string; assigned_role: string; added: boolean } }>({
    action: "assign_job_member", job_id: jobId, email, role,
  });
}

export function listJobMembers(jobId: string) {
  return adminCall<{ members: JobMember[] }>({ action: "list_job_members", job_id: jobId });
}

export function removeJobMember(jobId: string, userId: string, role: string) {
  return adminCall<{ removed: boolean }>({ action: "remove_job_member", job_id: jobId, user_id: userId, role });
}
