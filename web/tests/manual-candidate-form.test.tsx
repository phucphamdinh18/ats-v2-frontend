import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ManualCandidateForm from "../components/manual-candidate-form";
import { ApiError } from "../lib/supabase";

const api = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../lib/candidates", () => ({ createManualCandidateApplication: api.create }));
vi.mock("../lib/supabase", () => ({ ApiError: class ApiError extends Error { constructor(message: string, public status?: number) { super(message); } }, getClient: () => ({ from: () => { const query = { select: () => query, order: () => query, then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: [{ sub_source: "TEST ONLY", source: "TEST ONLY", source_ownership: "TEST ONLY" }], error: null }).then(resolve) }; return query; } }) }));
const openJob = { id: "00ff2943-6fb8-448d-9bf0-07546b08331d", title: "Pilot Job", job_code: "PILOT-1", status: "OPEN" };

beforeEach(() => { api.create.mockReset(); vi.stubGlobal("confirm", vi.fn(() => true)); vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "11111111-1111-4111-8111-111111111111") }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function complete() {
  const source = await screen.findByRole("option", { name: /TEST ONLY/ });
  fireEvent.change(screen.getByRole("combobox", { name: "Nguồn ứng viên" }), { target: { value: source.getAttribute("value") } });
  fireEvent.change(screen.getByLabelText("Họ và tên ứng viên"), { target: { value: "Pilot Candidate" } });
  fireEvent.change(screen.getByLabelText("Email ứng viên"), { target: { value: "pilot@example.invalid" } });
  fireEvent.change(screen.getByLabelText("Link CV Google Drive"), { target: { value: "https://drive.google.com/file/d/1MrJqmEnHb3KJXzqRPNXbb1_JLY4ZJufe/view" } });
  fireEvent.change(screen.getByLabelText("Tên tệp CV"), { target: { value: "Pilot CV.pdf" } });
}
describe("manual candidate form", () => {
  it("keeps the same request id when the network retry is requested", async () => {
    api.create.mockRejectedValueOnce(new Error("Mạng lỗi")).mockResolvedValueOnce({ created: true });
    render(<ManualCandidateForm job={openJob} onCreated={vi.fn(async () => {})} onSessionLost={vi.fn()} />);
    await complete(); fireEvent.click(screen.getByRole("button", { name: "Thêm vào pipeline" }));
    await screen.findByText("Mạng lỗi"); fireEvent.click(screen.getByRole("button", { name: "Thử lại với cùng request_id" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(2));
    expect(api.create.mock.calls[0][0].requestId).toBe(api.create.mock.calls[1][0].requestId);
  });
  it("does not submit a manual candidate to a Job that is not open", () => {
    render(<ManualCandidateForm job={{ ...openJob, status: "DRAFT" }} onCreated={vi.fn(async () => {})} onSessionLost={vi.fn()} />);
    expect(screen.getByText(/Chỉ Job đang mở tuyển/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Thêm vào pipeline" }).hasAttribute("disabled")).toBe(true);
    expect(api.create).not.toHaveBeenCalled();
  });
  it("clears scope through the session callback after a 401", async () => {
    const onSessionLost = vi.fn(); api.create.mockRejectedValue(new ApiError("Đăng nhập lại", 401));
    render(<ManualCandidateForm job={openJob} onCreated={vi.fn(async () => {})} onSessionLost={onSessionLost} />);
    await complete(); fireEvent.click(screen.getByRole("button", { name: "Thêm vào pipeline" }));
    await waitFor(() => expect(onSessionLost).toHaveBeenCalledTimes(1));
  });
});

describe("candidate request identity", () => {
  it.each([
    ["Họ và tên ứng viên", "Edited Candidate"],
    ["Email ứng viên", "edited@example.invalid"],
    ["Số điện thoại ứng viên", "+84900000000"],
    ["Chức danh hiện tại", "Engineer"],
    ["Link CV Google Drive", "https://drive.google.com/file/d/synthetic-file-123456789/view"],
    ["Tên tệp CV", "synthetic.pdf"],
  ])("uses a new ID and confirmation after editing %s", async (label, value) => {
    vi.mocked(crypto.randomUUID).mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
      .mockReturnValueOnce("22222222-2222-4222-8222-222222222222");
    api.create.mockRejectedValueOnce(new Error("Network uncertain")).mockResolvedValueOnce({ created: true });
    render(<ManualCandidateForm job={openJob} onCreated={vi.fn(async () => {})} onSessionLost={vi.fn()} />);
    await complete(); fireEvent.click(screen.getByRole("button", { name: "Thêm vào pipeline" }));
    await screen.findByText("Network uncertain");
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    expect(screen.queryByRole("button", { name: "Thử lại với cùng request_id" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Thêm vào pipeline" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(2));
    expect(api.create.mock.calls[0][0].requestId).not.toBe(api.create.mock.calls[1][0].requestId);
    expect(confirm).toHaveBeenCalledTimes(2);
  });
  it("uses a new ID after a definitive conflict response", async () => {
    vi.mocked(crypto.randomUUID).mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
      .mockReturnValueOnce("22222222-2222-4222-8222-222222222222");
    api.create.mockRejectedValueOnce(new ApiError("Conflict", 409)).mockResolvedValueOnce({ created: true });
    render(<ManualCandidateForm job={openJob} onCreated={vi.fn(async () => {})} onSessionLost={vi.fn()} />);
    await complete(); fireEvent.click(screen.getByRole("button", { name: "Thêm vào pipeline" }));
    await screen.findByText("Conflict");
    expect(screen.queryByRole("button", { name: "Thử lại với cùng request_id" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Thêm vào pipeline" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(2));
    expect(api.create.mock.calls[0][0].requestId).not.toBe(api.create.mock.calls[1][0].requestId);
  });
});
