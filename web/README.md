# ATS V2 — Next.js frontend, increment 1

Next.js App Router + strict TypeScript. The existing root `index.html` remains the deployed QA UI. This application is source-ready; merging does **not** deploy it or replace the Pages entry point. Hosting is still undecided.

## Run

Use Node 24. From `web/`:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Only the project URL and existing **publishable** key belong in these browser variables. Never use a service role key. `.env.local` is ignored. The Supabase project is ATS V2, independent of FireGroup.

```sh
npm test
npm run build
npm run typecheck
```

`build` creates `out/` via static export. The build reads no ATS records and needs no signed-in session. CI publishes a downloadable build artifact, not a website. The lockfile fixes the dependency graph.

## Implemented

- Google OAuth and sign-out, active profile/role gate, explicit reload of current access. Auth callbacks defer RLS queries to avoid Supabase's auth storage lock. Login has a 15-second timeout and a same-page duplicate guard; reload after an OAuth failure before starting another request.
- Responsive workspace with Vietnamese labels, keyboard focus, loading, error, empty and inactive states.
- Jobs read through the signed-in Supabase client's existing RLS. Search title/code and filter by actual status. All three counts describe only the **up to 100 loaded jobs**, never tenant-wide totals. Jobs are read-only in this increment.
- Admin/TA review queue through existing `ta-review`: CV/JD, pending/approved/rejected, 50-item pagination, details, Drive source, approve/reject, rejection reason and explicit source verification before approval.
- Approval blocked for duplicate/unready intakes. Name correction stays restricted to the exact existing TEST ONLY IDs + source + label. No fixture can create a Candidate/Job; closed fixtures stay closed. No normal CV/JD field editing is introduced.
- Request tickets discard stale responses on filter/selection changes and unmount. Logout/auth changes immediately clear loaded scope. Backend 401/403 clears access. A 409 clears detail and reloads the list; reopening is required. Submission locks prevent repeated writes while in flight. Backend remains authoritative for authorization, deduplication, audit and transactions.

## API contract

Uses existing project `izchulqhmhqevfmuvqlx` and `supabase/functions/ta-review/index.ts` from `phucphamdinh18/ats-v2-independent` (blob `6bffb9fdebabc48b8459d35caf80269b98caa0eb`). No backend/schema/role changes.

| Read/action         | Contract                                                                               |
| ------------------- | -------------------------------------------------------------------------------------- |
| Profile and roles   | `app_users(id,is_active)` and `user_roles(role)` for current Auth id, under RLS        |
| Jobs                | `jobs(id,job_code,title,status)`, ordered by job_code, limit 100, under RLS            |
| List                | `{action:'list',kind,state,page}` → `{drafts,page}`                                    |
| Detail              | `{action:'detail',kind,id}` → `{draft,intake,review}`                                  |
| Correct pilot title | `{action:'correct_title',kind,id,expected_value,value}` → `{correction:{changed,...}}` |
| Decide              | `{action:'decide',kind,id,decision,reason}` → `{review}`                               |

## Validation and rollout boundary

`npm test`: policy tests plus React DOM integration tests with a mocked backend. They cover authorization display gates, exact correction guards, closed/duplicate restrictions, safe source links, out-of-order details, CV→JD invalidation, 409 recovery, 403 access loss, unmount, job search, logout data clearing and duplicate OAuth initiation. Existing root QA tests remain unchanged. These are not live OAuth/RLS end-to-end results for this Next application.

Local production build and TypeScript validation must pass before merging. Browser visual QA was attempted but the cloud browser could not reach the isolated local server (`ERR_CONNECTION_REFUSED`), so desktop/mobile screenshots and actual Google OAuth on this Next build remain outstanding. Do not treat CSS breakpoints or DOM tests as visual QA.

Before first live rollout: choose hosting and its base path; build with `NEXT_PUBLIC_BASE_PATH` if needed; ensure exact origin/path callback is allowed in Supabase Auth, redirects return to that same path, and Edge CORS allows that origin. Then verify desktop/mobile rendering, Google sign-in/out, current Admin/TA/HM visibility and stale/revoked sessions against synthetic data. Avoid wildcard callback expansion. Keep the current QA entry available for comparison/rollback. Do not reopen closed fixtures.

Admin Job mutations/memberships and Applications remain available only in the existing QA UI. Candidate management, stages after SCREEN, Interview, Offer and Matching are not added here. Drive/AI pilot limits are unchanged; no real CV or JD was processed.

Official framework reference: https://nextjs.org/docs/app/guides/static-exports
