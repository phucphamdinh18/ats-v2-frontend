import { ApiError, getClient } from "./supabase";

export type OfferStatus = "PENDING" | "APPROVED" | "REJECTED" | "SENT" | "ACCEPTED" | "DECLINED" | "WITHDRAWN" | "EXPIRED";
export type OfferProposal = {
  id: string; application_id: string; job_id: string; job_code: string | null; job_title: string;
  candidate_name: string; currency: string; base_salary: number;
  proposed_start_date: string | null; status: OfferStatus;
  created_at: string; updated_at: string; sent_at: string | null;
  expires_at: string | null; responded_at: string | null;
};
export type OfferProposalDetail = {
  offer: OfferProposal & { notes: string | null; decision_note: string | null; response_note: string | null; };
  application: { id: string; stage: string; status: string };
  candidate: { id: string; full_name: string; current_title: string | null; primary_role: string | null; total_experience_years: number | null; seniority: string | null; location: string | null; current_company: string | null };
  job: { id: string; job_code: string | null; title: string; business_unit: string | null; location: string | null };
  events: { event_type: string; created_at: string; actor_id: string; actor_name: string | null }[];
};
async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getClient().functions.invoke("offers", { body });
  if (error) {
    let message = "Không thể tải thông tin Offer.";
    try { const result = await error.context?.json(); if (typeof result?.error === "string") message = result.error; } catch { /* no JSON body */ }
    throw new ApiError(message, error.context?.status);
  }
  if (data?.error) throw new ApiError(String(data.error), data.status);
  return data as T;
}
export async function listOfferProposals(jobId: string, limit = 25, offset = 0) {
  if (!jobId || !Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0)
    throw new Error("Phạm vi Offer không hợp lệ.");
  const data = await call<{ offers: OfferProposal[]; limit: number; offset: number }>({ action: "list", job_id: jobId, limit, offset });
  if (!Array.isArray(data?.offers)) throw new ApiError("API Offers trả dữ liệu không đúng định dạng.");
  return data;
}
export async function offerProposalDetail(offerId: string): Promise<OfferProposalDetail> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(offerId))
    throw new Error("Offer ID không hợp lệ.");
  const data = await call<OfferProposalDetail>({ action: "detail", offer_id: offerId });
  if (!data?.offer || !data?.candidate) throw new ApiError("Dữ liệu chi tiết Offer không đầy đủ.");
  return data;
}
