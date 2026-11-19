import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import BoschJobInterviews from "../components/bosch-job-interviews";

const api = vi.hoisted(() => ({ applications: vi.fn(), roster: vi.fn(), availability: vi.fn(), worklist: vi.fn(), create: vi.fn() }));
vi.mock("../lib/applications", () => ({ listApplications: api.applications }));
vi.mock("../lib/interviews", () => ({
  createInterview: api.create,
  listInterviewAvailability: api.availability,
  listInterviewRoster: api.roster,
  listInterviewWorklist: api.worklist,
}));
vi.mock("../lib/supabase", () => ({ ApiError: class ApiError extends Error { constructor(message: string, public status?: number) { super(message); } } }));

const application = { application_id: "00000000-0000-4000-8000-000000000001", candidate_id: "candidate-1", candidate_name: "Candidate A", stage: "INTERVIEW", status: "ACTIVE", source: null, created_at: "2026-11-19T00:00:00Z" };
const roster = [{ id: "00000000-0000-4000-8000-000000000002", display_name: "Interviewer A", role: "INTERVIEWER" as const }];
const free = { busy_slots: [], google_calendars: [{ participant_id: roster[0].id, status: "AVAILABLE" }] };
beforeEach(() => {
  vi.clearAllMocks();
  api.applications.mockResolvedValue({ applications: [application], limit: 100, offset: 0 });
  api.roster.mockResolvedValue(roster);
  api.availability.mockResolvedValue(free);
  api.worklist.mockResolvedValue([]);
  api.create.mockResolvedValue({ interview_id: "interview-1", created: true });
});
afterEach(cleanup);

async function prepareFreeSlot() {
  render(<BoschJobInterviews jobId="job-1" onAccessLost={vi.fn()} onAllInterviews={vi.fn()} />);
  fireEvent.change(await screen.findByRole("combobox", { name: "Ứng viên" }), { target: { value: application.application_id } });
  const interviewer = await screen.findByLabelText(/Interviewer A/);
  fireEvent.click(interviewer);
  fireEvent.click(screen.getByRole("button", { name: "Kiểm tra lịch bận\/rảnh" }));
  await screen.findByText("Đã kiểm tra Google Calendar");
}

it("checks Google and ATS availability before creating an ATS interview", async () => {
  await prepareFreeSlot();
  const book = screen.getByRole("button", { name: "Đặt lịch trong ATS" });
  expect((book as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(book);
  await screen.findByRole("status");
  await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
  expect(api.availability).toHaveBeenCalledTimes(2);
  expect(api.create.mock.calls[0][0]).toMatchObject({ application_id: application.application_id, participant_ids: [roster[0].id], interview_type: "INTERVIEW" });
  expect(screen.getByText(/Đã đặt lịch phỏng vấn cho Candidate A/)).toBeTruthy();
});

it("does not allow booking when Google cannot be verified", async () => {
  api.availability.mockResolvedValue({ busy_slots: [{ participant_id: roster[0].id, starts_at: "2099-01-01T09:00:00Z", ends_at: "2099-01-01T10:00:00Z", source: "ATS" }], google_calendars: [{ participant_id: roster[0].id, status: "NOT_CONNECTED" }] });
  render(<BoschJobInterviews jobId="job-1" onAccessLost={vi.fn()} onAllInterviews={vi.fn()} />);
  fireEvent.change(await screen.findByRole("combobox", { name: "Ứng viên" }), { target: { value: application.application_id } });
  fireEvent.click(await screen.findByLabelText(/Interviewer A/));
  fireEvent.click(screen.getByRole("button", { name: "Kiểm tra lịch bận\/rảnh" }));
  await screen.findByText("Chưa kết nối Google");
  expect((screen.getByRole("button", { name: "Đặt lịch trong ATS" }) as HTMLButtonElement).disabled).toBe(true);
  expect(api.create).not.toHaveBeenCalled();
});

it("does not allow booking when an ATS appointment overlaps the selected slot", async () => {
  api.availability.mockResolvedValue({
    busy_slots: [{ participant_id: roster[0].id, starts_at: new Date("2099-01-01T10:30:00").toISOString(), ends_at: new Date("2099-01-01T11:30:00").toISOString(), source: "ATS" }],
    google_calendars: [{ participant_id: roster[0].id, status: "AVAILABLE" }],
  });
  render(<BoschJobInterviews jobId="job-1" onAccessLost={vi.fn()} onAllInterviews={vi.fn()} />);
  fireEvent.change(await screen.findByRole("combobox", { name: "Ứng viên" }), { target: { value: application.application_id } });
  fireEvent.click(await screen.findByLabelText(/Interviewer A/));
  fireEvent.change(screen.getByLabelText(/Bắt đầu/), { target: { value: "2099-01-01T10:00" } });
  fireEvent.change(screen.getByLabelText(/Kết thúc/), { target: { value: "2099-01-01T11:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Kiểm tra lịch bận\/rảnh" }));
  await screen.findByText(/Lịch ATS/);
  expect((screen.getByRole("button", { name: "Đặt lịch trong ATS" }) as HTMLButtonElement).disabled).toBe(true);
  expect(api.create).not.toHaveBeenCalled();
});
