import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import CandidateEntryDialog from "../components/candidate-entry-dialog";
import { LanguageProvider, useLanguage } from "../components/language";
const api = vi.hoisted(() => ({
  create: vi.fn(),
  refreshed: vi.fn(async () => {}),
}));
vi.mock("../lib/candidates", () => ({
  createManualCandidateApplication: api.create,
}));
vi.mock("../lib/supabase", () => ({
  ApiError: class ApiError extends Error {},
  getClient: () => ({
    from: () => {
      const query = {
        select: () => query,
        order: () => query,
        then: (resolve: (result: unknown) => unknown) =>
          Promise.resolve({
            data: [
              {
                sub_source: "TEST ONLY",
                source: "TEST ONLY",
                source_ownership: "TEST ONLY",
              },
            ],
            error: null,
          }).then(resolve),
      };
      return query;
    },
  }),
}));
// jsdom lacks native dialog methods. Emulate only open/close state; real-browser
// top-layer layout and native focus containment still require visual QA.
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value() {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value() {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    },
  });
});
afterAll(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});
beforeEach(() => {
  localStorage.clear();
  api.create.mockReset();
  api.refreshed.mockClear();
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  );
  vi.stubGlobal("crypto", { randomUUID: () => "candidate-dialog-request" });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function Harness() {
  const [open, setOpen] = useState(false);
  const { setLocale } = useLanguage();
  return (
    <>
      <button onClick={() => setOpen(true)}>Launch</button>
      <button onClick={() => setLocale("en")}>English</button>
      <CandidateEntryDialog
        job={{
          id: "job-1",
          title: "Fixture Job",
          job_code: "TEST-1",
          status: "OPEN",
        }}
        isOpen={open}
        onDismiss={() => setOpen(false)}
        onCreated={api.refreshed}
        onSessionLost={vi.fn()}
      />
    </>
  );
}
function setup() {
  render(
    <LanguageProvider>
      <Harness />
    </LanguageProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Launch" }));
}
it("focuses the first field, offers Cancel/X/Escape and preserves unsaved input when reopened", async () => {
  setup();
  const dialog = screen.getByRole("dialog", { name: "Thêm ứng viên vào Job" });
  expect(document.activeElement).toBe(
    screen.getByLabelText("Họ và tên ứng viên"),
  );
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent.change(screen.getByLabelText("Họ và tên ứng viên"), {
    target: { value: "Unsubmitted Candidate" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.body.style.overflow).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "Launch" }));
  expect(
    (screen.getByLabelText("Họ và tên ứng viên") as HTMLInputElement).value,
  ).toBe("Unsubmitted Candidate");
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Launch" }));
  fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(api.create).not.toHaveBeenCalled();
});
it("prevents closing during a write, then permits closing after successful creation", async () => {
  let finish: (value: unknown) => void = () => {};
  api.create.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  setup();
  await screen.findByRole("option", { name: /TEST ONLY/ });
  for (const [label, value] of [
    ["Họ và tên ứng viên", "Fixture Candidate"],
    ["Email ứng viên", "fixture@example.invalid"],
    ["Link CV Google Drive", "https://drive.google.com/file/d/test-cv/view"],
    ["Tên tệp CV", "fixture.pdf"],
  ]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  fireEvent.change(screen.getByRole("combobox", { name: "Nguồn ứng viên" }), {
    target: { value: "TEST ONLY" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Thêm vào pipeline" }));
  await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
  expect(
    screen.getByRole("button", { name: "Đóng" }).hasAttribute("disabled"),
  ).toBe(true);
  expect(
    screen.getByRole("button", { name: "Hủy" }).hasAttribute("disabled"),
  ).toBe(true);
  fireEvent(
    screen.getByRole("dialog"),
    new Event("cancel", { cancelable: true }),
  );
  expect(screen.getByRole("dialog")).toBeTruthy();
  await act(async () => finish({ created: true }));
  await waitFor(() => expect(api.refreshed).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("translates close/cancel while retaining candidate data", () => {
  setup();
  fireEvent.change(screen.getByLabelText("Họ và tên ứng viên"), {
    target: { value: "Giữ nguyên tên" },
  });
  fireEvent.click(screen.getByRole("button", { name: "English" }));
  expect(
    screen.getByRole("dialog", { name: "Add candidate to job" }),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  expect(
    (screen.getByLabelText("Candidate’s full name") as HTMLInputElement).value,
  ).toBe("Giữ nguyên tên");
});

it("wraps Tab and Shift+Tab inside the form instead of leaving for browser chrome", () => {
  setup();
  const first = screen.getByRole("button", { name: "Đóng" });
  const last = screen.getByRole("button", { name: "Thêm vào pipeline" });
  last.focus();
  fireEvent.keyDown(last, { key: "Tab" });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(last);
});
