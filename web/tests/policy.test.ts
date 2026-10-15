import assert from "node:assert/strict";
import { test } from "node:test";
import {
  authRedirect,
  canReview,
  driveLink,
  isCorrectionFixture,
  RequestGate,
  reviewPermissions,
  type Detail,
} from "../lib/policy";
function draft(overrides: Partial<Detail> = {}): Detail {
  return {
    draft: {
      id: "real-draft",
      full_name: "Test",
      review_state: "pending_review",
    },
    intake: {
      kind: "cv",
      state: "ready_for_review",
      original_name: "cv.pdf",
      drive_url: "https://drive.google.com/file/d/example/view",
    },
    ...overrides,
  };
}
function fixture(): Detail {
  return draft({
    draft: {
      id: "30d9c99f-9f76-4e3b-be16-0a9632646df1",
      review_state: "pending_review",
      full_name: null,
    },
    intake: {
      kind: "cv",
      state: "ready_for_review",
      original_name: "[TEST ONLY] CV",
      drive_url:
        "https://example.invalid/ats-ta-cv-correction-e2e-20261014.pdf",
    },
  });
}
test("active roles permit review only for Admin and TA", () => {
  assert.equal(canReview(["ADMIN"]), true);
  assert.equal(canReview(["TA_RECRUITER"]), true);
  assert.equal(canReview(["HIRING_MANAGER", "INTERVIEWER"]), false);
  assert.equal(canReview([]), false);
});
test("normal pending draft permits decision but cannot use correction pilot", () => {
  assert.deepEqual(reviewPermissions("cv", draft()), {
    fixture: false,
    approve: true,
    reject: true,
    correct: false,
  });
});
test("duplicate draft cannot approve; rejection remains available", () => {
  const item = draft();
  item.intake.state = "possible_duplicate";
  assert.equal(reviewPermissions("cv", item).approve, false);
  assert.equal(reviewPermissions("cv", item).reject, true);
});
test("exact fixture permits correction, never candidate creation or decisions", () => {
  assert.deepEqual(reviewPermissions("cv", fixture()), {
    fixture: true,
    correct: true,
    approve: false,
    reject: false,
  });
});
test("fixture requires exact id, kind, source and TEST ONLY label together", () => {
  for (const mutate of [
    (d: Detail) => {
      d.draft.id = "other";
    },
    (d: Detail) => {
      d.intake.kind = "jd";
    },
    (d: Detail) => {
      d.intake.drive_url += "?fake=1";
    },
    (d: Detail) => {
      d.intake.original_name = "real-cv.pdf";
    },
  ]) {
    const item = fixture();
    mutate(item);
    assert.equal(isCorrectionFixture("cv", item), false);
    assert.equal(reviewPermissions("cv", item).correct, false);
  }
});
test("closed fixtures remain closed and normal closed drafts cannot decide", () => {
  for (const state of ["approved", "rejected"] as const)
    for (const item of [draft(), fixture()]) {
      item.draft.review_state = state;
      const p = reviewPermissions("cv", item);
      assert.equal(p.correct, false);
      assert.equal(p.approve, false);
      assert.equal(p.reject, false);
    }
});
test("wrong intake kind cannot decide", () => {
  const item = draft();
  item.intake.kind = "jd";
  const p = reviewPermissions("cv", item);
  assert.equal(p.approve, false);
  assert.equal(p.reject, false);
});
test("source links reject scripts, HTTP, credentials and hostname lookalikes", () => {
  for (const url of [
    "javascript:alert(1)",
    "http://drive.google.com/file",
    "https://drive.google.com.evil.test/file",
    "https://drive.google.com@evil.test/file",
    "https://x:y@drive.google.com/file",
    "not a url",
  ])
    assert.equal(driveLink(url), null);
  assert.equal(
    driveLink("https://drive.google.com/file/d/x/view"),
    "https://drive.google.com/file/d/x/view",
  );
});
test("new request rejects earlier results regardless of response order", async () => {
  const gate = new RequestGate();
  let visible = "";
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  const first = gate.next();
  const oldRequest = delayed.then(() => {
    if (gate.current(first)) visible = "old detail";
  });
  const second = gate.next();
  if (gate.current(second)) visible = "new detail";
  release();
  await oldRequest;
  assert.equal(visible, "new detail");
});
test("logout or scope change invalidates all pending results", () => {
  const gate = new RequestGate();
  const ticket = gate.next();
  gate.invalidate();
  assert.equal(gate.current(ticket), false);
});

test("preview OAuth returns only to a configured callback on the same origin", () => {
  const origin = "https://phucphamdinh18.github.io";
  assert.equal(
    authRedirect(origin, "/ats-v2-frontend"),
    origin + "/ats-v2-frontend/",
  );
  assert.equal(
    authRedirect(origin, "/ats-v2-frontend/next", origin + "/ats-v2-frontend/"),
    origin + "/ats-v2-frontend/",
  );
  for (const value of [
    "https://evil.test/callback",
    origin + "/?next=evil",
    origin + "/#token",
    "https://u:p@phucphamdinh18.github.io/",
  ])
    assert.throws(() => authRedirect(origin, "", value));
});
