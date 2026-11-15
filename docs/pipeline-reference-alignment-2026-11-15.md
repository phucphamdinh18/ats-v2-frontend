# Job Detail / Pipeline — reference rail alignment (2026-11-15)

Owner reference: image(20261115-153023).png (approved/right screenshot); current-layout evidence: image(20261115-153012).png. Scope is Job Detail / Pipeline presentation only, not Jobs Overview or Candidate Database.

## Changes
- Job Detail activates a dedicated pipelineLayout class only on its Pipeline tab. Desktop uses one shared CSS grid: flexible left column + clamp(360px,34%,500px) right rail, 24px gap.
- Existing Job header, metadata and tabs remain in the left column; the existing ApplicationPipeline child keeps its React position, state, API calls, permission guards and callbacks. CSS display:contents lets its summary, list and rail participate in the Job grid.
- Candidate rail starts at the Job title row (row 2), spans through the Candidate table bottom (end line 7), and scrolls internally. No negative margin or measured header offset. No fixed desktop rail height and no height:100% contribution.
- At <=1200px the Job Detail returns to block layout and the Pipeline uses its own one-column grid; the existing bounded/scrollable mobile panel remains below the list. Other Job tabs keep their previous composition.
- Six data headers/cells are centered horizontally and vertically; checkbox stays separate (6%). Final column shares: checkbox 6%, Candidate 24%, Stage 13%, Interview Round 17%, Match 10%, Experience 12%, Source 18%. Header labels can wrap without cutting words. Table minimum 620px with local horizontal scroll on narrower panes; rows target 56px, names/sources remain two-line clamped with existing tooltips.
- Candidate rail width 360–500px; name 22px/1.25, tabs 14px with four equal tracks, section headings 17px, body/facts/history 14px. Removes nested section borders and redundant card padding for a flat reference-style rail.
- All unavailable backend facts remain unavailable (dash); no fabricated contacts, rounds, scores, profile or hiring data. Existing overview/profile tab semantics and stage action permissions are not expanded.

## Verification
- Local Node tests and 81 Vitest tests passed; TypeScript passed. Updated obsolete row-2 rail placement assertions to the Job-header-spanning contract; existing functional Pipeline tests retained.
- Validate live deployed SHA via release.json, select a TEST Job and TEST candidate, measure rail/header top, rail/table bottom, font sizes and cell alignment. Test Job Details -> Pipeline return and VI/EN without real-data writes.
- Exact screenshot-sized comparison remains pending unless the browser supports those dimensions; do not certify pixel fidelity from source/static tests.

## Rollback
Revert this scoped presentation commit on Draft PR #44 and republish the previous verified Preview f94e9b4ef66af69f5840afa65f443302a00fdf4c. Preserve production_ref after independently rechecking live release.json. No database rollback or backend changes. Do not merge or delete backups.

## Live QA follow-up
- Preview b2b058a595aadf0dc2fb93f9bb179cdd816da6b2 was deployed by Publish #487 (43730790309); production root remained 71ff88ebdb68bea9f6456375c4c9d970e11c0379. QA/Next/Pages passed; Supabase E2E skipped.
- Authenticated TEST Job at 1363×936: rail width 360px; rail top and Job title-row top both -129.15625 (page was scrolled); rail and Candidate list bottom both 836.3125. All seven table cells including checkbox measured text-align:center and vertical-align:middle. No document horizontal overflow.
- Browser found unsupported multiplied percentage calc column widths resolving to equal-width columns, and a long Vietnamese stage badge overflowing its cell. Follow-up replaces the widths with compatible percentage-minus-pixel expressions, permits badge text wrapping, resets checkbox margins and makes source text 13px. Recheck the deployed follow-up before claiming the overflow fix passed.

- On deployed 07fd4d7942c82ec12220e01a61ffa1fe0616614d, Vietnamese badges no longer overflowed and all six data cells remained centered. Rail width 360px; title/rail top -129.15625; list/rail bottom 836.5; no page overflow. Column calc expressions (including percentage-minus-pixel) still resolved to automatic equal tracks in this browser's fixed-table algorithm. Final correction uses plain percentage col widths summing to 100% (6/24/13/17/10/12/18), avoiding percentage calc entirely.

## Owner revision — readable typography and descriptive-column alignment
- Supersedes the all-centered typography decision above: Candidate and Source headers/content align left with 12px cell inset. Checkbox and Stage/Interview Round/Match/Experience remain centered.
- Pipeline table header 15px, Candidate/Source/body 16px, stage badge 14px; summary titles 22px and labels 15px. Candidate panel name 26px, section headings 20px, body/facts/tabs 16px, history metadata 14px. Job title 28px (24px on small screens), metadata/breadcrumb 15px, Job tabs 16px.
- Profile tabs may wrap within four equal columns so translated labels do not collide. Existing row target, column percentages, panel grid and internal scrolling are retained; growing text can increase row height when needed.
- CSS only, plus correction of obsolete structural test descriptions. No shell, API, selection, filtering, pagination or stage handler changes.
- Validation: CI and deployed SHA must be checked before reporting success. Rollback: revert this typography commit and republish 54b2aa381fbf64d92512ef04b0e16eaf2dcebc7c with the independently verified production SHA unchanged.

### Deployed typography QA and narrow-table correction
- Preview bacac91842272b013422803c91720834a9afd032: Publish #493 / 43735736012 succeeded, production root remained 71ff88ebdb68bea9f6456375c4c9d970e11c0379. QA/Next/PR Pages succeeded; Supabase E2E skipped. Local 33 Node + 81 Vitest tests and TypeScript passed.
- Authenticated TEST-only VI/EN at 1363×936: headers 15px, body 16px, name 26px, section title 20px. Candidate and Source left; checkbox and four remaining data columns centered. Rail/header top and rail/list bottom matched; no document horizontal overflow.
- Visual QA found the English Experience header too close to Source at the previous 620px table minimum. Increase the table minimum to 820px, retaining original percentage tracks and local wrapper scrolling. This correction must be republished and visually rechecked.
- Root release marker may update before an already-open tab refreshes its old assets. A fresh Preview tab confirmed the new stylesheet; do not claim visual PASS using the release marker alone. Exact 1440/1920/mobile viewport QA remains SKIPPED in this browser.
