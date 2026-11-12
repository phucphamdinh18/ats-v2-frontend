import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import PipelineJobSwitcher from "../components/pipeline-job-switcher";
import type { Job } from "../lib/policy";
const jobs: Job[] = [
  { id: "one", title: "First Engineer", job_code: "FIRST-1", status: "OPEN" },
  {
    id: "two",
    title: "Second Engineer",
    job_code: "SECOND-2",
    status: "DRAFT",
  },
];
afterEach(cleanup);
it("searches by reference and selects by keyboard without changing the Job during typing", () => {
  const changed = vi.fn();
  function Harness() {
    const [selected, setSelected] = useState(jobs[0]);
    return (
      <PipelineJobSwitcher
        jobs={jobs}
        selected={selected}
        onChange={(job) => {
          changed(job);
          setSelected(job);
        }}
      />
    );
  }
  render(<Harness />);
  const trigger = screen.getByRole("button", {
    name: "Chọn Job cho Hiring Pipeline",
  });
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  const input = screen.getByRole("combobox", { name: "Tìm Job" });
  expect(document.activeElement).toBe(input);
  fireEvent.change(input, { target: { value: "SECOND-2" } });
  expect(screen.getAllByRole("option")).toHaveLength(1);
  expect(changed).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "Enter" });
  expect(changed).toHaveBeenCalledWith(jobs[1]);
  expect(trigger.textContent).toContain("Second Engineer");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(trigger);
});
it("dismisses empty searches with Escape or outside click and can reopen by keyboard", () => {
  const changed = vi.fn();
  render(
    <>
      <PipelineJobSwitcher jobs={jobs} selected={jobs[0]} onChange={changed} />
      <button>Outside</button>
    </>,
  );
  const trigger = screen.getByRole("button", {
    name: "Chọn Job cho Hiring Pipeline",
  });
  fireEvent.click(trigger);
  const input = screen.getByRole("combobox", { name: "Tìm Job" });
  fireEvent.change(input, { target: { value: "No matching role" } });
  expect(screen.queryByRole("option")).toBeNull();
  expect(screen.getByRole("status").textContent).toContain(
    "Không tìm thấy Job phù hợp",
  );
  fireEvent.keyDown(input, { key: "Escape" });
  expect(screen.queryByRole("listbox")).toBeNull();
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  expect(screen.getAllByRole("option")).toHaveLength(2);
  fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(changed).not.toHaveBeenCalled();
});
