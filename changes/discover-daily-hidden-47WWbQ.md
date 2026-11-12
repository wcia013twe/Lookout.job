# Discover daily drop and Hidden

The cumulative private board keeps the latest drop and earlier Apply Now / Strong Consider recommendations visible, and places older low-priority unapplied roles and expired postings in a collapsed Hidden section. Hide and restore overrides use owned search preferences, without mutating batches or application state. Deduplicated roles preserve their first discovery date and expose their latest recommendation date for grouping. The fictional demo includes an older Hidden role.

Validation: focused discovery tests (11 passed), full suite (1,354 passed, 5 skipped), data validation (158 roles), frontend typecheck and production build.

Limits: the board uses saved liveness; it does not independently verify postings. Manual visibility is available through the website and existing owned preference storage; no dedicated MCP hide/restore tool was added. Visual browser verification and deployment were not performed.
