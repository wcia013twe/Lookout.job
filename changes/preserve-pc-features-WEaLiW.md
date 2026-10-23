# Preserve useful PC branch features on current main

Selectively integrated origin/pc-behind-on-updates (ea47954) onto local main
(5b82e26). Overlapping work favors current main; this is not a wholesale merge.

- Adopted the six-concept /themes marketplace and Profile → Browse Marketplace.
  It previews Dashboard/Circles with session-only favorites; the appearance picker
  and actual workspace themes are unchanged.
- Adopted dedicated owner/revision-checked company workspaces, exact company
  identities, legacy import/compatibility projections, offline conflict recovery
  and permitted cross-Circle intelligence. Main's company editors and two current
  Network demo targets remain; source conversations are additive below Overview.
  Research handoffs use list_company_workspaces/save_company_workspace.
- Adopted structured Circle activity and transactional publication-event feed.
  Main's Clubhouse, Updates, optional Trophy room, chat and authorship labels remain.
  The existing update renderer reads structured and legacy activity. The duplicate
  PC Shared updates section is omitted; agents retain read_circle_feed.
- Adopted automatic Career Toolkit discovery and preparation refresh/account-change
  fixes. Main's 39-guide catalog, artifact/document/prep collection capabilities,
  interaction boundaries and UI remain. Gateway developerVersion advances to 42.
- Omitted overlapping Discover/Action Board/Applications styling, timeline/pulse
  restyling, profile simplifications/removals, alternate Network editors and demo
  replacements. Retained main's logo cache and GitHub Pages deployment; no Logo.dev
  or Sites migration. Generated OpenWiki pages were not copied or edited.

Validation: npm test -- --test-concurrency=1 passes all 459 tests, including real
PGlite migrations, RPC/MCP authorization, feed pagination/invalidation, structured
activity, company migration/conflicts and main's artifact/collection tests.
npm run validate:data validates 147 roles. Production build/typechecking/static
export passes (54 pages); guide generator --check and git diff --check pass.
The final build initially paused on a security advisory for the existing Next.js
16.4.0 dependency; retry succeeded without dependency changes. Full outputs are
preserved on the external SSD in Lookout/tmp/preserve-pc-{tests,build}.log and
preserve-pc-build-advisory.log.

Demo/browser verification: marketplace desktop and 390×844 mobile views, Botanical
selection, save/Saved and Circles preview work; current profile navigation and
Network examples/editors remain, with fictional company conversations visible.
Existing tests verify reset/isolation, structured/legacy activity and feed events.
No real account data, external messages, applications or production writes used.

Limits: hosted migrations, concurrent real-account permissions, agent clients and
production deployment remain unverified. Existing Circle release gates remain.
Backend additions must be deployed and verified through the production process
before claiming live website/MCP parity. No push, PR or publication in this pass.
