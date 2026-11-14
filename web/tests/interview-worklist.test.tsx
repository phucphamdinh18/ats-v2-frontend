import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import InterviewWorklist from "../components/interview-worklist";
import { ApiError } from "../lib/supabase";

const api = vi.hoisted(() => ({ worklist: vi.fn() }));
vi.mock("../lib/interviews", () => ({ listInterviewWorklist: api.worklist }));
vi.mock("../lib/supabase", () => ({
  ApiError: class ApiError extends Error { constructor(message: string, public status?: number) { super(message); } },
}));
const appointment = {
  id: "meeting-1", application_id: "app-1", job_id: "job-1", job_code: "JOB-1",
  job_title: "Software Engineer", candidate_name: "Candidate A",
  interview_type: "INTERVIEW", status: "SCHEDULED",
  starts_at: "2026-11-20T03:00:00.000Z", ends_at: "2026-11-20T04:00:00.000Z",
  timezone: "Asia/Ho_Chi_Minh", location: "Office",
  meeting_url: "https://meet.example.com/one",
  can_manage: true, can_decide: false, is_participant: true,
  feedback_submitted: false, feedback_count: 1,
  participants: [{ id: "user-1", display_name: "Interviewer One", role: "INTERVIEWER" }],
};
beforeEach(() => { api.worklist.mockReset(); });
afterEach(cleanup);
it("renders actual schedule rows and participant information from backend worklist", async () => {
  api.worklist.mockResolvedValue([appointment]);
  render(<InterviewWorklist onAccessLost={vi.fn()} />);
  expect((await screen.findByRole("button", { name: "Candidate A" })).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText("Interviewer One")).toBeTruthy();
  expect(screen.getByText("Software Engineer")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Mở cuộc họp" }).getAttribute("href")).toBe("https://meet.example.com/one");
  expect(api.worklist).toHaveBeenCalledWith("SCHEDULED", 25, 0);
});
it("switches worklist status using existing backend API, without any write", async () => {
  api.worklist.mockResolvedValue([appointment]);
  render(<InterviewWorklist onAccessLost={vi.fn()} />);
  await screen.findByText("Interviewer One");
  fireEvent.click(screen.getByRole("button", { name: "Đã hoàn tất" }));
  await waitFor(() => expect(api.worklist).toHaveBeenCalledWith("COMPLETED", 25, 0));
});
it("clears private worklist data when the server revokes access", async () => {
  api.worklist.mockRejectedValue(new ApiError("No access", 403));
  const onAccessLost = vi.fn();
  render(<InterviewWorklist onAccessLost={onAccessLost} />);
  await waitFor(() => expect(onAccessLost).toHaveBeenCalledTimes(1));
  expect(screen.queryByText("Candidate A")).toBeNull();
});
it("blocks non-https meeting URLs without hiding the appointment", async () => {
  api.worklist.mockResolvedValue([{ ...appointment, meeting_url: "javascript:alert(1)" }]);
  render(<InterviewWorklist onAccessLost={vi.fn()} />);
  await screen.findByText("Interviewer One");
  expect(screen.queryByRole("link", { name: "Mở cuộc họp" })).toBeNull();
});
