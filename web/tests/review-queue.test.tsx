import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import ReviewQueue from "../components/review-queue";
import { LanguageProvider, useLanguage } from "../components/language";
import { ApiError } from "../lib/supabase";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../lib/supabase", () => ({
  reviewCall: call,
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public status?: number,
    ) {
      super(message);
    }
  },
}));
const draft = (id: string) => ({
  id,
  full_name: id,
  review_state: "pending_review",
});
const detail = (id: string, state = "ready_for_review") => ({
  draft: draft(id),
  intake: {
    kind: "cv",
    state,
    original_name: "Synthetic.pdf",
    drive_url: "https://drive.google.com/file/d/synthetic/view",
  },
});
beforeEach(() => {
  call.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("review request lifecycle", () => {
  it("prevents an old detail from replacing a newer selection", async () => {
    let resolveOld!: (result: unknown) => void;
    call.mockImplementation((input) =>
      input.action === "list"
        ? Promise.resolve({ drafts: [draft("First"), draft("Second")] })
        : input.id === "First"
          ? new Promise((resolve) => {
              resolveOld = resolve;
            })
          : Promise.resolve(detail("Second")),
    );
    render(<ReviewQueue onAccessLost={languageAccessLost} />);
    fireEvent.click(await screen.findByRole("button", { name: /CV First/ }));
    fireEvent.click(screen.getByRole("button", { name: /CV Second/ }));
    await screen.findByRole("heading", { name: "Second" });
    await act(async () => {
      resolveOld(detail("First"));
    });
    expect(screen.queryByRole("heading", { name: "First" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Second" })).toBeTruthy();
  });
  it("invalidates CV detail when switching to JD", async () => {
    let resolveOld!: (result: unknown) => void;
    call.mockImplementation((input) =>
      input.action === "list"
        ? Promise.resolve({
            drafts: input.kind === "cv" ? [draft("CV old")] : [],
          })
        : new Promise((resolve) => {
            resolveOld = resolve;
          }),
    );
    render(<ReviewQueue onAccessLost={languageAccessLost} />);
    fireEvent.click(await screen.findByRole("button", { name: /CV CV old/ }));
    fireEvent.click(screen.getByRole("button", { name: "JD tuyển dụng" }));
    await screen.findByRole("heading", { name: /Chưa có.*cần duyệt/ });
    await act(async () => {
      resolveOld(detail("CV old"));
    });
    expect(screen.queryByRole("heading", { name: "CV old" })).toBeNull();
  });
  it("clears selection and reloads server list after stale decision 409", async () => {
    call.mockImplementation((input) =>
      input.action === "list"
        ? Promise.resolve({ drafts: [draft("Synthetic")] })
        : input.action === "detail"
          ? Promise.resolve(detail("Synthetic"))
          : Promise.reject(new ApiError("Stale", 409)),
    );
    render(<ReviewQueue onAccessLost={languageAccessLost} />);
    fireEvent.click(
      await screen.findByRole("button", { name: /CV Synthetic/ }),
    );
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(
      screen.getByRole("button", { name: "Duyệt & tạo ứng viên" }),
    );
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain(
      "Bản nháp đã thay đổi",
    );
    expect(
      screen.queryByRole("button", { name: "Duyệt & tạo ứng viên" }),
    ).toBeNull();
    expect(
      call.mock.calls.filter(([input]) => input.action === "list"),
    ).toHaveLength(2);
  });
  it("calls access reset when backend rejects current session with 403", async () => {
    call.mockRejectedValue(new ApiError("Role revoked", 403));
    const onAccessLost = vi.fn();
    render(<ReviewQueue onAccessLost={onAccessLost} />);
    await waitFor(() => expect(onAccessLost).toHaveBeenCalledTimes(1));
  });
  it("keeps duplicate drafts unapprovable and requires rejection reason", async () => {
    call.mockImplementation((input) =>
      Promise.resolve(
        input.action === "list"
          ? { drafts: [draft("Duplicate")] }
          : detail("Duplicate", "possible_duplicate"),
      ),
    );
    render(<ReviewQueue onAccessLost={languageAccessLost} />);
    fireEvent.click(
      await screen.findByRole("button", { name: /CV Duplicate/ }),
    );
    const approve = await screen.findByRole("button", {
      name: "Duyệt & tạo ứng viên",
    });
    expect((approve as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Từ chối" }));
    expect(screen.getByRole("alert").textContent).toContain("lý do");
    expect(call.mock.calls.some(([input]) => input.action === "decide")).toBe(
      false,
    );
  });
  it("ignores detail completion after unmount without calling access reset", async () => {
    let rejectOld!: (err: Error) => void;
    call.mockImplementation((input) =>
      input.action === "list"
        ? Promise.resolve({ drafts: [draft("Old session")] })
        : new Promise((_, reject) => {
            rejectOld = reject;
          }),
    );
    const onAccessLost = vi.fn();
    const view = render(<ReviewQueue onAccessLost={onAccessLost} />);
    fireEvent.click(
      await screen.findByRole("button", { name: /CV Old session/ }),
    );
    view.unmount();
    await act(async () => {
      rejectOld(new ApiError("Expired", 401));
    });
    expect(onAccessLost).not.toHaveBeenCalled();
  });
});

const languageAccessLost = () => {};
function ReviewWithLanguage() {
  const { locale, setLocale } = useLanguage();
  return (
    <>
      <select
        aria-label="Ngôn ngữ / Language"
        value={locale}
        onChange={(e) => setLocale(e.target.value === "en" ? "en" : "vi")}
      >
        <option value="vi">Tiếng Việt</option>
        <option value="en">English</option>
      </select>
      <ReviewQueue onAccessLost={languageAccessLost} />
    </>
  );
}
it("language switch preserves review notes and verification, with unchanged API decision codes", async () => {
  localStorage.clear();
  call.mockImplementation((input) =>
    Promise.resolve(
      input.action === "list"
        ? { drafts: [draft("Language fixture")] }
        : input.action === "detail"
          ? detail("Language fixture")
          : { review: { decision: "rejected" } },
    ),
  );
  render(
    <LanguageProvider>
      <ReviewWithLanguage />
    </LanguageProvider>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: /CV Language fixture/ }),
  );
  fireEvent.change(
    await screen.findByRole("textbox", { name: "Ghi chú / lý do từ chối" }),
    { target: { value: "Keep this note" } },
  );
  fireEvent.click(screen.getByRole("checkbox"));
  const listCalls = call.mock.calls.filter(
    ([input]) => input.action === "list",
  ).length;
  fireEvent.change(
    screen.getByRole("combobox", { name: "Ngôn ngữ / Language" }),
    { target: { value: "en" } },
  );
  expect(
    (
      screen.getByRole("textbox", {
        name: "Note / reason for declining",
      }) as HTMLTextAreaElement
    ).value,
  ).toBe("Keep this note");
  expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  expect(
    call.mock.calls.filter(([input]) => input.action === "list"),
  ).toHaveLength(listCalls);
  fireEvent.click(screen.getByRole("button", { name: "Decline" }));
  await waitFor(() =>
    expect(call).toHaveBeenCalledWith({
      action: "decide",
      kind: "cv",
      id: "Language fixture",
      decision: "rejected",
      reason: "Keep this note",
    }),
  );
  localStorage.clear();
});
