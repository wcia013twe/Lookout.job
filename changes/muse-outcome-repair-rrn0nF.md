# muse-outcome-repair

- Investigation only: production reports of completed Muse application jobs have timed out. The deployed dispatch function uses the same update for completed and blocked outcomes, differing in terminal status, and synchronously updates the application projection and change feed through triggers. No production code was changed.
- Production logs showed repeated retry-key conflicts and short contention on a per-user advisory lock. The MCP gateway forward has a 15-second timeout; several MCP requests reached that limit. These observations have not been correlated to a specific completed-report call, so they do not establish its root cause.
- Validation: `node --test tests/application-requests.test.mjs` passed (3 tests). Live database function, trigger definitions and logs were inspected read-only.
- Limits: No completed report was replayed, no fix was verified or deployed, and the pending job remains running. Continue by correlating a single bounded retry with gateway/database tracing and inspecting its exact idempotency key and current record versions. Do not retry an uncertain submission.
