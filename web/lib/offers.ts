import { ApiError, getClient } from "./supabase";
import type { Application } from "./applications";

export type OfferBoardItem = {
  application_id: string;
  offer_status: "PENDING" | "APPROVED";
  application: Application;
};

/** Returns only a safe board projection; salary and offer notes are excluded. */
export async function listOfferBoard(jobId: string) {
  const { data, error } = await getClient().functions.invoke("offers", {
    body: { action: "board", job_id: jobId },
  });
  if (error) {
    let message = "Không tải được cột Offer. Vui lòng thử lại.";
    try {
      const payload = await error.context?.json();
      if (typeof payload?.error === "string") message = payload.error;
    } catch {
      // Network failures do not necessarily carry a response body.
    }
    throw new ApiError(message, error.context?.status);
  }
  if (data?.error) throw new ApiError(data.error, data.status);
  if (!Array.isArray(data?.applications)) {
    throw new ApiError("API Offer chưa trả đúng dữ liệu Pipeline.");
  }
  return data as { applications: OfferBoardItem[] };
}
