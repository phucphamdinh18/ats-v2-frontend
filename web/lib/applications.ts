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

export type JobSourceMetric = { source: string; sub_source: string; source_ownership: string; count: number };
export type JobOverview = {
  job_id: string; total_candidates: number; new_count: number; screening_count: number;
  interview_count: number; hired_count: number; rejected_count: number; source_summary: JobSourceMetric[];
};

export async function jobOverview() {
  return call<{ jobs: JobOverview[] }>({ action: "overview" });
}

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

function humanize(message: string): string {
  return message.replace(/Applications?/gi, "hồ sơ trong Job");
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getClient().functions.invoke("applications", { body });
  if (error) {
    let message = "Không tải được hồ sơ trong Job. Vui lòng thử lại.";
    try {
      const payload = await error.context?.json();
      if (typeof payload?.error === "string") message = humanize(payload.error);
    } catch {
      // A network failure does not necessarily have a JSON response body.
    }
    throw new ApiError(message, error.context?.status);
  }
  if (data?.error) throw new ApiError(humanize(data.error), data.status);
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

export type ApplicationNote = { id: string; body: string; author_name: string | null; created_at: string };
export const APPLICATION_NOTE_LIMIT = 1000;
const NOTES_PAGE_SIZE = 25;

export async function listApplicationNotes(jobId: string, applicationId: string, beforeId?: string) {
  const { notes } = await call<{ notes: ApplicationNote[] }>({
    action: "notes", job_id: jobId, application_id: applicationId, before_id: beforeId,
  });
  return {
    notes: notes.slice(0, NOTES_PAGE_SIZE),
    nextBeforeId: notes.length > NOTES_PAGE_SIZE ? notes[NOTES_PAGE_SIZE - 1].id : undefined,
  };
}

export async function addApplicationNote(jobId: string, applicationId: string, requestId: string, body: string) {
  const { note } = await call<{ note: ApplicationNote }>({
    action: "add_note", job_id: jobId, application_id: applicationId, request_id: requestId, note: body,
  });
  return note;
}

export type ApplicationInterviewRound = {
  application_id: string;
  round_number: number;
  interview_status: "SCHEDULED" | "COMPLETED";
};

export async function currentInterviewRounds(jobId: string, applicationIds: string[]) {
  const ids = [...new Set(applicationIds)];
  const rounds = new Map<string, ApplicationInterviewRound>();
  for (let start = 0; start < ids.length; start += 100) {
    const response = await call<{ rounds: ApplicationInterviewRound[] }>({
      action: "interview_rounds", job_id: jobId, application_ids: ids.slice(start, start + 100),
    });
    for (const round of response.rounds) rounds.set(round.application_id, round);
  }
  return rounds;
}

export type ScreenApplicationResult = {
  application: { application_id: string; changed: boolean };
};

export function createApplication(candidateId: string, jobId: string, requestId: string, source: string, subSource: string) {
  return call<{ application: { application_id: string; changed?: boolean } }>({
    action: "create",
    candidate_id: candidateId,
    job_id: jobId,
    source,
    sub_source: subSource,
    request_id: requestId,
  });
}

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
