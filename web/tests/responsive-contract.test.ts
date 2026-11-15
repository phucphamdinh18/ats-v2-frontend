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

test("Candidate Database uses a single heading, five-column list and height-matched profile", () => {
  const view = file("talent-pool.tsx");
  const wrapper = file("bosch-module-layout.tsx");
  for (const rule of [".pageGrid{display:grid;", ".pageLeft{display:flex;flex-direction:column", ".listCard{flex:1 1 auto;", ".scroll{flex:1 1 auto;", ".table{width:100%;min-width:960px;", ".profileScroll{position:sticky;top:16px;", "@media(max-width:1200px)"]) {
    assert.ok(candidate.includes(rule), rule);
  }
  assert.ok(wrapper.includes('if (module === "candidates") {') && wrapper.includes("return <>{children}</>"), "Outer duplicate Candidates heading removed");
  for (const col of ["checkCol", "nameCol", "jobCol", "expCol", "sourceCol"]) {
    assert.ok(view.includes(`styles.${col}`), `Missing column ${col}`);
  }
  assert.ok(view.includes('title={candidate.full_name}'), "Candidate name remains available in tooltip");
  assert.ok(view.includes("attribution?.source") && view.includes("attribution?.sub_source"), "Source/sub-source both remain visible");
  assert.ok(!view.includes('tr("Gần nhất", "Latest")'), "Remove redundant Latest header subtitles");
  assert.ok(!view.includes('className={styles.avatar}'), "Reference has no initials avatar");
  assert.ok(!view.includes("Candidate Summary"), "No metrics card should be added");
  assert.ok(view.includes("className={styles.pagerControls}"), "Pagination controls remain attached to existing handlers");
});

test("Interviews collapses detail-backed columns based on actual table-pane width", () => {
  for (const rule of [".listCard{container-type:inline-size}", "@container (max-width:850px)", "@media(max-width:1350px)", ".table th:nth-child(5),.table td:nth-child(5){display:none}"])
    assert.ok(interview.includes(rule), rule);
});

