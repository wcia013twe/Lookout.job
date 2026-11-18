# Keep the Action Board loaded across workspace tabs

- Share one Action Board snapshot across the navigation, board and decision
  controls. Scope it to the current account and reset generation, or the current
  demo. Refresh on relevant sync changes and keep the last snapshot visible
  while a new read is pending.
- Preserve the existing owner-scoped board read and decision RPCs. In the
  detached demo, notify the shared reader when application, answer, outreach
  or imported application data changes.
- Document the workspace caching, invalidation and browser verification
  approach in [Workspace data fetching](../docs/workspace-data-fetching.md).
- Validation: 1,491 tests passed, including database scenarios. Frontend
  typecheck, static production build and catalog validation passed. Chromium
  verified demo decision persistence across navigation and demo reset.
- Benchmark: five warm returns with an artificial five-second delay per board
  read. Median fell from 5,436 ms to 118 ms and reads fell from one per return
  to zero. Chromium also verified owner and table filtering and cached content
  during a relevant refresh. Hosted account timing was outside this test.

## Reuse workspace data across tab switches

- Keep search status, imports, Planner, artifacts, Network and Circle reads
  scoped to the account and reset generation or the current demo. Share
  pending and completed reads across routes. Invalidate on the owning changes
  and keep explicit Circle refresh and bounded cache lifetimes.
- Local OCR delegation reviewed 17 source files. Added Planner invalidation
  for imported roles and application holds, and preserved write confirmation
  during concurrent refreshes.
- Signed-in Chromium against a local Supabase stack made zero Auth, REST,
  Functions or local JSON requests across 18 warm switches through the six
  workspace tabs. It also verified Circle detail reuse and explicit refresh,
  and persisted a Planner save while processing an invalidation. Cold loads
  still fetched data. Hosted behavior was outside this run.
- The detached demo verified Planner edits across navigation and fictional
  Network data with zero account API calls. The older browser scripts failed
  while waiting for a specific Action Board fixture and expecting the Network
  suggestions region to be absent. The focused checks use the current UI.
- All 1,491 tests passed, including database scenarios. Frontend typecheck,
  static export and validation of 158 catalog roles passed. Updated the
  workspace fetching source guide. The generated OpenWiki was not refreshed.
