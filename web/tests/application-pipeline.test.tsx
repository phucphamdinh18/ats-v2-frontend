import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ApplicationPipeline from "../components/application-pipeline";
import { ApiError } from "../lib/supabase";

const api = vi.hoisted(() => ({ list: vi.fn(), search: vi.fn(), detail: vi.fn(), screen: vi.fn(), interview: vi.fn(), back: vi.fn(), rounds: vi.fn(), worklist: vi.fn(), profile: vi.fn(), saveProfile: vi.fn(), notes: vi.fn(), addNote: vi.fn() }));
const confirmMock = vi.hoisted(() => vi.fn());
const randomUuidMock = vi.hoisted(() => vi.fn());
vi.mock("../lib/applications", () => ({
  listApplications: api.list,
  searchApplications: api.search,
  applicationDetail: api.detail,
  currentInterviewRounds: api.rounds,
  APPLICATION_NOTE_LIMIT: 1000,
  listApplicationNotes: api.notes,
  addApplicationNote: api.addNote,
  screenApplication: api.screen,
  interviewApplication: api.interview,
  moveApplicationBack: api.back,
}));
vi.mock("../lib/interviews", () => ({ listInterviewWorklist: api.worklist }));
vi.mock("../lib/candidates", () => ({ candidateProfile: api.profile, updateCandidateProfile: api.saveProfile }));
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
  await screen.findByLabelText("Chi tiết ứng viên");
}

