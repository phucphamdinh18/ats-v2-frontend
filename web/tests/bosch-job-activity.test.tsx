import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import BoschJobActivity from "../components/bosch-job-activity";
import { ApiError } from "../lib/supabase";

const api = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn() }));
vi.mock("../lib/applications", () => ({ listApplications: api.list, applicationDetail: api.detail }));
vi.mock("../lib/supabase", () => ({
  ApiError: class ApiError extends Error { constructor(message: string, public status?: number) { super(message); } },
}));
beforeEach(() => { api.list.mockReset(); api.detail.mockReset(); });
afterEach(cleanup);

it("shows a local permission error on Job Activity without ending the ATS session", async () => {
  api.list.mockRejectedValue(new ApiError("Permission denied", 403));
  const onAccessLost = vi.fn();
  render(<BoschJobActivity jobId="job-1" onAccessLost={onAccessLost} />);
  expect((await screen.findByRole("alert")).textContent).toContain("Permission denied");
  expect(onAccessLost).not.toHaveBeenCalled();
});

it("ends the ATS session only when Job Activity receives an authentication error", async () => {
  api.list.mockRejectedValue(new ApiError("Session expired", 401));
  const onAccessLost = vi.fn();
  render(<BoschJobActivity jobId="job-1" onAccessLost={onAccessLost} />);
  await screen.findByRole("alert");
  expect(onAccessLost).toHaveBeenCalledOnce();
});
