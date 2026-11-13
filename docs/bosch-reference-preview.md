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

Shared live workspace styles are applied by `web/app/bosch-ui.css`, using the existing structural styles and real workflow components. Preview-only styling and mock data were removed. EN/VI controls, permissions, and forms remain connected to the real workspace.

## Known limits

The live pipeline keeps permissions, candidate creation, interview scheduling, stage-transition confirmation, and Kanban drag-and-drop. Stage summary counts use Job metrics and Offer data; stage/source filters reflect the currently loaded page, consistent with API pagination. The API does not supply interview round or matching score per application row, so unavailable fields remain marked with a dash. Candidate profile details load through the existing RLS-protected endpoint. At narrower widths, the detail panel stacks below the table and the table scrolls horizontally.

## Apply and rollback

The frontend theme is in `web/app/bosch-ui.css`; the operational pipeline remains in `web/components/application-pipeline.tsx`. No backend, database, RLS policy, or API contract was changed. Roll back the frontend theme by removing its import from `web/app/layout.tsx`; restore preview routes only if a mock is needed again.
