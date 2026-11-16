import { ApiError, getClient } from "./supabase";
export type ProposalFields = {
  level: string;
  department: string;
  function: string;
  salary: number;
  currency: string;
  salary_period: "MONTH" | "YEAR";
  start_date: string;
  benefits?: string;
  notes?: string;
};
export type WorkflowOffer = {
  id: string;
  application_id: string;
  candidate_name: string;
  job_title: string;
  job_id: string;
  status: string;
  version: number;
  revision: number;
  fields: ProposalFields;
  snapshot:
    | (ProposalFields & {
        candidate_name: string;
        candidate_email: string;
        job_title: string;
        job_id: string;
      })
    | null;
  approver_id: string | null;
  template_id: string | null;
  decision_note: string | null;
  created_at: string;
  sent_at: string | null;
  can_edit: boolean;
  can_approve: boolean;
  deliveries: {
    id: string;
    kind: string;
    state: string;
    error_code: string | null;
    drive_pdf_id: string | null;
  }[];
  events: { type: string; actor_name: string | null; at: string }[];
};
export type OfferSetup = {
  approvers: { id: string; display_name: string | null }[];
  templates: { id: string; name: string; version: number }[];
};
export const OFFER_RETURN_KEY = "ats.offer.return";
export const offerUuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function offerWorkflow<T>(
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await getClient().functions.invoke("offer-workflow", {
    body,
  });
  if (error) {
    let message = "Không xử lý được Offer Proposal.";
    try {
      const payload = await error.context?.json();
      if (typeof payload?.error === "string") message = payload.error;
    } catch {}
    throw new ApiError(message, error.context?.status);
  }
  if (data?.error) throw new ApiError(String(data.error), data.status);
  if (!data || !Object.prototype.hasOwnProperty.call(data, "result"))
    throw new ApiError("API Offer chưa sẵn sàng.");
  return data.result as T;
}
export function approvalReturnPath(basePath: string, offerId: string) {
  return offerUuid.test(offerId)
    ? `${basePath}/offer-approval/?offer=${encodeURIComponent(offerId)}`
    : null;
}

export function offerError(error: unknown, en = false) {
  const code = error instanceof Error ? error.message : "";
  const messages: Record<string, [string, string]> = {
    ADMIN_REQUIRED: [
      "Chỉ Admin được thay đổi cấu hình.",
      "Only Admin may change this setting.",
    ],
    OFFER_ACCESS_REQUIRED: [
      "Bạn không còn quyền xử lý đề xuất này.",
      "You no longer have access to this proposal.",
    ],
    OFFER_APPROVAL_REQUIRED: [
      "Bạn không được chỉ định duyệt đề xuất này.",
      "You are not the assigned approver.",
    ],
    STALE_OFFER: [
      "Bản nháp đã thay đổi. Hãy tải lại trước khi lưu.",
      "The draft changed. Reload it before saving.",
    ],
    OFFER_IMMUTABLE: [
      "Đề xuất đã gửi duyệt không được sửa trực tiếp.",
      "A submitted proposal cannot be edited.",
    ],
    INVALID_REQUEST_REUSE: [
      "Nội dung khác với yêu cầu trước đó. Hãy tải lại kết quả.",
      "This differs from the original request. Reload its result.",
    ],
    APPROVER_ACCOUNT_REQUIRED: [
      "Người duyệt cần đăng nhập ATS trước và có tài khoản đang hoạt động.",
      "The approver must first sign in to ATS and have an active account.",
    ],
    TEMPLATE_REQUIRED: [
      "Chọn mẫu Offer Letter đã đăng ký.",
      "Select a registered Offer Letter template.",
    ],
    CANDIDATE_EMAIL_REQUIRED: [
      "Cần cập nhật email hợp lệ của ứng viên trước khi gửi duyệt.",
      "A valid candidate email is required before submission.",
    ],
    OFFER_ALREADY_OPEN: [
      "Ứng viên đã có đề xuất Offer đang xử lý.",
      "This application already has an open proposal.",
    ],
    APPLICATION_NOT_READY: [
      "Hồ sơ phải đang hoạt động ở vòng Phỏng vấn.",
      "The application must be active at Interview.",
    ],
    DELIVERY_CONFLICT: [
      "Trạng thái gửi đã thay đổi. Hãy tải lại; không gửi lại thư khi chưa đối soát.",
      "Delivery state changed. Reload and reconcile before any resend.",
    ],
  };
  return (
    messages[code]?.[en ? 1 : 0] ||
    (code && !/^[A-Z_]+$/.test(code)
      ? code
      : en
        ? "Unable to process the proposal."
        : "Không xử lý được đề xuất.")
  );
}
