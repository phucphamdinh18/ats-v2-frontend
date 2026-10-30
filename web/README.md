# ATS V2 — Next.js frontend, increment 2 (Application pipeline draft)

Next.js App Router + strict TypeScript. Next is deployed at https://phucphamdinh18.github.io/ats-v2-frontend/. The source root `index.html` preserves the legacy QA interface, published at `/qa.html`. Publishing is a separate manual workflow; merging does **not** deploy or replace the live Pages artifact. See the rollout evidence and controls below.

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
- Request tickets discard stale responses on filter/selection changes and unmount. Logout and identity changes immediately clear loaded scope; same-user auth refresh revalidates access while preserving the review selection. Backend 401/403 clears access. A 409 clears detail and reloads the list; reopening is required. Submission locks prevent repeated writes while in flight. Backend remains authoritative for authorization, deduplication, audit and transactions.

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

### Application pipeline draft (TEST ONLY)

This draft adds a read-only Job → Application pipeline, candidate-name search and Application detail surface. Jobs still use the authenticated browser client's RLS query; Applications call only the existing `applications` Edge Function with the session JWT automatically attached by Supabase. The browser sends no `actor_id` and contains only the publishable key.

| Action | Exact request | Exact response used by UI |
| --- | --- | --- |
| List | `{action:'list',job_id,limit,offset}` | `{applications,limit,offset}` |
| Search | `{action:'search',job_id,query,limit,offset}` | `{applications,limit,offset}` |
| Detail | `{action:'detail',job_id,application_id}` | `{application,events,event_count,limit,offset}` |
| Screen | `{action:'screen',application_id,request_id}` | `{application}` |

Stages are grouped from returned records; no client-side stage list is declared. `SCREEN` is only offered for returned `stage === 'NEW'` and `status === 'ACTIVE'`. A confirmation creates one UUID; a network retry retains that exact `request_id`, so the backend idempotency rule remains effective. The UI is not authorization: 401 clears the session-scoped UI, while 403 explicitly says **“Không có quyền”** and clears the Application view rather than rendering an empty list. Request tickets prevent old list/detail responses replacing newer selections.

The current deployed backend migration returns `actor_id`, not `actor_display_name`, and does not return `matching_context`. The detail view therefore states that the actor display name is unavailable; it will display `actor_display_name` and `matching_context` only if/when the backend adds them. No Candidate Profile/PII, Interview, Offer, Dashboard, Matching, AI, migration or Edge Function was changed.

### Draft validation boundary — 22 October 2026

**Tried locally:** strict TypeScript, 21 Node checks, 20 React tests (including Application loading/empty/403/error/retry-with-same-request-id/detail-race cases), and Next production build. All used TEST ONLY mocked Application fixtures; no CV/JD or live Application record was used.

**Not tried:** GitHub CI for the draft commit, E2E with an actual Admin JWT, E2E with a TA-only Job membership JWT, real Edge Function/network/CORS, production deployment, or a production write. Do not treat a green local suite as authorization proof; deploy a preview only after CI and test with separate Admin and TA accounts.

## Validation and rollout boundary

`npm test`: policy tests plus React DOM integration tests with a mocked backend. They cover authorization display gates, exact correction guards, closed/duplicate restrictions, safe source links, out-of-order details, CV→JD invalidation, 409 recovery, 403 access loss, unmount, job search, logout data clearing and duplicate OAuth initiation. Existing root QA tests remain unchanged. These are not live OAuth/RLS end-to-end results for this Next application.

Production build and strict TypeScript pass in CI. Desktop and a 375×812 same-origin iframe were inspected on live Pages. Google sign-in from the promoted Next root, sign-out data clearing and return to Admin/3 Jobs were verified. Job search/status filter, pending queues, a rejected synthetic JD's read-only details, cross-tab selection preservation and retained QA access were checked. No production records were created or changed by these checks. Mobile inspection used an iframe, not a physical device.

Before changing hosting/base path, verify the exact callback, Edge CORS origin and the resulting built asset paths again. No callback allowlist, CORS, Supabase schema, role or AI/Drive pilot change was needed for this rollout.

Admin Job mutations/memberships and Applications remain available only in the existing QA UI. Candidate management, stages after SCREEN, Interview, Offer and Matching are not added here. Drive/AI pilot limits are unchanged; no real CV or JD was processed.

Official framework reference: https://nextjs.org/docs/app/guides/static-exports

## Manual Pages publishing

`Publish ATS Pages` is a separate **workflow_dispatch-only** workflow on main. It runs the existing QA checks, all web tests, the production build and TypeScript before producing an artifact. Only the deploy job receives `pages:write` and the temporary OIDC token; the repository token has no content-write permission. Switch the existing Pages publishing source to **GitHub Actions** before the first run. No custom domain, new hosting account, OAuth callback allowlist, CORS origin or backend permission changes are required.

