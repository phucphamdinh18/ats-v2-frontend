# Approved light design applied to the ATS preview

The actual ATS workspace now uses the visual direction approved in the isolated Astryx Master and Pipeline demo. Shared colors, navigation, controls, tables, candidate cards and forms are scoped in web/app/workspace-theme.css. The independent mock route remains available for comparison.

## Screens

- Light Google sign-in and loading state.
- Sidebar, topbar, quick search, language control, role badges and help.
- Master with Bento metrics and five grouped columns. Level/priority moved into the identity cell; status and SLA share a cell. Existing data fields remain available.
- Pipeline with Job selector, quiet stage colors, initials from candidate names, source footer and a non-modal detail drawer. Escape dismisses the drawer. Existing stage guards, confirmations, retry request IDs and API calls remain in place.
- Talent Pool list/profile, CV review, JD review, Admin Job forms and Job membership forms share the same tokens.
- Narrow layouts stack panels, preserve horizontal table/board scrolling and provide a compact navigation bar.

## Data and access

The workspace still uses its existing Supabase session, RLS and Edge Function contracts. No migrations, role changes, API modifications or new demo data are introduced. Candidate skill/title/experience fields are not invented for Pipeline cards when the API does not return them. Bento counts describe Applications across loaded Jobs, not unique people. Missing metric responses display a dash. SLA targets retain their existing semantics.

## Release and rollback

Use the existing path-preview mode. Preserve the deployed root source 5b53cb18145e2ec03fa815fb5825c1a2a1882bef and publish only the preview source from PR 43. Keep the PR draft and unmerged. Roll back by publishing prior preview commit 7076d0bc5aafbb13f059a207133c6f47d5cf0ac5 with the same root source.

## Validation boundary

Run the existing frontend tests, root QA, typecheck and static build. Check the public sign-in in the cloud browser after release. Opening the existing Admin Google account was rejected by automatic approval review in this session, so signed-in browser QA requires explicit account authorization. Do not treat successful mock UI tests as live cloud role verification. No sign-in bypass or database fixture substitute is permitted.
