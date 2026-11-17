import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import Dialog from "../components/home-work-dialog";
const mock = vi.hoisted(() => ({
  task: vi.fn(),
  members: vi.fn(),
  invoke: vi.fn(),
}));
vi.mock("../lib/home-data", async () => ({
  ...(await vi.importActual("../lib/home-data")),
  taskCall: mock.task,
}));
vi.mock("../lib/admin-jobs", () => ({ listJobMembers: mock.members }));
vi.mock("../lib/supabase", async () => ({
  ...(await vi.importActual("../lib/supabase")),
  getClient: () => ({ functions: { invoke: mock.invoke } }),
}));
const noop = () => {};
beforeEach(() => {
  mock.task.mockReset();
  mock.members.mockReset();
  mock.invoke.mockReset();
  mock.task.mockResolvedValue({
    task: {
      id: "t",
      title: "Assigned task",
      status: "OPEN",
      priority: "NORMAL",
      owner_id: "me",
      created_by: "me",
      due_at: null,
      job_id: "j",
    },
    events: [],
  });
  mock.members.mockResolvedValue({
    members: [
      { user_id: "me", email: "me@example.invalid", role: "TA_RECRUITER" },
      {
        user_id: "other",
        email: "other@example.invalid",
        role: "HIRING_MANAGER",
      },
    ],
  });
});
afterEach(cleanup);
it("reassignment uses selected real colleague, retaining identical payload on lost-response retry", async () => {
  const done = vi.fn();
  render(
    <Dialog
      taskId="t"
      userId="me"
      roles={["ADMIN"]}
      en
      onClose={noop}
      onChanged={done}
      onAccessLost={noop}
    />,
  );
  const select = await screen.findByLabelText("Assign to");
  fireEvent.change(select, { target: { value: "other" } });
  mock.task.mockRejectedValueOnce(new Error("lost response"));
  fireEvent.click(screen.getByRole("button", { name: "Reassign task" }));
  await screen.findByRole("button", { name: "Retry update" });
  const first = mock.task.mock.calls.find(
    (c) => c[0].action === "reassign",
  )![0];
  expect(first.owner_id).toBe("other");
  expect(first.request_id).toMatch(/^[a-f0-9-]{36}$/);
  mock.task.mockResolvedValueOnce({ task: { task_id: "t", changed: false } });
  fireEvent.click(screen.getByRole("button", { name: "Retry update" }));
  await waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(
    mock.task.mock.calls
      .filter((c) => c[0].action === "reassign")
      .map((c) => c[0]),
  ).toEqual([first, first]);
});
it("ordinary non-owner cannot complete or reassign someone else's task", async () => {
  render(
    <Dialog
      taskId="t"
      userId="stranger"
      roles={["INTERVIEWER"]}
      en
      onClose={noop}
      onChanged={noop}
      onAccessLost={noop}
    />,
  );
  await screen.findByText("Assigned task");
  expect(
    screen.queryByRole("button", { name: "Mark task complete" }),
  ).toBeNull();
  expect(screen.queryByLabelText("Assign to")).toBeNull();
});
