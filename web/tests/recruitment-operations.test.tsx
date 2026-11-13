import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import RecruitmentOperations from "../components/recruitment-operations";

const api = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), offers: vi.fn() }));
vi.mock("../lib/applications", () => ({
  listApplications: api.list,
  applicationDetail: api.detail,
}));
vi.mock("../lib/offers", () => ({ listOfferBoard: api.offers }));
vi.mock("../lib/supabase", () => ({
  ApiError: class ApiError extends Error { constructor(message: string, public status?: number) { super(message); } },
}));
import { ApiError } from "../lib/supabase";
const jobs = [{ id: "job1", job_code: "TEST-1", title: "Test Job", status: "OPEN" }];
const record = { application_id: "app1", candidate_id: "cand1", candidate_name: "Test Candidate", stage: "INTERVIEW", status: "ACTIVE", source: "Referral", created_at: "2026-01-01T00:00:00Z" };
beforeEach(() => {
  api.list.mockReset();
  api.detail.mockReset();
  api.offers.mockReset();
  api.detail.mockResolvedValue({ application: record, events: [], event_count: 0, limit: 50, offset: 0 });
});
afterEach(cleanup);

it("lists only interview-stage applicants from existing API and opens detail without writes", async () => {
  api.list.mockResolvedValue({ applications: [record, { ...record, application_id: "app2", stage: "SCREEN" }], offset: 0, limit: 25 });
  render(<RecruitmentOperations mode="interviews" jobs={jobs} onAccessLost={vi.fn()} />);
  const btn = await screen.findByRole("button", { name: "Test Candidate" });
  expect(screen.queryByText("app2")).toBeNull();
  fireEvent.click(btn);
  await waitFor(() => expect(api.detail).toHaveBeenCalledWith("job1", "app1"));
  expect(screen.getByText("Application timeline")).toBeTruthy();
  expect(api.list).toHaveBeenCalledWith("job1", 25, 0);
});

it("shows only actual offer status without salary or fake approvals", async () => {
  api.offers.mockResolvedValue({ applications: [{ application_id: "app1", application: record, offer_status: "PENDING" }] });
  render(<RecruitmentOperations mode="offers" jobs={jobs} onAccessLost={vi.fn()} />);
  await screen.findByRole("button", { name: "Test Candidate" });
  expect(screen.getByText("Pending approval")).toBeTruthy();
  expect(screen.queryByText("Salary package")).toBeNull();
  expect(api.offers).toHaveBeenCalledWith("job1");
});

it("shows API errors and permits a retry without inventing results", async () => {
  api.list.mockRejectedValueOnce(new Error("API failed")).mockResolvedValue({ applications: [], limit: 25, offset: 0 });
  render(<RecruitmentOperations mode="interviews" jobs={jobs} onAccessLost={vi.fn()} />);
  expect((await screen.findByRole("alert")).textContent).toContain("API failed");
  fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
});

it("invalidates restricted workspace when job permissions are revoked", async () => {
  api.list.mockRejectedValue(new ApiError("Forbidden", 403));
  const onAccessLost = vi.fn();
  render(<RecruitmentOperations mode="interviews" jobs={jobs} onAccessLost={onAccessLost} />);
  await waitFor(() => expect(onAccessLost).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole("button", { name: "Test Candidate" })).toBeNull();
});
