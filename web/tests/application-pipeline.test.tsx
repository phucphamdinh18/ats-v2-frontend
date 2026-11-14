import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ApplicationPipeline from "../components/application-pipeline";
import { ApiError } from "../lib/supabase";

const api = vi.hoisted(() => ({ list: vi.fn(), search: vi.fn(), detail: vi.fn(), screen: vi.fn(), interview: vi.fn(), back: vi.fn() }));
const confirmMock = vi.hoisted(() => vi.fn());
const randomUuidMock = vi.hoisted(() => vi.fn());
vi.mock("../lib/applications", () => ({
  listApplications: api.list,
  searchApplications: api.search,
  applicationDetail: api.detail,
  screenApplication: api.screen,
  interviewApplication: api.interview,
  moveApplicationBack: api.back,
}));
vi.mock("../lib/supabase", () => ({
  ApiError: class ApiError extends Error { constructor(message: string, public status?: number) { super(message); } },
  getClient: () => ({
    from: () => {
      const result = { data: [{ sub_source: "TEST ONLY", source: "TEST ONLY", source_ownership: "TEST ONLY" }], error: null };
      const query = {
        select: () => query,
        order: () => query,
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      };
      return query;
    },
  }),
}));

const requestId = "11111111-1111-4111-8111-111111111111";
const job = { id: "job-1", job_code: "TEST-1", title: "Test only job", status: "OPEN" };
const application = (id: string, stage = "NEW") => ({
  application_id: id, candidate_id: `candidate-${id}`, candidate_name: id,
  stage, status: "ACTIVE", source: "TEST ONLY", created_at: "2026-01-01T00:00:00Z",
});
const detail = (id: string, stage = "NEW") => ({
  application: application(id, stage), events: [], event_count: 0, limit: 50, offset: 0,
});
function renderPipeline(canManageApplications = true) {
  return render(<ApplicationPipeline job={job} onSessionLost={vi.fn()} canManageApplications={canManageApplications} />);
}
async function selectCandidate(name = "Ada") {
  fireEvent.click(await screen.findByRole("button", { name }));
  await screen.findByRole("heading", { name: "Lịch sử" });
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  confirmMock.mockReset().mockReturnValue(true);
  randomUuidMock.mockReset().mockReturnValue(requestId);
  vi.stubGlobal("confirm", confirmMock);
  vi.stubGlobal("crypto", { randomUUID: randomUuidMock });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Bosch list-only hiring pipeline", () => {
  it("shows a candidate table, five-stage summary and right-side detail; no Kanban or drag mode", async () => {
    api.list.mockResolvedValue({ applications: [application("Ada")], limit: 25, offset: 0 });
    api.detail.mockResolvedValue(detail("Ada"));
    renderPipeline();
    expect(await screen.findByRole("table")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Hiring pipeline counts" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Kanban" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Giai đoạn NEW" })).toBeNull();
    const candidate = screen.getByRole("button", { name: "Ada" });
    expect(candidate.getAttribute("draggable")).toBeNull();
    fireEvent.click(candidate);
    expect((await screen.findByLabelText("Chi tiết ứng viên")).textContent).toContain("Ada");
  });

  it("keeps the stage summary and empty message for a Job without applications", async () => {
    api.list.mockResolvedValue({ applications: [], limit: 25, offset: 0 });
    renderPipeline();
    await screen.findByText("Chưa có ứng viên");
    expect(screen.getByRole("group", { name: "Hiring pipeline counts" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Giai đoạn SCREEN" })).toBeNull();
  });

  it("shows forbidden access and does not pretend no applications exist", async () => {
    api.list.mockRejectedValue(new ApiError("Không có quyền", 403));
    renderPipeline();
    expect((await screen.findByRole("alert")).textContent).toContain("Không có quyền");
    expect(screen.queryByText("Chưa có ứng viên")).toBeNull();
  });

  it("does not expose stage actions to read-only users", async () => {
    api.list.mockResolvedValue({ applications: [application("Ada", "SCREEN")], limit: 25, offset: 0 });
    api.detail.mockResolvedValue(detail("Ada", "SCREEN"));
    renderPipeline(false);
    await selectCandidate();
    expect(screen.getByRole("status").textContent).toContain("Chế độ chỉ xem");
    expect(screen.queryByRole("button", { name: /Chuyển (về|sang)/ })).toBeNull();
  });

  it("moves NEW to SCREEN through confirmed button and guarded backend action", async () => {
    api.list.mockResolvedValue({ applications: [application("Ada")], limit: 25, offset: 0 });
    api.detail.mockResolvedValue(detail("Ada"));
    api.screen.mockResolvedValue({ application: { application_id: "Ada", changed: true } });
    renderPipeline();
    await selectCandidate();
    fireEvent.click(screen.getByRole("button", { name: "Chuyển sang SCREEN" }));
    await waitFor(() => expect(api.screen).toHaveBeenCalledWith("Ada", requestId));
    expect(confirmMock).toHaveBeenCalledWith("Chuyển Ada sang SCREEN?");
  });

  it("moves SCREEN back to NEW through the explicit button", async () => {
    api.list.mockResolvedValue({ applications: [application("Ada", "SCREEN")], limit: 25, offset: 0 });
    api.detail.mockResolvedValue(detail("Ada", "SCREEN"));
    api.back.mockResolvedValue({ application: { application_id: "Ada", changed: true } });
    renderPipeline();
    await selectCandidate();
    fireEvent.click(screen.getByRole("button", { name: "Chuyển về NEW" }));
    await waitFor(() => expect(api.back).toHaveBeenCalledWith("Ada", "NEW", requestId));
    expect(confirmMock).toHaveBeenCalledWith("Chuyển Ada về NEW?");
  });

  it("moves SCREEN to INTERVIEW via the existing workflow API", async () => {
    api.list.mockResolvedValue({ applications: [application("Ada", "SCREEN")], limit: 25, offset: 0 });
    api.detail.mockResolvedValue(detail("Ada", "SCREEN"));
    api.interview.mockResolvedValue({ application: { application_id: "Ada", changed: true } });
    renderPipeline();
    await selectCandidate();
    fireEvent.click(screen.getByRole("button", { name: "Chuyển sang INTERVIEW" }));
    await waitFor(() => expect(api.interview).toHaveBeenCalledWith("Ada", requestId));
    expect(confirmMock).toHaveBeenCalledWith("Chuyển Ada sang INTERVIEW?");
  });

  it("moves INTERVIEW back to SCREEN via the existing workflow API", async () => {
    api.list.mockResolvedValue({ applications: [application("Ada", "INTERVIEW")], limit: 25, offset: 0 });
    api.detail.mockResolvedValue(detail("Ada", "INTERVIEW"));
    api.back.mockResolvedValue({ application: { application_id: "Ada", changed: true } });
    renderPipeline();
    await selectCandidate();
    fireEvent.click(screen.getByRole("button", { name: "Chuyển về SCREEN" }));
    await waitFor(() => expect(api.back).toHaveBeenCalledWith("Ada", "SCREEN", requestId));
    expect(confirmMock).toHaveBeenCalledWith("Chuyển Ada về SCREEN?");
  });

  it("does not mutate stage when the recruiter cancels confirmation", async () => {
    api.list.mockResolvedValue({ applications: [application("Ada")], limit: 25, offset: 0 });
    api.detail.mockResolvedValue(detail("Ada"));
    confirmMock.mockReturnValue(false);
    renderPipeline();
    await selectCandidate();
    fireEvent.click(screen.getByRole("button", { name: "Chuyển sang SCREEN" }));
    expect(api.screen).not.toHaveBeenCalled();
  });

  it("clears scoped data and retries when stage access is revoked", async () => {
    api.list.mockResolvedValue({ applications: [application("Ada")], limit: 25, offset: 0 });
    api.detail.mockResolvedValue(detail("Ada"));
    api.screen.mockRejectedValue(new ApiError("Denied", 403));
    renderPipeline();
    await selectCandidate();
    fireEvent.click(screen.getByRole("button", { name: "Chuyển sang SCREEN" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Không có quyền");
    expect(screen.queryByRole("button", { name: "Ada" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Thử lại chuyển SCREEN" })).toBeNull();
  });

  it("reuses the original idempotency request_id for retries after a network failure", async () => {
    api.list.mockResolvedValue({ applications: [application("Ada")], limit: 25, offset: 0 });
    api.detail.mockResolvedValue(detail("Ada"));
    api.screen.mockRejectedValueOnce(new Error("Mạng lỗi")).mockResolvedValue({ application: application("Ada") });
    renderPipeline();
    await selectCandidate();
    fireEvent.click(screen.getByRole("button", { name: "Chuyển sang SCREEN" }));
    await screen.findByText("Mạng lỗi");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại chuyển SCREEN" }));
    await waitFor(() => expect(api.screen).toHaveBeenCalledTimes(2));
    expect(api.screen.mock.calls[1]).toEqual(api.screen.mock.calls[0]);
    expect(randomUuidMock).toHaveBeenCalledTimes(1);
    expect(confirmMock).toHaveBeenCalledTimes(1);
  });

  it("does not let stale candidate detail override the newest selection", async () => {
    let resolveOld!: (value: ReturnType<typeof detail>) => void;
    api.list.mockResolvedValue({ applications: [application("Old"), application("New")], limit: 25, offset: 0 });
    api.detail.mockImplementation((_job: string, id: string) => id === "Old"
      ? new Promise((resolve) => { resolveOld = resolve; })
      : Promise.resolve(detail("New")));
    renderPipeline();
    fireEvent.click(await screen.findByRole("button", { name: "Old" }));
    fireEvent.click(screen.getByRole("button", { name: "New" }));
    await waitFor(() => expect(screen.getByLabelText("Chi tiết ứng viên").textContent).toContain("New"));
    await act(async () => resolveOld(detail("Old")));
    expect(screen.getByLabelText("Chi tiết ứng viên").textContent).not.toContain("Old");
  });

  it("closes detail when a new search has no results", async () => {
    api.list.mockResolvedValue({ applications: [application("Ada")], limit: 25, offset: 0 });
    api.detail.mockResolvedValue(detail("Ada"));
    api.search.mockResolvedValue({ applications: [], limit: 25, offset: 0 });
    renderPipeline();
    await selectCandidate();
    fireEvent.change(screen.getByRole("textbox", { name: "Tìm ứng viên trong vị trí này" }), {
      target: { value: "No matching candidate" },
    });
    await screen.findByText("Chưa có ứng viên");
    expect(screen.queryByLabelText("Chi tiết ứng viên")).toBeNull();
  });

  it("renders real audit actor and no fabricated matching context", async () => {
    api.list.mockResolvedValue({ applications: [application("Ada")], limit: 25, offset: 0 });
    api.detail.mockResolvedValue({
      ...detail("Ada"),
      events: [{
        event_id: "event-1", actor_id: "actor-1", actor_display_name: "TEST ONLY Recruiter",
        event_type: "MOVED", from_stage: "NEW", to_stage: "SCREEN", created_at: "2026-01-01T00:00:00Z",
      }],
      matching_context: null,
    });
    renderPipeline();
    await selectCandidate();
    expect(screen.getByLabelText("Chi tiết ứng viên").textContent).toContain("TEST ONLY Recruiter");
    expect(screen.queryByText("Matching context")).toBeNull();
  });
});
