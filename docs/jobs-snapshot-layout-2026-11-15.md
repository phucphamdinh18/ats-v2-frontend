# Job Openings — balanced Snapshot layout (2026-11-15)

Scope: CSS/markup only on Draft PR #44. Supersedes previous 315px Snapshot and 70px row styling. Existing filters, search, pagination, selection and both detail actions are unchanged. Candidate changes already on the branch are preserved.

## Layout contract
- `.workspace`: grid `minmax(0,1fr) clamp(340px,26%,400px)`, gap 17px, stretch, min-height 640px.
- `.stack`: column flex, gap 16px, min-width 0; removed height 100%.
- `.jobsPanel`: existing flex column retained; existing footer margin-top:auto retained.
- `.snapshot`: relative, stretch, min-width 0, overflow hidden, 1px #dce2ea border, 7px radius, white; removed height 100%.
- Added `.snapshotInner`: absolute, inset 0, column flex, overflow-y:auto. All Snapshot content, including empty state, is inside this wrapper. It cannot determine grid-row height.
- `.snapshotHead,.snapshotSection`: flex-shrink:0 so overflow scrolls rather than compressing content.
- Last Snapshot section: margin-top:auto. Removed old `.snapshotFinal` flex growth.
- At <=1370px: one grid column, min-height 0; Snapshot and inner wrapper static with visible overflow.
- `.snapshotHead`: padding 16px 18px. h2 19px/1.3, weight 700, margin-bottom 6px, #101924. Subtitle 12px, #657286.
- `.snapshotSection`: padding 14px 18px, bottom border #e8ecf1 except last. h3 15px/700, #172236, margin-bottom 10px and padding 0.
- `.facts`: 116px/minmax(0,1fr), gap 10px 8px, 13px/1.45, margin 0; dt #657286/400, dd #172236/700/margin 0/overflow-wrap:anywhere. Dash-only presentation spans use `.placeholder` #9ca3af.
- `.primary`: padding 11px 16px, 13px/800, margin-top 14px; existing #d7192d background, white text, border 0, 4px radius retained.
- Table body rows: 64px including selected rows. Summary padding: 14px; metric padding: 14px 5px.
- Existing 36/20/12/18/14% column widths, cell styles, shared tokens and local table scroll are retained.

## Validation and limits
- Local web tests before concurrent Candidate update: 32 Node tests and 79 Vitest tests passed; TypeScript passed. Updated only superseded Jobs assertions; retained incoming Candidate tests.
- Production root verified before publish: 71ff88ebdb68bea9f6456375c4c9d970e11c0379. Previous deployed Preview: a73416aa73e873d48d58325dc3917e655a54b49d.
- Publish only through path-preview, preserve the verified production_ref, and recheck live release.json afterward. CI and deploy IDs are available on the commit/Actions pages.
- Exact 1440×900/100% visual acceptance is pending: the available Cloud Browser previously exposed 1363×936, no viewport setter, and policy-blocked DevTools. Do not infer desktop side-by-side alignment from the stacked view below 1370px.
- For empty/short filtered lists, the explicitly requested 640px minimum can still create more than 40px of space before the footer. The absolute Snapshot wrapper prevents Snapshot content from adding any more height. Long content may scroll within the desktop panel.

## Rollback
Revert this scoped commit and republish the prior verified Preview via path-preview, after rechecking production_ref. No database rollback. Do not merge PR #44, alter production, or delete the backup branch.

## Five-item Job Summary — owner reference (2026-11-15)
- Replaces Other Status with separate On Hold and Closed cells. Ordered EN: Total Jobs / Open / Draft / On Hold / Closed; VI: Tổng số Job / Đang tuyển / Bản nháp / Tạm dừng / Đã đóng.
- Counts use the already authorized allJobs list: total length, exact OPEN, DRAFT, ON_HOLD and CLOSED status counts. No inferred closed/paused aggregation; other status codes remain included in Total Jobs. No API/RLS/schema or status mutation.
- No demonstration counts or Sample count labels copied from the image. Zero is shown when the authorized list has no matching status. Existing summary scope remains independent of the table's search/status/priority filters.
- Summary grid has five equal columns; <=780px uses two columns with the fifth cell spanning the row. Other table/Snapshot styles and action handlers remain unchanged.
- Component regression fixture checks 9 total / 5 Open / 2 Draft / 1 On Hold / 1 Closed and verifies that filtering the table does not change summary scope. Fixtures are local tests, never inserted into Supabase.
- Rollback: revert this scoped five-item summary commit and republish the previous verified Preview using the existing path-preview release process. Preserve production and backup.
