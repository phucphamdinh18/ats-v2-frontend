import type { Job } from "./policy";
import { ApiError, getClient } from "./supabase";

export type JobMember = {
  user_id: string;
  email: string;
  role: string;
  assigned_at: string;
  display_name?: string | null;
  ta_assignment?: "PRIMARY" | "SUPPORT" | null;
};
export type JobMetadataInput = {
  jobId: string;
  level: number;
  functionGroup: string;
  hiringSeason: string;
  reqDate: string | null;
  requestType: string;
  priority: string;
  replacementFor: string;
};

async function adminCall<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getClient().functions.invoke("admin-jobs", {
    body,
  });
  if (error) {
    let message = "Không thực hiện được thao tác quản trị. Vui lòng thử lại.";
    try {
      const payload = await error.context?.json();
      if (typeof payload?.error === "string") message = payload.error;
    } catch {
      /* Network failures may not include a response body. */
    }
    throw new ApiError(message, error.context?.status);
  }
  if (data?.error) throw new ApiError(data.error, data.status);
  return data as T;
}

export function createJobDraft(input: {
  requestId: string;
  title: string;
  businessUnit: string;
  location: string;
}) {
  return adminCall<{
    job: {
      job_id: string;
      job_title: string;
      job_status: string;
      created: boolean;
    };
  }>({
    action: "create_job_draft",
    request_id: input.requestId,
    title: input.title,
    business_unit: input.businessUnit,
    location: input.location,
  });
}

export function updateJobMetadata(input: JobMetadataInput) {
  return adminCall<{ job: Record<string, unknown> }>({
    action: "update_job_metadata",
    job_id: input.jobId,
    level: input.level,
    function_group: input.functionGroup,
    hiring_season: input.hiringSeason,
    req_date: input.reqDate,
    request_type: input.requestType,
    priority: input.priority,
    replacement_for: input.replacementFor,
  });
}

export function openJob(jobId: string, expectedTitle: string, jobCode: string) {
  return adminCall<{
    job: { job_id: string; job_status: string; opened: boolean };
  }>({
    action: "open_job",
    job_id: jobId,
    expected_title: expectedTitle,
    job_code: jobCode,
  });
}

export function assignJobMember(jobId: string, email: string, role: string) {
  return adminCall<{
    member: {
      target_user_id: string;
      target_email: string;
      assigned_role: string;
      added: boolean;
    };
  }>({
    action: "assign_job_member",
    job_id: jobId,
    email,
    role,
  });
}

export function listJobMembers(jobId: string) {
  return adminCall<{ members: JobMember[] }>({
    action: "list_job_members",
    job_id: jobId,
  });
}

export function removeJobMember(jobId: string, userId: string, role: string) {
  return adminCall<{ removed: boolean }>({
    action: "remove_job_member",
    job_id: jobId,
    user_id: userId,
    role,
  });
}

export type JobOpeningFields = {
  title: string;
  business_unit: string;
  location: string;
  level: number;
  function_group: string;
  hiring_season: string;
  req_date: string | null;
  request_type: string;
  priority: string;
  replacement_for: string;
  status: "DRAFT" | "OPEN";
};
export type JobOpeningCommand = {
  requestId: string;
  jobId: string | null;
  expectedUpdatedAt: string | null;
  fields: JobOpeningFields;
};
export type JobOpeningResult = {
  job_id: string;
  job_title: string;
  job_status: string;
  job_code: string;
  changed: boolean;
};
export type JobOpeningEditor = Job & { updated_at: string };
export function saveJobOpening(input: JobOpeningCommand) {
  return adminCall<{ job: JobOpeningResult }>({
    action: "save_job_opening",
    request_id: input.requestId,
    job_id: input.jobId,
    expected_updated_at: input.expectedUpdatedAt,
    fields: input.fields,
  });
}
export function getJobOpening(jobId: string) {
  return adminCall<{ job: JobOpeningEditor }>({
    action: "get_job_opening",
    job_id: jobId,
  });
}

export type JobRecruiter = {
  job_id: string;
  user_id: string;
  display_name: string | null;
  email: string;
  ta_assignment: "PRIMARY" | "SUPPORT" | null;
};
export async function listJobRecruiters(jobIds: string[]): Promise<JobRecruiter[]> {
  const ids = [...new Set(jobIds)];
  const rows: JobRecruiter[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const r = await adminCall<{ recruiters: JobRecruiter[] }>({
      action: "list_job_recruiters", job_ids: ids.slice(i, i + 50),
    });
    if (!Array.isArray(r.recruiters)) throw new Error("Không tải được phân công TA.");
    rows.push(...r.recruiters);
  }
  return rows;
}
export function assignJobRecruiter(input: {
  jobId: string; email: string; assignment: "PRIMARY" | "SUPPORT";
  expectedPrimary: string | null; requestId: string;
}) {
  return adminCall<{ member: JobRecruiter }>({
    action: "assign_job_recruiter", job_id: input.jobId, email: input.email,
    ta_assignment: input.assignment, expected_primary: input.expectedPrimary,
    request_id: input.requestId,
  });
}
