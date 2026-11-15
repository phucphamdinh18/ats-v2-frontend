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
