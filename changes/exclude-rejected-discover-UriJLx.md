# Exclude rejected jobs from Discover

Add an explicit rejection-outcome check instead of relying on submission progress. Match every owned job ID/canonical URL and tracker outcome so queued duplicates cannot mask prior submission/rejection. Reuse the shared predicate for cumulative, single-batch, date-filtered, public and onboarding previews. Applied jobs remain hidden by default; the explicit applied-history toggle never reveals rejected jobs. Pending/failed/blocked work alone remains visible. No application or batch writes.

The direct worker already excludes tracked applications regardless of status. Its real SQL-leased regression now covers both Submitted and Rejected, including no submitted_at on rejection, and verifies the full application is unchanged and the posting is not reverified or shortlisted. Existing scoped read_batch and application readers remain the access boundary; no new operation or migration.

Validation: full suite 1,099 passed, 5 skipped, no failures; 44 focused tests passed. Frontend typecheck/static build, 158-role data validation and diff checks passed. Built isolated browser demo showed 5 default roles and 15 with applied history, with the rejected role absent in both modes; no page errors, external requests or mobile overflow. Proof screenshots remain ignored in `next-app/.profile-flow-proof/rejected-discover/`. Focused tests cover rejection-only/import aliases, tracker rejection, rejection milestones, duplicate records, unrelated rejected jobs, scheduled nonfinal events and applied-history mode. Detached demo includes a rejected role.

Checkout: `/Volumes/External SSD/Lookout/tmp/lookout-features/exclude-rejected-discover-UriJLx/repo`; branch `codex/exclude-rejected-discover-UriJLx`. No push/GCP deployment or real account changes.
