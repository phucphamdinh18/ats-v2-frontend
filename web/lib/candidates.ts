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
  subSource: string;
};

export type ManualCandidateResult = {
  candidate_id: string;
  application_id: string;
  created: boolean;
};

export type Candidate = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  current_title: string | null;
  primary_role: string | null;
  total_experience_years: number | null;
  seniority: string | null;
  location: string | null;
  current_company: string | null;
  created_at: string;
};
export type CandidateDocument = {
  drive_file_id: string;
  drive_url: string;
  original_name: string;
  created_at: string;
};
export type CandidateApplication = {
  id: string;
  job_id: string;
  stage: string;
  status: string;
  source: string | null;
  created_at: string;
};
export type CandidateProfile = {
  candidate: Candidate;
  documents: CandidateDocument[];
  applications: CandidateApplication[];
};

async function candidateCall<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getClient().functions.invoke("candidates", { body });
  if (error) {
    let message = "Không tải được hồ sơ ứng viên. Vui lòng thử lại.";
    try {
      const payload = await error.context?.json();
      if (typeof payload?.error === "string") message = payload.error;
    } catch { /* Network errors may have no response body. */ }
    throw new ApiError(message, error.context?.status);
  }
  if (data?.error) throw new ApiError(data.error, data.status);
  return data as T;
}

export async function listCandidates(query: string, limit: number, offset: number) {
  return candidateCall<{ candidates: Candidate[]; limit: number; offset: number }>({
    action: "list", query: query.trim() || null, limit, offset,
  });
}

export async function candidateProfile(candidateId: string) {
  return candidateCall<CandidateProfile>({ action: "detail", candidate_id: candidateId });
}

export async function createManualCandidateApplication(input: ManualCandidateInput) {
  return candidateCall<{ result: ManualCandidateResult }>({
    action: "create_and_apply",
    request_id: input.requestId,
    job_id: input.jobId,
    full_name: input.fullName,
    email: input.email || null,
    phone: input.phone || null,
    current_title: input.currentTitle || null,
    drive_url: input.driveUrl,
    document_name: input.documentName,
    sub_source: input.subSource,
  }).then(({ result }) => result);
}
