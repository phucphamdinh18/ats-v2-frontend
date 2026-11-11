import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AdminConsole from "../components/admin-console";
import { LanguageProvider, useLanguage } from "../components/language";
vi.mock("../lib/admin-jobs", () => ({
  listJobMembers: vi.fn().mockResolvedValue({ members: [] }),
  assignJobMember: vi.fn(),
  createJobDraft: vi.fn(),
  openJob: vi.fn(),
  removeJobMember: vi.fn(),
  updateJobMetadata: vi.fn(),
}));
afterEach(cleanup);
function Switch() {
  const { setLocale } = useLanguage();
  return (
    <>
      <button onClick={() => setLocale("en")}>English UI</button>
      <button onClick={() => setLocale("vi")}>Vietnamese UI</button>
    </>
  );
}
it("uses focused admin tabs and translates open forms while keeping metadata values and input", async () => {
  localStorage.clear();
  render(
    <LanguageProvider>
      <Switch />
      <AdminConsole
        jobs={[
          { id: "j", title: "Kỹ sư phần mềm", job_code: null, status: "DRAFT" },
        ]}
        onRefresh={vi.fn()}
        onAccessLost={vi.fn()}
      />
    </LanguageProvider>,
  );
  fireEvent.change(screen.getByLabelText("Tên vị trí"), {
    target: { value: "Kỹ sư QA" },
  });
  fireEvent.click(screen.getByRole("button", { name: "English UI" }));
  expect(screen.getByLabelText("Job title").getAttribute("value")).toBe(
    "Kỹ sư QA",
  );
  fireEvent.click(screen.getByRole("tab", { name: "Hiring requirements" }));
  expect(
    screen.getByRole("tabpanel", { name: "Hiring requirements" }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Create draft job" })).toBeNull();
  const season = screen.getByLabelText("Hiring season") as HTMLSelectElement;
  expect(season.value).toBe("Normal Time");
  expect(season.selectedOptions[0].textContent).toBe("Regular season");
  fireEvent.click(screen.getByRole("button", { name: "Vietnamese UI" }));
  expect(
    screen.getByRole("tabpanel", { name: "Yêu cầu tuyển dụng" }),
  ).toBeTruthy();
  expect(
    (screen.getByLabelText("Mùa tuyển dụng") as HTMLSelectElement)
      .selectedOptions[0].textContent,
  ).toBe("Mùa thông thường");
  expect(screen.getByRole("option", { name: "Kỹ sư phần mềm" })).toBeTruthy();
});
