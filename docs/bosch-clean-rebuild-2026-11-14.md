Warning: truncated output (original token count: 20342)
Total output lines: 580

# Bosch V2 clean rebuild — implementation log

Date: 2026-11-14
Scope: PR #44 only. No Supabase schema, Edge Function, Auth, RLS, production site, or recruitment workflow changes.

## Recovery point
- Branch: `backup/bosch-pr44-before-clean-rebuild-20261114`
- SHA: `938dc56382d5d48b6203786a437b20c496409873`
- Retained independently from the active draft PR. Never force-push/delete it.

## Completed in this first implementation slice
- New `web/components/bosch-v2-jobs.module.css`: standalone Bosch V2 styling for Jobs Master.
- Refactored `web/components/bosch-jobs-master.tsx` to use only its CSS module for screen-level selectors; preserved existing Jobs props, filtering, selection, Pipeline open actions and real API metrics.
- New `web/components/bosch-v2-job-detail.module.css`: standalone job header, tabs, metadata, details and auxiliary sections.
- Refactored `web/components/bosch-job-detail.tsx` to use scoped CSS Module classes instead of `.bosch-*` global CSS.
- `ApplicationPipeline` remains mounted unchanged and retains the existing stage/API/permission handling.

## Still open — NOT production ready
1. Extract Auth/session/access refresh logic from `workspace.tsx` into a tested headless adapter/hook without breaking RLS-driven access.
2. Replace the legacy `.shell` App Shell with a dedicated layout and remove old `globals.css` visual dependencies; verify Bosch wordmark no longer clips.
3. Rebuild pipeline's internal tables, five-stage summary and candidate side panel with the same isolated visual architecture. No invented data.
4. Complete visual QA at the user's reference viewport, Admin/TA/HM/Interviewer E2E and inspect real API errors and empty states.
5. Migrate Candidates, Interviews and Offers only after Jobs is accepted.
6. Delete legacy UI only when no imports/references remain. Preserve backup and all rollback paths.

## Verify / rollback
- CI checks: QA, Next web checks, Publish ATS Pages PR-build. `Supabase local browser E2E` can be skipped without a Docker-enabled runner: record as unverified.
- Live preview is not automatically updated by PR commits. `Publish ATS Pages` manual `path-preview` requires live verification of root `release.json` before choosing `production_ref`.
- Rollback by resetting the PR branch to the backup SHA in a controlled new commit/branch or comparing and restoring individual files; never rewrite production history.
- Do not merge or delete backup before owner acceptance.

## Step 2 — App Shell visual separation (2026-11-14)
- Created `web/components/bosch-v2-shell.module.css` for the Bosch header/identity/sidebar/top navigation/search/account layout.
- Replaced the legacy `shell/sidebar/topbar` DOM class contract in `web/components/workspace.tsx` with CSS Module classes; preserved existing onClick handlers and state for role-filtered nav, job search, Ctrl/Cmd+K, language selection, guide, session logout and job selection.
- This removes the old `.shell` styles from the App Shell. **Existing Pipeline and other modules may still depend on `.shell` descendant overrides and require visual/regression checks.**
- This is *presentational decoupling*, NOT yet full extraction of Auth/session/access logic into a headless controller. Auth remains in `workspace.tsx` and is deliberately unchanged for safety.
- Pending: test browser screenshots, extract Auth/access logic, migrate Pipeline internals; do not claim full frontend replacement.

## Step 3 — Job Pipeline presentation extraction (2026-11-14)
- Added `web/components/bosch-v2-pipeline.module.css` with isolated five-stage summary, list table, status labels, right-side candidate overview/detail, timeline and responsive layout.
- Refactored `web/components/application-pipeline.tsx` to use the new scoped CSS classes for the summary/list/detail. No modifications to `listApplications`, `searchApplications`, `applicationDetail`, stage transitions, idempotent `request_id`, role checks or candidate selection lifecycle.
- Preserved Kanban view and manual candidate form under existing implementations to avoid destabilizing stage drag/drop or create-candidate behavior. These are **still legacy presentation dependencies** and MUST be migrated in a separate tested step; the frontend is not yet isolated end-to-end.
- Display continues to show `—` for matching/experience/interview-round/last activity where the API does not return values; do not invent user data.
- No manual `path-preview` dispatch, no changes to root release, no live visual QA, no E2E certification in this step.
- Next: isolate Kanban and candidate intake UI; validate screenshot and actual role-scoped behavior before considering legacy CSS deletion.


## Step 4 — Owner-approved list-only pipeline (2026-11-14)

**Decision:** The user approved removing Kanban drag-and-drop. The Job ID/Pipeline must match the supplied Bosch table-and-right-detail reference without a draggable board.

- Removed `viewMode` toggle, legacy Kanban card/column DOM, `draggable` handlers, drag target state, visual drag affordances and presentation-only interim round SLA constants from `web/components/application-pipeline.tsx`.
- Preserved `NEW ↔ SCREEN ↔ INTERVIEW` backend transitions via explicit Candidate Detail buttons, `window.confirm`, permission gating, existing RPCs and idempotent `request_id` retries.
- Kept the five-stage **read-only summary** (New, Screening, Interview, Offer, Hired). Offer is a distinct backend workflow; summary is not a draggable Application stage.
- Kept authorized candidate search, paging, application detail, interview progress, add-candidate disclosure, audit timeline, error/forbidden states and source/matching data handling.
- Replaced the now-obsolete Kanban drag tests in `web/tests/application-pipeline.test.tsx` with list-only functional tests (read-only role, forward/back stage transitions, cancel, forbidden, retry idempotency, stale details, search and audit).
- Removed nonfunctional summary filter-looking placeholders and scoped Pipeline notices, retry buttons, and stage actions to its CSS Module.
- **Not changed:** Supabase schema, RLS, Auth, Edge Functions, production or pipeline state machine.
- **Still pending:** browser screenshot fidelity/role E2E, remaining ManualCandidateForm legacy CSS and other modules. Preserve backup and PR Draft.


