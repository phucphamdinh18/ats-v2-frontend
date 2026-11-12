import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import InterviewSchedule from "../components/interview-schedule";
import InterviewWorkspace from "../components/interview-workspace";
import { LanguageProvider } from "../components/language";
const api = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../lib/interviews", async () => ({
  ...(await vi.importActual("../lib/interviews")),
  interviewCall: api.call,
}));
beforeEach(() => {
  localStorage.clear();
  api.call.mockReset();
  vi.stubGlobal("crypto", { randomUUID: () => "test-request-1" });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const lost = vi.fn();
const person = {
  id: "person-1",
  display_name: "Synthetic Interviewer",
  role: "INTERVIEWER",
};
function schedule() {
  render(
    <LanguageProvider>
      <InterviewSchedule
        applicationId="app-1"
        onSaved={async () => {}}
        onAccessLost={lost}
      />
    </LanguageProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Đặt lịch phỏng vấn" }));
}
it("keeps a single request and frozen details after an uncertain schedule result", async () => {
  api.call.mockImplementation(async (b) => {
    if (b.action === "roster") return { participants: [person] };
    throw new Error("network");
  });
  schedule();
  await screen.findByText(/Synthetic Interviewer/);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.change(screen.getByLabelText("Bắt đầu"), {
    target: { value: "2026-12-01T10:00" },
  });
  fireEvent.change(screen.getByLabelText("Kết thúc"), {
    target: { value: "2026-12-01T11:00" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận đặt lịch" }));
  await screen.findByRole("button", { name: "Thử lại yêu cầu" });
  expect(screen.getByLabelText("Bắt đầu").closest("fieldset")?.disabled).toBe(
    true,
  );
  fireEvent.click(screen.getByRole("button", { name: "Thử lại yêu cầu" }));
  await waitFor(() =>
    expect(
      api.call.mock.calls.filter(([b]) => b.action === "create"),
    ).toHaveLength(2),
  );
  const calls = api.call.mock.calls.filter(([b]) => b.action === "create");
  expect(calls[0][0]).toEqual(calls[1][0]);
});
it("an interviewer can submit feedback but cannot coordinate or decide", async () => {
  const row = {
    id: "interview-1",
    application_id: "app-1",
    job_id: "job-1",
    job_title: "TEST Job",
    candidate_name: "Synthetic Candidate",
    interview_type: "INTERVIEW",
    status: "COMPLETED",
    starts_at: "2026-11-01T10:00:00Z",
    ends_at: "2026-11-01T11:00:00Z",
    timezone: "UTC",
    participants: [person],
    can_manage: false,
    can_decide: false,
    is_participant: true,
    feedback_submitted: false,
    feedback_count: 0,
  };
  api.call.mockImplementation(async (b) =>
    b.action === "worklist"
      ? { interviews: [row] }
      : b.action === "feedback_list"
        ? { feedback: [] }
        : { feedback: { submitted: true } },
  );
  render(
    <LanguageProvider>
      <InterviewWorkspace onAccessLost={lost} />
    </LanguageProvider>,
  );
  await screen.findByRole("article", { name: "Chi tiết phỏng vấn" });
  expect(screen.getByRole("button", { name: "Gửi feedback" })).toBeTruthy();
  expect(
    screen.getByLabelText("Trạng thái lịch").getAttribute("aria-label"),
  ).toBe("Trạng thái lịch");
  expect(screen.queryByRole("button", { name: "Lưu quyết định" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Hủy lịch" })).toBeNull();
  expect(api.call.mock.calls.some(([b]) => b.action === "decision_list")).toBe(
    false,
  );
});
it("no roster is fetched until the scheduling action is opened", () => {
  api.call.mockResolvedValue({ participants: [] });
  render(
    <LanguageProvider>
      <InterviewSchedule
        applicationId="app-1"
        onSaved={async () => {}}
        onAccessLost={lost}
      />
    </LanguageProvider>,
  );
  expect(api.call).not.toHaveBeenCalled();
});
