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

test("Candidates confines its table, keeps Source/Sub-source, and stacks the profile on small viewports", () => {
  for (const rule of [".listCard{container-type:inline-size}", "@container (max-width:1250px)", "@container (max-width:480px)", ".scroll{overflow-x:auto", "@media(max-width:1150px)", ".table th:nth-child(10),.table td:nth-child(10){display:none}"])
    assert.ok(candidate.includes(rule), rule);
  assert.ok(!candidate.includes(".table th:nth-child(8),.table td:nth-child(8){display:none}"), "Source remains visible");
  assert.ok(!candidate.includes(".table th:nth-child(9),.table td:nth-child(9){display:none}"), "Sub-source remains visible");
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


test("Job Pipeline uses six data columns, no Last Activity, and wraps full candidate names", () => {
  const source = readFileSync(join(process.cwd(), "components", "application-pipeline.tsx"), "utf8");
  assert.ok(source.includes("<th>{copy.source}</th></tr>"), "Source is the last information column");
  assert.ok(!source.includes("<th>{copy.activity}</th>"), "Last Activity must not be duplicated in the table");
  assert.ok(pipeline.includes(".candidateLink{display:block;width:100%"), "Long candidate names should wrap naturally");
  assert.ok(pipeline.includes("overflow-wrap:break-word;word-break:normal"), "Long names must not overflow the candidate column");
  assert.ok(!pipeline.includes("-webkit-line-clamp:2"), "Long names must not be cut off");
  assert.ok(pipeline.includes("@container (max-width:650px)"), "Narrow panels must reflow safely");
});


test("Pipeline sidebar has natural page scroll without stretching the left grid rows", () => {
  assert.ok(pipeline.includes("grid-template-rows:max-content max-content"), "Summary and candidate table must stack without artificial row stretching");
  assert.ok(pipeline.includes(".side{grid-column:2;grid-row:1 / span 2;position:static"), "Right detail rail stays in page flow");
  assert.ok(pipeline.includes("max-height:none;overflow:visible"), "History must not be clipped behind an independently scrolling sidebar");
  assert.ok(pipeline.includes("@media(max-width:1250px)"), "Small displays stack the panel");
});
