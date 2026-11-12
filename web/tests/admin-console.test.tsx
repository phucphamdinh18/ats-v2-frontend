import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import AdminConsole from "../components/admin-console";
import { LanguageProvider, useLanguage } from "../components/language";
const api = vi.hoisted(() => ({
  members: vi.fn(),
  assign: vi.fn(),
  create: vi.fn(),
  open: vi.fn(),
  remove: vi.fn(),
  metadata: vi.fn(),
}));
vi.mock("../lib/admin-jobs", () => ({
  listJobMembers: api.members,
  assignJobMember: api.assign,
  createJobDraft: api.create,
  openJob: api.open,
  removeJobMember: api.remove,
  updateJobMetadata: api.metadata,
}));
const jobs = [
  {
    id: "open-1",
    title: "Embedded Engineer",
    job_code: "OPEN-1",
    status: "OPEN",
  },
  { id: "draft-1", title: "QA Engineer", job_code: null, status: "DRAFT" },
];
beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset());
  api.members.mockResolvedValue({ members: [] });
  api.metadata.mockResolvedValue({ job: {} });
  localStorage.clear();
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  );
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "ui-create-request") });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function Switch() {
  const { setLocale } = useLanguage();
  return (
    <>
      <button onClick={() => setLocale("en")}>English UI</button>
      <button onClick={() => setLocale("vi")}>Vietnamese UI</button>
    </>
  );
}
function setup() {
  return render(
    <LanguageProvider>
      <Switch />
      <AdminConsole
        jobs={jobs}
        onRefresh={vi.fn(async () => {})}
        onAccessLost={vi.fn()}
      />
    </LanguageProvider>,
  );
}
function row(title: string) {
  return screen.getByRole("row", { name: new RegExp(title) });
}
function completeRequirements() {
  fireEvent.change(screen.getByLabelText("Cấp độ"), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("Nhóm chức năng"), {
    target: { value: "Tech/Product" },
  });
  fireEvent.change(screen.getByLabelText("Mùa tuyển dụng"), {
    target: { value: "Normal Time" },
  });
}
it("starts with one Job table and separates draft opening from team access", async () => {
  setup();
  expect(screen.queryByRole("tablist")).toBeNull();
  expect(screen.queryByLabelText("Tên vị trí")).toBeNull();
  expect(api.members).not.toHaveBeenCalled();
  expect(
    within(row("Embedded Engineer")).queryByRole("button", {
      name: "Mở tuyển",
    }),
  ).toBeNull();
  fireEvent.click(
    within(row("QA Engineer")).getByRole("button", {
      name: "Mở tuyển",
    }),
  );
  const panel = screen.getByRole("region", { name: "Mở tuyển" });
  expect(panel.textContent).toContain("QA Engineer");
  expect(panel.textContent).not.toContain("Embedded Engineer");
  api.open.mockResolvedValue({ job: { opened: true } });
  fireEvent.change(screen.getByLabelText("Mã Job"), {
    target: { value: "QA-2026" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận mở tuyển" }));
  await waitFor(() =>
    expect(api.open).toHaveBeenCalledWith("draft-1", "QA Engineer", "QA-2026"),
  );
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(api.assign).not.toHaveBeenCalled();
  expect(api.create).not.toHaveBeenCalled();
});
it("shows identity and requirements in one creation form; retry after a metadata failure reuses the saved draft", async () => {
  setup();
  fireEvent.click(screen.getByRole("button", { name: "Tạo Job" }));
  fireEvent.change(screen.getByLabelText("Tên vị trí"), {
    target: { value: "New QA Engineer" },
  });
  completeRequirements();
  const form = screen.getByLabelText("Tên vị trí").closest("form");
  expect(screen.getByLabelText("Cấp độ").closest("form")).toBe(form);
  api.create.mockResolvedValue({
    job: { job_id: "created-1", job_title: "New QA Engineer", created: true },
  });
  api.metadata
    .mockRejectedValueOnce(new Error("Network failed"))
    .mockResolvedValueOnce({ job: {} });
  fireEvent.submit(form!);
  await screen.findByText(
    "Job nháp đã được lưu. Hoàn tất phần yêu cầu bên dưới; thử lại sẽ không tạo thêm Job.",
  );
  expect(
    (screen.getByLabelText("Tên vị trí") as HTMLInputElement).disabled ||
      screen.getByLabelText("Tên vị trí").closest("fieldset")?.disabled,
  ).toBe(true);
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Lưu tiếp yêu cầu" })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Lưu tiếp yêu cầu" }));
  await waitFor(() => expect(api.metadata).toHaveBeenCalledTimes(2));
  expect(api.create).toHaveBeenCalledTimes(1);
  expect(api.metadata.mock.calls.map((call) => call[0].jobId)).toEqual([
    "created-1",
    "created-1",
  ]);
  expect(api.open).not.toHaveBeenCalled();
  expect(api.assign).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByLabelText("Tên vị trí")).toBeNull());
});
it("translates the table and open form without losing input or changing metadata codes", () => {
  setup();
  fireEvent.click(screen.getByRole("button", { name: "Tạo Job" }));
  fireEvent.change(screen.getByLabelText("Tên vị trí"), {
    target: { value: "Kỹ sư QA" },
  });
  completeRequirements();
  fireEvent.click(screen.getByRole("button", { name: "English UI" }));
  expect((screen.getByLabelText("Job title") as HTMLInputElement).value).toBe(
    "Kỹ sư QA",
  );
  const season = screen.getByLabelText("Hiring season") as HTMLSelectElement;
  expect(season.value).toBe("Normal Time");
  expect(season.selectedOptions[0].textContent).toBe("Regular season");
  expect(
    screen.getByRole("columnheader", { name: "Team & access" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Vietnamese UI" }));
  expect(
    (screen.getByLabelText("Mùa tuyển dụng") as HTMLSelectElement)
      .selectedOptions[0].textContent,
  ).toBe("Mùa thông thường");
  expect(api.create).not.toHaveBeenCalled();
});
it("loads team access only for the selected row and ignores a stale previous Job response", async () => {
  let resolveFirst: (value: unknown) => void = () => {};
  api.members
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    )
    .mockResolvedValueOnce({
      members: [
        {
          user_id: "member-b",
          email: "draft-team@example.invalid",
          role: "TA_RECRUITER",
        },
      ],
    });
  setup();
  fireEvent.click(
    within(row("Embedded Engineer")).getByRole("button", {
      name: "Phân công đội ngũ",
    }),
  );
  await waitFor(() => expect(api.members).toHaveBeenCalledWith("open-1"));
  fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
  fireEvent.click(
    within(row("QA Engineer")).getByRole("button", {
      name: "Phân công đội ngũ",
    }),
  );
  await screen.findByText("draft-team@example.invalid");
  await act(async () =>
    resolveFirst({
      members: [
        {
          user_id: "old",
          email: "wrong-job@example.invalid",
          role: "HIRING_MANAGER",
        },
      ],
    }),
  );
  expect(screen.queryByText("wrong-job@example.invalid")).toBeNull();
  expect(
    screen.getByRole("region", { name: "Phân công đội ngũ" }).textContent,
  ).toContain("QA Engineer");
  expect(api.open).not.toHaveBeenCalled();
  expect(api.assign).not.toHaveBeenCalled();
});
it("editing requirements targets the chosen Job without opening it or changing assignments", async () => {
  setup();
  fireEvent.click(
    within(row("Embedded Engineer")).getByRole("button", {
      name: "Chỉnh yêu cầu",
    }),
  );
  completeRequirements();
  fireEvent.click(screen.getByRole("button", { name: "Lưu yêu cầu" }));
  await waitFor(() =>
    expect(api.metadata).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "open-1",
        level: 3,
        functionGroup: "Tech/Product",
        hiringSeason: "Normal Time",
      }),
    ),
  );
  expect(api.open).not.toHaveBeenCalled();
  expect(api.assign).not.toHaveBeenCalled();
});

