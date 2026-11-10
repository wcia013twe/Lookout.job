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


## Load once, then fetch changed records

- Replace the account controller's repeated table/batch loads with one authenticated snapshot RPC and subsequent row deltas. Preserve source ownership, reset guards, optimistic writes, offline/profile conflict protection, generation checks and detached demos.
- Index one latest pointer per owned record, retain deletion keys, serialize cursors through the existing workspace-version row and read cursor/rows under one STABLE snapshot. Project latest posting evidence and changed employer facts through owned records. No data bodies or workflow progress are copied into the pointer table.
- Merge accepted upserts/deletions by stable key, adopt cursors only with accepted state, and retain unchanged arrays. Discover projects directly from cached rows; an unrelated profile change does not refetch/rebuild its batches.
- Relevant source-table signals replace 10–15 second private-data polling in company workspaces, outreach, imported tracker and onboarding; remove unrelated planner/Action Board focus reloads. Keep the local planner clock and a one-shot onboarding lease-expiry read. Pending company/outreach edits retain retry on focus/online.
- MCP mapping: internal browser synchronization reads existing owned records only. Existing MCP read capabilities/scopes and all backend write/version/approval checks remain unchanged. The SQL proof writes through existing scoped agent_dispatch and observes the browser delta; no new product action or arbitrary database tool is introduced.
- Proof: real migrated SQL with 250 answers returns a 73,974-byte initial snapshot, 56-byte unchanged response, and 385-byte one-agent-update delta. No unchanged answers are resent. Tests cover tombstones, replay, rollback, missed notifications, Auth/private-key isolation, restored-ahead cursors, shared employer updates, no per-table browser fallback, and no Discover refresh for a profile-only change.
- Demo coverage: existing fictional planner interaction now uses a relevant change event; unrelated/account-foreign notifications do not reload it. Detached demo/account-switch/conflict scenarios remain in the passing suite. There is no real-account fixture or backend write in demo.
- Validation: full npm test 1,348 passed, five skipped, zero failures (1,353 total); 38 focused SQL/cloud/planner checks; frontend typecheck, production static export (435 assets), catalog 158 and diff checks passed.
- Limits: no deployment or hosted CPU/IO measurement. Release the migration and frontend together. Auth/reset guards remain separate reads. Optional auxiliary pages load on mount and reload their owned projections on relevant signals; not every product view is a row-delta consumer. The shared Circle company-intelligence feed retains its separate refresh policy. Snapshot rehydration is allowed on explicit profile conflict recovery or a restored-ahead cursor. Pointer/tombstone storage is one entry per changed/deleted key and is not currently time-pruned.


## Production release

- Published PR #90 through feature:publish; protected CI passed and the queue merged reviewed source as c7cac585bd56e322a0cb250525ee60b7c0619b8a. Production workflow: https://github.com/wcia013twe/Lookout.job/actions/runs/42847435452.
- The normal main-branch backend workflow installed migration 20261110152808 and deployed the authenticated functions. Hosted verification confirms the sync reader is STABLE, authenticated-only, and browsers cannot read the private pointer table.
- Read-only hosted SQL smoke under an owner context returned a 2,143,376-byte snapshot and a 63-byte unchanged delta with no records. No real-account records were changed and private values were not returned in the diagnostic output. This is backend read verification, not a real browser-session mutation test or a CPU/IO benchmark.
- First Pages attempt timed out during updating_pages after 10 minutes; a targeted retry of the publication job succeeded. Backend/build results remain successful. Public HTML matches the exact production artifact; the account RPC bundle and separate delta-merge bundle return HTTP 200, with the delta bundle matching artifact SHA-256. Open tabs must reload to replace their old JavaScript and polling hooks. No live CPU/IO improvement measurement or real-account browser write was performed.
