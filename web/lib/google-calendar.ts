import { ApiError, getClient } from "./supabase";

export type GoogleCalendarConnection = {
  connected: boolean;
  google_email: string | null;
  connected_at: string | null;
  can_create_events?: boolean;
};

async function invoke(action: "status" | "begin" | "disconnect") {
  const { data, error } = await getClient().functions.invoke("google-calendar-oauth", {
    body: { action },
  });
  if (error) {
    let message = "Không thể kết nối Google Calendar.";
    try {
      const response = await error.context?.json();
      if (typeof response?.error === "string") message = response.error;
    } catch { /* A network error may not include a response body. */ }
    throw new ApiError(message, error.context?.status);
  }
  if (data?.error) throw new ApiError(String(data.error), data.status);
  return data;
}

export async function getGoogleCalendarConnectionStatus(): Promise<GoogleCalendarConnection> {
  const data = await invoke("status");
  if (typeof data?.connected !== "boolean" ||
      (data.google_email !== null && typeof data.google_email !== "string") ||
      (data.connected_at !== null && typeof data.connected_at !== "string")) {
    throw new ApiError("Trạng thái kết nối Google Calendar không đúng định dạng.");
  }
  return {
    connected: data.connected,
    google_email: data.google_email,
    connected_at: data.connected_at,
    can_create_events: data.can_create_events === true,
  };
}

export async function beginGoogleCalendarConnection(): Promise<never> {
  const data = await invoke("begin");
  if (typeof data?.authorization_url !== "string") {
    throw new ApiError("Google chưa trả về đường dẫn cấp quyền.");
  }
  let target: URL;
  try { target = new URL(data.authorization_url); }
  catch { throw new ApiError("Đường dẫn kết nối Google không hợp lệ."); }
  if (target.protocol !== "https:" || target.hostname !== "accounts.google.com") {
    throw new ApiError("Đường dẫn kết nối Google không an toàn.");
  }
  window.location.assign(target.toString());
  return new Promise<never>(() => {});
}

export async function disconnectGoogleCalendar(): Promise<void> {
  await invoke("disconnect");
}