## Step 5 — Bosch candidate intake form isolation (2026-11-14)

- Created `web/components/bosch-v2-candidate-intake.module.css`, independent from `globals.css` legacy selectors, for form grid, controls, source selector, Drive CV URL, validation/success/error states, retry, submit and responsive layout.
- Refactored `web/components/manual-candidate-form.tsx` to use scoped module classes only.
- Preserved `createManualCandidateApplication`, OPEN-job gate, catalog lookup, email/phone dedupe requirements, Drive-link-only rule, request confirmation, idempotent request ID, 401 session revocation, retry and error handling.
- Scope remains PR #44, with backup at `938dc56382d5d48b6203786a437b20c496409873` and production unchanged.
- UI component is now visually isolated, **but no browser screenshot QA or role-based end-to-end verification has yet occurred**. Do not remove legacy global CSS until all remaining modules are migrated and evidence of no dependencies exists.

### Current release gate
- Jobs Master, Job Detail, App Shell, Pipeline primary table/side panel and candidate intake have isolated CSS modules.
- The other modules (Candidates/Talent Pool, Interviews, Offers, Admin, and ancillary login/review components) still require isolation or safe integration.
- Test the rendered preview against the selected Bosch screenshots before any release/merge.


## Step 6 — Remove legacy Jobs DOM (2026-11-15)
- Identified `workspace.tsx` still rendering `1.1 Bảng Master / 1.2 Hiring Pipeline` tab strip and old page-heading/role badges on Bosch screens, relying on the obsolete global `.shell .bosch-hidden-page-heading` rule to hide them.
- Removed the legacy Job tabs from the rendered component altogether. Existing Job Master → Job ID → Back buttons remain the supported navigation.
- Rendered old Workspace headings/role badges only in not-yet-migrated JD/Admin modules instead of depending on CSS to hide them in Jobs/Candidates/Interviews/Offers.
- Preserved Job guide via an accessible Help button in the new sidebar; preserved role-based navigation, filters, API and Auth handlers.
- Added a focused workspace regression test ensuring only the Bosch Jobs heading is shown and the old tab strip does not reappear.
- No backend/RLS/schema/API/stage changes. This commit has not been published to live `/preview/`. Browser visual QA, authenticated E2E and owner approval still pending.

## Step 7 — Preview visual QA and fixes (superseded 2026-11-15)
- Historical QA at SHA `5b18ab6d2d502fe3c09a76a58c8c83b9de99b09e` found Jobs Master header overlap and incomplete Pipeline side-panel layout. These observations led to follow-up changes; they are not the current release state.
- An earlier preview at `31f7500cf757a7c024825a172d5428677cf7cfb1` was not accepted because the Jobs header still overlapped. Do not use that release as current evidence.

## Step 8 — Scoped table header fix (2026-11-15; superseded by Step 9)
- Moved the Jobs Master table-header reset into `web/components/bosch-v2-jobs.module.css`, where it overrides the legacy global sticky-header rule.
- Subsequent screenshot review also found long cell text clipping. Step 9 records the additional body wrapping fix and current verification.

## Step 9 — Preview deployment and visual QA (2026-11-15)

### Revision and safeguards
- PR #44 remains **open, Draft, unmerged**. The verified branch HEAD deployed to preview is `1a71a843625fcc1fe2b42567266c9659ec3feb09`.
- Live `release.json` confirms production root `71ff88ebdb68bea9f6456375c4c9d970e11c0379` and preview revision `1a71a843625fcc1fe2b42567266c9659ec3feb09`; the `path-preview` workflow published only the preview path. Production root remained unchanged.
- Recovery branch `backup/bosch-pr44-before-clean-rebuild-20261114` remains at `938dc56382d5d48b6203786a437b20c496409873`.
- No database, Supabase Auth/RLS, Edge Function, backend API, recruitment workflow, or real candidate record was changed. No merge or legacy/backup deletion was performed.

### CI on the deployed commit
- QA checks #259: success.
- Next web checks #232: success.
- Pages PR build #256: success.
- Supabase local browser E2E #150: skipped. This is not proof of live role/RLS behavior.
- Local verification on the frontend changes: Node tests 23/23, Vitest 59/59, typecheck and static build passed.

### Visual QA at 1363 × 1023 (laptop viewport)
- **Jobs Master — PASS for the inspected desktop viewport.** Bosch navy header, full wordmark, light sidebar, red active state and compact job table render without the previous header collision. Long status header wraps inside its own column; long department/location text wraps instead of clipping. The selected table values and counts come from the authorized API data. No legacy 1.1/1.2 tabs or duplicate old page heading are visible.
- **Job ID / Hiring Pipeline — FAIL for strict reference fidelity.** Job title, metadata, section tabs, five-stage summary and candidate list render; selecting a test candidate opens the right-side detail panel. There is no Kanban/drag-drop. Missing API values display `—` with explanatory text instead of fabricated score, experience or interview-round data. However, the seven-column candidate table has an internal horizontal scrollbar at this laptop width; user-provided Bosch reference shows the table fitted in the left pane. The detail pane starts as a placeholder until a candidate is selected. This needs a frontend layout pass before visual acceptance.
- Laptop viewport only. Narrow/mobile viewport and responsive behavior were not captured; no claim is made for them. Visual QA is based on supplied Bosch screenshots but does not claim pixel-identical matching.

