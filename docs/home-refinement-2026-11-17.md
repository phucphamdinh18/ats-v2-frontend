# Home and header refinement — 17 November 2026

Scope: Home and shared utility header on `redesign/bosch-enterprise-v2`.

The supplied screenshots showed a clipped Bosch/ATS identity, duplicate ATS V2 labels, repeated section headings and technical API/SLA copy in the main user flow. The refinement keeps one ATS V2 label, gives the Bosch identity a nonshrinking width, and simplifies Home to greeting/date, three actionable counts, tasks, today's interview agenda, and jobs needing attention. Desktop task and agenda columns use a lightweight divider; narrow layouts stack. Draft reminders use amber instead of the high-priority red dot.

Actions retain existing authorized navigation callbacks. Priority review opens pending interview feedback first when available, then the first attention job. Interview times use GMT+7 directly. Loading/error states show a dash rather than a misleading zero. Empty states appear only after successful loading. Errors use actionable bilingual messages rather than raw API responses. When the existing 25-item schedule limit is reached, a plain-language message points to the full interview workspace. No schema, RLS, API, role mappings or hiring stages changed. No fabricated approvals, scores or appointments were introduced.

## Validation

- TypeScript check: passed.
- Full existing suite: passed, all 88 React tests across 11 files plus the existing Node contract/page tests. Two Home assertions were updated for the intentionally changed greeting and removed technical copy.
- Production static build: passed (only existing routes `/`, `/_not-found`, `/offer-approval`).
- `git diff --check`: passed.
- Local visual check: blocked. The cloud browser returned an upstream connection termination at the internal preview URL, while the public Preview showed the login screen. The temporary isolated fixture used for attempted layout inspection was removed and is not part of this change.
- Authenticated role checks and screenshot comparison remain pending. Do not certify visual fidelity or treat a successful build as browser verification.

## Rollback

Revert the single Home/header refinement commit on the redesign branch. No data migration or database rollback is needed. Production remains unchanged. Publish only through the existing path-preview process after verifying current production and preview revisions.
