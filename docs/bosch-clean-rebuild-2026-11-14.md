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
- `web/components/bosch-job-activity.tsx`: new read-only list of applications for the selected Job, with on-demand `applicationDetail` event timeline and actor names. It is an **application timeline**, not a full Job-wide audit log.
- `web/components/bosch-v2-job-detail.module.css`: added isolated responsive card/table/detail pane styles and scroll confinement, preserving compact Bosch visual language.
- `web/components/workspace.tsx`: supplies verified current roles and per-Job stage-edit authority; read permissions are still enforced server-side by current RLS/API. No new REST/RPC/Edge Functions.
- `web/tests/bosch-job-detail.test.tsx`: assertions for requisition fields and missing actual SLA, source metrics/empty state and current-role-only Team & Access.
- **Offer security:** Offer detail/salary remains gated by existing `reviewAllowed` and authorized `offers` API. Team roster, TA PIC, Hiring Manager name, actual SLA, job-wide interview totals, and global Job activity totals are **not available** from current response contract; placeholders or explanations remain rather than fabricated data.
- **Release gate:** complete CI, screenshot-based Visual QA for all Home/Jobs/Job Detail/Candidates/Interviews/Offers and Docker-backed role E2E. Keep PR #44 Draft; no production merge or backend/schema change.


## Step 13 — Preview deployment and full visual QA checkpoint (2026-11-15)

### Phase 1 — Repository and deployment verification
- PR #44 remained **open, Draft, unmerged** at UI commit `ee994841caa10fd2a4472135cecf7fc517d39aef` before this QA checkpoint.
- Verified live production `release.json`: root revision `71ff88ebdb68bea9f6456375c4c9d970e11c0379`. The existing preview was stale at `9d9651eaef26545ff76f710e884d257d91a0c764`.
- Dispatched existing `Publish ATS Pages` workflow #307 in `path-preview` mode with the verified root and PR commit. Build and deploy both completed successfully.
- Cache-busted `release.json` then confirmed production still `71ff88ebdb68bea9f6456375c4c9d970e11c0379` and preview `ee994841caa10fd2a4472135cecf7fc517d39aef`. No production path was changed.
- Related checks on the supplied commit: QA checks #307 success; Next web checks #280 success; Pages PR build #306 success; Supabase local browser E2E #198 **skipped**. The Publish run summary reported 51/51 and 75/75 Vitest assertions across its two test reports. These do not replace live role E2E.

### Phase 2 — Browser visual QA (partial; Cloud Browser viewport 1363 × 936)
Reviewed the live authenticated preview and compared its visible structure/colors against the Bosch references in the project conversation. The browser session exposed only this viewport; requested 1440×900, 1920×1080, 768px and 390px viewport runs were **not performed**.

- **Home — PARTIAL.** Navy topbar, light sidebar, red active state and dashboard summary/pipeline/job/interview panels are present. The screen uses authorized API-derived metrics and explanatory placeholders. Exact target viewport and EN-wide translation were not validated.
- **Jobs Overview — FAIL (P1 layout).** Bosch shell and table composition are present, but the first Job row is visibly drawn underneath/into the table header area in the browser screenshot. The Jobs Master table therefore needs a scoped layout fix and screenshot regression check.
- **Job Detail / Pipeline — PARTIAL / FAIL (P1 fit).** Job header, metadata, section tabs, five-stage summary and right candidate overview render; no Kanban/drag-and-drop was present. At this laptop viewport the candidate table has an internal horizontal scrollbar, while the Bosch reference fits more columns in the visible left pane. Candidate selector was positioned after the pipeline content in the page's accessibility order and appeared low in the screenshot; review its placement. No stage-changing action was submitted.
- **Candidates — FAIL (P1 fit; P2 localization).** Detail pane is positioned at the right without covering the table. The candidate table is wider than its left pane and requires horizontal scrolling; a row/header alignment artifact is visible. With English selected, the candidate page still displayed Vietnamese labels/help text (including the review-queue action and candidate guidance); with Vietnamese selected, several candidate section/title labels remained English.
- **Interviews — PARTIAL / FAIL (P1 fit, P2 localization).** Schedule and selected interview details were visible and the record used test data. The table requires horizontal scrolling at the observed viewport, and the visible table header/first-row area needs alignment review. User-local time zone and interview details rendered. Not all labels were checked in both languages.
- **Offers — FAIL (P1 functional/API state; P2 localization).** The Offer list showed an error (“Không xử lý được yêu cầu”) for the selected test Job and no Offer records. With English selected, the error remained Vietnamese. Do not infer whether the cause is frontend request construction, API authorization or service response until the request/response is inspected in a safe test environment; no compensation/approval data was exposed in this run.
- **Shell localization — FAIL (P2).** The language selector changed the shell and several headings, but some helper/action text stayed in the previous language. Admin screen also showed mixed English and Vietnamese. Translation coverage is not complete.
- User-provided reference image comparisons were visual/qualitative only; no pixel-perfect or image-diff claim is made. Browser screenshots were inspected live; no image files were committed.

