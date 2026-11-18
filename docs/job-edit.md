# Editing Job information

Adds Edit Job for active Admins in Job Openings rows, snapshot and Job Detail. Supports DRAFT, OPEN and ON_HOLD only. Editing does not change Job status, code, opened_at, memberships, TA responsibility, applications, interview rounds or offers. Existing create/open APIs are unchanged.

The form loads current data and the exact updated_at, keeps missing fields unset, sends only changed whitelisted fields, and disables editing during an uncertain retry. A stale write requires explicitly loading the latest version. Request IDs bind exact retries to the same actor, Job, timestamp and changes. A successful save followed by refresh failure never offers a mutation retry.

Migration 20261127_job_edit.sql adds service-only admin_get_job_edit/admin_update_job_edit RPCs and a service-only RLS audit table, job_edit_events. Reuses job_opening_requests with a distinct EDIT_JOB payload. Writes lock the Job, validate fields, enforce current active Admin, and record before/after metadata atomically. Code/status/identity fields are rejected in payloads. Changing SLA configuration requires a complete valid Level/Function/Season tuple (or explicitly clearing all three); changing title/location leaves existing unknown SLA fields untouched. No RLS grants are widened.

Validation: run verify-edit.mjs with @electric-sql/pglite 0.5.16 installed in a disposable environment. Run npm --prefix web test, typecheck and static build in the FE repo. Test Admin vs TA denial, code/status/team/pipeline preservation, partial null preservation, invalid dates/levels/unknown keys, stale updates, exact retry, audit deduplication and CLOSED denial. Hosted business writes require dedicated test data; deployment verification alone is not authenticated E2E.

Deployment order: additive migration, admin-jobs function (JWT verification retained), FE build and Publish ATS Pages from main. Inspect deployed function source before replacement to preserve concurrent changes.

Rollback: deploy previous FE commit and prior admin-jobs source; leave additive RPC/audit table in place until rollback is verified. A code rollback does not undo user edits. Recover metadata from job_edit_events only after reviewing the specific Job and newer edits. Do not restore an entire database or reverse memberships/pipeline data.
