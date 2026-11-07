# Assignment frontend and MCP scope

- Temporarily disable Community, shared interview reports, packs, appearance extras,
  XP/leaderboards and the dashboard tour with one reversible feature switch.
- Keep Discover, Applications, Network, Career Toolkit, profile/agent settings,
  light/dark mode and approval/blocker handoffs. Skip the Circle onboarding step,
  including existing saved navigation checkpoints. Saved data is untouched.
- Filter paused tools from both MCP discovery and calls (including local extras),
  hide the Circle guide and advance developer context to 101.
- Validation: 932 tests: 927 passed, 5 legacy Community MCP parity tests explicitly
  skipped while paused; data validation (158 roles); frontend typecheck and
  production build; desktop/mobile demo browser checks passed (no external
  requests or page errors); mechanical UI detector reported no findings.
- Limits: no push or production release; gateway/MCP need normal release and
  agent tool/context refresh. Audit-log database work is separate.

## Private audit storage

- Add owner-private agent_audit_runs and agent_audit_events with immutable metadata,
  server sequence/time, per-event evidence and connection identity. API roles cannot
  update/delete history. Existing workspace reset and account deletion remove logs.
- Add scoped start/append/read MCP tools and a shared dedicated credential RPC for
  Node/Edge. Exact retries replay, changed retries conflict, batches are atomic,
  bounded reads resume after a sequence, and common secret patterns are rejected.
- Add versioned agent-audit guide and developer context 102. Logs collect observations
  only; no scoring, execution, automatic Muse trace capture or submission proof.
- Validation: full suite 941 tests: 936 passed, 5 paused legacy Community MCP tests;
  frontend and backend TypeScript checks; production frontend build; data validation.
  No new audit security-advisor findings. Controlled audit fixture
  covers replay/conflict rollback, RLS/privileges, revocation, redaction, routing,
  pagination/late events and reset fencing.
- Applied audit migration 20261107002624 to hosted Lookout (osyrlausutnqzlegxmnd).
  Verified RLS/privileges and hosted start/append/replay/read using synthetic records
  inside a rolled-back transaction. No test users, runs or events were retained.
- Limits: frontend and gateway/MCP/Node code were not pushed or deployed. The tables
  are live; Muse logging tools require normal backend release and discovery refresh.