### Phase 3 — Functional and role E2E (BLOCKED / PARTIAL)
- Read-only browsing was performed using the already signed-in `phuc.phamdinh18@gmail.com` session; the visible Administration module indicates admin workspace access. Existing test-labeled records were read only.
- Job list, Job Pipeline candidate list, candidate details/CV placeholder, scheduled interview and Offer error state were inspected. No new candidate, interview, Offer or stage change was submitted; no production data was intentionally changed.
- Login/logout, request retry with the same `request_id`, search result assertions, pagination beyond the first page, stage transitions, API 401/403 behavior and stale sensitive-detail clearing were not run end-to-end in this browser session.
- TA Recruiter, Hiring Manager and Interviewer sessions were unavailable. Their role tests are **SKIPPED**, not Passed. Supabase local Docker/browser E2E was skipped in CI. API response details for the live Offer error remain unverified.

### Phase 4 — Fixes and release disposition
- No code fix was committed in this checkpoint: the available local checkout is at `5b18ab6d2d502fe3c09a76a58c8c83b9de99b09e`, contains pre-existing uncommitted changes, and is not the deployed PR HEAD. It was left untouched to avoid overwriting unrelated work or testing/editing a different revision.
- Keep PR #44 Draft and do not merge. Do not delete legacy UI or the backup branch. Current live preview stays on the verified `ee9948…` UI commit; production stays on `71ff88…`.
- **Next required work before acceptance:** get a clean checkout of the current PR HEAD; reproduce/fix the Jobs/Candidates/Interviews table alignment and laptop fit; complete EN/VN string coverage; inspect the Offers request/error against a safe test backend; then rerun existing CI and screenshots. Run role E2E only with designated test accounts and local/test data. Repeat screenshots at all requested viewport sizes using a viewport-capable runner.

### Phase 5 — Acceptance status
| Module | Status | Reason |
|---|---|---|
| Home Dashboard | PARTIAL | Structure present; full viewport/localization QA incomplete |
| Jobs Overview | FAIL | Visible Job row/table header overlap |
| Job Detail / Pipeline | PARTIAL / FAIL | Core read-only layout present; table overflows at laptop width |
| Candidates | FAIL | Table overflow/alignment artifact; mixed VN/EN strings |
| Interviews | PARTIAL / FAIL | Table fit/alignment and bilingual coverage incomplete |
| Offers | FAIL | Live API request returns generic error; localized message incorrect for English |
| Role E2E (Admin/TA/HM/Interviewer) | BLOCKED | Only one existing session; local E2E skipped; other test identities unavailable |

Rollback remains the documented path: keep production root at `71ff88ebdb68bea9f6456375c4c9d970e11c0379`; a preview-only rollback can rerun the existing `Publish ATS Pages` workflow with the verified previous preview SHA, after checking `release.json` and preserving the current preview SHA for recovery.


## Step 14 — Scoped Bosch table header regression fix (2026-11-15)
- Root cause of the observed row/header collision: legacy `globals.css` applies `th { position: sticky; top: 68px; z-index: 1 }`; the horizontally scrollable module tables create their own scroll container. Pipeline already resets its header positioning, but Jobs, Candidates, Interviews and Offers did not.
- Added scoped static header positioning (`position: static; top: auto; z-index: auto`) to the table header rules in:
  - `web/components/bosch-v2-jobs.module.css`
  - `web/components/bosch-v2-candidates.module.css`
  - `web/components/bosch-v2-interviews.module.css`
  - `web/components/bosch-v2-offers.module.css`
- No table data, API calls, authorization, workflow, backend, Supabase or production code changed.
- This is a targeted frontend fix for the observed P1 table header artifact. **The fix is not accepted until CI passes and the updated preview is checked visually.** Remaining issues from Step 13 (Candidates/Interviews table width, missing VN/EN strings, Offers API error, role E2E, viewport matrix) remain open pending re-test.
- Branch backup retained; PR #44 remains Draft.

## Step 15 — Product-owner priority decision: frontend first; Offer workflow deferred (2026-11-15)

