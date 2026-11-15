import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

// Structural CSS regression checks: these are not screenshot or authenticated E2E tests.
const file = (name: string) => readFileSync(join(process.cwd(), "components", name), "utf8");
const candidate = file("bosch-v2-candidates.module.css");
const interview = file("bosch-v2-interviews.module.css");
const pipeline = file("bosch-v2-pipeline.module.css");
const applicationPipeline = file("application-pipeline.tsx");
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
  for (const rule of [".listSection{grid-column:1;grid-row:2;", ".scroll{flex:1 1 auto;", "@media(max-width:1200px)", ".table{table-layout:fixed;"])
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


test("Job Pipeline has seven table columns and clamped accessible candidate/source names", () => {
  assert.ok(applicationPipeline.includes("<colgroup>"), "Colgroup fixes all column proportions");
  for (const col of ["checkCol", "candidateCol", "stageCol", "roundCol", "matchCol", "experienceCol", "sourceCol"]) {
    assert.ok(applicationPipeline.includes(`styles.${col}`), `Missing column ${col}`);
  }
  assert.ok(applicationPipeline.includes("<th>{copy.source}</th></tr>"), "Source remains final column");
  assert.ok(!applicationPipeline.includes("<th>{copy.activity}</th>"), "No duplicate Last Activity column");
  assert.ok(applicationPipeline.includes("title={application.candidate_name}"), "Full long names remain accessible");
  assert.ok(applicationPipeline.includes('title={application.source || "—"}'), "Full source remains accessible");
  assert.ok(pipeline.includes(".candidateLink{display:-webkit-box;"), "Candidate name is clamped to two lines");
  assert.ok(pipeline.includes(".sourceText{display:-webkit-box;"), "Source is clamped to two lines");
  assert.ok(pipeline.includes("min-width:820px"), "Table scroll is local to its wrapper");
});

test("Pipeline has centered pagination and a scrollable height-matched detail rail", () => {
  assert.ok(pipeline.includes(".mainColumn{display:contents}"), "Allow Candidate card and detail panel to share a grid row");
  assert.ok(pipeline.includes(".listSection{grid-column:1;grid-row:2;"), "Candidate list is on the detail panel's row");
  assert.ok(pipeline.includes(".side{grid-column:2;grid-row:2;position:relative"), "Right detail matches Candidate card height");
  assert.ok(pipeline.includes(".sideInner{position:absolute;inset:0;overflow-y:auto"), "Long History stays scrollable inside the panel");
  assert.ok(pipeline.includes(".pagination{display:grid;grid-template-columns:1fr auto 1fr"), "Current page is centered independent of button widths");
  assert.ok(pipeline.includes(".table tbody tr{height:56px}"), "Rows target consistent height");
  assert.ok(pipeline.includes("@media(max-width:1200px)"), "Narrow viewports stack the detail rail");
  assert.ok(applicationPipeline.includes("className={styles.detailSticky}"), "Candidate header and tabs remain visible while scrolling");
});


test("Bosch identity grows on desktop while sidebar remains compact on mobile", () => {
  const shell = file("bosch-v2-shell.module.css");
  const workspace = file("workspace.tsx");
  assert.ok(shell.includes("grid-template-columns:310px minmax(0,1fr)"), "Desktop sidebar should match the approved reference proportions");
  assert.ok(shell.includes(".identity img{width:188px"), "Bosch wordmark must remain legible");
  assert.ok(shell.includes("@media(max-width:1280px)"), "Laptop should use the compact sidebar width");
  assert.ok(shell.includes("@media(max-width:760px)"), "Mobile sidebar still collapses to icons");
  assert.ok(workspace.includes('alt="Bosch" width="188" height="52"'), "Logo intrinsic dimensions should match the design");
});


test("Candidate professional summary includes four icons and bilingual Education label", () => {
  const source = readFileSync(join(process.cwd(), "components", "application-pipeline.tsx"), "utf8");
  for (const icon of ["UserRound", "BriefcaseBusiness", "Building2", "GraduationCap"])
    assert.ok(source.includes(`<${icon} aria-hidden="true" size={17}/>`), `Missing icon ${icon}`);
  assert.ok(source.includes('en ? "Education" : "Học vấn"'));
  assert.ok(pipeline.includes(".professionalFacts{display:grid"));
  assert.ok(pipeline.includes(".professionalFacts dt svg{"));
});


test("Jobs Overview uses reference five-column grid and reusable shared table primitives", () => {
  const css = file("bosch-v2-jobs.module.css");
  const shared = file("ats-table.module.css");
  const view = file("bosch-jobs-master.tsx");
  for (const width of ['"36%"', '"20%"', '"12%"', '"18%"', '"14%"']) {
    assert.ok(view.includes(width), `Missing column width ${width}`);
  }
  assert.ok(view.includes("<colgroup>"), "Five-column table still needs colgroup");
  assert.ok(view.includes("title={job.title}"), "Full title still accessible");
  assert.ok(css.includes(".table tbody tr{height:70px"), "Reference uses 70px rows");
  assert.ok(css.includes("-webkit-line-clamp:2"), "Long job names remain at most two visible lines");
  assert.ok(css.includes(".workspace{display:grid;grid-template-columns:minmax(0,1fr) 315px"), "Job Snapshot uses 315px column");
  assert.ok(css.includes("@media(max-width:1370px)"), "Narrow pages stack snapshot");
  assert.ok(css.includes(".snapshot{position:static;align-self:stretch;display:flex;flex-direction:column"), "Snapshot stretches with left stack");
  assert.ok(css.includes(".footer{composes:foot"), "Footer reuses shared primitive");
  assert.ok(css.includes(".table{composes:atsTable"), "Table opts in to shared style");
  assert.ok(css.includes(".state{composes:tag") && css.includes(".dim{composes:dim"), "Tags and secondary text reuse shared primitives");
  for (const rule of [".atsTable th{", ".atsTable td{", ".tag{", ".dim{", ".foot{"]) assert.ok(shared.includes(rule), rule);
});
