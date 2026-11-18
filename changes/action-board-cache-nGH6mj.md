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
