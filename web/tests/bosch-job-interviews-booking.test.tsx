import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import BoschJobInterviews from "../components/bosch-job-interviews";

const api = vi.hoisted(() => ({ applications: vi.fn(), roster: vi.fn(), availability: vi.fn(), worklist: vi.fn(), create: vi.fn(), connect: vi.fn() }));
vi.mock("../lib/applications", () => ({ listApplications: api.applications }));
vi.mock("../lib/interviews", () => ({
  createInterview: api.create,
  listInterviewAvailability: api.availability,
  listInterviewRoster: api.roster,
  listInterviewWorklist: api.worklist,
}));
vi.mock("../lib/supabase", () => ({ ApiError: class ApiError extends Error { constructor(message: string, public status?: number) { super(message); } } }));
vi.mock("../lib/google-calendar", () => ({ beginGoogleCalendarConnection: api.connect }));

const application = { application_id: "00000000-0000-4000-8000-000000000001", candidate_id: "candidate-1", candidate_name: "Candidate A", stage: "INTERVIEW", status: "ACTIVE", source: null, created_at: "2026-11-19T00:00:00Z" };
const roster = [{ id: "00000000-0000-4000-8000-000000000002", display_name: "Interviewer A", role: "INTERVIEWER" as const }];
const free = { busy_slots: [], google_calendars: [{ participant_id: roster[0].id, status: "AVAILABLE", can_create_events: true }] };
beforeEach(() => {
  vi.clearAllMocks();
  vi.setSystemTime(new Date(2026, 10, 19, 8, 0, 0));
  api.applications.mockResolvedValue({ applications: [application], limit: 100, offset: 0 });
  api.roster.mockResolvedValue(roster);
  api.availability.mockResolvedValue(free);
  api.worklist.mockResolvedValue([]);
  api.create.mockResolvedValue({ interview_id: "interview-1", created: true, calendar_sync: { status: "SYNCED", invitation_requested: true } });
});
afterEach(() => {
  cleanup();
  vi.setSystemTime(new Date());
});

async function prepareFreeSlot() {
  render(<BoschJobInterviews jobId="job-1" onAccessLost={vi.fn()} onAllInterviews={vi.fn()} />);
  fireEvent.change(await screen.findByRole("combobox", { name: "Ứng viên" }), { target: { value: application.application_id } });
  const interviewer = await screen.findByLabelText(/Interviewer A/);
  fireEvent.click(interviewer);
  await screen.findByText("Đã kiểm tra Google Calendar");
}

