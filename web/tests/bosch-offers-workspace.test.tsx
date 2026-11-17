import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import BoschOffersWorkspace from "../components/bosch-offers-workspace";
import { ApiError } from "../lib/supabase";

vi.mock("../components/offer-approval-workspace", () => ({
  default: ({ embedded }: { embedded: boolean }) => (
    <label>
      Proposal editor {String(embedded)}
      <input aria-label="Unfinished proposal" />
    </label>
  ),
}));
const api = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn() }));
vi.mock("../lib/offer-workspace", () => ({
  listOfferProposals: api.list,
  offerProposalDetail: api.detail,
}));
vi.mock("../lib/supabase", () => ({
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public status?: number,
    ) {
      super(message);
    }
  },
}));
const jobs = [
  {
    id: "job-1",
    job_code: "TEST-1",
    title: "Synthetic Test Job",
    status: "OPEN",
  },
];
const offer = {
  id: "11111111-1111-4111-8111-111111111111",
  application_id: "app-1",
  job_id: "job-1",
  job_code: "TEST-1",
  job_title: "Synthetic Test Job",
  candidate_name: "Sample Candidate",
  currency: "VND",
  base_salary: 1000000,
  proposed_start_date: null,
  status: "PENDING",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  sent_at: null,
  expires_at: null,
  responded_at: null,
};
beforeEach(() => {
  api.list.mockReset();
  api.detail.mockReset();
  api.list.mockResolvedValue({ offers: [offer], limit: 25, offset: 0 });
  api.detail.mockResolvedValue({
    offer,
    application: { id: "app-1", stage: "INTERVIEW", status: "ACTIVE" },
    candidate: { id: "cand-1", full_name: "Sample Candidate" },
    job: { id: "job-1", title: "Synthetic Test Job" },
    events: [
      {
        event_type: "CREATED",
        created_at: "2026-01-01T00:00:00Z",
        actor_id: "user-1",
        actor_name: "Synthetic Recruiter",
      },
    ],
  });
});
afterEach(cleanup);
it("reads job-scoped Offer list and detail without writing", async () => {
  render(<BoschOffersWorkspace jobs={jobs} onAccessLost={vi.fn()} />);
  const name = await screen.findByRole("button", { name: "Sample Candidate" });
  expect(api.list).toHaveBeenCalledWith("job-1", 25, 0);
  expect(screen.getAllByText("Pending Approval").length).toBeGreaterThan(0);
  fireEvent.click(name);
  await waitFor(() => expect(api.detail).toHaveBeenCalledWith(offer.id));
  expect(
    screen.getByText("Synthetic Recruiter", { exact: false }),
  ).toBeTruthy();
  expect(screen.getAllByText("1.000.000 VND").length).toBeGreaterThan(0);
});
it("clears scoped Offer state and invalidates access after 403", async () => {
  api.list.mockRejectedValue(new ApiError("No Offer access", 403));
  const onAccessLost = vi.fn();
  render(<BoschOffersWorkspace jobs={jobs} onAccessLost={onAccessLost} />);
  await waitFor(() => expect(onAccessLost).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole("button", { name: "Sample Candidate" })).toBeNull();
});

it("keeps Offers list and selected detail in independent Bosch columns", async () => {
  const view = render(
    <BoschOffersWorkspace jobs={jobs} onAccessLost={vi.fn()} />,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Sample Candidate" }),
  );
  await screen.findByText("Synthetic Recruiter", { exact: false });
  const workspace = view.container.querySelector('[class*="workspace"]');
  expect(workspace?.children.length).toBe(2);
  expect(workspace?.children[0].className).toContain("list");
  expect(workspace?.children[1].className).toContain("detail");
  expect(view.container.querySelector(".bosch-offer-workspace")).toBeNull();
  expect(screen.getByRole("complementary").textContent).toContain(
    "Compensation Summary",
  );
  expect(screen.getByRole("table")).toBeTruthy();
});

it("shows current-page Offer counts without inventing Draft approvals", async () => {
  render(<BoschOffersWorkspace jobs={jobs} onAccessLost={vi.fn()} />);
  await screen.findByRole("button", { name: "Sample Candidate" });
  expect(screen.getByText("Draft")).toBeTruthy();
  expect(
    screen.getByText(/Draft is not a persisted backend Offer status/),
  ).toBeTruthy();
  expect(screen.getByText("Approved: 0", { exact: false })).toBeTruthy();
});

it("clears selected sensitive detail when Job changes", async () => {
  const twoJobs = [
    ...jobs,
    { id: "job-2", job_code: "TEST-2", title: "Second Job", status: "OPEN" },
  ];
  api.list.mockImplementation((jobId: string) =>
    Promise.resolve({
      offers: jobId === "job-1" ? [offer] : [],
      limit: 25,
      offset: 0,
    }),
  );
  const view = render(
    <BoschOffersWorkspace jobs={twoJobs} onAccessLost={vi.fn()} />,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Sample Candidate" }),
  );
  await screen.findByText("Synthetic Recruiter", { exact: false });
  fireEvent.change(screen.getByRole("combobox", { name: "Chọn Job Offer" }), {
    target: { value: "job-2" },
  });
  await waitFor(() => expect(api.list).toHaveBeenCalledWith("job-2", 25, 0));
  await waitFor(() =>
    expect(
      screen.queryByText("Synthetic Recruiter", { exact: false }),
    ).toBeNull(),
  );
  expect(view.container.textContent).not.toContain("1.000.000 VND");
});

it("places proposals inside Offers and keeps unfinished input when switching sections", async () => {
  render(<BoschOffersWorkspace jobs={jobs} onAccessLost={vi.fn()} />);
  await screen.findByRole("button", { name: "Sample Candidate" });
  expect(screen.queryByRole("link", { name: /Offer Proposal/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Đề xuất Offer" }));
  const input = screen.getByRole("textbox", { name: "Unfinished proposal" });
  fireEvent.change(input, { target: { value: "Draft in progress" } });
  fireEvent.click(screen.getByRole("button", { name: "Tiến trình Offer" }));
  expect(
    screen.queryByRole("textbox", { name: "Unfinished proposal" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Đề xuất Offer" }));
  expect(
    (
      screen.getByRole("textbox", {
        name: "Unfinished proposal",
      }) as HTMLInputElement
    ).value,
  ).toBe("Draft in progress");
});
