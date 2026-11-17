import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collectPages,
  todaysInterviews,
  safeMeetingUrl,
  localDay,
} from "../lib/home-data";
import { buildHomeTasks, homePerspectives } from "../lib/home-model";
import type { InterviewWorklistItem } from "../lib/interviews";
import type { WorkflowOffer } from "../lib/offer-approval";
const base = {
  id: "i",
  application_id: "a",
  job_id: "j",
  job_title: "Engineer",
  job_code: null,
  candidate_name: "Candidate",
  interview_type: "INTERVIEW",
  status: "SCHEDULED",
  starts_at: "2026-11-17T02:00:00Z",
  ends_at: "2026-11-17T03:00:00Z",
  timezone: "Asia/Ho_Chi_Minh",
  location: "Office",
  meeting_url: null,
  can_manage: false,
  can_decide: false,
  is_participant: true,
  feedback_submitted: false,
  feedback_count: 0,
  participants: [{ id: "me", display_name: "Minh", role: "INTERVIEWER" }],
} satisfies InterviewWorklistItem;
test("collects beyond the first 25/100 records including exact-page boundaries", async () => {
  for (const count of [0, 25, 100, 231]) {
    const data = Array.from({ length: count }, (_, i) => ({ id: String(i) }));
    const offsets: number[] = [];
    const result = await collectPages(async (limit, offset) => {
      offsets.push(offset);
      return data.slice(offset, offset + limit);
    });
    assert.equal(result.length, count);
    assert.equal(new Set(result.map((r) => r.id)).size, count);
    if (count === 100) assert.deepEqual(offsets, [0, 100]);
  }
});
test("incomplete, repeated or cancelled scans never return an apparently exact partial count", async () => {
  const page = Array.from({ length: 100 }, (_, i) => ({ id: String(i) }));
  await assert.rejects(
    () => collectPages(async () => page),
    /PAGE_CHANGED|REPEATING_PAGE/,
  );
  await assert.rejects(
    () =>
      collectPages(async (_l, o) => {
        if (o) throw Error("offline");
        return page;
      }),
    /offline/,
  );
  await assert.rejects(
    () =>
      collectPages(
        async () => [],
        () => false,
      ),
    /CANCELLED/,
  );
});
test("today is the complete GMT+7 calendar day, including earlier/completed/cancelled interviews", () => {
  const now = Date.parse("2026-11-17T08:00:00Z");
  const rows = [
    base,
    { ...base, id: "done", status: "COMPLETED" as const },
    { ...base, id: "cancel", status: "CANCELLED" as const },
    { ...base, id: "midnight", starts_at: "2026-11-16T17:00:00Z" },
    { ...base, id: "tomorrow", starts_at: "2026-11-17T17:00:00Z" },
  ];
  assert.equal(todaysInterviews(rows, now).length, 4);
  assert.equal(localDay("2026-11-16T17:00:00Z"), "2026-11-17");
  assert.equal(todaysInterviews([base], now)[0].status, "SCHEDULED");
});
test("all 38 assigned tasks remain accessible without inventing owner or deadline", () => {
  const tasks = Array.from({ length: 38 }, (_, i) => ({
    id: String(i),
    title: `Task ${i}`,
    status: "OPEN" as const,
    priority: "NORMAL",
    due_at: null,
    job_id: null,
    application_id: null,
    candidate_id: null,
    created_at: "2026-11-17T00:00:00Z",
    completed_at: null,
  }));
  const result = buildHomeTasks({
    perspective: "INTERVIEWER",
    userId: "me",
    userName: "Minh",
    jobs: [
      { id: "draft", title: "Hidden draft", job_code: null, status: "DRAFT" },
    ],
    tasks,
    interviews: [],
    offers: [],
    en: true,
  });
  assert.equal(result.length, 38);
  assert.ok(
    result.every(
      (t) => t.owner === "Minh" && t.due === null && t.group === "assigned",
    ),
  );
});
test("interviewer gets only personal feedback; HM follow-up reflects actual participants", () => {
  const i = { ...base, status: "COMPLETED" as const };
  const input = {
    userId: "me",
    userName: "Minh",
    jobs: [],
    tasks: [],
    interviews: [i],
    offers: [],
    en: true,
  };
  assert.equal(
    buildHomeTasks({ ...input, perspective: "INTERVIEWER" })[0].group,
    "feedback",
  );
  assert.equal(
    buildHomeTasks({
      ...input,
      perspective: "HIRING_MANAGER",
      interviews: [{ ...i, is_participant: false, can_decide: true }],
    })[0].group,
    "followup",
  );
  assert.equal(
    buildHomeTasks({
      ...input,
      perspective: "INTERVIEWER",
      interviews: [{ ...i, is_participant: false, can_decide: true }],
    }).length,
    0,
  );
});
test("role-less approver uses actual assignment; other assignees cannot become actionable approvals", () => {
  const mine = {
    id: "o1",
    approver_id: "me",
    can_approve: true,
    status: "PENDING",
    candidate_name: "C1",
    job_title: "J1",
  } as WorkflowOffer;
  const other = { ...mine, id: "o2", approver_id: "other", can_approve: false };
  assert.deepEqual(homePerspectives([], []), ["PERSONAL"]);
  assert.deepEqual(homePerspectives([], [mine]), ["APPROVER"]);
  const rows = buildHomeTasks({
    perspective: "APPROVER",
    userId: "me",
    userName: "DH",
    jobs: [],
    tasks: [],
    interviews: [],
    offers: [
      mine,
      other,
      { ...mine, id: "approved", status: "APPROVED", can_approve: false },
    ],
    en: true,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].target, "o1");
  assert.equal(rows[0].owner, "DH");
});
test("meeting links reject executable schemes and embedded credentials", () => {
  assert.equal(safeMeetingUrl("javascript:alert(1)"), null);
  assert.equal(safeMeetingUrl("https://me:secret@example.com"), null);
  assert.equal(
    safeMeetingUrl("https://teams.microsoft.com/meet/test"),
    "https://teams.microsoft.com/meet/test",
  );
});
