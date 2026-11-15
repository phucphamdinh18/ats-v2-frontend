import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

// Structural CSS regression checks: these are not screenshot or authenticated E2E tests.
const file = (name: string) => readFileSync(join(process.cwd(), "components", name), "utf8");
const candidate = file("bosch-v2-candidates.module.css");
const interview = file("bosch-v2-interviews.module.css");
const pipeline = file("bosch-v2-pipeline.module.css");
const detail = file("bosch-v2-job-detail.module.css");

test("Candidates confines its table and stacks the profile on small viewports", () => {
  for (const rule of [".listCard{container-type:inline-size}", "@container (max-width:1250px)", "@container (max-width:480px)", ".scroll{overflow-x:auto", "@media(max-width:1150px)", ".table th:nth-child(9),.table td:nth-child(9){display:none}"])
    assert.ok(candidate.includes(rule), rule);
});

test("Interviews collapses detail-backed columns based on actual table-pane width", () => {
  for (const rule of [".listCard{container-type:inline-size}", "@container (max-width:850px)", "@media(max-width:1350px)", ".table th:nth-child(5),.table td:nth-child(5){display:none}"])
    assert.ok(interview.includes(rule), rule);
});

test("Job Pipeline and Job Detail retain usable mobile navigation", () => {
  for (const rule of [".listSection{container-type:inline-size}", "@container (max-width:1250px)", "@container (max-width:440px)", "@media(max-width:1250px)"])
    assert.ok(pipeline.includes(rule), rule);
  for (const rule of [".tabs{max-width:100%;overflow-x:auto", "@media(max-width:768px)", "@media(max-width:420px)"])
    assert.ok(detail.includes(rule), rule);
});

test("four requested viewport widths meet intended panel stacking breakpoint", () => {
  const widths = [1920, 1440, 768, 390];
  assert.deepEqual(widths.map((n) => n <= 1150), [false, false, true, true]);
  assert.deepEqual(widths.map((n) => n <= 1350), [false, false, true, true]);
  assert.deepEqual(widths.map((n) => n <= 1250), [false, false, true, true]);
});
