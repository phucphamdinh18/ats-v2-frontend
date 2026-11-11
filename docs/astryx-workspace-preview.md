# Approved light design applied to the ATS preview

The actual ATS workspace now uses the visual direction approved in the isolated Astryx Master and Pipeline demo. Shared colors, navigation, controls, tables, candidate cards and forms are scoped in web/app/workspace-theme.css. The independent mock route remains available for comparison.

## Screens

- Light Google sign-in and loading state.
- Sidebar, topbar, quick search, language control, role badges and help.
- Master with Bento metrics and five grouped columns. Level/priority moved into the identity cell; status and SLA share a cell. Existing data fields remain available.
- Pipeline with Job selector, quiet stage colors, initials from candidate names, source footer and a non-modal detail drawer. Escape dismisses the drawer. Existing stage guards, confirmations, retry request IDs and API calls remain in place.
- Talent Pool list/profile, CV review, JD review, Admin Job forms and Job membership forms share the same tokens.
- Narrow layouts stack panels, preserve horizontal table/board scrolling and provide a compact navigation bar.

## Data and access

The workspace still uses its existing Supabase session, RLS and Edge Function contracts. No migrations, role changes, API modifications or new demo data are introduced. Candidate skill/title/experience fields are not invented for Pipeline cards when the API does not return them. Bento counts describe Applications across loaded Jobs, not unique people. Missing metric responses display a dash. SLA targets retain their existing semantics.

## Release and rollback

Use the existing path-preview mode. Preserve the deployed root source 5b53cb18145e2ec03fa815fb5825c1a2a1882bef and publish only the preview source from PR 43. Keep the PR draft and unmerged. Roll back by publishing prior preview commit 7076d0bc5aafbb13f059a207133c6f47d5cf0ac5 with the same root source.

## Validation boundary

Run the existing frontend tests, root QA, typecheck and static build. Check the public sign-in in the cloud browser after release. Opening the existing Admin Google account was rejected by automatic approval review in this session, so signed-in browser QA requires explicit account authorization. Do not treat successful mock UI tests as live cloud role verification. No sign-in bypass or database fixture substitute is permitted.

## 2026-11-12 — Pipeline fidelity, focused Admin and complete interface language

Reviewed the V6 share directly. Its selected combination was Astryx components, Sidebar navigation, Bento summaries, Full-width Kanban and Split Screen profiles. shadcn/ui/lint was a consistency reference, not an installed dependency; no Tailwind migration is included.

- Pipeline now follows the approved pilot structure: Job identity/selector, four full-Job overview cards, board heading, search and source filter, compact stage lanes and source-backed candidate cards. Missing fields such as current employer, skills and stage age are not fabricated from the demo. The API still paginates at 25 records. Source filters explicitly apply to the current page; overview values use existing Job metrics and show a dash if unavailable.
- Admin now follows the Job openings pattern: summary cards, section tabs and one focused form. Fields remain visible with explicit borders. Forms retain their values when switching sections or languages. Tabs support arrow/Home/End keys.
- Master, navigation, Pipeline, details/history, Admin, Talent Pool and manual candidate entry use explicit VI/EN interface copy, including accessibility names, placeholders, confirmation text and known notices. Persisted protocol values and user-entered names/job titles/CV content stay unchanged. Existing CV/JD review and login translations are retained.
- Stage controls show recruitment terms instead of NEW/SCREEN codes. Guarded API actions, confirmations, idempotent retry IDs and role/Job membership checks remain intact. Offers remain a presentation lane governed by existing offer permission checks.

Validation: 25 Node tests, 54 component tests, 12 root QA checks, inline syntax, typecheck and static export passed. Added actual language-switch tests with an open candidate drawer and an open Admin form, plus a source-filter/full-Job-total check. Existing stage guard, permission and retry tests remain in place. Full signed-in cloud browser testing still requires an authorized Admin session; component tests do not replace it. Local Chromium screenshot capture was attempted but the runtime denied its process socket, and the cloud browser cannot reach the local fixture server.

Publish with the existing `path-preview` workflow from main, keeping root source `5b53cb18145e2ec03fa815fb5825c1a2a1882bef`. Keep PR #43 draft and unmerged. Roll back this revision by publishing prior preview source `2323094a9524c2323fd283227036bcaad0be6243` with the same root source.

Unknown backend errors now use the existing localized friendly-error fallback. Known application event codes are translated; unknown event codes display a neutral profile-update label. No raw backend error/code is required for the recruiter to interpret.
