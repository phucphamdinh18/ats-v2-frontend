# Admin Job Opening editor

The frontend removes the CV review and Job description review entry points. Historical intake data and backend review functions remain unchanged.

Admin creates a Job or continues an existing DRAFT in one form: core information, hiring/SLA metadata, then Save draft or Save and open. Job codes are assigned server-side when saved. Existing codes are preserved. The UUID primary key is unchanged. Generated display codes use ATS- plus the full UUID without hyphens; no manual code or shared counter is required.

Job membership assignment/revocation belongs to Job > Team & Access, locked to the current Job. Only active Admin can mutate membership. Other users retain verified read-only permissions. Existing role and membership semantics are unchanged.

The save API validates input and performs core fields, metadata, code, status and audit in one transaction. A request receipt supports retries after an uncertain response. Changed request payloads cannot reuse the same request ID; existing drafts require their precise updated_at version. No automated job, member or email writes run during deployment.

Validation: 40 Node tests + 101 React tests, TypeScript and static Next build pass. Disposable PGlite SQL checks cover active Admin gates, automatic code, receipt retry, atomic rollback, stale edits, draft opening and service-only privileges. Hosted authenticated user E2E remains a manual acceptance check.

Manual acceptance on Preview: Admin creates a TEST ONLY draft, confirms generated code; opens the draft; goes to that Job's Team & Access to assign/revoke an authorized test account. TA/HM/Interviewer must not have mutation controls. Review CVs and Job descriptions must be absent in navigation and search.

Rollback: publish the previous Preview commit a5d6ce14a096f18f1c67f1a29c0619f73c5d22a0 using path-preview with the production revision pinned. The old admin API actions remain available. The additive SQL functions and receipt table may remain unused; do not delete receipts or change existing codes during a rollback. If necessary restore the previous admin-jobs source with JWT verification enabled, after reverting Preview. No data rollback is required.
