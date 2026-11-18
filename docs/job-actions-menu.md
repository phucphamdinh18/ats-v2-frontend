# Job actions menu

Replaces the top Add Job button on Job Openings with one Job actions dropdown. Add Job keeps the current creation flow. Edit Job opens the existing editor for the selected snapshot/table Job, with its title shown in the menu; the option is disabled for missing/closed/cancelled selections. The parent still restricts these callbacks to Admins.

Removes the added Edit buttons from table rows and the snapshot. The table action column contains only View detail, with constrained wrapping so its contents stay within the cell. The header popup is anchored to the right, constrained to the heading/viewport width, and supports outside-click dismissal, Escape, arrows, Home/End and focus return. Existing Job Detail edit entry remains available.

UI-only correction. No schema, APIs, permissions, Job data or workflows change. Regression tests cover add/edit selection, closed status, permission-gated navigation, keyboard/outside dismissal and the existing editor save safeguards. Rollback by reverting this FE commit and running the single-app publishing workflow; no database rollback is needed.
