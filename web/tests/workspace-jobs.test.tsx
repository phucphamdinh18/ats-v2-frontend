import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import Workspace from "../components/workspace";
import { LanguageProvider } from "../components/language";
const fixtures = vi.hoisted(() => ({ role: "ADMIN", members: vi.fn() }));
vi.mock("../components/application-pipeline", () => ({
  default: () => <div>Pipeline fixture</div>,
}));
vi.mock("../components/review-queue", () => ({
  default: () => <div>Review fixture</div>,
}));
vi.mock("../components/talent-pool", () => ({
  default: () => <div>Talent fixture</div>,
}));
vi.mock("../lib/applications", () => ({
  jobOverview: async () => ({ jobs: [] }),
}));
vi.mock("../lib/admin-jobs", () => ({
  listJobMembers: fixtures.members,
  assignJobMember: vi.fn(),
  createJobDraft: vi.fn(),
  openJob: vi.fn(),
  removeJobMember: vi.fn(),
  updateJobMetadata: vi.fn(),
}));
vi.mock("../lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/supabase")>();
  return {
    ...original,
    getClient: () => ({
      auth: {
        getSession: async () => ({
          data: {
            session: {
              user: { id: "test-admin", email: "test@example.invalid" },
            },
          },
        }),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
      from: (table: string) => {
        const data =
          table === "app_users"
            ? { id: "test-admin", is_active: true }
            : table === "user_roles"
              ? [{ role: fixtures.role }]
              : table === "jobs"
                ? [
                    {
                      id: "job-1",
                      title: "Fixture Engineer",
                      job_code: "TEST-1",
                      status: "DRAFT",
                    },
                  ]
                : [];
        const result = { data, error: null };
        const query = {
          select: () => query,
          eq: () => query,
          order: () => query,
          limit: async () => result,
          maybeSingle: async () => result,
          then: (resolve: (value: typeof result) => unknown) =>
            Promise.resolve(result).then(resolve),
        };
        return query;
      },
    }),
  };
});
beforeEach(() => {
  localStorage.clear();
  fixtures.role = "ADMIN";
  fixtures.members.mockReset().mockResolvedValue({ members: [] });
});
afterEach(cleanup);
function setup() {
  render(
    <LanguageProvider>
      <Workspace />
    </LanguageProvider>,
  );
}
it("keeps overview clear, opens management as a Job tab and preserves creation input across views", async () => {
  setup();
  const manageTab = await screen.findByRole("tab", { name: "1.3 Quản lý Job" });
  expect(
    screen.queryByRole("button", { name: "Phân công đội ngũ" }),
  ).toBeNull();
  expect(screen.queryByRole("button", { name: "Chỉnh yêu cầu" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Mở tuyển" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Tạo Job" })).toBeNull();
  const firstTab = screen.getAllByRole("tab")[0];
  firstTab.focus();
  fireEvent.keyDown(firstTab, { key: "End" });
  expect(document.activeElement).toBe(manageTab);
  expect(manageTab.getAttribute("aria-selected")).toBe("true");
  expect(screen.getAllByRole("table")).toHaveLength(1);
  const jobRow = screen.getByRole("row", { name: /Fixture Engineer/ });
  expect(within(jobRow).getAllByRole("button")).toHaveLength(1);
  fireEvent.click(within(jobRow).getByRole("button", { name: "Quản lý" }));
  expect(screen.queryByRole("table")).toBeNull();
  expect(fixtures.members).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
  fireEvent.click(screen.getByRole("button", { name: "Tạo Job" }));
  fireEvent.change(screen.getByLabelText("Tên vị trí"), {
    target: { value: "Keep this job title" },
  });
  fireEvent.click(screen.getByRole("tab", { name: /1.2 Tiến độ tuyển dụng/ }));
  expect(screen.queryByRole("textbox", { name: "Tên vị trí" })).toBeNull();
  fireEvent.click(manageTab);
  expect((screen.getByLabelText("Tên vị trí") as HTMLInputElement).value).toBe(
    "Keep this job title",
  );
  fireEvent.change(screen.getByLabelText("Ngôn ngữ / Language"), {
    target: { value: "en" },
  });
  expect(
    screen
      .getByRole("tab", { name: "1.3 Manage jobs" })
      .getAttribute("aria-selected"),
  ).toBe("true");
  expect((screen.getByLabelText("Job title") as HTMLInputElement).value).toBe(
    "Keep this job title",
  );
});
it("does not expose the management tab or controls to a recruiter", async () => {
  fixtures.role = "TA_RECRUITER";
  setup();
  await screen.findByRole("tab", { name: /1.2 Tiến độ tuyển dụng/ });
  expect(screen.queryByRole("tab", { name: "1.3 Quản lý Job" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Tạo Job" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Quản lý" })).toBeNull();
  expect(fixtures.members).not.toHaveBeenCalled();
});
