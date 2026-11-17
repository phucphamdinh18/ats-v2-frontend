# Job → Offers → Offer proposal

Supersedes the earlier two-section global Offers design after user review of screenshots.

- Remove global Offers and Offer approvals sidebar entries and the global Offers workspace branch.
- Job detail → Offers opens Offer proposals directly. No second Offer pipeline, Job selector, tab pair or Open Offers module shortcut.
- The embedded proposal receives the current Job explicitly. Every list request, including pagination, supplies job_id; setup and candidate selection use the same Job. Unexpected cross-Job list/detail responses fail closed. React keys clear all drafts and cached detail when changing Jobs.
- Keep /offer-approval/ for assigned approver deep links and Home approval tasks. It is no longer a sidebar category. Existing independent approval accounts retain access through those authorized links.
- Keep managed API, SQL/RLS, statuses and mail dispatcher configuration unchanged. This UI change does not send emails.

Validation: component tests cover removal of sidebar entries, current-Job scoping, cross-Job response rejection, Job changes clearing drafts, role-gated decisions and request replay. Run npm test and npm run build in web. Hosted authenticated visual checks still require choosing the authorized account.

Rollback: revert this frontend commit and republish Preview with root production_ref 71ff88ebdb68bea9f6456375c4c9d970e11c0379 and previous preview_ref 2da4005beba9b1bd699cb43f7b2a9dd4ec2f3d45. No database rollback.
