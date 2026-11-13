# ATS V2 — Bosch-style frontend rollout

## Scope

The selected Bosch-style direction is now the live ATS frontend across the workspace, sign-in, Job overview and pipeline, Talent Pool, CV/JD review, interview scheduling, and administration. The standalone Astryx and Bosch mock routes were removed to avoid duplicate/demo screens; the root route is the real Supabase-connected app.

The live UI continues to use the existing Supabase data, RLS, and APIs. This change does not modify database schema, policies, or endpoint contracts.

## Design direction

The screen follows the supplied Bullhorn-style job workspace reference with a restrained Bosch-inspired palette: dark navy navigation, light gray workspace surfaces, compact data rows, and a red active-navigation accent. The primary workflow is a job pipeline table with a candidate detail panel.

### Scoped tokens

| Token | Value | Use |
|---|---|---|
| `--primary` | `#d5001c` | Main action and active navigation accent |
| `--ink` | `#1c232b` | Primary text |
| `--muted` | `#667085` | Supporting text |
| `--line` | `#d9dee5` | Dividers and controls |
| `--bg` | `#f7f8fa` | Workspace background |
| `--white` | `#ffffff` | Tables and detail surfaces |
| `--radius` | `5px` | Small control radius |

Shared live workspace styles are applied by `web/app/bosch-ui.css` and `web/app/bosch-reference-overrides.css`, using the real workflow components. Preview-only mock data is not used. EN/VI controls, permissions, and forms remain connected to the real workspace.

## Known limits

The live pipeline keeps permissions, candidate creation, interview scheduling, stage-transition confirmation, and Kanban drag-and-drop. Stage summary counts use Job metrics and Offer data; stage/source filters reflect the currently loaded page, consistent with API pagination. The API does not supply interview round or matching score per application row, so unavailable fields remain marked with a dash. Candidate profile details load through the existing RLS-protected endpoint. At narrower widths, the detail panel stacks below the table and the table scrolls horizontally.

## Apply and rollback

The frontend theme is in `web/app/bosch-ui.css` and `web/app/bosch-reference-overrides.css`; the operational pipeline remains in `web/components/application-pipeline.tsx`. No backend, database, RLS policy, or API contract was changed. Roll back the reference overrides by removing their import from `web/app/layout.tsx`.

## 2026-11-13 — Rebuilt workspace navigation and page structure

The earlier nested Job tabs were removed. The app now uses separate destinations, so users do not have to guess whether a control opens a Job, edits requirements, or assigns access:

| Destination | Purpose | Existing workflow retained |
|---|---|---|
| Job Openings | Search/filter the accessible Job list and see stage/source summaries | RLS-scoped Job list and existing pipeline action |
| Hiring Pipeline | Select a Job and review its applications in a compact table with a candidate detail panel | Application search, stage change confirmation, add candidate, timeline, pagination and permissions |
| Manage Jobs | Create a draft, select one row to manage, edit requirements, assign Job-level roles, or open a draft | Existing authenticated API operations remain separate; opening and team access are clearly described as different actions |
| Job Review | Review submitted Job descriptions in the existing review queue | Existing reviewer permissions and review actions |
| Candidates / Interviews / Offers | Dedicated main destinations matching the reference suite | Existing Supabase-backed modules and role visibility |

The global header follows the Bosch reference: dark navy bar, Bosch ATS lockup, Jobs/Candidates/Interviews/Offers navigation, a clear active red underline, search, language and account controls. The left navigation groups recruiting work separately from administration. Tables use aligned columns, darker readable text, light neutral surfaces, thin dividers and compact row spacing. The pipeline heading is now a stable “Hiring Pipeline” label; the selected Job appears once in its selector rather than being repeated as the page title.

English and Vietnamese navigation labels and workflow descriptions are provided for the new destinations. The Offers view intentionally uses only the current safe offer-board projection (candidate, Job and pending/approved state); salary, template, expiry and approval detail fields are not available in that API projection and are not fabricated or sourced through a backend change.

No backend code, schema, RLS, API contract, or saved workflow was changed. The standalone pipeline/job tabs are removed from the visible page structure, while their actions remain available in the relevant dedicated destination. The previous dated notes about a three-tab Job navigation describe an earlier iteration and are superseded by this section.
