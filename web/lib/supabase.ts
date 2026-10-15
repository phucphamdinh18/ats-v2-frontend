import { createClient, type SupabaseClient } from "@supabase/supabase-js";
let client: SupabaseClient | null = null;
export function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error("Chưa cấu hình kết nối ATS. Liên hệ quản trị viên.");
  client ??= createClient(url, key);
  return client;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}
export async function reviewCall<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getClient().functions.invoke("ta-review", {
    body,
  });
  if (error) {
    let message = "Không tải được dữ liệu. Vui lòng thử lại.";
    try {
      const result = await error.context?.json();
      if (typeof result?.error === "string") message = result.error;
    } catch {
      /* Network response has no body. */
    }
    throw new ApiError(message, error.context?.status);
  }
  if (data?.error) throw new ApiError(data.error);
  return data as T;
}
