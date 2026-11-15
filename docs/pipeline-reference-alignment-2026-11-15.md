# Job Detail / Pipeline — reference rail alignment (2026-11-15)

Owner reference: image(20261115-153023).png (approved/right screenshot); current-layout evidence: image(20261115-153012).png. Scope is Job Detail / Pipeline presentation only, not Jobs Overview or Candidate Database.

## Changes
- Job Detail activates a dedicated pipelineLayout class only on its Pipeline tab. Desktop uses one shared CSS grid: flexible left column + clamp(360px,34%,500px) right rail, 24px gap.
- Existing Job header, metadata and tabs remain in the left column; the existing ApplicationPipeline child keeps its React position, state, API calls, permission guards and callbacks. CSS display:contents lets its summary, list and rail participate in the Job grid.
- Candidate rail starts at the Job title row (row 2), spans through the Candidate table bottom (end line 7), and scrolls internally. No negative margin or measured header offset. No fixed desktop rail height and no height:100% contribution.
- At <=1200px the Job Detail returns to block layout and the Pipeline uses its own one-column grid; the existing bounded/scrollable mobile panel remains below the list. Other Job tabs keep their previous composition.
- Six data headers/cells are centered horizontally and vertically; checkbox stays separate (36px). Remaining column shares: Candidate 24%, Stage 13%, Interview Round 18%, Match 12%, Experience 14%, Source 19%. Header labels can wrap without cutting words. Table minimum 620px with local horizontal scroll on narrower panes; rows target 56px, names/sources remain two-line clamped with existing tooltips.
- Candidate rail width 360–500px; name 22px/1.25, tabs 14px with four equal tracks, section headings 17px, body/facts/history 14px. Removes nested section borders and redundant card padding for a flat reference-style rail.
- All unavailable backend facts remain unavailable (dash); no fabricated contacts, rounds, scores, profile or hiring data. Existing overview/profile tab semantics and stage action permissions are not expanded.

## Verification
- Local Node tests and 81 Vitest tests passed; TypeScript passed. Updated obsolete row-2 rail placement assertions to the Job-header-spanning contract; existing functional Pipeline tests retained.
- Validate live deployed SHA via release.json, select a TEST Job and TEST candidate, measure rail/header top, rail/table bottom, font sizes and cell alignment. Test Job Details -> Pipeline return and VI/EN without real-data writes.
- Exact screenshot-sized comparison remains pending unless the browser supports those dimensions; do not certify pixel fidelity from source/static tests.

## Rollback
Revert this scoped presentation commit on Draft PR #44 and republish the previous verified Preview f94e9b4ef66af69f5840afa65f443302a00fdf4c. Preserve production_ref after independently rechecking live release.json. No database rollback or backend changes. Do not merge or delete backups.
