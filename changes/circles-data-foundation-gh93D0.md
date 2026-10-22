# Circles structured activity and agent-feed design

Circles activity drafts now persist validated highlights, goal and help fields in
the existing immutable knowledge revision table. Website review/cards/editing and
scoped agent context read the same fields; legacy reviewed text remains readable
without rewriting history. Personal activity retains exact-revision human approval.
Gateway developerVersion advances from 33 to 34. Existing propose/read/search tools
provide MCP parity; no new scope, general table access or sharing permission.

The design maps current Circle elements to existing tables and proposes a single
publication-event table and scoped read feed, with notification preferences and a
delivery ledger reserved for a later runtime integration. The feed is not shipped.

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
