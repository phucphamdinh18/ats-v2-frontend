# Job TA responsibility

Primary and support are responsibility labels on the existing TA_RECRUITER membership, not new permission roles. Each Job has at most one primary TA. No automatic legacy classification or new opening gate is introduced.

Migration 20261126_job_ta_responsibility.sql adds nullable ta_assignment, a unique primary index, and service-only request receipts. Existing memberships, RLS policies and stage permissions remain unchanged. Receipt payload/result record the requested change and previous primary for audit.

admin-jobs adds assign_job_recruiter and list_job_recruiters; list_job_members uses the new admin_list_job_team RPC without changing its wrapper. Existing admin RPCs remain available. All writes require active Admin. A handover demotes the previous primary to support atomically. expected_primary rejects stale handovers; request_id binds retries to actor and exact payload. A receipt retry does not reapply an old assignment after later changes.

Recruiter reads expose only active TA names/email/responsibility for requested Jobs the caller can read as Admin, TA or HM; at most 50 Jobs per request. Empty display names fall back to verified email. No parsing names from email. No global roster is exposed, and no Supabase service key is used in FE.

Validation: node verify-ta.mjs in the disposable PGlite harness. Includes legacy preservation, atomic primary handover, duplicate primary rejection, exact retry, conflicting payload rejection, stale-write rollback, non-admin denial, cross-job denial, revocation, inactive users and function ACL. Hosted tests should use test accounts and disposable data, not production fixture writes.

Deployment order: additive migration, updated admin-jobs function with verify_jwt=true, then frontend. Keep existing function version before replacing it. Do not replace another concurrent deployment without re-reading and merging its changes.

Rollback: deploy previous FE and prior admin-jobs source first. Keep additive column/receipt table and their data so assignments can be recovered. Do not reverse role grants or delete memberships. If a complete schema rollback is necessary, export classification/audit data, then remove only the new RPCs, index, constraint, column and receipt table. No pipeline migration is required.

Frontend: Team & Access offers a responsibility selector when assigning a TA, and explicit Make primary/Make support buttons for existing TAs. Primary replacement requires confirmation. Existing NULL labels read TA · Not classified. Home batches scoped roster reads and shows primary/support names on Job-level reminders. It distinguishes unavailable data from no assignment. Individual assigned tasks retain their explicit task owner. Returning to Home or refreshing reloads the roster.

Checks: npm --prefix web test; npm --prefix web run typecheck; root-base-path static build. To verify manually: classify two registered test TAs, confirm one primary, reopen Home, check named labels, transfer primary, revoke one and reload Home. Verify a non-admin cannot mutate and cannot fetch an unrelated Job roster. Do not promise authenticated hosted E2E until these checks actually run.