**Decision owner:** ATS V2 product owner. **Status:** agreed prioritization; this note supersedes the *execution priority* of Offers in Steps 13–14, but does not invalidate the recorded QA findings.

### Scope NOW — frontend stabilization before acceptance
1. Complete bilingual VN/EN coverage in Home, Jobs Overview, Job Detail / Hiring Pipeline, Candidates, Interviews and common App Shell (including labels, validation/errors and empty states). Offers is excluded from the current feature-completion scope.
2. Fix responsive behavior, visual alignment and safe table scrolling for the above modules. Check 1440×900, 1920×1080, 768px and 390px and compare with the approved Bosch references.
3. Verify navigation, search, pagination, Candidate Detail, Add to Job, Job stage transitions, invalid-session/403 clearing and idempotent retry using **authorized test accounts and synthetic data**. Record PASS/FAIL/SKIPPED separately for Admin, assigned TA, HM and Interviewer; do not infer a PASS from CI alone.
4. Use the existing Draft PR #44 and isolated preview. Keep production, backend migrations, RLS and permission model unchanged. Avoid repeated unnecessary CI runs and paid infrastructure.
5. Record screenshots, defects, CI results, outstanding gaps and rollback at every accepted milestone.

### Scope LATER — Offers (explicitly DEFERRED)
- Do **not** spend current frontend iteration time designing/implementing new Offer creation, approval, sending, response, withdrawal, expiry, compensation editor, templates, approver management or unrelated analytics. Do not fabricate Offer records or status counts.
- Keep the existing Offers code and tabs intact for later integration; no deletion, forced mock success, hardcoded empty fallback or disabling security checks to hide the current error.
- The current Offers list error (`Không xử lý được yêu cầu.`) remains **OPEN / NOT ACCEPTED**, not automatically classified as a frontend defect.
- Backend contains Offer SQL/Edge Function logic, but the backend `docs/test-deployment-drift-2026-11-12.md` records that `list_offer_proposals`, `get_offer_proposal_detail`, `send_offer`, `record_offer_response`, `withdraw_offer` and `expire_due_offers` were absent from the checked TEST environment on 2026-11-12. This is historical deployment evidence, **not confirmation of the current live database state**. Check migration history, actual RPC presence and safe request/response before attributing any subsequent Offers error or deploying a selective migration.
- Reopen Offers **after** the other frontend modules satisfy their agreed visual/functional QA gates and the product owner resumes the Offer workflow. Then verify backend deployment, RLS/role E2E, idempotency and Offer state transitions before building Offer action UI.

### Release / acceptance implications
- **No global ATS V2 acceptance or production merge while critical functionality/security checks remain incomplete.** Modules other than Offers may be marked independently PASS after the evidence-based test matrix, but Offers remains DEFERRED / FAIL (unresolved API) and must be explicitly excluded from any limited-scope milestone.
- PR #44 remains Draft. No production deploy; retain the rollback/backup branch.
- **Next task:** audit and fix VN/EN strings across non-Offer modules, then responsive layout, then visual and role-based functional QA.


## Step 16 — Frontend VN/EN stabilization, Offers deferred (2026-11-15)

**Owner priority:** complete frontend i18n and responsive/visual QA for Home, Jobs, Job Detail, Candidates, Interviews and shared App Shell. **Offer workflow and Offer UI implementation remain deferred** under Step 15.

### Code applied on PR #44
- `web/components/talent-pool.tsx`: Candidate Database headings, list columns, search, CV review entry, profile information, source selection, Add to Job and confirmation/success/fallback copy use the selected locale. This is presentation-only; the authorized candidate read API, source catalog, Add to Job validation and idempotent `request_id` are unchanged.
- `web/components/bosch-module-layout.tsx`: localized Candidates/Interviews headings, breadcrumbs, descriptions and non-interactive availability tab labels. Offers component/frame is intentionally unchanged.
- `web/components/interview-worklist.tsx`: localized worklist loading and generic network fallback; status filters/details were already bilingual.
- `web/components/bosch-job-detail.tsx`, `web/components/bosch-job-activity.tsx`, `web/components/bosch-job-interviews.tsx`: localized requisition header, status, buttons, tab names, table labels, empty states, date presentation and Interview status labels. No modification to Pipeline stage transitions or permissions.
- `web/components/workspace.tsx`: localized common App Shell sidebar headings, guide accessibility labels, sidebar expand/collapse labels, and local test login copy. Existing Auth and session controls stay intact.
- `web/tests/bosch-candidates-layout.test.tsx`, `web/tests/interview-worklist.test.tsx`, `web/tests/bosch-job-detail.test.tsx`: updated Vietnamese-default test expectations and added VI→EN render-switch assertions without changing data or invoking business mutations.

