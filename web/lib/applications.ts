import { ApiError, getClient } from "./supabase";

export type Application = {
  application_id: string;
  candidate_id: string;
  candidate_name: string;
  stage: string;
  status: string;
  source: string | null;
  created_at: string;
};

export type ApplicationEvent = {
  event_id: string;
  actor_id: string;
  event_type: string;
  from_stage: string | null;
  to_stage: string | null;
  created_at: string;
  actor_display_name: string;

};

export type ApplicationDetail = {
  application: Application;
  events: ApplicationEvent[];
  event_count: number;
  limit: number;
  offset: number;
  // Applications not created through Matching return null.
  matching_context?: unknown | null;
};

type ListResponse = { applications: Application[]; limit: number; offset: number };

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getClient().functions.invoke("applications", { body });
  if (error) {
    let message = "Không tải được dữ liệu Application. Vui lòng thử lại.";
    try {
      const payload = await error.context?.json();
      if (typeof payload?.error === "string") message = payload.error;
    } catch {
      // A network failure does not necessarily have a JSON response body.
    }
    throw new ApiError(message, error.context?.status);
  }
  if (data?.error) throw new ApiError(data.error, data.status);
  return data as T;
}

export function listApplications(jobId: string, limit: number, offset: number) {
  return call<ListResponse>({ action: "list", job_id: jobId, limit, offset });
}

export function searchApplications(jobId: string, query: string, limit: number, offset: number) {
  return call<ListResponse>({ action: "search", job_id: jobId, query, limit, offset });
}

export function applicationDetail(jobId: string, applicationId: string) {
  return call<ApplicationDetail>({ action: "detail", job_id: jobId, application_id: applicationId });
}

export type ScreenApplicationResult = {
  application: { application_id: string; changed: boolean };
};

export function screenApplication(applicationId: string, requestId: string) {
  return call<ScreenApplicationResult>({
    action: "screen",
    application_id: applicationId,
    request_id: requestId,
  });
}

export function interviewApplication(applicationId: string, requestId: string) {
  return call<ScreenApplicationResult>({
    action: "interview",
    application_id: applicationId,
    request_id: requestId,
  });
}

export function moveApplicationBack(applicationId: string, targetStage: "NEW" | "SCREEN", requestId: string) {
  return call<ScreenApplicationResult>({
    action: "move_back",
    application_id: applicationId,
    target_stage: targetStage,
    request_id: requestId,
  });
}
