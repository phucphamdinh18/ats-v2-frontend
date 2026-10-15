import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
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
  review: vi.fn(),
  authCallback: null as
    null | ((event: string, session: { user: { id: string } } | null) => void),
}));
vi.mock("../lib/supabase", () => ({
  getClient: () => ({
    from: mocks.from,
    auth: {
      getSession: mocks.session,
      signInWithOAuth: mocks.oauth,
      signOut: mocks.signOut,
      onAuthStateChange: (
        fn: (event: string, session: { user: { id: string } } | null) => void,
      ) => {
        mocks.authCallback = fn;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
  }),
  reviewCall: mocks.review,
  ApiError: class extends Error {},
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.review.mockResolvedValue({ drafts: [] });
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

it("same-user auth refresh preserves the current review kind while rechecking roles", async () => {
  scope(true, ["ADMIN"]);
  render(<Workspace />);
  fireEvent.click(await screen.findByRole("button", { name: "Duyệt CV & JD" }));
  fireEvent.click(await screen.findByRole("button", { name: "JD tuyển dụng" }));
  await screen.findByRole("heading", { name: "Không có bản nháp" });
  const callsBefore = mocks.session.mock.calls.length;
  await act(async () => {
    mocks.authCallback?.("SIGNED_IN", { user: { id: "synthetic" } });
  });
  await waitFor(() =>
    expect(mocks.session.mock.calls.length).toBeGreaterThan(callsBefore),
  );
  expect(
    screen
      .getByRole("button", { name: "JD tuyển dụng" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  await act(async () => {
    mocks.authCallback?.("TOKEN_REFRESHED", { user: { id: "synthetic" } });
  });
  expect(
    screen
      .getByRole("button", { name: "JD tuyển dụng" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
});
it("silent same-user auth refresh removes review when current roles are revoked", async () => {
  scope(true, ["ADMIN"]);
  render(<Workspace />);
  fireEvent.click(await screen.findByRole("button", { name: "Duyệt CV & JD" }));
  await screen.findByRole("button", { name: "JD tuyển dụng" });
  scope(false, []);
  await act(async () => {
    mocks.authCallback?.("TOKEN_REFRESHED", { user: { id: "synthetic" } });
  });
  await screen.findByRole("heading", { name: "Đang chờ cấp quyền" });
  expect(screen.queryByRole("button", { name: "JD tuyển dụng" })).toBeNull();
});
