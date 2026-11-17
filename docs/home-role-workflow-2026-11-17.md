# Home: roles, full lists and real assignments

## Implemented in the redesign branch

- Admin, TA, Hiring Manager, Interviewer and assigned Approver perspectives use the existing backend access contracts. Multiple roles get a perspective selector; switching it never grants permissions.
- An active user with no global role can enter personal Home and the dedicated approval workspace. Actual offer assignment and backend `can_approve` determine actionable proposals. Admin, Talent and general Offer privileges are not granted to that account.
- Approver sees pending/internal-approved/rejected proposal counts and an assigned proposal preview. Salary is confined to the actual approver perspective; decisions use the existing `/offer-approval/?offer=...` workflow and its revision/idempotency checks. Internal approval remains distinct from candidate acceptance.
- Task list, interview states and proposal list follow all 100-record API pages before publishing exact totals. Errors, cancellation, overlap/repeated pages and the explicit 100,000-offset guard do not publish a truncated exact total. The underlying offset APIs do not provide transactional snapshots; data changed concurrently must be reloaded.
- Tasks paginate six at a time. All today's appointments are in an internally scrollable agenda, including earlier, completed and cancelled appointments, by the full GMT+7 calendar day. No past-time-to-completed inference.
- Real interview type, time range, location, meeting link, participant names and backend status are shown. There is no authoritative round-number field, so the app does not invent Round 1/2 labels.
- Assigned-task owners are the authenticated recipient of the existing `list_my_recruitment_tasks` contract. No deadline is fabricated. Derived application/job reminders are explicitly labeled as team reminders/unassigned rather than inventing a task owner.
- Task detail supports completing an owned task and reassigning through the existing permission-checked Tasks API. Eligible colleague options come from `admin-jobs/list_job_members`. If that existing endpoint denies the roster, the app does not fabricate a colleague list or bypass it. The backend remains authoritative for reassignment.
- Interview detail lists real participants/feedback and supports own feedback submission only for an assigned participant on a completed appointment. Meeting URLs must be HTTPS without embedded credentials.
- Retries preserve exact task/feedback request ID and payload after a lost response. No automatic email is sent by Home. Refresh on focus/visibility and every 60 seconds while visible, plus explicit Refresh; this is polling, not a claim of realtime subscriptions.
- Job reads now paginate instead of silently cutting off at 100, so Home job reminders can include the whole authorized result.

## Validation

- React/DOM tests cover task pagination with 14 tasks, 12 agenda entries, real participants/time, failed-source dashes, role-less assigned approver, multi-role switching, and idempotent reassignment retry.
- Data tests cover 0/25/100/231 records, exact-page boundary, a repeated/changed page, mid-scan failure, request cancellation, GMT+7 midnight, earlier/completed/cancelled interviews, 38 assigned tasks, role/action restrictions and unsafe meeting URLs.
- Existing suites remain required. No hosted test records, roles or appointments were created.
- Static Next export uses only existing routes. The framework emitted a security upgrade reminder during the build; dependencies have not been upgraded as part of this feature.
- Visual QA remains BLOCKED. Opening the exported local-only fixture in the cloud browser was rejected by its file-URL policy. No alternate browser or bypass was attempted. This is not a visual-fidelity certification.

## Hosted backend preflight (read only)

On 17 November 2026, `list_edge_functions` for project `izchulqhmhqevfmuvqlx` returned admin-jobs, drive-intake, ta-review, applications, offers, candidates and interviews. It did **not** return `tasks` or `offer-workflow`. A schema-only inventory returned `offer_proposals` but not `recruitment_tasks`, `offer_approver_grants` or `offer_mail_outbox`.

Therefore task assignment and the new proposal workflow are **not live-ready**. Frontend absence/error states are intentional. Do not call these features complete end-to-end or publish fabricated zero counts. A successful frontend test cannot prove the missing hosted backend works.

The existing proposal branch is separate work: `phucphamdinh18/ats-v2-independent`, branch `feat/offer-proposal-approval-mail`, inspected revision `13ec1c9d90da1cd475404b7965953e6028f02ac5`. Tasks contracts were inspected on backend main at `177ed294c5d97a2c49cc5a701c264fbd59602a01`. Coordinate those versions before activation; do not overwrite concurrent backend Offer work.

## Activation boundary

Frontend Preview deployment remains separate from changing the shared Supabase database. Before hosted activation:

1. Check the read-only inventory in `docs/home-backend/preflight.sql`.
2. Validate the missing Task/Offer migrations and functions against a local/disposable database, using the repository's baseline and existing tests.
3. Approve and apply only the verified missing schema migrations, preserving existing data and permissions. Register no new approvers or email templates without explicit configuration.
4. Deploy `tasks` and `offer-workflow` with JWT verification enabled. Home needs the authenticated user API, not the email worker. Leave email worker scheduling disabled unless separately authorized.
5. Run authenticated role checks and booking/cancellation/date-change/feedback/task-assignment checks in test data, then capture desktop/mobile screenshots.

The schema inventory does not establish migration readiness; it is not permission to apply migrations or deploy privileged functions.

## Rollback

Revert the Home feature commit on the redesign branch. Preview rollback target is `bb8a8dac6b04b19ed07776326a302cd528a2c3f3`, with the production root pinned to its separately verified revision. This frontend change makes no hosted schema or data changes. Any later backend deployment needs its own reviewed rollback plan; never drop task/offer tables containing user data merely to roll back UI.
