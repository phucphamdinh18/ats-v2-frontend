import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AtsNotificationCenter from "../components/ats-notification-center";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("../lib/supabase", () => ({ getClient: () => ({ rpc }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("shows the shared notification and marks it read", async () => {
  rpc.mockImplementation((name: string) => Promise.resolve(name === "ats_list_notifications"
    ? { data: [{ id: "notice-1", kind: "ACCESS_REQUEST", title_vi: "Có yêu cầu tham gia ATS mới", body_vi: "Quản trị viên đang xem xét một yêu cầu truy cập mới.", title_en: "New ATS access request", body_en: "An administrator is reviewing a new access request.", created_at: "2026-11-26T10:00:00Z", read_at: null }], error: null }
    : { data: null, error: null }));
  render(<AtsNotificationCenter locale="vi"/>);
  const trigger = await screen.findByRole("button", { name: "Thông báo, 1 chưa đọc" });
  fireEvent.click(trigger);
  const item = await screen.findByRole("button", { name: /Có yêu cầu tham gia ATS mới/ });
  expect(item.textContent).not.toContain("email");
  fireEvent.click(item);
  await waitFor(() => expect(rpc).toHaveBeenCalledWith("ats_mark_notification_read", { p_notification_id: "notice-1" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Thông báo, 0 chưa đọc" })).toBeTruthy());
});