it("checks Google and ATS availability before creating an ATS interview", async () => {
  await prepareFreeSlot();
  const freeSlot = screen.getAllByRole("button", { name: /10:00$/ }).find((button) => !(button as HTMLButtonElement).disabled);
  expect(freeSlot).toBeTruthy();
  fireEvent.click(freeSlot!);
  const book = screen.getByRole("button", { name: "Đặt lịch và gửi thư mời" });
  expect((book as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(book);
  await screen.findByRole("status");
  await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
  expect(api.availability).toHaveBeenCalledTimes(3);
  expect(Date.parse(api.availability.mock.calls[0][3]) - Date.parse(api.availability.mock.calls[0][2])).toBe(7 * 24 * 60 * 60 * 1000);
  expect(api.create.mock.calls[0][0]).toMatchObject({ application_id: application.application_id, participant_ids: [roster[0].id], interview_type: "INTERVIEW" });
  expect(screen.getByText(/Đã đặt lịch cho Candidate A/)).toBeTruthy();
  expect(screen.getByText(/Google Calendar đã tạo sự kiện/)).toBeTruthy();
  await waitFor(() => expect(screen.getAllByRole("button").some((button) => button.getAttribute("title")?.includes("Phỏng vấn · Candidate A"))).toBe(true));
});

it("lets the recruiter drag across week cells to choose the full interview time", async () => {
  const { container } = render(<BoschJobInterviews jobId="job-1" onAccessLost={vi.fn()} onAllInterviews={vi.fn()} />);
  fireEvent.change(await screen.findByRole("combobox", { name: "Ứng viên" }), { target: { value: application.application_id } });
  fireEvent.click(await screen.findByLabelText(/Interviewer A/));
  await screen.findByText("Đã kiểm tra Google Calendar");

  const start = container.querySelector<HTMLButtonElement>('[data-calendar-slot="true"][data-day="2026-11-19"][data-index="6"]')!;
  const end = container.querySelector<HTMLButtonElement>('[data-calendar-slot="true"][data-day="2026-11-19"][data-index="7"]');
  expect(start.disabled).toBe(false);
  const rows = container.querySelector<HTMLDivElement>('[data-calendar-rows="true"]');
  expect(end).toBeTruthy();
  const originalElementFromPoint = document.elementFromPoint;
  Object.defineProperty(document, "elementFromPoint", { configurable: true, value: vi.fn(() => end) });
  try {
    fireEvent.pointerDown(start, { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(rows!, { pointerId: 1, buttons: 1, clientX: 100, clientY: 132 });
    fireEvent.pointerUp(rows!, { pointerId: 1, button: 0, clientX: 100, clientY: 132 });
  } finally {
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: originalElementFromPoint });
  }
  const selectedRange = container.querySelector<HTMLElement>('[data-selected-range="true"]');
  expect(selectedRange).toBeTruthy();
  expect(selectedRange?.textContent).toContain("10:00");
  expect(selectedRange?.textContent).toContain("11:00");
});

it("requires event permission for the first selected interviewer before booking", async () => {
  api.availability.mockResolvedValue({ busy_slots: [], google_calendars: [{ participant_id: roster[0].id, status: "AVAILABLE", can_create_events: false }] });
  render(<BoschJobInterviews jobId="job-1" onAccessLost={vi.fn()} onAllInterviews={vi.fn()} />);
  fireEvent.change(await screen.findByRole("combobox", { name: "Ứng viên" }), { target: { value: application.application_id } });
  fireEvent.click(await screen.findByLabelText(/Interviewer A/));
  await screen.findByText(/cần kết nối lại Google và cấp quyền tạo sự kiện/);
  await screen.findByText(/cần kết nối lại Google và cấp quyền tạo sự kiện/);
  expect((screen.getByRole("button", { name: "Đặt lịch và gửi thư mời" }) as HTMLButtonElement).disabled).toBe(true);
  expect(api.create).not.toHaveBeenCalled();
});

it("does not allow booking when Google cannot be verified", async () => {
  api.availability.mockResolvedValue({ busy_slots: [{ participant_id: roster[0].id, starts_at: "2099-01-01T09:00:00Z", ends_at: "2099-01-01T10:00:00Z", source: "ATS" }], google_calendars: [{ participant_id: roster[0].id, status: "NOT_CONNECTED" }] });
  render(<BoschJobInterviews jobId="job-1" onAccessLost={vi.fn()} onAllInterviews={vi.fn()} />);
  fireEvent.change(await screen.findByRole("combobox", { name: "Ứng viên" }), { target: { value: application.application_id } });
  fireEvent.click(await screen.findByLabelText(/Interviewer A/));
  await screen.findByText("Chưa kết nối Google");
  expect((screen.getByRole("button", { name: "Đặt lịch và gửi thư mời" }) as HTMLButtonElement).disabled).toBe(true);
  expect(api.create).not.toHaveBeenCalled();
});

it("does not allow booking when an ATS appointment overlaps the selected slot", async () => {
  const now = new Date();
  const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  sunday.setDate(sunday.getDate() - sunday.getDay());
  let firstFutureTen = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), 10, 0);
  while (firstFutureTen.getTime() <= now.getTime() && firstFutureTen.getTime() < sunday.getTime() + 7 * 86400000) {
    firstFutureTen.setDate(firstFutureTen.getDate() + 1);
    firstFutureTen.setHours(10, 0, 0, 0);
  }
  api.availability.mockResolvedValue({
    busy_slots: [{ participant_id: roster[0].id, starts_at: new Date(firstFutureTen.getTime() + 30 * 60000).toISOString(), ends_at: new Date(firstFutureTen.getTime() + 90 * 60000).toISOString(), source: "ATS" }],
    google_calendars: [{ participant_id: roster[0].id, status: "AVAILABLE", can_create_events: true }],
  });
  render(<BoschJobInterviews jobId="job-1" onAccessLost={vi.fn()} onAllInterviews={vi.fn()} />);
  fireEvent.change(await screen.findByRole("combobox", { name: "Ứng viên" }), { target: { value: application.application_id } });
  fireEvent.click(await screen.findByLabelText(/Interviewer A/));
  await screen.findByText(/Đã kiểm tra Google Calendar/);
  const busySlot = screen.getAllByRole("button").find((button) => (button as HTMLButtonElement).disabled && button.getAttribute("title")?.includes("ATS bận"));
  expect(busySlot).toBeTruthy();
  expect((screen.getByRole("button", { name: "Đặt lịch và gửi thư mời" }) as HTMLButtonElement).disabled).toBe(true);
  expect(api.create).not.toHaveBeenCalled();
});
