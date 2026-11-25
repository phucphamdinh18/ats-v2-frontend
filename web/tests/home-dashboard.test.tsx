import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import Home from "../components/bosch-home-dashboard";
import { LanguageProvider } from "../components/language";
import type { InterviewWorklistItem } from "../lib/interviews";
import type { WorkflowOffer } from "../lib/offer-approval";
const mock = vi.hoisted(() => ({
  interviews: vi.fn(),
  tasks: vi.fn(),
  offers: vi.fn(),
  recruiters: vi.fn(),
}));
vi.mock("../lib/home-data", async () => ({
  ...(await vi.importActual("../lib/home-data")),
  allInterviews: mock.interviews,
  allMyTasks: mock.tasks,
  allHomeOffers: mock.offers,
}));
vi.mock("../lib/admin-jobs", () => ({listJobRecruiters: mock.recruiters}));
const noop = () => {};
function interview(n: number, status = "SCHEDULED") {
  const start = new Date();
  const vietnamToday = new Date(Date.now() + 7 * 60 * 60 * 1000);
  start.setUTCFullYear(vietnamToday.getUTCFullYear(), vietnamToday.getUTCMonth(), vietnamToday.getUTCDate());
  start.setUTCHours(1, n, 0, 0);
  return {
    id: `i-${n}`,
    application_id: "a",
    job_id: "j",
    job_title: "Engineer",
    job_code: "J",
    candidate_name: `Candidate ${n}`,
    interview_type: "INTERVIEW",
    status,
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 3600000).toISOString(),
    timezone: "Asia/Ho_Chi_Minh",
    location: "HCMC",
    meeting_url: "https://teams.microsoft.com/example",
    can_manage: true,
    can_decide: true,
    is_participant: true,
    feedback_submitted: false,
    feedback_count: 0,
    participants: [{ id: "me", display_name: "Minh", role: "INTERVIEWER" }],
  } as InterviewWorklistItem;
}
function task(n: number) {
  return {
    id: `t${String(n).padStart(3, "0")}`,
    title: `Assigned task ${n}`,
    status: "OPEN",
    priority: "NORMAL",
    due_at: null,
    job_id: null,
    application_id: null,
    candidate_id: null,
    created_at: new Date().toISOString(),
    completed_at: null,
  };
}
beforeEach(() => {
  mock.interviews.mockImplementation(async (status: string) =>
    status === "SCHEDULED"
      ? Array.from({ length: 12 }, (_, i) => interview(i))
      : [],
  );
  mock.tasks.mockResolvedValue(Array.from({ length: 14 }, (_, i) => task(i)));
  mock.offers.mockResolvedValue([]);
  mock.recruiters.mockResolvedValue([]);
  localStorage.clear();
});
afterEach(cleanup);
const props = {
  jobs: [],
  roles: ["INTERVIEWER"],
  userName: "Minh",
  userId: "me",
  onOpenJob: noop,
  onOpenJobs: noop,
  onOpenInterviews: noop,
  onAccessLost: noop,
};
it("keeps all today's interviews in a scroll region and exposes every assigned task through pages", async () => {
  render(<Home {...props} />);
  await screen.findByText("Assigned task 0");
  const agenda = screen.getByRole("region", {
    name: "Cuộn để xem tất cả lịch hôm nay",
  });
  expect(within(agenda).getAllByRole("button")).toHaveLength(12);
  expect(agenda.textContent).toContain("Minh");
  expect(agenda.textContent).toContain("08:00–09:00");
  expect(screen.queryByText("Assigned task 6")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Tiếp" }));
  expect(screen.getByText("Assigned task 6")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tiếp" }));
  expect(screen.getByText("Assigned task 13")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Tiếp" }).hasAttribute("disabled"),
  ).toBe(true);
});
it("does not replace failed data with a zero or an all-caught-up claim", async () => {
  mock.interviews.mockRejectedValue(new Error("offline"));
  mock.tasks.mockRejectedValue(new Error("offline"));
  render(<Home {...props} />);
  await screen.findByRole("alert");
  expect(screen.queryByText("Bạn đã xử lý hết việc cần chú ý.")).toBeNull();
  expect(
    screen.getByRole("region", { name: "Tóm tắt nhanh" }).textContent,
  ).toContain("—");
});
it("role-less assigned approver sees internal proposal counts and no candidate acceptance labels", async () => {
  mock.offers.mockResolvedValue([
    {
      id: "00000000-0000-4000-8000-000000000001",
      candidate_name: "Candidate proposal",
      job_title: "Engineer",
      status: "PENDING",
      approver_id: "me",
      can_approve: true,
    },
    {
      id: "other",
      status: "PENDING",
      approver_id: "other",
      can_approve: false,
    },
  ] as WorkflowOffer[]);
  mock.tasks.mockResolvedValue([]);
  render(<Home {...props} roles={[]} />);
  await screen.findByText("Duyệt đề xuất tuyển dụng");
  expect(
    screen.getByText("Chờ tôi duyệt").previousElementSibling?.textContent,
  ).toBe("1");
  expect(screen.queryByText("Accepted")).toBeNull();
  expect(screen.getAllByText("Candidate proposal · Engineer").length).toBeGreaterThan(0);
});
it("multi-role Home switches perspective without granting privileges or fabricating completed appointments", async () => {
  render(
    <LanguageProvider>
      <Home {...props} roles={["ADMIN", "INTERVIEWER"]} />
    </LanguageProvider>,
  );
  await screen.findByText("Assigned task 0");
  fireEvent.click(screen.getByRole("button", { name: "Người phỏng vấn" }));
  const agenda = screen.getByRole("region", {
    name: "Cuộn để xem tất cả lịch hôm nay",
  });
  expect(agenda.textContent).not.toContain("Hoàn tất");
  expect(agenda.textContent).toContain("Đã lên lịch");
});


it("shows real per-Job TA responsibility and replaces revoked team data after refresh", async () => {
 mock.tasks.mockResolvedValue([]);mock.interviews.mockResolvedValue([]);
 mock.recruiters.mockResolvedValue([{job_id:"j",user_id:"p",display_name:"Phuc",email:"p@test.invalid",ta_assignment:"PRIMARY"},{job_id:"j",user_id:"s",display_name:"Linh",email:"l@test.invalid",ta_assignment:"SUPPORT"}]);
 render(<Home {...props} roles={["ADMIN"]} jobs={[{id:"j",title:"Engineer",job_code:"J",status:"OPEN",metrics:{new_count:1} as never}]}/>);
 await screen.findByText(/Phuc \(TA chính\).*Linh \(TA hỗ trợ\)/);
 expect(screen.queryByText("Job hiring team")).toBeNull();
 mock.recruiters.mockRejectedValue(new Error("offline"));
 fireEvent.focus(window);
 await screen.findByText("Chưa tải được phân công TA");
 expect(screen.queryByText(/Phuc \(TA chính\)/)).toBeNull();
});