### Safe functional checks
- Admin session `phucphamdinh18@gmail.com`: opened Jobs Master, inspected the four API-backed jobs and six applications for a marked test job, searched and cleared a candidate query, selected a marked test candidate and read its actual detail/interview history. Read-only checks only; no stage transition or add-candidate submit was performed.
- TA, Hiring Manager and Interviewer live sessions were not available in this browser. Their authenticated flows, session refresh/logout, forbidden API paths, stage-change confirmation and `request_id` retry were not verified in live E2E. Unit/component permission and retry tests passed, but do not replace role E2E.
- Loading appeared briefly while API data resolved, then the list/details rendered. API error and empty states were not forced in the live session.

### Screen verdicts and release gate
- Jobs Master: **PASS** (desktop visual and read-only data flow only).
- Job ID / Hiring Pipeline: **FAIL** (table does not fit without internal horizontal scrolling at the inspected width).
- Admin runtime read-only: **PASS** for the checks above; Admin mutation path not tested.
- TA / Hiring Manager / Interviewer E2E: **BLOCKED** (no authorized test sessions/local browser E2E runner available).
- Overall acceptance: **BLOCKED**. Do not merge PR #44, deploy production or remove the historical frontend until Pipeline layout is corrected and all four role test paths plus responsive checks are verified against disposable/test data.

### Rollback
- Production was not changed, so rollback of the preview is not required to restore the public site.
- For PR code comparison/rollback, preserve `backup/bosch-pr44-before-clean-rebuild-20261114` at `938dc56382d5d48b6203786a437b20c496409873`; use a reviewed revert commit or restore selected files from that branch. Do not reset/force-push shared history and do not delete the backup.


## Step 7 — Jobs Overview from approved fullscreen HTML (2026-11-15)

**Source:** `ATS_V2_Bosch_Jobs_Master_Fullscreen_Demo(1).html` provided by the owner. This is a visual reference only, never a source of production data.

- Rebuilt `web/components/bosch-jobs-master.tsx` to implement the seven agreed data groups: Job title/ID, business unit/function, request type/date, level/priority, status, configured SLA target, application count and source. Button opens the existing Job Detail/Pipeline.
- Added `Job Snapshot` aside on the right for authorized Job data, including requisition metadata, status/SLA and existing Job metrics, with a direct Job Detail action.
- Added local Priority filter and 10-item pagination. Existing Job search/status filters stay owned by `workspace.tsx`; no API, schema, RLS or authorization changes.
- Updated `web/components/bosch-v2-jobs.module.css` to use isolated two-column Bosch layout and respond by stacking the detail pane on narrower screens.
- Explicitly **not** displaying fabricated hiring managers, TA PIC, SLA actual/breach dates or historical source metrics that the current Job contract does not provide.
- Data comes from authorized `jobs` and the existing `jobOverview()` metrics. Job SLA continues to be computed from `job_sla_rules` (Level/Function/Season) by the existing Workspace.
- Updated `web/tests/workspace.test.tsx` for Job Snapshot, priority filter, grouped columns, SLA displayed only from config, and existing scoped access.
- Still pending: screenshot comparison on new `/preview/` deployment, browser E2E with real role-scoped TEST login, owner acceptance. Do not merge PR #44 or modify production before that gate.


## Step 8 — Bosch Enterprise Home Dashboard (2026-11-15)

**Visual target:** Owner-approved Bosch Home Dashboard demo sharing the topbar/sidebar/tables/panel language of Jobs/Candidates/Interviews/Offers references.

- Added `web/components/bosch-home-dashboard.tsx` and `web/components/bosch-home-dashboard.module.css`. The new Home is *real*, authenticated and role-scoped, not a demo data fixture.
- `web/components/workspace.tsx`: Home in topbar and Dashboard sidebar now open a distinct `home` route/tab, with correct active state. Backlinks go to existing Jobs Master/Job Detail and existing authorized Interviews view.
- KPI: loaded accessible Jobs, OPEN Jobs, summed Job-level **application associations** from existing `jobOverview` metrics, and scheduled appointments in the **first page** of the authorized Interview worklist. Missing values render —. Do not treat loaded Jobs as guaranteed global counts (the existing access query caps at 100).
- Pipeline: New/Screening/Interview/Hired from existing aggregated job metrics. Offer is left — because it is a separate workflow and no complete authorized cross-Job Offer count is provided by current API.
- My Action Items: existing Job priority (HIGH/CRITICAL) and DRAFT only. Not fabricated interview feedback tasks or SLA breaches.
- Jobs Needing Attention: linked to authorized Jobs already loaded; owner is — because the current Job list contract lacks ownership.
- Upcoming Interviews: real `listInterviewWorklist("SCHEDULED",25,0)` projection; no made-up appointments. Client-side Upcoming and 7-day filters only affect the returned page, never claim exhaustive totals.
- Error & permissions: Interview API 401/403 invalidates the current scope, the same as existing module logic. No secrets, service role key, new API, backend schema or RLS changes.
- Added Workspace regression tests for Home navigation/role scope, absence of invented Offer/SLA figures and Job Detail navigation. Supabase local E2E and screenshot visual verification remain mandatory prior to merge.
- **Do not update production or merge Draft PR #44.** `/preview/` publishing is a separate checked workflow and should not be claimed without verifying deployed commit.


## Step 9 — Candidates List / Candidate Detail rebuild (2026-11-15)

