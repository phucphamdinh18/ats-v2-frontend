# Offers / Offer proposals

Offer proposal is a section inside Offers, alongside the existing Offer pipeline. It is not a separate primary navigation category. Proposal data continues to use the managed offer-workflow API. Existing legacy pipeline APIs, statuses, database schema and RLS remain unchanged.

## Interaction

- Open Offers, then Offer proposals. The proposal workspace loads lazily and remains mounted when switching sections so unsaved fields and uncertain-write retry payloads survive.
- Use New proposal to reveal the draft editor. Saving a draft closes the editor and focuses the returned proposal through the existing detail request.
- Search and status filtering operate on the currently loaded page (25 records). Pagination remains available; no global count is claimed.
- Review proposed compensation, level, onboarding, department/function, assigned approver, decision actions, delivery status and audit history in the detail panel.
- Administrator configuration is in a collapsed Approvers & template settings section.
- The standalone /offer-approval/ URL remains available for existing approval deep links and OAuth return handling, with the same component and role gates.
- Approval is an internal decision; candidate acceptance remains a separate status. This UI does not enable email dispatch or send messages by itself.

## Validation and rollback

Component tests cover role-gated approval, required rejection comment, identical-request retry after unknown outcomes, access revocation, draft save, retaining unsaved input, embedded shell and switching Offers sections. Run npm test and npm run build from web. Validate the published Preview with an authorized account; do not create hosted offers just for screenshots.

Rollback: revert the UI commit and republish /preview/ using production_ref 71ff88ebdb68bea9f6456375c4c9d970e11c0379. No database rollback is required. Root production must remain pinned unless separately authorized.
