import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ApplicationPipeline from "../components/application-pipeline";
import { ApiError } from "../lib/supabase";

const api = vi.hoisted(() => ({ list: vi.fn(), search: vi.fn(), detail: vi.fn(), screen: vi.fn() }));
const confirmMock = vi.hoisted(() => vi.fn());
const randomUuidMock = vi.hoisted(() => vi.fn());
vi.mock("../lib/applications", () => ({
  listApplications: api.list, searchApplications: api.search, applicationDetail: api.detail, screenApplication: api.screen,
}));
vi.mock("../lib/supabase", () => ({
  ApiError: class ApiError extends Error { constructor(message: string, public status?: number) { super(message); } },
}));

const job = { id: "job-1", job_code: "TEST-1", title: "Test only job", status: "OPEN" };
const application = (id: string) => ({ application_id: id, candidate_id: `candidate-${id}`, candidate_name: id, stage: "NEW", status: "ACTIVE", source: "TEST ONLY", created_at: "2026-01-01T00:00:00Z" });
const detail = (id: string) => ({ application: application(id), events: [], event_count: 0, limit: 50, offset: 0 });

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  confirmMock.mockReset();
  confirmMock.mockReturnValue(true);
  randomUuidMock.mockReset();
  randomUuidMock.mockReturnValue("11111111-1111-4111-8111-111111111111");
  vi.stubGlobal("confirm", confirmMock);
  vi.stubGlobal("crypto", { randomUUID: randomUuidMock });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("application pipeline", () => {
  it("shows explicit forbidden state rather than an empty list", async () => {
    api.list.mockRejectedValue(new ApiError("Không có quyền", 403));
    render(<ApplicationPipeline job={job} onSessionLost={vi.fn()} />);
    expect((await screen.findByRole("alert")).textContent).toContain("Không có quyền");
    expect(screen.queryByText("Chưa có Application")).toBeNull();
  });
  it("renders only stages returned by the API", async () => {
    api.list.mockResolvedValue({
      applications: [application("Ada")],
      limit: 25,
      offset: 0,
    });
    render(<ApplicationPipeline job={job} onSessionLost={vi.fn()} />);
    await screen.findByRole("region", { name: "Giai đoạn NEW" });
    expect(
      screen.queryByRole("region", { name: "Giai đoạn SCREEN" }),
    ).toBeNull();
  });
  it("does not let an old detail response replace the latest selection", async () => {
    let resolveOld!: (value: ReturnType<typeof detail>) => void;
    api.list.mockResolvedValue({ applications: [application("Old"), application("New")], limit: 25, offset: 0 });
    api.detail.mockImplementation((_job: string, id: string) => id === "Old" ? new Promise((resolve) => { resolveOld = resolve; }) : Promise.resolve(detail("New")));
    render(<ApplicationPipeline job={job} onSessionLost={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Old/ }));
    fireEvent.click(screen.getByRole("button", { name: /New/ }));
    await screen.findByText("New");
    await act(async () => resolveOld(detail("Old")));
    expect(screen.queryByText("Old")).toBeTruthy(); // Old remains a card, but not detail content.
    expect(screen.getByLabelText("Chi tiết Application").textContent).toContain("New");
    expect(screen.getByLabelText("Chi tiết Application").textContent).not.toContain("Old");
  });
  it("closes the previous detail when a new search has no results", async () => {
    api.list.mockResolvedValue({ applications: [application("Ada")], limit: 25, offset: 0 });
    api.detail.mockResolvedValue(detail("Ada"));
    api.search.mockResolvedValue({ applications: [], limit: 25, offset: 0 });
    render(<ApplicationPipeline job={job} onSessionLost={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Ada/ }));
    await screen.findByText("Lịch sử");

    fireEvent.change(screen.getByRole("textbox", { name: "Tìm ứng viên trong Job" }), {
      target: { value: "No matching candidate" },
    });

    expect(screen.queryByLabelText("Chi tiết Application")).toBeNull();
    expect(await screen.findByText("Chưa có Application")).toBeTruthy();
    expect(screen.queryByLabelText("Chi tiết Application")).toBeNull();
  });
  it("renders actor display name and hides null matching context", async () => {
    api.list.mockResolvedValue({ applications: [application("Ada")], limit: 25, offset: 0 });
    api.detail.mockResolvedValue({
      ...detail("Ada"),
      events: [{ event_id: "event-1", actor_id: "actor-1", actor_display_name: "TEST ONLY Recruiter", event_type: "MOVED", from_stage: "NEW", to_stage: "SCREEN", created_at: "2026-01-01T00:00:00Z" }],
      matching_context: null,
    });
    render(<ApplicationPipeline job={job} onSessionLost={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Ada/ }));
    expect((await screen.findByLabelText("Chi tiết Application")).textContent).toContain("TEST ONLY Recruiter");
    expect(screen.queryByText("Matching context")).toBeNull();
  });
  it("retries screen with the same generated request id", async () => {
    api.list.mockResolvedValue({ applications: [application("Ada")], limit: 25, offset: 0 });
    api.detail.mockResolvedValue(detail("Ada"));
    api.screen.mockRejectedValueOnce(new Error("Mạng lỗi")).mockResolvedValue({ application: application("Ada") });
    render(<ApplicationPipeline job={job} onSessionLost={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Ada/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Chuyển sang SCREEN" }));
    await screen.findByText("Mạng lỗi");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại với cùng request_id" }));
    await waitFor(() => expect(api.screen).toHaveBeenCalledTimes(2));
    expect(api.screen.mock.calls[0][1]).toBe(api.screen.mock.calls[1][1]);
    expect(randomUuidMock).toHaveBeenCalledTimes(1);
    expect(confirmMock).toHaveBeenCalledTimes(1);
  });
});
