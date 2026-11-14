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