- **Scope:** rebuild broken Candidates UI against existing Bosch Enterprise visual target. No Supabase SQL, Auth, RLS, Edge Function, production, or recruitment workflow changes.
- Created `web/components/bosch-v2-candidates.module.css`: self-contained two-column layout with scroll-contained candidate table, sticky right-side profile (desktop), stacked panels below 1080px, and scoped form/buttons/feedback states.
- Refactored `web/components/talent-pool.tsx` presentation classes; eliminated its old `talent-*` and `candidate-database-*` class names from the rendered component. Kept `listCandidates`, `candidateProfile`, source catalog, authorized Job choices, CV document links, review queue, search debounce, paging, confirmation, `createApplication`, and idempotent request ID logic.
- Created `web/components/bosch-v2-candidate-frame.module.css`; changed `BoschModuleLayout` **only for the Candidates variant**. Existing Interviews and Offers layout logic remains unchanged. Unsupported tab labels are nonfunctional information labels, not fake workflows.
- Candidate list API lacks Job-specific Stage, Interview Round, Match %, Source and Last Activity; these fields intentionally remain `—` instead of fabricated values.
- Added `web/tests/bosch-candidates-layout.test.tsx` testing list/detail structure, selected candidate, Add to Job behavior and empty state.
- **Remaining:** visual browser screenshots and full E2E with real test users; investigate whether the connected API supports aggregated list fields before adding them to Candidate Database. Do not remove `globals.css` or merge Draft PR #44 until other modules are migrated and verified.


## Step 10 — Interviews: Bosch schedule + details (2026-11-15)

**Visual reference:** user-approved Bosch Enterprise Interviews mockup (navy App Shell, white compact table, right-side details); scope is **visual rebuild**, not inventing scheduling/feedback APIs.

- Added `web/components/bosch-v2-interviews.module.css` for standalone Schedule summary, status filters, authorized table, pagination, and right-side Interview Details/Interviewers.
- Refactored `web/components/interview-worklist.tsx` away from `ops-*` legacy global CSS, retaining existing `listInterviewWorklist(status,25,offset)` API, pagination, safe HTTPS meeting URLs, user-local date display, participant list, selected item, 401/403 invalidation and stale-request protection.
- Added `web/components/bosch-v2-interview-frame.module.css` and a scoped `interviews` branch in `web/components/bosch-module-layout.tsx`. The Candidate and Offer variants were not touched.
- Current top status selector is functional (SCHEDULED/COMPLETED/CANCELLED) and uses real API records. Counts describe **only the returned page**. The reference screenshot's Pipeline/Feedback/Analytics tabs are present as non-action labels only until verified backend workflows can support them.
- Added layout, empty-response, network error cleanup regression coverage to `web/tests/interview-worklist.test.tsx`.
- Pending: screenshot Visual QA on the deployed preview, browser role-based E2E with test users, feedback/scheduling integration contract review. No Supabase SQL/RLS/API change; keep PR #44 Draft and production untouched.


## Step 11 — Offers visual rebuild (2026-11-15)

- **Approved visual target:** Bosch Enterprise Offers (compact Offer stage strip, list/table on left, Offer Detail with Overview/Compensation/Approval/Activity labels on right). Preserve actual Offer API, Auth and role restrictions.
- Created `web/components/bosch-v2-offers.module.css` providing scoped two-column layout, scroll-contained Offer table, fixed/scrollable detail panel and responsive stacking at narrower widths. Existing legacy `bosch-offer-*` selectors are not used by the component anymore.
- Refactored `web/components/bosch-offers-workspace.tsx` presentation only. Preserved job-filtered `listOfferProposals(jobId,25,offset)`, `offerProposalDetail(offerId)`, secure 401/403 access invalidation, last-write-wins request handling, salary rendering from authorized responses only, accurate current-page status counts, and existing Offer history.
- Created `web/components/bosch-v2-offer-frame.module.css`; added dedicated Offer view to `BoschModuleLayout` without changes to Candidates/Interviews.
- The UI does **not** infer Job grade, approver identities or unavailable Draft persistence. Compensation and audit events are shown only when returned by the authorized detail API. No writes or approval workflow modifications.
- Extended `web/tests/bosch-offers-workspace.test.tsx` to cover two-column composition, page-scoped KPI and removal of previously selected sensitive Offer details on Job changes.
- **Release gates remaining:** current branch CI all green, screenshot-based Visual QA at production-independent preview URL, Supabase role-based E2E, audit of salary visibility policies. No production merge or backend/schema/RLS changes.


## Step 12 — Job Detail: direct Job-scoped read-only workspaces (2026-11-15)

**Reference:** owner-approved Bosch Enterprise Job Detail / Hiring Pipeline design. The existing Pipeline keeps its stage permission checks, confirmation, and idempotent request IDs; no changes to the stage workflow.

