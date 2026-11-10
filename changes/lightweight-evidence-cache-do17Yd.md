# Lightweight Discover refresh

- Bulk-page saved batches/items; deduplicate posting evidence across batches and query chunks of 50 jobs instead of one request per job. Page observations to preserve older evidence for less recently checked jobs.
- Cache evidence per client/current account until existing workspace/reconnect/account/focus/online/explicit-refresh events invalidate it, share concurrent requests, cache missing evidence, evict failed reads and bound retained entries. Debounce notification bursts by 100 ms. Existing ownership and final account checks remain.
- Existing MCP tools and backend validation are unchanged; this optimizes browser reads and adds no service action or permissions. Demo stays detached; existing fictional demo interactions and account-switch isolation are verified by focused tests.
- Validation: focused evidence, discovery, cloud-sync and demo tests (44 passed); catalog validation (158 roles). Further checks recorded below.
- Limits: informational posting evidence uses event invalidation, with focus/reconnect/manual refresh recovering missed notifications. No production deployment or live CPU/disk improvement claim; watcher cadence and Action Board SQL are outside this focused repair.

- Request-count regression: five fictional batches with the same 20 jobs use three data reads initially and two on repeat refresh; cached evidence survives rebuilding the backend adapter around the same client. Focused tests additionally cover pagination, account switches, concurrent requests, event invalidation, fallback, errors and detached demos.
- Production static build, frontend typecheck and diff checks passed. Initial full-suite sandbox run: 1,325 passed, 16 blocked failures, five skipped (local listen EPERM); targeted unrestricted integration rerun: 28 passed. Full unrestricted rerun passed: 1,342 passed, five skipped, zero failures (1,347 total). Final focused suite passed all 45 tests.

- Follow-up simplification: removed timer-based expiry. Existing workspace and reconnect notifications invalidate evidence, as do account/demo switches, focus/visibility, online recovery and explicit refresh. No periodic refresh was introduced.

- Final event-driven implementation: full suite passed 1,343 tests with five skips and zero failures; focused suite 46/46, frontend typecheck, rebuilt static export, catalog 158 and diff checks passed. No hosted performance measurement or deployment.
