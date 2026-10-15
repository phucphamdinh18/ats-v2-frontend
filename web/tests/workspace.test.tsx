import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import Workspace from "../components/workspace";
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  session: vi.fn(),
  oauth: vi.fn(),
  signOut: vi.fn(),
  authCallback: null as null | (() => void),
}));
vi.mock("../lib/supabase", () => ({
  getClient: () => ({
    from: mocks.from,
    auth: {
      getSession: mocks.session,
      signInWithOAuth: mocks.oauth,
      signOut: mocks.signOut,
      onAuthStateChange: (fn: () => void) => {
        mocks.authCallback = fn;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
  }),
  reviewCall: vi.fn(),
  ApiError: class extends Error {},
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({
    data: {
      session: { user: { id: "synthetic", email: "qa@example.invalid" } },
    },
    error: null,
  });
});
afterEach(cleanup);
function scope(active: boolean, roles: string[], jobs: unknown[] = []) {
  mocks.from.mockImplementation((table: string) => {
    const result =
      table === "app_users"
        ? { data: { id: "synthetic", is_active: active }, error: null }
        : table === "user_roles"
          ? { data: roles.map((role) => ({ role })), error: null }
          : { data: jobs, error: null };
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: () => Promise.resolve(result),
      order: () => query,
      limit: () => Promise.resolve(result),
      then: (resolve: (data: unknown) => unknown) =>
        Promise.resolve(result).then(resolve),
    };
    return query;
  });
}
it("inactive profile cannot show role-restricted data even with a retained TA role", async () => {
  scope(false, ["TA_RECRUITER"]);
  render(<Workspace />);
  await screen.findByRole("heading", { name: "Đang chờ cấp quyền" });
  expect(screen.queryByRole("button", { name: /Duyệt CV/ })).toBeNull();
  expect(mocks.from.mock.calls.some(([table]) => table === "jobs")).toBe(false);
});
it("HM sees scoped jobs and accurate loaded counts, without review entry", async () => {
  scope(
    true,
    ["HIRING_MANAGER"],
    [
      {
        id: "job1",
        title: "Synthetic Engineer",
        status: "OPEN",
        job_code: "TEST-1",
      },
    ],
  );
  render(<Workspace />);
  await screen.findByText("Synthetic Engineer");
  expect(screen.queryByRole("button", { name: /Duyệt CV/ })).toBeNull();
  expect(
    screen.getByText(
      "Hiển thị 1 / 1 vị trí đã tải · Thông tin được lọc theo quyền ATS",
    ),
  ).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox", { name: "Tìm vị trí" }), {
    target: { value: "Unmatched" },
  });
  expect(screen.queryByText("Synthetic Engineer")).toBeNull();
});
it("logout removes already displayed private data immediately", async () => {
  scope(
    true,
    ["HIRING_MANAGER"],
    [{ id: "job1", title: "Synthetic Job", status: "DRAFT", job_code: null }],
  );
  mocks.signOut.mockImplementation(() => new Promise(() => {}));
  render(<Workspace />);
  await screen.findByText("Synthetic Job");
  fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  expect(screen.queryByText("Synthetic Job")).toBeNull();
});
it("signed-out login starts only one OAuth request on repeated clicks", async () => {
  mocks.session.mockResolvedValue({ data: { session: null }, error: null });
  mocks.oauth.mockResolvedValue({ error: null });
  render(<Workspace />);
  const login = await screen.findByRole("button", {
    name: "Đăng nhập bằng Google",
  });
  fireEvent.click(login);
  fireEvent.click(login);
  await waitFor(() => expect(mocks.oauth).toHaveBeenCalledTimes(1));
  expect(mocks.oauth).toHaveBeenCalledWith({
    provider: "google",
    options: {
      redirectTo: window.location.origin + "/",
      queryParams: { prompt: "select_account" },
    },
  });
});