- `web/components/bosch-job-detail.tsx`: implemented detailed requisition information (Job ID, status, BU, function, location, level, req date/type, replacement, season, priority, configured SLA), sourcing KPI/source breakdown, embedded Job-interviews worklist, scoped Offer workspace for authorized Admin/TA, verified current role and per-Job stage rights, and a candidate-specific application audit timeline.
- `web/components/bosch-job-interviews.tsx`: new read-only view of actual scheduled/completed/cancelled records. **Important limitation:** current `interviews.worklist` accepts status + global offset, not a Job filter; this client filters only the returned worklist page, so absence of a result does **not** prove the Job has no interviews. The main Interviews workspace remains available.
- `web/components/bosch…8342 tokens truncated…erged.
- QA checks #368, Next web checks #341, PR Pages build #377: **success**. Supabase local browser E2E #259: **skipped**.
- Manual Publish ATS Pages #378: **success**, mode `path-preview`, production_ref `71ff88ebdb68bea9f6456375c4c9d970e11c0379`, preview_ref `b69dbdd599d0c013594da7113f086e06d084a7d3`.
- Live `release.json` after deploy: production revision still `71ff88ebdb68bea9f6456375c4c9d970e11c0379`; preview revision `b69dbdd599d0c013594da7113f086e06d084a7d3`. Website root was not changed.

### Real browser visual evidence
- Authenticated preview opened in Chromium at the available CSS viewport **1363×936**. Captured Jobs Master and Job Detail/Pipeline screenshots after hard reload; Jobs table values/API source and Pipeline candidate/source values rendered. Typography is dark/bold and visually consistent across these screens; no candidate/source text overlap is visible in the Pipeline table. Pipeline table measured `scrollWidth=697`, `clientWidth=697`; document width 1348px within viewport 1363px.
- Jobs Master shows compact columns and Job Snapshot; no table/page overflow visible at this available desktop width. The browser is authenticated as Admin; no write action was taken.
- Exact requested 1920×1080, 1440×900, 768×1024 and 390×844 screenshots could not be captured because this managed browser blocks DevTools and exposes no viewport setter. Prior browser zoom checks indicated a crowded top navigation at tablet width; the fix hides only horizontal top navigation below 900px while keeping the labeled sidebar. **Do not claim exact viewport-matrix PASS.**
- Home, Candidates and Interviews had been visually inspected earlier in the same browser session at the available laptop viewport; Candidate Source/Sub-source and long names wrapped without overlap. This pass did not recapture every module at every target size or exercise VI/EN on the final HEAD.
- Offers and Job Reviews/Admin were not fully audited for typography consistency in this pass. Offer workflow remains deferred.

### Remaining gaps and verdict
- **Observed and fixed:** candidate hyperlink/source text overflow; crowded tablet top navigation; Jobs table density at narrower panes; Pipeline Source cell overflow.
- **Not verified:** exact four viewport dimensions, complete bilingual sweep on the final HEAD, all routes’ typography, Admin/TA/HM/Interviewer role matrix, API error/retry flows, Supabase local E2E (skipped). No real recruiting mutations were made.
- Visual evidence supports the updated preview at the available desktop width; it is **not a full frontend acceptance/PASS** against all required viewports and roles. PR remains Draft. No backend, API, Auth/RLS, recruitment workflow, production or legacy cleanup changes.

### Rollback
- Revert only the scoped follow-up UI commits on `redesign/bosch-enterprise-v2`, or restore the affected CSS modules from `backup/bosch-pr44-before-clean-rebuild-20261114` (`938dc56382d5d48b6203786a437b20c496409873`) via a reviewed commit. Keep shared history and backup intact.
- To restore the prior preview, run the existing `path-preview` workflow using a verified current production_ref and the chosen prior preview_ref. Production was not touched.

## Follow-up — All active Bosch screens: larger, clearer readable text (2026-11-15)

**Owner instruction:** increase readability of frontend text throughout, not only boldness. Keep previously agreed responsive behavior and Source/Sub-source intact. Continue PR #44 Draft only.

Changes made to the ten scoped frontend CSS files: `bosch-v2-shell.module.css`, `bosch-home-dashboard.module.css`, `bosch-v2-jobs.module.css`, `bosch-v2-job-detail.module.css`, `bosch-v2-pipeline.module.css`, `bosch-v2-candidates.module.css`, `bosch-v2-interviews.module.css`, `bosch-v2-offers.module.css`, `bosch-v2-candidate-intake.module.css`, and `bosch-v2-candidate-frame.module.css`. Shell received an additional dedicated 14px sidebar navigation/section-title adjustment (commit `e5cde53`).

- Base component text 13px -> 14px where defined by the root font shorthand.
- Explicit font sizes 9–10px -> 12px; 11px -> 12px; 12px -> 13px, retaining larger existing page titles and KPI values.
- Darkened selected muted grays to #526174; retained semantic badge colors and existing font weights.
- No changes to columns, Source/Sub-source mapping, container queries/media breakpoints, React/TypeScript components, API contracts, Auth/RLS, Offer features, or production.
- Offer's existing presentational CSS was adjusted for legibility only; Offer workflows remain deferred.

**QA gates:** Source edits committed, but no full CI results, authenticated browser screenshots, role E2E, or final preview revision verification is claimed. Increasing text may change wrapping in Jobs, Candidates and Interviews; test at 1920x1080, 1440x900, 768x1024 and 390x844 in both languages. Do not mark PASS from CSS inspection or Pages artifact build alone. Check final HEAD and live release.json before any preview-only deploy. Keep original backup and do not merge or delete legacy frontend until owner acceptance.

**Rollback:** revert this pass's CSS commits from current branch by reviewed revert commits (avoid force-push); preserve pre-existing responsive and source attribution fixes.

## Follow-up — Job Pipeline six-column table and long candidate names (2026-11-15)

Owner compared signed-in Job Detail/Pipeline preview against the Bosch reference and requested six information columns, **excluding Last Activity** because the right-side candidate panel already includes activity/history. Long test candidate names must not distort the table.

- `web/components/application-pipeline.tsx` commit `813a5a3`: kept Candidate, Stage, Interview Round, Match, Experience and Source; removed Last Activity header/cell; added full candidate name as title tooltip. This is a presentational change only. The checkbox remains an independent selection control, not one of the six data columns.
- `web/components/bosch-v2-pipeline.module.css` commit `24f80d4`: assigned balanced column proportions, wrapped table headers and Source, clamped displayed candidate names to two lines with a full-name tooltip, and retained a compact responsive table. At narrow actual list-pane widths (<=650px), placeholder-only Round/Match/Experience are hidden; at <=440px, Source is available in the selected candidate side panel instead. No page-level horizontal overflow intended.
- `web/tests/responsive-contract.test.ts` commit `add4d0d`: added structure checks for six columns, removed Last Activity and long-name clamping.
- **Data contract limitation:** Application list API still does NOT return Round, Match score or Experience. These three columns display `—`; do not fabricate reference values. Rendering all six fields may look sparse until verified backend aggregation is independently planned. Side panel remains contextual to the selected application.
- **No** schema, backend, Auth/RLS, API, stage transitions, request_id, Offer workflow or production changes. Preserve Source/Sub-source work in Candidate Database, other responsive corrections and backup branch.

**QA:** Commit and static structural checks added; full CI and authenticated viewport screenshots are NOT yet independently verified. Review 1920x1080, 1440x900, 768x1024 and 390x844. Ensure a long candidate name does not overlap Stage and its full text is accessible. Supabase E2E statuses must be reported accurately. Keep PR #44 Draft and do not merge.

**Rollback:** revert the three scoped code/test commits above in reverse order using reviewed revert commits, retaining prior text readability changes; never force-push shared history.


## Step 20 — Jobs Overview 5-column layout and live Preview QA (2026-11-15)

### Revision and release safeguards
- The owner-supplied PR head at the start of this pass was `fdc98336838791f1811fc0c98c7d892ecadcb712`. Existing typography commits were present in the branch.
- Implemented the previously approved Jobs Overview table shape in `web/components/bosch-jobs-master.tsx`: exactly five headers — Job Opening, Department/BU, Status, Applications, Action. Application source stays visible beneath the count. Requisition details, level/priority, SLA and Job metrics remain in Job Snapshot. No API/business logic changes.
- Added regression coverage in `web/tests/workspace.test.tsx`. The code commit was `56b85d6a12aa9989c17b91f453e67d4d07ee9a2b`.
- Live screenshot review at the available 1363×936 browser showed the table had five visible columns, but the Job Snapshot stacked below because the CSS breakpoint was 1370px. Changed only `web/components/bosch-v2-jobs.module.css` to move that stack breakpoint to 1180px. Commit: `0c9f38bd0e6edfe36488b6befbb58e9ebf258e08`. The table, Source/Sub-source, data and other responsive fixes remain intact.
- PR #44 remains Draft/open/unmerged. Backup branch `backup/bosch-pr44-before-clean-rebuild-20261114` at `938dc56382d5d48b6203786a437b20c496409873` remains intact.

### CI and deployment evidence
- On code commit `0c9f38b`: QA checks #385 **success**; Next web checks #358 **success** (unit tests, build and typecheck); Publish ATS Pages PR build #396 **success**; Supabase local browser E2E #276 **skipped**.
- Rechecked live root `release.json` immediately before publishing. Production SHA: `71ff88ebdb68bea9f6456375c4c9d970e11c0379`; existing preview before publish: `56b85d6a12aa9989c17b91f453e67d4d07ee9a2b`.
- Manually ran Publish ATS Pages #397 from `main`, mode `path-preview`, production_ref `71ff88ebdb68bea9f6456375c4c9d970e11c0379`, preview_ref `0c9f38bd0e6edfe36488b6befbb58e9ebf258e08`. Build and deploy jobs succeeded. No production root deployment occurred.
- Live `release.json` after publish: production revision is still `71ff88ebdb68bea9f6456375c4c9d970e11c0379`; `preview.revision` is `0c9f38bd0e6edfe36488b6befbb58e9ebf258e08`.
- Preview link: https://phucphamdinh18.github.io/ats-v2-frontend/preview/ . CI links: https://github.com/phucphamdinh18/ats-v2-frontend/actions/runs/43696292401 , https://github.com/phucphamdinh18/ats-v2-frontend/actions/runs/43696292403 , https://github.com/phucphamdinh18/ats-v2-frontend/actions/runs/43696292410 , manual deployment https://github.com/phucphamdinh18/ats-v2-frontend/actions/runs/43696500274 .

### Authenticated live browser QA evidence
- Signed-in Admin session: `phucphamdinh18@gmail.com`. Browser screenshots were captured in the 2026-11-15 QA conversation for Home, Jobs, Candidates, Interviews, Job Detail/Pipeline and the Bosch App Shell. Screens used authorized API-backed test records; no mutation was submitted.
- Available browser content viewport was **1363×936**. App shell shows the complete Bosch/ATS V2 identity, navy top bar, light sidebar and red active state. Text is visibly darker/bolder; computed body font is 14px. This confirms the tested rendered screens at this viewport only, not all CSS elements or exact pixel match to the references.
- **Jobs Overview — visual PASS at 1363×936:** live DOM contains exactly five table headers. Job Snapshot measured 299px wide at x=1026, beside the table; document width 1348px remained below viewport width 1363px. Snapshot contains requisition facts, status/SLA and actual Job metrics. Some long Job names and column headings wrap; no overlap was seen in the captured screen.
- **Home — visual PASS at 1363×936 (English):** recruitment summary, pipeline counts, action-required jobs, upcoming interview and insights rendered. API-unavailable values displayed `—`; no invented figures were added.
- **Job Detail/Pipeline — visual PASS at 1363×936 (English and Vietnamese):** Job header, seven tabs, five-stage summary, six application rows, Source and Candidate Overview rendered. The Kanban/drag-and-drop board is absent. This was read-only; no stage change or candidate add was submitted.
- **Candidates — visual PASS at 1363×936 (English):** table and candidate detail pane rendered; Source and Sub-source columns remained visible, with existing source values and placeholders. No overlap was visible in the screenshot.
- **Interviews — visual PASS at 1363×936 (English):** schedule row and detail pane rendered after loading; interviewer and feedback fields were visible. A transient loading state was observed first; the final captured state was populated.
- **App Shell — visual PASS at 1363×936 (English and Vietnamese):** main navigation labels and language selector changed. Jobs and Pipeline also rendered Vietnamese labels after switching language. The source catalog names and some API enum values remain canonical English; a full bilingual sweep of every route was not completed.

### Remaining gaps and honest verdict
- Exact target viewport QA at 1920×1080, 1440×900, 768×1024 and 390×844 is **BLOCKED**: this browser session is 1363×936 and organization policy blocks DevTools; no supported viewport setter was available. No exact-size screenshots or PASS are claimed for those four sizes.
- Full VI/EN testing on every module is **PARTIAL**. Offers typography/workflow, Job Reviews and Admin module are not fully visually audited in this pass. Offers workflow remains deferred.
- Admin-only read-only inspection was performed. TA, HM and Interviewer role-specific sessions, API 401/403 and mutation/retry flows are **SKIPPED**; Supabase browser E2E is **SKIPPED**. No real candidate or Job data was changed.
- Screenshots are visual evidence in the QA conversation; they were not added as binary files to this Markdown log. The corresponding authenticated Preview remains available at the link above.
- Overall ATS frontend acceptance remains **BLOCKED**, despite the scoped Jobs Overview and inspected desktop screens looking correct. Do not merge PR #44, deploy production or remove legacy frontend until target viewport and role checks are completed.

### Rollback
- Revert only CSS commit `0c9f38bd0e6edfe36488b6befbb58e9ebf258e08` to restore the prior Jobs Snapshot stacking breakpoint; this leaves the five-column component intact. To undo the five-column markup separately, restore `web/components/bosch-jobs-master.tsx` and its matching test from the parent state before `56b85d6` using a reviewed revert commit.
- The independent backup remains `938dc56382d5d48b6203786a437b20c496409873`. To restore a prior Preview, verify the current production SHA in live `release.json`, then run the existing workflow in `path-preview` mode with the verified production_ref and chosen earlier preview_ref. Never change the production root for rollback.

## Follow-up — Full multiline candidate names in six-column Pipeline (2026-11-15)

Owner rejected the earlier Pipeline visual outcome: test candidate names are long, and truncating at two lines does not match the desired behavior. Approved direction is to allow names to wrap fully and retain exactly six data columns (Candidate, Stage, Interview Round, Match, Experience, Source), excluding Last Activity. The selection checkbox is separate.

- `web/components/bosch-v2-pipeline.module.css` commit `96afc61`: removed two-line clamp, renders the whole name across as many lines as needed, wraps at word boundaries with break-word fallback, and gives Candidate column 34% (formerly 30%) by redistributing width from placeholder columns. All other responsive container-width rules retained.
- `web/tests/responsive-contract.test.ts` commit `9f478e7`: asserts no truncation and no content overflow; maintains the six-column contract.
- No changes to API data, Supabase, Auth/RLS, stage transition controls, Source, Offer or production. The right detail panel was not rebuilt in this specific correction.
- **Visual discrepancy remains:** Reference includes example Round/Match/Experience values that are not in the current Application list API, so the real table correctly renders `—`. Do not invent these values.
- Verify CI on final HEAD and authenticated preview at matching viewport in VI/EN. In particular, confirm long fixture names wrap without overlapping Stage and the row height grows naturally. PR #44 remains Draft. Browser QA, role E2E and preview deployment should be recorded as PENDING until independently confirmed.

Rollback: revert the two scoped CSS/test commits, preserving prior six-column structure; do not force push.

## Follow-up — Pipeline lower alignment and Bosch Sidebar identity (2026-11-15)

Owner supplied screenshots showing the Pipeline Candidates table ending while the right History panel had a separate scrollbar and visually clipped content, and requested that the Bosch logo/sidebar closely match the owner-approved Bosch Enterprise reference.

### Changes committed on Draft PR #44
- `web/components/bosch-v2-pipeline.module.css` `f61cf37`: remove sticky, max-height and independent scroll from the right Candidate Detail rail; use max-content grid rows. The left Candidates table retains its own natural height/pagination, while longer right-side History flows down the document. This does **not** guarantee both unequal-height columns end at the same Y coordinate; stretching the shorter panel merely to align bottoms would introduce blank content.
- `web/tests/responsive-contract.test.ts` `97d249c`: check natural Pipeline page flow and absence of panel clipping.
- `web/components/bosch-v2-shell.module.css` `c90f5f5`, `66de528`: increase desktop identity/sidebar width to 310px, Bosch wordmark display width to 188px, sidebar nav height/icons/spacing and label contrast. Use a compact 245px sidebar on <=1280px and retain the existing 60px icon-only navigation <=760px; fix mobile selector specificity so the logo does not overflow.
- `web/components/workspace.tsx` `1e24ffb`: update logo element's intrinsic dimensions to 188x52 while retaining the same bundled `bosch-inspired-wordmark.svg`. Navigation items and their role gates are unchanged; **do not invent reference-image menu items that lack product routes or permission contracts**.
- `web/tests/responsive-contract.test.ts` `367bf8f`: assert desktop logo/sidebar proportions and responsive width fallbacks.
- No Supabase schema, Auth/RLS, API, Offer workflow, stage transition, data, root production or backup changes.

### QA and caveats
- Code/structural checks committed, but actual signed-in browser rendering at 1920x1080, 1440x900, 768x1024 and 390x844 in both locales remains PENDING until verified on an explicitly deployed PR HEAD. Do not mark visual PASS based solely on source tests.
- **Pipeline height:** The panels remain content-driven: History may extend below the left table; this is intentional, not evidence that the shorter side should be filled with blank whitespace. Check that there is no second scrollbar and action buttons remain reachable on long History records.
- **Sidebar:** Logo is larger on desktop, but 1:1 reference fidelity is not claimed without side-by-side screenshot at the same viewport. Confirm Bosch SVG itself is not clipped, navigation labels fit and topbar controls do not collide.
- Keep PR #44 Draft; do not publish production or clean up legacy code.

Rollback: reviewed revert commits for `f61cf37`, `c90f5f5`, `1e24ffb`, `66de528` and scoped test edits; retain backup branch. Verify live `release.json` before any preview-only deployment.

## Follow-up — Candidate Summary professional icons (2026-11-15)

Owner requested the four Bosch-reference line icons in the selected Candidate Detail's Summary panel on Job Pipeline. Draft PR #44 only.

- `web/components/application-pipeline.tsx` commit `826d84e`: added Lucide `UserRound`, `BriefcaseBusiness`, `Building2`, `GraduationCap` for Experience, Current Role, Company, Education. Kept the existing authorized Application Detail read contract; Education has no verified value in this response and is explicitly shown as `—`, not invented. Both EN/VN labels are supported.
- `web/components/bosch-v2-pipeline.module.css` commit `ebf4cf2`: scoped 17px navy line icons, two-column label/value alignment, compact mobile widths and readable font weight. No global CSS overrides.
- `web/tests/responsive-contract.test.ts` commit `aea4331`: static regression checks for four icons and bilingual Education label.
- Kept stage actions, RLS, backend/API, Interview Progress, History, 6-column list, Source, Offer workflow, production and rollback backup unchanged.

**QA gates:** CI/typecheck and signed-in browser visual QA require verification on final HEAD. Review long candidate names, 390px mobile panel, both languages, data-unavailable states and icon alignment. No production merge or preview-live certification without release evidence.

Rollback: revert only the three commits above on the Draft branch with reviewed revert commits.

## Follow-up — Pipeline detail/table alignment (2026-11-15)

### Verified revision and preview deployment
- Confirmed Draft PR #44 was open/unmerged and its HEAD was `872f1584064bfb1659d8fba805c1008ca267170c` before this fix.
- QA checks #399, Next web checks #372 and the PR Pages build #412 passed on that HEAD. Supabase local browser E2E #290 was skipped.
- Read production `release.json` immediately before preview publishing: production revision `71ff88ebdb68bea9f6456375c4c9d970e11c0379`. Ran Publish ATS Pages #413 from `main`, `mode=path-preview`, that verified production ref and preview ref `872f1584064bfb1659d8fba805c1008ca267170c`. Both workflow jobs succeeded.
- Live `release.json` after publishing continued to report production `71ff88ebdb68bea9f6456375c4c9d970e11c0379`, while `preview.revision` was `872f1584064bfb1659d8fba805c1008ca267170c`. Production was not replaced.
- Authenticated Cloud Browser inspected the preview at its available 1363×936 viewport. Confirmed the six data headers (Candidate, Stage, Interview Round, Match, Experience and Source), no Last Activity, four Candidate Summary facts/icons, and all History entries reachable. No API values were fabricated. An extended selected-candidate panel caused the left table to be pushed far below the summary by the spanning grid rows; this was a P1 layout defect.

### Scoped fix prepared on the PR branch
- `web/components/application-pipeline.tsx`: put the summary and candidates section in one left-column wrapper so the Candidate Detail remains a separate, aligned right rail.
- `web/components/bosch-v2-pipeline.module.css`: use a single stacked left column and a bounded, internally scrollable detail rail on desktop; stack both in normal page flow on narrow screens. This keeps long History reachable without forcing the candidate table below its content height.
- `web/tests/application-pipeline.test.tsx` and `web/tests/responsive-contract.test.ts`: assert the six-column contract and the side-by-side/scroll behavior.
- Validation on the working revision: `npm test` **PASS** (31 node tests + 78 Vitest tests); `npm run typecheck` **PASS**; `npm run build` **PASS**. These local checks do not substitute for live visual verification.
- Change is intended for Draft PR #44 only. After push, record its resulting commit SHA and CI/deployment evidence here; do not merge or deploy production.

### Responsive/locale QA status and rollback
- Actual browser viewport available in this session was 1363×936; the browser provided no supported viewport-resize control. Exact 1920×1080, 1440×900, 768×1024 and 390×844 screenshots are therefore **BLOCKED**, and no PASS is claimed for those sizes. Complete VI/EN checks at all four requested sizes are also **BLOCKED**.
- Admin read-only session only; role-specific TA/HM/Interviewer E2E remains **SKIPPED**, as does Supabase browser E2E. No mutation was submitted.
- Capture the new signed-in preview after publishing the fix before marking the alignment **PASS**. Keep the previous release refs above as rollback evidence; to roll back only this frontend change, revert the scoped commit on the Draft branch and republish the previously verified preview ref through `path-preview`, after rechecking production `release.json`.
