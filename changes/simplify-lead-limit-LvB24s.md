# Simplify source-only verification limit

Limit each direct-worker Simplify feed to its 100 newest title/seniority-matching leads before deduplication and employer verification. Keep all other providers unchanged. Omitted matching leads make coverage partial and include an explicit omitted count and no-continuation notice. No cursor storage, schema changes or new agent tools. Existing backend-job entry points serve website/MCP; manual lead paging is unchanged.

Validation: full `npm test` passed (1,034 passed, 5 skipped, 0 failed); 14 focused Simplify/Jobright tests passed; runtime TypeScript and `validate:data` (158 roles) passed. Docker fixture selected the newest 100 of 150 matching leads from 180 total metadata rows, omitted 50 matching leads, and reported partial coverage. Local API health passed. Fictional demo includes a capped source with no network calls or account writes.

Local rollout: API and worker run `lookout-node:simplify-limit`; the standard local image tag is refreshed. Existing staging volume and all nine staged candidates were preserved. The active search retains its job/run and resumes after the old worker lease expires; completion was not claimed. No new search or database migration was started.

Limit: older matches can remain unchecked indefinitely. The limit is a lead selection budget, not a guarantee of 100 saved results.

Checkout: `/private/tmp/lookout-features/simplify-lead-limit-LvB24s/repo`; branch `codex/simplify-lead-limit-LvB24s`. Nothing pushed or deployed to GCP.
