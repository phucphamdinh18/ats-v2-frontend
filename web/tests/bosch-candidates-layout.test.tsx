import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import TalentPool from "../components/talent-pool";
import { LanguageProvider, useLanguage } from "../components/language";

const api = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), create: vi.fn() }));
vi.mock("../lib/candidates", () => ({ listCandidates: api.list, candidateProfile: api.detail }));
vi.mock("../lib/applications", () => ({ createApplication: api.create }));
vi.mock("../lib/supabase", () => ({
  ApiError: class ApiError extends Error { constructor(message: string, public status?: number) { super(message); } },
  getClient: () => ({ from: (table: string) => {
    const response = table === "applications"
      ? { data: [{ candidate_id: "Ada", source: "Referral", sub_source: "Internal employee", created_at: "2026-01-02T00:00:00Z" }], error: null }
      : { data: [{ sub_source: "TEST ONLY", source: "TEST ONLY", source_ownership: "TEST ONLY" }], error: null };
    const query = {
      select: () => query,
      in: () => query,
      order: () => query,
      then: (resolve: (value: typeof response) => unknown) => Promise.resolve(response).then(resolve),
    };
    return query;
  } }),
}));
const c = (name: string, id = name) => ({
  id, full_name: name, email: "qa@example.invalid", phone: null,
  current_title: "Embedded Engineer", primary_role: null, current_company: "Test Corporation",
  total_experience_years: 5, seniority: null, location: null, created_at: "2026-01-01T00:00:00Z",
});
const profile = (name: string, apps: unknown[] = []) => ({
  candidate: c(name), documents: [], applications: apps,
});
const job = { id: "job-test-1", title: "Test Job", job_code: "TEST-1", status: "OPEN" };
beforeEach(() => {
  window.sessionStorage.clear();
  Object.values(api).forEach((fn) => fn.mockReset());
  api.list.mockResolvedValue({ candidates: [c("Ada")], limit: 25, offset: 0 });
  api.detail.mockResolvedValue(profile("Ada"));
  api.create.mockResolvedValue({ application: { application_id: "app-1", changed: true } });
  vi.stubGlobal("confirm", vi.fn(() => true));
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "11111111-1111-4111-8111-111111111111") });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Bosch Candidates isolated list/detail layout", () => {
  it("keeps the Candidate table and profile as separate layout regions", async () => {
    const view = render(<TalentPool jobs={[job]} onAccessLost={vi.fn()} />);
    await screen.findByRole("button", { name: "Ada" });
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Talent Pool" })).toBeTruthy();
    expect((await screen.findAllByText("qa@example.invalid")).length).toBeGreaterThan(0);
    const layout = view.container.querySelector('[class*="pageGrid"]');
    const panels = layout?.children;
    expect(panels?.length).toBe(2);
    expect(panels?.[0].className).toContain("pageLeft");
    expect(panels?.[1].className).toContain("profileCard");
    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(5);
    for (const name of ["Chọn hồ sơ", "Ứng viên", "Vị trí / Công ty", "Kinh nghiệm", "Nguồn"]) {
      expect(screen.getByRole("columnheader", { name })).toBeTruthy();
    }
    expect(screen.getByRole("navigation", { name: "Mục ứng viên" }).querySelectorAll("span")).toHaveLength(1);
    expect(screen.queryByText("Candidate Summary")).toBeNull();
    expect(await screen.findByText("Referral")).toBeTruthy();
    expect(screen.getByText("Internal employee")).toBeTruthy();
  });

  it("offers working Overview/Resume tabs and authorized View Job navigation", async () => {
    const onOpenJob = vi.fn();
    api.detail.mockResolvedValue(profile("Ada", [{ id: "app1", job_id: job.id, stage: "INTERVIEW", status: "ACTIVE", source: null, created_at: "2026-10-10" }]));
    render(<TalentPool jobs={[job]} onAccessLost={vi.fn()} onOpenJob={onOpenJob} />);
    await screen.findByRole("heading", { name: "Ada" });
    const viewJob = await screen.findByRole("button", { name: /Xem Job/ });
    fireEvent.click(viewJob);
    expect(onOpenJob).toHaveBeenCalledWith(job);
    expect(screen.getByText("INTERVIEW")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hồ sơ CV" }));
    expect(screen.getByText("Chưa có CV trong hồ sơ.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tổng quan" }));
    expect(screen.getByRole("heading", { name: "Liên hệ" })).toBeTruthy();
  });

  it("selects a new candidate and opens the matching profile without changing Job data", async () => {
    api.list.mockResolvedValue({ candidates: [c("Ada"), c("Ben")], limit: 25, offset: 0 });
    api.detail.mockImplementation((id: string) => Promise.resolve(profile(id)));
    render(<TalentPool jobs={[job]} onAccessLost={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Ben" }));
    await waitFor(() => expect(api.detail).toHaveBeenCalledWith("Ben"));
    expect(await screen.findByRole("heading", { name: "Ben" })).toBeTruthy();
  });

  it("preserves guarded Add to Job with approved source and stable request ID", async () => {
    render(<TalentPool jobs={[job]} onAccessLost={vi.fn()} />);
    await screen.findByRole("heading", { name: "Ada" });
    const source = await screen.findByRole("option", { name: /TEST ONLY/ });
    fireEvent.change(screen.getByRole("combobox", { name: "Chọn Job để thêm ứng viên" }), { target: { value: job.id } });
    fireEvent.change(screen.getByRole("combobox", { name: "Chọn nguồn ứng viên" }), { target: { value: source.getAttribute("value") } });
    fireEvent.click(screen.getByRole("button", { name: "Thêm vào Job" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith("Ada", "job-test-1",
      "11111111-1111-4111-8111-111111111111", "TEST ONLY", "TEST ONLY"));
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("shows an empty state without rendering a fake candidate", async () => {
    api.list.mockResolvedValue({ candidates: [], limit: 25, offset: 0 });
    render(<TalentPool jobs={[job]} onAccessLost={vi.fn()} />);
    await screen.findByText("Talent Pool chưa có hồ sơ");
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText("Ada")).toBeNull();
  });
});


function SwitchEnglish() {
  const { setLocale } = useLanguage();
  return <button type="button" onClick={() => setLocale("en")}>Switch to English</button>;
}

it("changes Candidate Database labels, actions and profile facts to English without reloading records", async () => {
  render(<LanguageProvider><SwitchEnglish /><TalentPool jobs={[job]} onAccessLost={vi.fn()} /></LanguageProvider>);
  await screen.findByRole("button", { name: "Ada" });
  expect(screen.getAllByRole("columnheader")).toHaveLength(5);
  expect(screen.getByRole("columnheader", { name: "Ứng viên" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Switch to English" }));
  expect(screen.getAllByRole("columnheader")).toHaveLength(5);
  for (const name of ["Candidate", "Current Job / Company", "Experience", "Source"]) {
    expect(screen.getByRole("columnheader", { name })).toBeTruthy();
  }
  expect(screen.queryByRole("button", { name: "Review CVs" })).toBeNull();
  expect(screen.getByRole("textbox", { name: "Search candidates" })).toBeTruthy();
  expect(await screen.findByRole("heading", { name: "Contact" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Current Role" })).toBeTruthy();
  expect(screen.getByRole("combobox", { name: "Select Job to add candidate" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Add to Job" })).toBeTruthy();
  expect(screen.queryByText("Liên hệ")).toBeNull();
});


describe("Candidate Database table isolation", () => {
  it("opts out of inherited sticky headers that overlap the first row", () => {
    const css = readFileSync("components/bosch-v2-candidates.module.css", "utf8");
    expect(css).toContain(".table th{position:static;top:auto;z-index:auto}");
  });
});
