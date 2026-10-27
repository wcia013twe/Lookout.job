# Company discussions inside Circles

Circles now has Your circles and Company discussions views without adding a top-level navigation item. Company discussions provides visible text/company search, shortcuts from tracked applications excluding rejected/withdrawn outcomes, current-membership source previews, pagination, empty/error recovery, and direct entry into the existing thread/reply experience. The view survives reload and browser history; original Circle workflows remain available.

Uses existing knowledge.search with scope current_memberships (MCP: search_circle_knowledge), and knowledge.read/thread replies (MCP: read_circle_thread and existing reviewed contribution tools). Website and MCP retain the same backend membership, published-revision and sharing validation. No new backend capability, autonomous Muse results, global sharing or notifications are introduced.

Demo coverage adds a clearly fictional Stripe OA timeline alongside existing interview experiences, activity and strategy threads. Demo browser checks cover company shortcuts, source navigation and return, empty/clear search, view reload, desktop/mobile layouts and overflow. Public logo requests from the existing thread surface are blocked during verification; no account/backend API requests occur.

Validation: npm test (825 passed), npm run validate:data (158 roles), npm --prefix next-app run typecheck, npm run build, and node scripts/check-company-discussions-ui.mjs (desktop/mobile passed). Existing Circle tests cover the scoped MCP search/read paths and permission boundaries. Screenshots inspected in /private/tmp/lookout-company-discussions. Hosted production not deployed or verified; broader company discussion visibility remains limited to current Circle memberships.
