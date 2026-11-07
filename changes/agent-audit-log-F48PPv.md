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

## Simple job preferences, one profile and one selected résumé

- Gate the full editor behind SINGLE_PROFILE_UI. Keep one stable visible profile,
  basic search preferences, and one résumé selection; hide profile management,
  priority/tier boards, company-tier MCP writes, role assignments, variant pickers and additional uploads
  while a résumé is selected. Keep saved profiles/files and application snapshots.
- A deliberate résumé selection deactivates saved role assignments without losing
  their contents, so preparation uses the selected fallback file consistently.
- Replace automation tier/threshold controls with one toggle. Explicit saved
  Submission mode supports review-each versus auto-apply without company ranking;
  all fact/answer/authorization/uncertainty checks remain. Legacy policies are not
  silently broadened before the user saves the new setting.
- Update workspace/application guides, workflow references and developer context 103.
- Limits: UI constraint, not a database cardinality restriction. Existing API records,
  hidden preferences and other profile histories remain available; fixtures should
  pin the intended profile. No production code or preference deployment.

- Validation for this pass: 945 tests, 940 passed and 5 explicitly paused Community
  MCP tests; frontend/backend TypeScript checks; data validation (158 roles);
  production frontend build; desktop/mobile fictional browser interactions for
  basic preference edits, single résumé selection and both submission modes;
  no external account requests, page errors or mechanical design findings.

## Restore the previous job-preferences UI

- Restore the existing detailed preferences editor, including priority choices,
  career tradeoffs, profile rules and advanced instructions. Keep company tiers
  hidden as requested; preserve one profile, one selected résumé and the submission toggle.
- No backend, database or saved preference changes in this follow-up.
- Validation: frontend typecheck and production build; 940 tests passed, 5 paused
  Community tests skipped; 158 catalog roles validated; desktop/mobile demo checks
  passed with no external requests or page errors.