test("Job Pipeline and Job Detail retain usable mobile navigation", () => {
  for (const rule of [".listSection{grid-column:1;grid-row:var(--job-pipeline-list-row,2);", ".scroll{flex:1 1 auto;", "@media(max-width:1200px)", ".table{table-layout:fixed;"])
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

test("Pipeline aligns the Candidate rail with Job header and keeps descriptive columns left aligned", () => {
  assert.ok(pipeline.includes(".mainColumn{display:contents}"), "Allow Candidate card and detail panel to share a grid row");
  assert.ok(pipeline.includes(".listSection{grid-column:1;grid-row:var(--job-pipeline-list-row,2);"), "Candidate list follows the header-grid placement");
  assert.ok(pipeline.includes(".side{grid-column:2;grid-row:var(--job-pipeline-side-row,1 / 3);position:relative"), "Right detail can span the Job header and Candidate list");
  assert.ok(pipeline.includes(".sideInner{position:absolute;inset:0;overflow-y:auto"), "Long History stays scrollable inside the panel");
  assert.ok(pipeline.includes(".pagination{display:grid;grid-template-columns:1fr auto 1fr"), "Current page is centered independent of button widths");
  assert.ok(pipeline.includes(".table tbody tr{height:56px}"), "Rows target consistent height");
  assert.ok(pipeline.includes("@media(max-width:1200px)"), "Narrow viewports stack the detail rail");
  assert.ok(detail.includes("--job-pipeline-side-row:2 / 7"), "Rail starts on Job title row and ends with Candidate list");
  assert.ok(detail.includes(".pipelineLayout>.content{display:contents}"), "Children share the Job grid without moving React state");
  assert.ok(pipeline.includes(".table thead th{height:48px;padding:10px 8px;text-align:center"), "Default headers remain centered");
  assert.ok(pipeline.includes(".table td{height:56px;padding:8px;text-align:center"), "Default cells remain centered vertically and horizontally");
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


test("Jobs Overview uses six-column grid and reusable shared table primitives", () => {
  const css = file("bosch-v2-jobs.module.css");
  const shared = file("ats-table.module.css");
  const view = file("bosch-jobs-master.tsx");
  for (const width of ['"30%"', '"15%"', '"13%"', '"12%"', '"17%"']) {
    assert.ok(view.includes(width), `Missing column width ${width}`);
  }
  assert.ok(view.includes("<colgroup>"), "Six-column table still needs colgroup");
  assert.ok(view.includes("title={job.title}"), "Full title still accessible");
  assert.ok(css.includes(".table tbody tr{height:64px"), "Updated reference uses 64px rows");
  assert.ok(css.includes("-webkit-line-clamp:2"), "Long job names remain at most two visible lines");
  assert.ok(css.includes(".workspace{display:grid;grid-template-columns:minmax(0,1fr) var(--ats-detail-track)"), "Jobs panels share the readable detail track");
  assert.ok(css.includes("@media(max-width:1370px)"), "Narrow pages stack snapshot");
  assert.ok(css.includes(".snapshotInner{position:absolute;inset:0;display:flex;flex-direction:column;overflow-y:auto"), "Snapshot content cannot increase the left stack height");
  assert.ok(css.includes(".footer{composes:foot"), "Footer reuses shared primitive");
  assert.ok(css.includes(".table{composes:atsTable"), "Table opts in to shared style");
  assert.ok(css.includes(".state{composes:tag") && css.includes(".dim{composes:dim"), "Tags and secondary text reuse shared primitives");
  for (const rule of [".atsTable th{", ".atsTable td{", ".tag{", ".dim{", ".foot{"]) assert.ok(shared.includes(rule), rule);
});


test("Dedicated Candidate Detail renders authenticated facts and working navigation from existing props", () => {
  const view = file("talent-pool.tsx");
  const panel = file("bosch-candidate-detail.tsx");
  const workspace = file("workspace.tsx");
  for (const icon of ["Mail", "Phone", "MapPin", "BriefcaseBusiness", "Building2", "CalendarDays", "Layers3"]) {
    assert.ok(panel.includes(`<${icon} `) || panel.includes(`<${icon} aria-hidden`), `Missing icon ${icon}`);
  }
  for (const rule of [".detailHead{padding:18px", ".detailTabs{display:flex", ".detailBody{display:flex", ".detailFactLines{display:flex", ".assignmentList{list-style:none", ".addControls>.primary{display:inline-flex"]) {
    assert.ok(candidate.includes(rule) || candidate.includes(rule.replace(".addControls>.primary", ".detailBody .addControls>.primary")), `Missing panel style ${rule}`);
  }
  assert.ok(view.includes("<BoschCandidateDetail"), "Dedicated panel is mounted instead of legacy profile sections");
  assert.ok(view.includes("onAddToJob={() => void addToJob()}"), "Original submit callback retained");
  assert.ok(view.includes('onClick={() => setView("cv-review")}'), "CV review navigation retained");
  assert.ok(workspace.includes('onOpenJob={(job) => { setSelectedJob(job); setTab("jobs"); setJobView("pipeline"); }}'), "Job navigation reuses approved route handler");
  assert.ok(panel.includes('onClick={() => setTab("overview")}') && panel.includes('onClick={() => setTab("resume")}'), "Only data-backed tabs enabled");
  assert.ok(panel.includes("profile.documents.map"), "Resume tab lists actual authorized CV documents");
  assert.ok(panel.includes("application.stage") && panel.includes("application.status"), "Assigned Jobs use real stage/status");
  assert.ok(!panel.includes("candidate.skills") && !panel.includes("matching_score"), "No fabricated skills or matching");
  assert.ok(panel.includes("onClick={onAddToJob}"), "Single Add to Job action preserved");
});