| Mode      | Root URL         | Other pages                        | Purpose                                                        |
| --------- | ---------------- | ---------------------------------- | -------------------------------------------------------------- |
| `preview` | Redirect to Next | Next at `/next/`, QA at `/qa.html` | Verify Next without sending OAuth users into legacy QA |
| `next`    | Next application | QA at `/qa.html`                   | Promote the verified build                                     |
| `qa`      | Existing QA      | QA at `/qa.html`                   | Restore the current QA interface                               |

Every release includes `.nojekyll`, `release.json` and an `ats-release` HTML meta tag with the source commit/mode. The export uses `/ats-v2-frontend/next` for preview or `/ats-v2-frontend` for promotion. A same-origin `NEXT_PUBLIC_AUTH_REDIRECT_URL` remains the already-allowed root callback. In preview, the root landing page forwards the OAuth hash and query string to `/next/`, so users return to the Next workspace while no Supabase callback allowlist change is needed. Normal Next at root returns to itself.

Packaging copies only the static export and the reviewed legacy HTML; source, environment files and dependencies are excluded. It refuses an existing destination, an unexpected legacy callback, an invalid source revision or a mismatched Next basePath. `/responsive-check.html` embeds the actual app at 375×812 for mobile visual inspection when the cloud browser cannot resize its viewport. Sign in at the top-level root first; Google OAuth should not be used inside the iframe.

Rollback: manually run `Publish ATS Pages` with `mode: qa` on main, or restore the prior Pages deployment. Publishing `next` again rebuilds the current main source; it is not an immutable old-release rollback. There is no automatic production deployment on merge/push.

## Rollout evidence 15 October 2026

| Change / release                 | Evidence                                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Manual publish setup             | PR #16, head `6173e5553cb70a5eb9a68a344bd8ee71bc8322b0`, Next CI `38744395978`, QA CI `38744396024`; merged `af306fc436975f188b86035fa37eb0b58b4890fc` |
| Initial preview                  | Publish `38745055648` succeeded; existing QA root + Next `/next/`                                                                                      |
| Refocus fix found during preview | PR #17, head `201bed4c0fa6100ec4e08031687f7b35e656f73a`, Next CI `38745850001`, QA CI `38745849728`; merged `5b53cb18145e2ec03fa815fb5825c1a2a1882bef` |
| Fixed preview                    | Publish `38746535323` succeeded; actual rejected synthetic JD selection survived loading another ATS tab, with zero write forms                        |
| Next at canonical root           | Publish `38746986182` succeeded in `next` mode; live HTML meta `5b53cb18145e2ec03fa815fb5825c1a2a1882bef:next`                                         |
| Checks in final publish          | 29 web tests + 11 existing QA tests, production build, TypeScript and packaging passed                                                                 |

Same-user SIGNED_IN/TOKEN_REFRESHED now rechecks profile/roles/Jobs while keeping the mounted review selection. Sign-out/identity changes still clear data immediately; revoked/inactive access or a failed scope read removes the view. Two new component tests cover preserved JD selection and silent revalidation after revocation. Revocation in this Next increment was tested with mocks; earlier QA-role revocation evidence belongs to the legacy UI and is not a new live Next revocation test.

The canonical root and `/qa.html` were verified in the browser after propagation. Pages initially served the preceding preview from cache even after deployment succeeded; acceptance used the actual HTML release marker and visible UI, not a green workflow alone. Rollback mode packaging is tested; an actual production rollback was not executed.

This remains the first Next increment. HM/Interviewer live matrix, pending draft writes through Next, real CV/JD intake, later pipeline stages, Interview, Offer and Matching still require their own implementation/QA. The rollout performed read-only ATS data checks plus Auth session operations; it did not approve/reject drafts, grant roles or run AI/Drive processing.


## Pending local UI increment Vietnamese and English

Prepared a SaaS-style interface with indigo primary actions, mint/amber labelled statuses, consistent SVG icons, clearer typography, role-aware quick-start guidance, and friendly empty/error states. API payloads, authorization gates, correction allowlists and draft transaction logic remain unchanged. Job/status and role labels are localized; imported titles, names, notes and other source data retain their original text.

A typed copy dictionary provides Vietnamese and English. The selector is available before and after sign-in, stores only `ats.locale`, updates the document language, and continues working when browser storage is unavailable. Switching languages preserves review selection, unsaved notes and source verification, without refetching the scope or changing API state codes. Raw backend error details are replaced with localized actionable messages.

Local validation: 38 web tests and 11 legacy QA tests passed, as did the Next production build and strict TypeScript. New tests cover dictionary/placeholder parity, locale persistence and private-browser failures, actual review state preservation across languages, and unchanged decision payloads. A standalone HTML design preview uses clearly labelled sample data and simulated sign-in; it has no live Supabase connection.

This increment has not been pushed, checked in GitHub CI, published or visually accepted. The attempted GitHub read was rejected. The cloud browser blocks file URLs, so it could not visually inspect the standalone preview. Restore GitHub authorization, reconcile against the latest main, create a PR, run CI, then use the existing manual Pages preview flow for actual desktop/mobile and bilingual QA before promotion. Current live release remains the one recorded above.
