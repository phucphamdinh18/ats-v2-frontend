# One maintained ATS frontend — 17 November 2026

The user accepted the Bosch frontend at commit `b57412df5b1619a3df328b1db8b6a3f17b32ca75` and authorized making it the main interface while removing previous interfaces. The former main revision was `71ff88ebdb68bea9f6456375c4c9d970e11c0379`.

The current Next application under `web/` now builds only for `/ats-v2-frontend`. The standalone legacy root `index.html`, its correction/login/syntax tests and obsolete QA workflow are removed from the active source tree. Historical commits and backend/data remain unchanged.

Publishing uses one root export from main; PRs cannot deploy. Legacy QA, preview and path-preview packaging, alternate source selectors and the separate preview deployment job are removed. The package is created in a fresh destination and excludes retired bundles. Old entry URLs redirect to the main app, retaining query parameters and fragments; old approval paths redirect to the current approval page. These are redirects, not alternative frontend versions.

Validation covers root assets, the approval page, missing legacy source, rejection of retired modes and wrong basePath, stale destination rejection, absence of old bundles, and preservation of OAuth callback/approval URLs. The existing frontend and permission tests remain required. No hosted database writes or email actions are part of this release. Authenticated visual E2E was not executed in this workspace; the user accepted the existing UI.

Rollback: retain Git history. Revert the relevant application commit(s) on main, keep the single-root package, run checks and manually publish again. The accepted source baseline above and prior production revision remain recoverable by SHA. Do not delete Git history or reset branches with force. Restoring old multi-frontend packaging is not a routine rollback.