### Known limitations / acceptance gates
- Backend error bodies currently provide arbitrary Vietnamese strings without a machine-readable locale-independent message code. The client retains these backend messages rather than guessing translations or concealing errors. Exact EN localization of backend errors requires a separate verified API contract, not a risky frontend-only string replacement.
- Admin Console and additional older components may contain untranslated text beyond this core module scope. A browser-based bilingual sweep is still required to locate and log every visible remainder.
- Offers remains deferred and unresolved. No migration, Edge Function, database, RLS or production changes were made.
- **Not yet accepted:** check both locales with 1440×900, 1920×1080, 768px and 390px viewport screenshots; verify visual fit; run local/test role-based E2E for Admin, TA, HM and Interviewer. Unit tests and Next CI do not substitute for browser E2E or visual acceptance.
- Keep Draft PR #44, branch backup and production root unchanged. Next: responsive table/layout corrections in non-Offer modules, then viewport-based Visual QA and E2E.


## Step 17 — Candidates, Interviews and Job Detail responsive stabilization (2026-11-15)

**Owner request:** eliminate laptop table crowding while retaining usable mobile behavior; verify four viewport sizes: `1440×900`, `1920×1080`, `768px`, `390px`. Offers remains **DEFERRED** (Step 15).

### Implemented on Draft PR #44
- Existing branch commits `c5e0a29`, `1c4c5c9`, `dcf958e` and `eaf592f` already added base responsive behavior to Candidate Database, Interview Schedule, Application Pipeline and Job Detail. This iteration **preserved those changes**, rather than rewriting them.
- `web/components/bosch-v2-candidates.module.css`: use `container-type: inline-size` on the table panel and collapse the five placeholder-only columns when **actual list-pane width <=1250px**, even at large desktop viewport widths. Preserve Candidate, current position/company and experience; further reduce columns on a narrow phone.
- `web/components/bosch-v2-interviews.module.css`: use actual pane width <=850px to collapse Type and Feedback columns (the real values remain in Interview Details). Retain Candidate, Job and start date; preserve read-only schedule and status filters.
- `web/components/bosch-v2-pipeline.module.css`: collapse only unavailable placeholder Application fields by pane width <=1250px. Preserve actual Candidate, Stage and Source values, and show Source in the detail area when the phone table is narrower than 440px.
- `web/components/bosch-v2-job-detail.module.css`: enforce scroll containment on Job tab bar and audit/requisition tables, keyboard focus visibility, stacked detail cards on tablet and safe Job switching on phone.
- Added `web/tests/responsive-contract.test.ts` structural assertions for container queries, table overflow boundaries and four target breakpoint widths. No API, Supabase, RLS, migrations, Offers workflow or production files were modified.

### Verification and limits
- Ran **local Chromium synthetic layout fixture** at `1440×900`, `1920×1080`, `768×900`, and `390×844` for representative Candidates, Interviews and Pipeline split-pane structures with the new responsive rules: document horizontal overflow **false** for all 12 combinations; detail pane stacked beneath table at 768px and 390px, side-by-side at 1440px and 1920px. Visible table columns by viewport were Candidates **4/4/4/3**, Interviews **3/5/3/3**, Pipeline **4/4/4/3** respectively (ordered 1440/1920/768/390). These are **fixture results only**, not screenshots of the live authenticated Next.js ATS.
- **Browser-backed preview Visual QA is NOT complete.** The browser connector is unavailable outside its originating browser context, and the available container cannot reach the GitHub Pages preview domain. This iteration therefore cannot truthfully certify actual signed-in page rendering, layout screenshots, or pixel comparison at any requested viewport. Record as `SKIPPED / BLOCKED` until an authenticated preview browser with viewport controls is available.
- Confirm CI status on the final HEAD (QA/Next/Pages) before approval. Browser role-based E2E remains `SKIPPED` until test identities and a suitable test backend are available.
- **Rollback:** revert only the scoped responsive CSS and structural test commits on `redesign/bosch-enterprise-v2`, retaining the preexisting responsive commits and documented backup. Do not merge or modify production to test.


## Step 18 — Live authenticated responsive QA and Interview table fix (2026-11-15)

