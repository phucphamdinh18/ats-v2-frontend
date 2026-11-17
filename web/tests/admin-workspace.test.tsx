import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import AdminConsole from "../components/admin-console";
import JobTeamAccess from "../components/job-team-access";
import { ApiError } from "../lib/supabase";
const api = vi.hoisted(() => ({
  save: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  assign: vi.fn(),
  remove: vi.fn(),
  workflow: vi.fn(),
}));
vi.mock("../lib/offer-approval", () => ({ offerWorkflow: api.workflow }));
vi.mock("../lib/admin-jobs", () => ({
  saveJobOpening: api.save,
  getJobOpening: api.get,
  listJobMembers: api.list,
  assignJobMember: api.assign,
  removeJobMember: api.remove,
}));
const job = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "TEST Position",
  job_code: "ATS-AUTO",
  status: "DRAFT",
};
const noop = () => {};
beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.save.mockResolvedValue({
    job: {
      job_id: job.id,
      job_code: "ATS-AUTO",
      job_title: "TEST Position",
      job_status: "DRAFT",
      changed: true,
    },
  });
  api.get.mockResolvedValue({
    job: { ...job, updated_at: "2026-11-17T00:00:00.123456Z" },
  });
  api.list.mockResolvedValue({ members: [] });
  api.assign.mockResolvedValue({ member: { added: true } });
  api.remove.mockResolvedValue({ removed: true });
  api.workflow.mockResolvedValue({ approvers: [] });
});
afterEach(cleanup);
it("uses one atomic request with automatic code and preserves identical retry after lost response", async () => {
  const refreshed = vi.fn(async () => {});
  render(<AdminConsole jobs={[]} onRefresh={refreshed} onAccessLost={noop} />);
  expect((screen.getByLabelText("Mã Job") as HTMLInputElement).readOnly).toBe(
    true,
  );
  fireEvent.change(screen.getByLabelText("Tên vị trí"), {
    target: { value: "TEST Position" },
  });
  api.save.mockRejectedValueOnce(new ApiError("Network unavailable", 503));
  fireEvent.submit(
    screen.getByRole("button", { name: "Lưu nháp" }).closest("form")!,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Thử lại yêu cầu cũ" }),
  );
  await waitFor(() => expect(refreshed).toHaveBeenCalledOnce());
  expect(api.save.mock.calls).toHaveLength(2);
  expect(api.save.mock.calls[1][0]).toEqual(api.save.mock.calls[0][0]);
  expect(api.save.mock.calls[0][0].fields.job_code).toBeUndefined();
  expect(api.save.mock.calls[0][0].fields.status).toBe("DRAFT");
});
it("loads an existing draft version and atomically opens it without requesting a manual code", async () => {
  render(
    <AdminConsole
      jobs={[job]}
      onRefresh={async () => {}}
      onAccessLost={noop}
    />,
  );
  fireEvent.change(
    screen.getByRole("combobox", { name: "Chọn Job nháp để tiếp tục" }),
    { target: { value: job.id } },
  );
  await waitFor(() =>
    expect(
      (screen.getByLabelText("Tên vị trí") as HTMLInputElement).value,
    ).toBe(job.title),
  );
  fireEvent.click(screen.getByRole("button", { name: "Lưu & mở tuyển" }));
  await waitFor(() => expect(api.save).toHaveBeenCalledOnce());
  expect(api.save.mock.calls[0][0]).toMatchObject({
    jobId: job.id,
    expectedUpdatedAt: "2026-11-17T00:00:00.123456Z",
    fields: { status: "OPEN" },
  });
});
it("does not offer mutation retry when refresh fails after a successful save", async () => {
  render(
    <AdminConsole
      jobs={[]}
      onRefresh={async () => {
        throw Error("read failed");
      }}
      onAccessLost={noop}
    />,
  );
  fireEvent.change(screen.getByLabelText("Tên vị trí"), {
    target: { value: "TEST Position" },
  });
  fireEvent.submit(
    screen.getByRole("button", { name: "Lưu nháp" }).closest("form")!,
  );
  await screen.findByText(/Đã lưu Job. Danh sách chưa tải lại/);
  expect(
    screen.queryByRole("button", { name: "Thử lại yêu cầu cũ" }),
  ).toBeNull();
  expect(api.save).toHaveBeenCalledOnce();
});
it("assigns only on the current Job and retries the identical member after an unknown outcome", async () => {
  render(<JobTeamAccess job={job} onAccessLost={noop} />);
  await screen.findByText("Chưa có thành viên được phân công cho Job này.");
  fireEvent.change(screen.getByLabelText("Email người dùng"), {
    target: { value: "recruiter@example.invalid" },
  });
  api.assign.mockRejectedValueOnce(new ApiError("lost", 503));
  fireEvent.submit(
    screen.getByRole("button", { name: "Gán quyền" }).closest("form")!,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Thử lại thao tác" }),
  );
  await waitFor(() => expect(api.assign).toHaveBeenCalledTimes(2));
  expect(api.assign.mock.calls).toEqual([
    [job.id, "recruiter@example.invalid", "TA_RECRUITER"],
    [job.id, "recruiter@example.invalid", "TA_RECRUITER"],
  ]);
});
it("requires explicit confirmation before revoking and clears roster on forbidden responses", async () => {
  api.list.mockResolvedValue({
    members: [
      {
        user_id: "u",
        email: "hm@example.invalid",
        role: "HIRING_MANAGER",
        assigned_at: "2026-11-17",
      },
    ],
  });
  const lost = vi.fn();
  render(<JobTeamAccess job={job} onAccessLost={lost} />);
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Thu hồi hm@example.invalid Hiring Manager",
    }),
  );
  expect(api.remove).not.toHaveBeenCalled();
  api.remove.mockRejectedValueOnce(new ApiError("revoked", 403));
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận thu hồi" }));
  await waitFor(() => expect(lost).toHaveBeenCalledOnce());
  expect(api.remove).toHaveBeenCalledWith(job.id, "u", "HIRING_MANAGER");
  expect(screen.queryByRole("cell", { name: "hm@example.invalid" })).toBeNull();
});
it("preserves per-job DH/CEO approver assignment in Team and Access without granting a team role", async () => {
  render(<JobTeamAccess job={{...job,status:"OPEN"}} onAccessLost={noop} />);
  await waitFor(() => expect(api.workflow).toHaveBeenCalledWith({action:"setup",job_id:job.id}));
  fireEvent.change(screen.getByLabelText("Email người dùng"), {target:{value:"head@example.com"}});
  fireEvent.change(screen.getByLabelText("Vai trò trên Job"), {target:{value:"OFFER_APPROVER"}});
  fireEvent.click(screen.getByRole("button", {name:"Gán quyền"}));
  await waitFor(() => expect(api.workflow).toHaveBeenCalledWith({action:"grant_approver_email",job_id:job.id,email:"head@example.com",enabled:true}));
  expect(api.assign).not.toHaveBeenCalled();
});
