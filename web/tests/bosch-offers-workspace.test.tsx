import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import BoschOffersWorkspace from "../components/bosch-offers-workspace";
import type { Job } from "../lib/policy";
vi.mock("../components/offer-approval-workspace", () => ({
  default: ({
    scopedJob,
    onAccessLost,
  }: {
    scopedJob: Job;
    onAccessLost: () => void;
  }) => (
    <section>
      <h2>{scopedJob.title}</h2>
      <label>
        Draft
        <input aria-label="Draft" />
      </label>
      <button onClick={onAccessLost}>Lost access</button>
    </section>
  ),
}));
afterEach(cleanup);
it("opens proposals directly and resets unsaved state when the Job changes", () => {
  const onAccessLost = vi.fn();
  const job = {
    id: "job1",
    title: "First Job",
    job_code: "TEST",
    status: "OPEN",
  };
  const view = render(
    <BoschOffersWorkspace job={job} onAccessLost={onAccessLost} />,
  );
  expect(screen.queryByText("Offer Pipeline")).toBeNull();
  expect(screen.queryByRole("combobox")).toBeNull();
  fireEvent.change(screen.getByLabelText("Draft"), {
    target: { value: "Private draft" },
  });
  view.rerender(
    <BoschOffersWorkspace
      job={{ ...job, id: "job2", title: "Second Job" }}
      onAccessLost={onAccessLost}
    />,
  );
  expect(screen.getByRole("heading", { name: "Second Job" })).toBeTruthy();
  expect((screen.getByLabelText("Draft") as HTMLInputElement).value).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "Lost access" }));
  expect(onAccessLost).toHaveBeenCalledOnce();
});
