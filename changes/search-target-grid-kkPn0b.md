# Search target source grid

- My Profile → My agent now displays search sources in a responsive card grid, with a source count, readable full names and addresses, and aligned Edit/Remove controls. Access-status details expand on demand.
- Expanded the isolated, resettable admin demo to six fictional sources covering all source types and long names/URLs; documented the grid, narrow-screen, editing, empty-state, and reset walkthrough.
- Uses the existing `save_search_targets` website/MCP boundary and owner/version validation; no service contract or backend behavior changed.
- Validation: `npm test` (423 passing, including website/shared validation and MCP search-target contract coverage); `npm run validate:data` (147 roles); `npm run build`; `npm --prefix next-app run typecheck`; `git diff --check`; Impeccable detector (no findings).
- Visual verification: rendered the actual SearchTargets component with six fictional demo fixtures and production CSS at desktop (880px, two columns) and phone (375px, one column), across dark/light themes; no phone card overflow, full long addresses, and working native access-details disclosure.
- Limits: the visual fixture preview does not hydrate account writes; live account saves and the full admin demo reset/edit walkthrough were not exercised. Initial build attempts hit dependency/network setup and disk-space errors; the final integrated build and checks passed after clearing this task’s temporary caches.
