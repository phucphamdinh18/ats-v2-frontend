# ATS V2 — Frontend Replacement Contract (approved visual reference)

## Status
**PR #44 is NOT accepted.** The prior CSS-overrides strategy is rejected. All screenshot comparisons must use the original approved Bosch Enterprise images supplied by the owner. Do not treat CI green as visual acceptance.

## Scope
Replace the entire rendered frontend presentation layer, including:
- fixed dark navy top bar, Bosch-inspired identity block, compact sidebar
- typography, font scale, weights, icon set, spacing, buttons, inputs, status pills
- Jobs overview and Job detail with one continuous, compact 5-stage pipeline summary
- compact, sortable/searchable/paginated candidate table
- contextual candidate detail right panel, tabs, structured profile and interview progress
- independent Candidates, Interviews and Offers modules using the same design system
- error/empty/loading states, Vietnamese/English support and responsive layout
- real Interview records, and only permitted Offer fields (never invent confidential figures)

Do **not** reuse old page composition with a new CSS skin. No giant cards, oversized introductory headings, purple/indigo actions, instructional cards, or artificial whitespace.

## Unchanged contracts
- PostgreSQL/schema/migrations and Supabase Auth/RLS unchanged
- Edge Functions/API payloads unchanged
- stages, transitions, assignments, interview schedule/feedback, Offer/approval and request_id idempotency unchanged
- preserve global & per-job authorisation, token refresh/logout, RLS-scoped data, error handling and duplicate protection
- frontend only uses public publishable/anon key
- no production data used for visual fixtures, no new paid services

## Architecture
Create a **new presentation component tree**, rather than continuing to patch the current `workspace.tsx` shell. Extract existing API and business handlers into reusable hooks/adapters **without changing their semantics**; use the new view components as consumers. Data → permissions → handlers → UI. Keep the previous frontend and build references available only for rollback until sign-off.

## Required acceptance before merge/cleanup
1. Screenshot comparison at identical viewport against each owner-approved image: Jobs/Pipeline, Candidates, Interviews, Offers; review typography/layout/spacing, NOT just palette.
2. Real working controls: navigation, Job selection, search, filters, pagination, row selection, details, stage moves, multi-round interview, offer permissions.
3. Automated tests: component tests + CI build/typecheck + scoped Admin/TA/HM/Interviewer end-to-end tests against disposable TEST DB.
4. No backend/schema/RLS/API diff. No accidental write operations in read-only pages.
5. Confirm deployed root `production_ref`; publish to `/preview/` only. Verify `release.json` points to the exact new commit, and capture browser screenshots.
6. Explicit user acceptance before merge, production deploy, or deletion of old UI/branches.
7. Rollback documented with verified prior production ref.

## Non-acceptance
A green CI run or a screenshot that merely resembles the approved color scheme is **not** completion. PR #44 must remain Draft until complete visual/functional QA.

## 2026-11-14 — Jobs Master replacement, PR #44

- User screenshot confirmed `Job Openings → Bảng Master` was still rendered from the legacy dashboard-like layout.
- Replaced the legacy master view with `web/components/bosch-jobs-master.tsx`, an independent compact enterprise table and four-cell summary. Removed oversized cards, 1.1/1.2 master tabs from visible navigation, multi-line numbered field headers and old action presentation.
- Job table displays only previously authorized `access.jobs`: title, ID, BU, location, status, actual backend metrics, priority and Pipeline action. Search/status remain frontend filters. Clicking Job ID or Pipeline opens the independent Bosch Job Detail; stage logic is not touched.
- Backend schema, RLS, Edge Functions, APIs, request IDs, interview/offer approval logic are unchanged.
- Release safeguards: do not merge/destroy old code until signed-off screenshot QA; CI run after the last change must pass, Supabase E2E and authenticated browser visual QA remain separate required gates. Green PR build does **not** automatically publish `/preview/`.
- Production root source SHA is not yet independently confirmed from live `release.json`; do not dispatch `path-preview` using a guessed default `production_ref`.


## 2026-11-14 — Legacy UI contamination: confirmed root cause

**Owner rejected live preview screenshots after deploy of PR #44. Full visual replacement has NOT been achieved.**

Code inspection of `web/app/globals.css` at PR head `f703ef545aa0916560c2c74d147882149a302584`:
- 3,113 lines, ~128,250 characters in one global stylesheet.
- 527 occurrences of `.shell` and 303 occurrences of `.bosch`; the new Bosch presentation layer appends selector overrides to legacy global CSS rather than replacing it.
- Existing `workspace.tsx` is still ~812 lines and imports old `ApplicationPipeline` and `TalentPool`, as well as new Bosch components.
- Screenshot shows clipped brand, weak typography hierarchy, excessive sidebar space and incorrect Job Master table structure compared with approved reference.

### Binding remediation (do not solve with another CSS override)
1. Create new isolated layout/CSS design system under a dedicated Bosch namespace; no inheritance of legacy shell visual classes.
2. Extract/reuse only network/auth/permission/transition handlers from the old UI without altering their public contracts. Preserve existing status/stage keys and workflows.
3. Replace rendered UI from app shell through Jobs Master, Job ID, Candidate list/detail, Interview, Offer with independent components.
4. Bring over all functional controls and error/loading/empty states; do not render inert navigation or fabricate matching/round metrics.
5. Regression test then screenshot compare at matched viewport; review alignment, typography, borders, colors, data density and responsive behavior.
6. Remove unused legacy CSS/components **only after** the replacement is exercised end to end. Keep Git tag/commit for rollback, do not touch backend migrations or live DB.
7. No merge, production deploy, cleanup or 100% fidelity assertion before owner approves actual screenshots.

**Current implementation: NOT accepted.** Previous CI passes prove builds/tests only.
