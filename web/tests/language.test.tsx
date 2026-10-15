import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { LanguageProvider, useLanguage } from "../components/language";
import { LOCALE_KEY } from "../lib/i18n";
function Example() {
  const { t, locale, setLocale } = useLanguage();
  return (
    <>
      <select
        aria-label={t.language}
        value={locale}
        onChange={(e) => setLocale(e.target.value === "en" ? "en" : "vi")}
      >
        <option value="vi">Tiếng Việt</option>
        <option value="en">English</option>
      </select>
      <h1>{t.jobs}</h1>
      <input aria-label="Draft note" defaultValue="" />
    </>
  );
}
beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = "vi";
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("switches live copy and document lang, persists choice, and preserves form values", async () => {
  const view = render(
    <LanguageProvider>
      <Example />
    </LanguageProvider>,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Draft note" }), {
    target: { value: "Keep this note" },
  });
  fireEvent.change(
    screen.getByRole("combobox", { name: "Ngôn ngữ / Language" }),
    { target: { value: "en" } },
  );
  await screen.findByRole("heading", { name: "Job openings" });
  expect(document.documentElement.lang).toBe("en");
  expect(document.title).toBe("ATS · Recruiting workspace");
  expect(localStorage.getItem(LOCALE_KEY)).toBe("en");
  expect(
    (screen.getByRole("textbox", { name: "Draft note" }) as HTMLInputElement)
      .value,
  ).toBe("Keep this note");
  view.unmount();
  render(
    <LanguageProvider>
      <Example />
    </LanguageProvider>,
  );
  await screen.findByRole("heading", { name: "Job openings" });
  fireEvent.change(
    screen.getByRole("combobox", { name: "Ngôn ngữ / Language" }),
    { target: { value: "vi" } },
  );
  await screen.findByRole("heading", { name: "Vị trí tuyển dụng" });
  expect(document.documentElement.lang).toBe("vi");
});
it("works when private browser storage throws", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("disabled");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("disabled");
  });
  render(
    <LanguageProvider>
      <Example />
    </LanguageProvider>,
  );
  fireEvent.change(
    screen.getByRole("combobox", { name: "Ngôn ngữ / Language" }),
    { target: { value: "en" } },
  );
  await screen.findByRole("heading", { name: "Job openings" });
  expect(document.documentElement.lang).toBe("en");
  expect(document.title).toBe("ATS · Recruiting workspace");
});