### Version and deployment
- Verified Draft PR #44 was open and unmerged; the responsive UI commit under test was `9bf2c948d35f329c69ae4bce6ec58c729352a8aa`. QA checks, Next web checks and PR Pages build passed; Supabase local browser E2E was skipped.
- Verified `release.json` before publishing: production root remained `71ff88ebdb68bea9f6456375c4c9d970e11c0379`, preview was `9bf2c948d35f329c69ae4bce6ec58c729352a8aa`.
- Live browser QA found and fixed an Interview Schedule table overflow. CSS fix commit: `ca9640c5918680dd0ed71d70d07312b010bd6725` (`web/components/bosch-v2-interviews.module.css`). Preview workflow #345 completed successfully with mode `path-preview`, the same production ref, and preview ref `ca9640c5918680dd0ed71d70d07312b010bd6725`. Verified `release.json` afterward; production ref was unchanged and preview ref matched the fix commit.
- CI for the fix commit: QA checks **success** (#342), Next web checks **success** (#315), PR Pages build **success** (#344); Supabase local browser E2E **skipped** (#233). Manual preview build/deploy **success** (#345).

### Browser observations (authenticated Admin; current available viewport 1363×936)
- **Candidates:** loaded eight authorized profiles; search returned the matching test candidate after debounce; candidate detail displayed CV/document, assigned Job and Add to Job controls. No add or other write was submitted. No page-wide horizontal overflow was measured at this viewport (document width 1348px).
- **Interviews:** one scheduled test-only appointment loaded with its schedule details and interviewer panel; switching to Completed showed the empty state and switching back restored Scheduled. Before the CSS fix, long candidate and Job labels visibly overlapped adjacent columns. After deploying `ca9640c`, both labels wrapped within their cells; measured candidate button right edge was 467.6px and next cell began at 477.6px (no overlap). Document width was 1348px at 1363px viewport.
- **Job Detail / Pipeline:** opened the test Job, saw all seven Job tabs and the New/Screening/Interview/Offer/Hired summary plus Candidate/Stage/Source table. Candidate detail opened in the side panel. Switching to the second test Job cleared the previous candidate detail and loaded that Job's own count/data; switching back restored the first Job's data. The table uses its own horizontal scroll at this width; page document width remained 1348px. No stage or candidate mutation was made.
- **Language:** switched between VI and EN on Candidates, Interviews and Job Detail. Main page controls/headings and workflow stages translated. In Vietnamese, API enum/participant values such as `INTERVIEW` and `INTERVIEWER`, and source names, remain English; record as a minor localization limitation for a later bilingual sweep.
- Captured live browser screenshots for Candidates, Interviews before/after the fix, and Job Detail/Pipeline at 1363×936 in the QA conversation. These are not screenshots at the requested target viewports.

### Acceptance status and limits
- Chrome displayed **“DevTools not allowed on this page — Your organization has blocked the use of DevTools on this page.”** The browser surface has no viewport setter, and the available display is only 1363px wide. Therefore exact visual QA at 1920×1080, 1440×900, 768×1024 and 390×844 was **BLOCKED**. No fixture result was substituted; screenshots above document only the live 1363×936 view.
- Role testing was limited to the authorized Admin session. TA, Hiring Manager and Interviewer permission checks, API 401/403, responsive target matrix, and mutations/add-candidate flow remain **SKIPPED**. No real recruiting record was changed.
- The Interviews overlap is fixed and verified at the available width, but all three modules remain **not accepted** against the full responsive criteria until the requested viewport matrix and role E2E are run in a browser with viewport controls and the matching test roles.
- **Rollback:** revert commit `ca9640c5918680dd0ed71d70d07312b010bd6725` on `redesign/bosch-enterprise-v2` to remove only the Interview cell wrapping override. Preview can be republished from the prior preview ref; do not change production root. PR #44 remains draft and unmerged; backup branch is untouched.


## Follow-up UI fixes — candidate source fields and shell title (2026-11-15)

- Fixed the Bosch shell wordmark clipping: reduced only the identity area's internal gap/padding and ATS V2 label size; retained the 235px sidebar and full Bosch logo.
- Candidates now show **Source** and **Sub-source** from the newest application the signed-in user is allowed to read. These values are application-specific; the table labels them as latest to avoid implying that one source belongs permanently to a candidate.
- The source lookup reads only `applications` through the existing authenticated Supabase client and existing RLS. The current policy allows Admin to read all applications and TA/Recruiter or Hiring Manager only applications for Jobs where they have the corresponding assignment; no service key, API, schema, policy, or backend changes were made. The Candidate directory itself remains Admin/TA scoped by the existing list API.
- When source lookup fails, the UI shows a localized notice and does not invent attribution. At small widths, source fields remain available; only unavailable/placeholder fields are hidden.
- Language labels for Source/Sub-source and the latest attribution hint support Vietnamese and English.
- Code commits: shell fix `ae02e1539e1db8adb4afa3a1927d10c4b31a2511`; candidate attribution `b287dd2482d702d3a3f8367eacf0d09828b0acb0`; table styling `704f9867ef608feeedcc03d883ac07c559c8b0c9`; narrow-pane visibility correction `bed99ab178b1b21a292955c1489b1ec86e40e1df`; updated the existing responsive contract test at `13ce1aa0e143679f519d9da16aee72c00baed89e` to keep Source and Sub-source visible.
- CI attempt at `df7a0a3...` failed the existing responsive contract because it expected the old ninth column to be hidden. The current test expectation was updated, and CI is rerunning on `13ce1aa...`. QA checks passed; Supabase local browser E2E was skipped. Confirm rerun results before claiming green.
- Preview has not yet been redeployed or visually rechecked for these source/branding fixes. Production was not touched; PR #44 remains unmerged. Do not claim responsive/browser acceptance until preview screenshots are checked.


## Step 18 — Jobs Overview typography contrast correction against owner screenshots (2026-11-15)

- Owner compared **actual Jobs Preview (image 1)** against **approved Bosch visual reference (image 2)** and reported overly small/light text in the actual Jobs table and right-side Job Snapshot.
- Verified cause in `web/components/bosch-v2-jobs.module.css`: actual table used 11px text with 10px header and metadata; Job Snapshot fact grid used 11px; secondary text was light gray `#768598`. Display zoom/screenshot scaling may additionally affect apparent text size but was not independently measured.
- Made **Jobs-only** typography changes: table body 12px, header 11px, Job link 12px, secondary metadata 11px with stronger contrast, status/action labels 11–12px, Job Snapshot fact grid 12px with clearer primary/secondary hierarchy. Preserved the approved light theme, functional tables/columns, data, priority/source values and existing responsive breakpoints.
- Scope: CSS-only; **no Supabase, API, RLS, backend, Candidates, Interviews, Job Detail or Offers workflow changes**.
- Not yet browser-accepted: verify actual signed-in preview at the same browser zoom (100%) and identical viewport against the Bosch reference. In particular, confirm Jobs table headers do not wrap or overflow and the snapshot labels remain legible. Keep PR #44 Draft and production unchanged.


## Follow-up: Candidate table headers and source attribution — 2026-11-15

- Live path-preview review at `60bd38b4d2e881c32ba359d098f66f2648dca785` confirmed the Bosch ATS V2 wordmark is fully visible and the Candidates table includes Source and Sub-source.
- The laptop screenshot showed `Current Job / Company` and `Experience` headings running together because table headers were forced to one line in a fixed-width table. Updated the Candidates module CSS to wrap headings within their cells (`white-space: normal`, compact line-height, safe wrapping).
- Source/Sub-source are application-level attribution fields read through the existing authenticated Supabase client and current RLS. Existing applications with no `sub_source` continue to show an empty marker; no inferred values or backend changes were added. The shared source catalog remains the source for selectable source/sub-source options.
- Fix commit: `6dc1409252a3ea6d8ac8e486c7c6834d4d679bae`. Preview deployment and post-fix browser verification are pending.

## Follow-up — Cross-module typography and contrast pass (2026-11-15)

**Scope:** Owner instructed fixing readability across the entire active ATS V2 frontend, not only Home. Continued on Draft PR #44; no production merge/deploy. Offer feature implementation remains explicitly deferred per Step 15.

### CSS changes committed
- Shell: `web/components/bosch-v2-shell.module.css` — `bc0ba2f`
- Home: `web/components/bosch-home-dashboard.module.css` — `5ae0183`
- Jobs Overview: `web/components/bosch-v2-jobs.module.css` — `7fc93a6`
- Job Detail: `web/components/bosch-v2-job-detail.module.css` — `3c4b229`
- Pipeline: `web/components/bosch-v2-pipeline.module.css` — `4d31b9c`
- Candidates: `web/components/bosch-v2-candidates.module.css` — `a4677e5`
- Interviews: `web/components/bosch-v2-interviews.module.css` — `e086cb0`
- Candidate Intake: `web/components/bosch-v2-candidate-intake.module.css` — `53cb5e1`

Adjusted only scoped small text rules: 9px to 11px, 10px to 11px, 11px to 12px. Darkened selected pale-gray metadata labels to #526174. Existing component markup, responsive breakpoints/container queries, table columns, Source/Sub-source, roles, API calls, data mapping, Auth, RLS, backend and Offer workflow were not changed. No new global CSS overrides were introduced.

### Verification / acceptance
- CSS changes committed on PR branch. Static source inspection before write verified these are component-scoped CSS files; no runtime browser or role E2E verification performed in this pass.
- CI status on final documentation HEAD: NOT YET CONFIRMED. Check QA checks, Next web checks and PR Pages build; Supabase local E2E must be reported SKIPPED if it does not run.
- Preview revision: NOT VERIFIED/NOT PUBLISHED by this pass. Never infer that public /preview/ contains the new styles from PR commits alone.
- Browser visual QA at 1440x900, 1920x1080, 768px and 390px, both VI/EN: PENDING. Specifically verify table/header wrapping, Jobs Snapshot, Candidate Source/Sub-source columns and mobile panes after the typography increase.
- Admin/assigned TA/HM/Interviewer functional E2E: PENDING. Do not mark PASS without recorded evidence.
- **No production acceptance or cleanup.** Keep PR #44 Draft and preserve backup branch `backup/bosch-pr44-before-clean-rebuild-20261114`.

### Rollback
For a scoped rollback, revert only the eight CSS commits above in reverse order, or restore their prior blob versions by reviewed changes on PR #44. Do not force-push or change production. Verify the exact preview and root SHAs using live `release.json` before any later deployment.

## Follow-up — Stronger type weight across Bosch V2 (2026-11-15)

Owner requested **bolder text** on all active frontend modules following the prior cross-module font-size/contrast pass. Scope is presentational only, on Draft PR #44; production unchanged and Offers feature workflow remains deferred.

- App Shell `9c211f7`
- Home Dashboard `836eb04`
- Jobs Overview `c12f018`
- Job Detail `7d3c9b6`
- Hiring Pipeline `3da6dda`
- Candidates `c3151d2`
- Interviews `3db80a1`
- Candidate Intake `31c50f3`

Changes are component-scoped: primary table data weight 600 where applicable; secondary labels/hints weight 600 with readable gray; selected facts and key labels 750. Form fields use 500. Existing semantic status treatments and primary headings stay prominent. No markup, business logic, Source/Sub-source mapping, responsive breakpoints, API, RLS, database, Auth or Offer workflows changed. Do not add global CSS overrides.

**Verification:** GitHub source edits committed; no signed-in browser screenshots, full viewport matrix, role E2E or final CI acceptance is asserted. Check source commit and successful deployment marker before visual QA. Test at 1440x900, 1920x1080, 768px and 390px, VI/EN; look for clipping/overlap on dense tables. Keep PR Draft, production and backup untouched. Rollback by reverting these eight scoped CSS commits in reverse order, without force-pushing.


## Step 19 — Cross-frontend typography and responsive overflow QA (2026-11-15)

### Version, CI and preview
- Typography pass verified in the PR branch across the eight scoped CSS Modules (see “Follow-up — Stronger type weight across Bosch V2”); original user commit: `4dda96a746b8eea5eee407652624bc79958b974d`.
- Subsequent frontend-only fixes on PR #44: `a8c43aa` (Candidate name/link wrapping), `1c5be62` (Source/Sub-source wrapping), `3a0a4ac` (hide crowded top navigation at tablet widths), `f2691c8` (responsive Jobs columns), and `b69dbdd` (Pipeline Source wrapping).
- HEAD verified before publish: `b69dbdd599d0c013594da7113f086e06d084a7d3`. PR #44 remains Draft and unmerged.
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

### Live inspection of the first layout fix (authenticated Admin, 1363×936)
- Published `e4da0e949da5ad4e4c3cbf8cfba37af969828fea` with successful manual Pages run #417. `release.json` verified production remains `71ff88ebdb68bea9f6456375c4c9d970e11c0379` and preview revision is `e4da0e949da5ad4e4c3cbf8cfba37af969828fea`.
- Opened the TEST ONLY Job in the live Preview, selected the TEST ONLY Drag Retry candidate, and captured the Pipeline with right Candidate Detail. On the rendered page, the six-data-column table stayed beside the right panel as the panel grew; no empty grid gap was introduced. Candidate Summary showed the four icons/labels and missing API fields as `—`; the History list exposed all three existing events in the accessibility tree. This inspection submitted no mutations.
- The first live capture also showed the panel could extend below the viewport because its `100vh - 24px` maximum ignored the Job header above the Pipeline. A follow-up CSS-only adjustment and regression assertion are now in the branch (`web/components/bosch-v2-pipeline.module.css`, `web/tests/responsive-contract.test.ts`): desktop detail height is bounded by the remaining workspace height, and small screens still use normal stacked flow. Local tests (31 node + 78 Vitest), typecheck and static build passed again after this adjustment.
- Recheck this final height adjustment on the deployed final HEAD before describing History scrolling as visually passing. The exact four requested viewport sizes and full bilingual matrix remain BLOCKED by the 1363×936 Cloud Browser limit; there are no screenshots at those exact dimensions.
- Branch update after the main wrapper fix and viewport-height follow-up: responsive CSS/test commit `992336b8cf7c7679145e0223ef0ec6dcbe57e758`. The subsequent documentation commit is the final PR head for this pass; verify the live PR head and CI before preview deployment. Supabase browser E2E remains SKIPPED. Production, backend, Auth/RLS/API and recruitment data remain unchanged.

## Final follow-up — Pipeline panel viewport correction and live verification (2026-11-15)

### Preview and CI
- PR #44 remains open, Draft, and unmerged. Before the docs-only closeout below, the final UI code revision was `a561e18f1859d10fbb33cb6def4e859f71cfaeb8`.
- Read live `release.json` before deploy: production `71ff88ebdb68bea9f6456375c4c9d970e11c0379`; currently published preview was `e4da0e949da5ad4e4c3cbf8cfba37af969828fea`.
- Publish ATS Pages manual run #420 succeeded from `main`, mode `path-preview`, using that verified production ref and UI preview ref `a561e18f1859d10fbb33cb6def4e859f71cfaeb8`. Run: https://github.com/phucphamdinh18/ats-v2-frontend/actions/runs/43702307371
- Post-deploy live `release.json` confirmed production remained `71ff88ebdb68bea9f6456375c4c9d970e11c0379` and preview revision became `a561e18f1859d10fbb33cb6def4e859f71cfaeb8`.
- CI on that UI revision: QA checks #404 **success**; Next web checks #377 **success**; PR Pages build #419 **success**; Supabase local browser E2E #295 **skipped**.
- Additional local verification after the CSS height fix: 31 Node tests + 78 Vitest tests **passed**, typecheck **passed**, static build **passed**.

### Signed-in Preview inspection (Admin, 1363×936 only)
- Opened the deployed Preview as `phuc.phamdinh18@gmail.com`, opened the TEST ONLY Job and selected TEST ONLY Drag Retry Fixture. No data mutation was submitted.
- **Pipeline layout — PASS at this observed viewport:** the Candidates table and selected-candidate rail remain side by side; the detail rail fits the workspace area instead of extending beyond the page. The panel scrolls internally, and scrolling to its end reveals all three existing History entries and the stage action. Four Summary icon rows (Experience, Current role, Company, Education) are present. Missing API values remain `—`; no fake data was added.
- **Shell spot check — PASS at this viewport:** Bosch/ATS V2 wordmark is fully visible, navy topbar and light sidebar render, active navigation is red, and labels are readable.
- Switched the same view VI → EN. Navigation, Job Detail labels, Pipeline labels, Candidate Summary and History changed language. A complete bilingual sweep of every module was not performed.
- On the available narrow left content pane, responsive CSS shows Candidate, Stage and Source; Round, Match and Experience columns are hidden at this pane width, while Last Activity remains removed. This is the current compact layout behavior; exact wider desktop and mobile behavior still needs screenshots at supported target viewports.

### Viewport/role results and verdict
- Actual available browser viewport: **1363×936**. Exact-size live screenshots for 1920×1080, 1440×900, 768×1024 and 390×844 remain **BLOCKED**; do not infer their visual result from CSS.
- VI/EN was spot-checked on the Job Detail/Pipeline at 1363×936; full six-module bilingual coverage is **PARTIAL**.
- Admin authenticated read-only Pipeline inspection: **PASS** for the checks above. TA, HM and Interviewer E2E, API 401/403, mutation/retry, and Supabase local E2E: **SKIPPED/BLOCKED**. No real recruitment records were changed.
- Overall ATS acceptance remains **BLOCKED**. This pass only certifies the observed Pipeline and Shell behavior at 1363×936; it does not certify pixel-perfect Bosch fidelity or the requested viewport matrix.

### Rollback
- Revert the scoped Pipeline wrapper/height CSS and responsive test commits on the Draft branch with reviewed revert commits if needed. Keep backup branch `backup/bosch-pr44-before-clean-rebuild-20261114` at `938dc56382d5d48b6203786a437b20c496409873`.
- To restore an earlier Preview, first read live `release.json`, preserve its current production revision as `production_ref`, then run the existing `path-preview` workflow with the chosen earlier `preview_ref`. Do not change the production root.