it("retries an uncertain draft creation with the same request ID", async () => {
  vi.mocked(crypto.randomUUID)
    .mockReturnValueOnce("request-one")
    .mockReturnValueOnce("request-two");
  api.create
    .mockRejectedValueOnce(new Error("Network uncertain"))
    .mockResolvedValueOnce({
      job: { job_id: "created-retry", job_title: "Retry QA", created: false },
    });
  setup();
  fireEvent.click(screen.getByRole("button", { name: "Tạo Job" }));
  fireEvent.change(screen.getByLabelText("Tên vị trí"), {
    target: { value: "Retry QA" },
  });
  completeRequirements();
  fireEvent.click(screen.getByRole("button", { name: "Lưu Job nháp" }));
  await screen.findByRole("alert");
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Lưu Job nháp" })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Lưu Job nháp" }));
  await waitFor(() =>
    expect(api.metadata).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "created-retry" }),
    ),
  );
  expect(api.create.mock.calls.map((call) => call[0].requestId)).toEqual([
    "request-one",
    "request-one",
  ]);
  expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
  expect(api.open).not.toHaveBeenCalled();
  expect(api.assign).not.toHaveBeenCalled();
});

it("embeds row actions without a second Job list and keeps the selected target", async () => {
  const refresh = vi.fn(async () => {});
  const accessLost = vi.fn();
  const view = (
    kind: "details" | "team" | "create",
    jobId: string | undefined,
    requestId: number,
  ) => (
    <LanguageProvider>
      <AdminConsole
        editorOnly
        jobs={jobs}
        action={{ kind, jobId, requestId }}
        onRefresh={refresh}
        onAccessLost={accessLost}
      />
    </LanguageProvider>
  );
  const rendered = render(view("details", "draft-1", 1));
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.queryByRole("searchbox")).toBeNull();
  expect(
    screen.getByRole("region", { name: "Chỉnh yêu cầu" }).textContent,
  ).toContain("QA Engineer");
  expect(api.members).not.toHaveBeenCalled();
  expect(api.metadata).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
  expect(screen.queryByRole("region", { name: "Chỉnh yêu cầu" })).toBeNull();
  rendered.rerender(view("team", "open-1", 2));
  await waitFor(() => expect(api.members).toHaveBeenCalledWith("open-1"));
  expect(
    screen.getByRole("region", { name: "Phân công đội ngũ" }).textContent,
  ).toContain("Embedded Engineer");
  expect(api.open).not.toHaveBeenCalled();
  expect(api.assign).not.toHaveBeenCalled();
  rendered.rerender(view("create", undefined, 3));
  expect(screen.getByLabelText("Tên vị trí")).toBeTruthy();
  expect(screen.queryByRole("table")).toBeNull();
  expect(api.create).not.toHaveBeenCalled();
});
