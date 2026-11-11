# Astryx Master and Hiring Pipeline preview

The isolated route /master-astryx-preview/ now includes Master and Hiring Pipeline views. It uses synthetic candidates only and makes no Supabase requests.

- Open a Job pipeline from its Master row or the Hiring Pipeline view button.
- Select one of four demo Jobs; counts, source choices and cards follow that Job.
- Search names, roles or skills; filter sources; empty Jobs and empty searches have explicit messages.
- Open candidate details in a native modal dialog; Escape closes it and native dialog focus handling applies.
- Move synthetic cards between NEW and SCREEN by drag/drop or detail action. Reset demo or reload restores fixtures. Other transitions are intentionally unavailable.
- Offer is a presentation lane for a candidate with an offer flag, not a new persisted stage.
- Round SLA and elapsed days are illustrative. This preview does not implement SLA measurement.

Validation: local TypeScript check, static Next.js build, 74 frontend tests (23 Node and 51 Vitest), 12 root QA tests passed. Local Chromium launch was blocked by the executor socket policy; verify interactions and responsive layout on the published preview before treating browser QA as complete.

Release only with the existing path-preview workflow, retaining the currently deployed root commit. Keep PR #43 draft; no merge or backend changes are required. To roll back the preview, republish path-preview with its prior preview SHA 56a6a85a1ea77044f6d8459ba00acc1eb764c281 and the same root commit. Do not change database schema or data for this UI preview.
