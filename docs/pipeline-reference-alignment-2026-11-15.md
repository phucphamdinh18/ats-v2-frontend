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