beforeEach(() => {
  window.sessionStorage.clear();
  Object.values(api).forEach((fn) => fn.mockReset());
  api.rounds.mockResolvedValue(new Map());
  api.worklist.mockResolvedValue([]);
  api.profile.mockImplementation(async (id: string) => ({ candidate: { id }, documents: [], applications: [] }));
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
    expect(screen.getByRole("group", { name: "Số hồ sơ theo giai đoạn" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Kanban" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Giai đoạn NEW" })).toBeNull();
    const candidate = screen.getByRole("button", { name: "Ada" });
    expect(candidate.getAttribute("draggable")).toBeNull();
    const table = screen.getByRole("table");
    const headers = Array.from(table.querySelectorAll("th"), (header) => header.textContent?.trim());
    expect(headers).toEqual(["", "Ứng viên", "Vòng tuyển dụng", "Vòng phỏng vấn", "Độ phù hợp", "Kinh nghiệm", "Nguồn"]);
    expect(headers).not.toContain("Hoạt động gần nhất");
    const overview = screen.getByLabelText("Tổng quan ứng viên");
    expect(overview.previousElementSibling?.contains(table)).toBe(true);
    fireEvent.click(candidate);
    expect((await screen.findByLabelText("Chi tiết ứng viên")).textContent).toContain("Ada");
  });

  it("keeps the stage summary and empty message for a Job without applications", async () => {
    api.list.mockResolvedValue({ applications: [], limit: 25, offset: 0 });
    renderPipeline();
    await screen.findByText("Chưa có ứng viên");
    expect(screen.getByRole("group", { name: "Số hồ sơ theo giai đoạn" })).toBeTruthy();
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
    expect(screen.queryByRole("button", { name: "Sửa ứng viên" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Hồ sơ" }));
    expect(screen.getByText(/quyền xem thông tin liên hệ và CV/)).toBeTruthy();
    expect(api.profile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ghi chú" }));
    expect(screen.getByText(/quyền truy cập ghi chú/)).toBeTruthy();
    expect(api.notes).not.toHaveBeenCalled();
  });

  it("restores the Overview summary and reuses the candidate data in Profile", async () => {
    api.list.mockResolvedValue({ applications: [application("Ada")] });
    api.detail.mockResolvedValue(detail("Ada"));
    api.profile.mockResolvedValue({
      candidate: { id: "candidate-Ada", email: "ada@example.test", current_title: "Test Engineer", current_company: "Test Company", total_experience_years: 0 },
      documents: [{ drive_file_id: "test_cv_file", drive_url: "https://drive.google.com/file/d/test_cv_file/view", original_name: "Test CV.pdf", created_at: "2026-11-24T10:00:00Z" }],
    });
    renderPipeline();
    await selectCandidate();
    const summary = screen.getByRole("heading", { name: "Tóm tắt" });
    const overview = within(screen.getByLabelText("Chi tiết ứng viên"));
    expect(overview.queryByRole("heading", { name: "Tiến độ phỏng vấn" })).toBeNull();
    for (const label of ["Vòng tuyển dụng", "Trạng thái", "Nguồn"]) {
      expect(overview.queryByText(label, { exact: true })).toBeNull();
    }
    expect(await screen.findByText("Test Engineer")).toBeTruthy();
    expect(screen.getByText("Test Company")).toBeTruthy();
    expect(screen.getByText("0 năm")).toBeTruthy();
    expect(screen.getByText("Học vấn").closest("dt")?.nextElementSibling?.textContent).toBe("—");
    expect(screen.queryByText("ada@example.test")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Lịch sử" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tiến độ phỏng vấn" }));
    expect(await screen.findByRole("heading", { name: "Tiến độ phỏng vấn" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Tóm tắt" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hồ sơ" }));
    expect(await screen.findByText("ada@example.test")).toBeTruthy();
    expect(screen.getByText("Test Company")).toBeTruthy();
    expect(screen.getByText("0 năm")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Test CV.pdf" }).getAttribute("href")).toBe("https://drive.google.com/file/d/test_cv_file/view");
    expect(screen.queryByRole("heading", { name: "Tiến độ phỏng vấn" })).toBeNull();
    expect(api.profile).toHaveBeenCalledTimes(1);
  });

  it("adds a Job-scoped note and reuses the request ID after a network error", async () => {
    const newNote = { id: requestId, body: "Gọi lại vào thứ Sáu", author_name: "TEST Recruiter", created_at: "2026-11-24T10:00:00Z" };
    api.list.mockResolvedValue({ applications: [application("Ada")] });
    api.detail.mockResolvedValue(detail("Ada"));
    api.notes.mockResolvedValue({ notes: [] });
    api.addNote.mockRejectedValueOnce(new Error("Mạng lỗi")).mockResolvedValueOnce(newNote);
    renderPipeline();
    await selectCandidate();
    fireEvent.click(screen.getByRole("button", { name: "Ghi chú" }));
    expect(await screen.findByText("Chưa có ghi chú.")).toBeTruthy();
    expect(api.notes).toHaveBeenCalledWith(job.id, "Ada", undefined);
    fireEvent.change(screen.getByLabelText("Ghi chú mới"), { target: { value: "  Gọi lại vào thứ Sáu  " } });
    fireEvent.click(screen.getByRole("button", { name: "Thêm ghi chú" }));
    await screen.findByText("Mạng lỗi");
    fireEvent.click(screen.getByRole("button", { name: "Thêm ghi chú" }));
    expect(await screen.findByText(newNote.body)).toBeTruthy();
    expect(screen.getByText(/TEST Recruiter/)).toBeTruthy();
    expect(api.addNote.mock.calls).toEqual([[job.id, "Ada", requestId, newNote.body], [job.id, "Ada", requestId, newNote.body]]);
  });

  it("shows the current round and status in the table, using the same scheduled and completed rounds as the sidebar", async () => {
    const applicants = ["Ada", "Lin", "Min", "Sam"];
    api.list.mockResolvedValue({ applications: applicants.map((name) => application(name, "INTERVIEW")) });
    api.detail.mockResolvedValue(detail("Ada", "INTERVIEW"));
    api.rounds.mockResolvedValue(new Map([
      ["Ada", { application_id: "Ada", round_number: 2, interview_status: "SCHEDULED" }],
      ["Lin", { application_id: "Lin", round_number: 1, interview_status: "SCHEDULED" }],
      ["Min", { application_id: "Min", round_number: 1, interview_status: "COMPLETED" }],
    ]));
    api.worklist.mockImplementation(async (status, _limit, _offset, id) => status === "SCHEDULED" ? [
      { id: `${id}-scheduled`, status: "SCHEDULED", starts_at: "2026-11-20T17:30:00Z", timezone: "Etc/GMT-7", interview_type: "FINAL" },
      { id: "cancelled", status: "CANCELLED", starts_at: "2026-11-20T09:00:00Z", participants: [{ display_name: "Cancelled only" }] },
    ] : id === "Ada" ? [
      { id: "completed", status: "COMPLETED", starts_at: "2026-11-20T10:00:00Z", timezone: "Etc/GMT-7", interview_type: "INTERVIEW" },
    ] : []);
    renderPipeline();
    await selectCandidate();
    expect(api.rounds).toHaveBeenCalledWith(job.id, applicants);
    const roundCell = (name: string) => within(screen.getByRole("row", { name: new RegExp(name) })).getAllByRole("cell")[3];
    expect(within(roundCell("Ada")).getByText("Vòng 2")).toBeTruthy();
    expect(within(roundCell("Ada")).getByText("Đã lên lịch")).toBeTruthy();
    expect(within(roundCell("Lin")).getByText("Vòng 1")).toBeTruthy();
    expect(within(roundCell("Lin")).getByText("Đã lên lịch")).toBeTruthy();
    expect(within(roundCell("Min")).getByText("Đã hoàn tất")).toBeTruthy();
    expect(roundCell("Sam").textContent?.trim()).toBe("—");
    fireEvent.click(screen.getByRole("button", { name: "Tiến độ phỏng vấn" }));
    const progress = screen.getByRole("region", { name: "Tiến độ phỏng vấn" });
    expect(await within(progress).findByText("1/2 đã hoàn tất")).toBeTruthy();
    const rounds = within(progress).getAllByRole("listitem");
    expect(rounds).toHaveLength(2);
    expect(rounds[0].textContent).toContain("Đã hoàn tất · 20/11/2026");
    expect(rounds[1].textContent).toContain("Đã lên lịch · 21/11/2026, 00:30");
    expect(within(progress).queryByText("Cancelled only")).toBeNull();
    expect(api.worklist.mock.calls).toEqual([["SCHEDULED", 100, 0, "Ada"], ["COMPLETED", 100, 0, "Ada"]]);

    api.detail.mockResolvedValue(detail("Lin", "INTERVIEW"));
    await selectCandidate("Lin");
    fireEvent.click(screen.getByRole("button", { name: "Tiến độ phỏng vấn" }));
    expect(await screen.findByText("0/1 đã hoàn tất")).toBeTruthy();
  });

  it("prefills and saves the selected candidate while reloading the application list", async () => {
    const version = "2026-11-20T10:00:00Z";
    api.list.mockResolvedValueOnce({ applications: [application("Ada")] })
      .mockResolvedValueOnce({ applications: [{ ...application("Ada"), candidate_name: "Ada Nguyen" }] });
    api.detail.mockResolvedValue(detail("Ada"));
    api.profile.mockResolvedValue({ candidate: { id: "candidate-Ada", full_name: "Ada", email: "ada@example.test", updated_at: version }, documents: [], applications: [] });
    api.saveProfile.mockResolvedValue({ candidate_id: "candidate-Ada", full_name: "Ada Nguyen" });
    renderPipeline();
    await selectCandidate();
    fireEvent.click(screen.getByRole("button", { name: "Sửa ứng viên" }));
    const input = await screen.findByDisplayValue("Ada");
    fireEvent.change(input, { target: { value: "Ada Nguyen" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await screen.findByText("Đã lưu hồ sơ ứng viên.");
    expect(api.saveProfile).toHaveBeenCalledWith(job.id, "Ada", version, {
      full_name: "Ada Nguyen", email: "ada@example.test", phone: "", current_title: "", current_company: "",
    });
    expect(await screen.findByRole("button", { name: "Ada Nguyen" })).toBeTruthy();
  });

  it("moves NEW to SCREEN through confirmed button and guarded backend action", async () => {
    api.list.mockResolvedValue({ applications: [application("Ada")], limit: 25, offset: 0 });
    api.detail.mockResolvedValue(detail("Ada"));
    api.screen.mockResolvedValue({ application: { application_id: "Ada", changed: true } });
    renderPipeline();
    await selectCandidate();
    fireEvent.click(screen.getByRole("button", { name: "Chuyển sang Sơ loại" }));
    await waitFor(() => expect(api.screen).toHaveBeenCalledWith("Ada", requestId));
    expect(confirmMock).toHaveBeenCalledWith("Chuyển Ada sang Sơ loại?");
  });

  it("moves SCREEN back to NEW through the explicit button", async () => {
    api.list.mockResolvedValue({ applications: [application("Ada", "SCREEN")], limit: 25, offset: 0 });
    api.detail.mockResolvedValue(detail("Ada", "SCREEN"));
    api.back.mockResolvedValue({ application: { application_id: "Ada", changed: true } });
    renderPipeline();
    await selectCandidate();
    fireEvent.click(screen.getByRole("button", { name: "Chuyển về Mới ứng tuyển" }));
    await waitFor(() => expect(api.back).toHaveBeenCalledWith("Ada", "NEW", requestId));
    expect(confirmMock).toHaveBeenCalledWith("Chuyển Ada về Mới ứng tuyển?");
  });

  it("moves SCREEN to INTERVIEW via the existing workflow API", async () => {
    api.list.mockResolvedValue({ applications: [application("Ada", "SCREEN")], limit: 25, offset: 0 });
    api.detail.mockResolvedValue(detail("Ada", "SCREEN"));
    api.interview.mockResolvedValue({ application: { application_id: "Ada", changed: true } });
    renderPipeline();
    await selectCandidate();
    fireEvent.click(screen.getByRole("button", { name: "Chuyển sang Phỏng vấn" }));
    await waitFor(() => expect(api.interview).toHaveBeenCalledWith("Ada", requestId));
    expect(confirmMock).toHaveBeenCalledWith("Chuyển Ada sang Phỏng vấn?");
  });

  it("moves INTERVIEW back to SCREEN via the existing workflow API", async () => {
    api.list.mockResolvedValue({ applications: [application("Ada", "INTERVIEW")], limit: 25, offset: 0 });
    api.detail.mockResolvedValue(detail("Ada", "INTERVIEW"));
    api.back.mockResolvedValue({ application: { application_id: "Ada", changed: true } });
    renderPipeline();
    await selectCandidate();
    fireEvent.click(screen.getByRole("button", { name: "Chuyển về Sơ loại" }));
    await waitFor(() => expect(api.back).toHaveBeenCalledWith("Ada", "SCREEN", requestId));
    expect(confirmMock).toHaveBeenCalledWith("Chuyển Ada về Sơ loại?");
  });

  it("does not mutate stage when the recruiter cancels confirmation", async () => {
    api.list.mockResolvedValue({ applications: [application("Ada")], limit: 25, offset: 0 });
    api.detail.mockResolvedValue(detail("Ada"));
    confirmMock.mockReturnValue(false);
    renderPipeline();
    await selectCandidate();
    fireEvent.click(screen.getByRole("button", { name: "Chuyển sang Sơ loại" }));
    expect(api.screen).not.toHaveBeenCalled();
  });

  it("clears scoped data and retries when stage access is revoked", async () => {
    api.list.mockResolvedValue({ applications: [application("Ada")], limit: 25, offset: 0 });
    api.detail.mockResolvedValue(detail("Ada"));
    api.screen.mockRejectedValue(new ApiError("Denied", 403));
    renderPipeline();
    await selectCandidate();
    fireEvent.click(screen.getByRole("button", { name: "Chuyển sang Sơ loại" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Chuyển sang Sơ loại" }));
    await screen.findByText("Mạng lỗi");
    fireEvent.click(screen.getByRole("button", { name: "Gửi lại yêu cầu: Sơ loại" }));
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

  it("moves application history from Overview to Activity with the recorded actor", async () => {
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
    expect(screen.queryByRole("heading", { name: "Lịch sử" })).toBeNull();
    expect(screen.queryByText(/TEST ONLY Recruiter/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Hoạt động" }));
    expect(screen.getByRole("heading", { name: "Lịch sử" })).toBeTruthy();
    expect(screen.getByLabelText("Chi tiết ứng viên").textContent).toContain("TEST ONLY Recruiter");
    expect(screen.queryByText("Matching context")).toBeNull();
  });
});
