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
