# Circles structured activity and agent-feed design

Circles activity drafts now persist validated highlights, goal and help fields in
the existing immutable knowledge revision table. Website review/cards/editing and
scoped agent context read the same fields; legacy reviewed text remains readable
without rewriting history. Personal activity retains exact-revision human approval.
Gateway developerVersion advances from 33 to 34. Existing propose/read/search tools
provide MCP parity; no new scope, general table access or sharing permission.

The design maps current Circle elements to existing tables and proposes a single
publication-event table and scoped read feed, with notification preferences and a
delivery ledger reserved for a later runtime integration. The initial pass specified the feed; the follow-up below implements it locally.

Validation: all 416 tests pass with `npm test` outside the sandbox (the sandbox
blocked subprocess checks with EPERM). Added real database/browser RPC and actual
MCP dispatch coverage for structured activity, search, private drafts, stale
approval, invalid/private fields, removal and revoked direct table access.
`npm run validate:data` validates 76 roles; frontend typecheck, production static
build and `git diff --check` pass. Demo Alex uses structured activity, Sam retains
legacy text; tests verify context copies, private draft creation and independent
demo reset without real accounts or network writes.

Limits: migration and gateway are not deployed. Hosted grants, live accounts,
concurrent revocation and real agent-client behavior remain unverified; the Circle
release gate remains unchanged. No real data import, external-news ingestion,
feed delivery or persistent file uploads occurred. Fictional fixtures stay local.

## Member feed follow-up

Added a Circle publication-event table, committed per-Circle positions and fixed
scan cursors; scoped `read_circle_feed` shares browser RPC validation and current
membership/visibility checks. Private edits stay out; unavailable source revisions
return invalidations, and parent withdrawal/hiding invalidates cached replies.
The Clubhouse contains a collapsible Shared updates section. Fictional demo
fixtures cover feed reads, publication, revisions, pagination and withdrawal/reset.

Validation: integrated the company workspace and cross-Circle search from local
main, preserving both contracts and advancing gateway developerVersion to 36.
All 423 tests pass with `npm test -- --test-concurrency=1` outside the sandbox;
the parallel merged run hit a PGlite WebAssembly function-signature failure,
whose complete output is retained in `/tmp/circles-feed-merged-tests.log`. The
focused database rerun also passes. Frontend typecheck, production static build,
data validation (76 roles) and whitespace checks pass. UI detector reports no
findings. Desktop (1440×1000) and mobile (390×844) checks exercise loading,
refresh and thread navigation with no horizontal overflow or page errors.
Visual review found raw thread Markdown in previews; existing mention rendering
now handles it. The reviewer scored that fix resolved on both final viewports.
Captures and interaction evidence are in `/tmp/circles-feed-review/`.
The established theme tokens and design system remain unchanged.

Limits: no hosted deployment, real-account permission/concurrency verification,
notifications, scheduler, external-news ingestion or production gate change.
The event feed starts with future publication; old knowledge remains searchable.
Browser visual checks use isolated fictional preview data, with external requests
blocked. Account switching and hosted races were not exercised in a real browser.
