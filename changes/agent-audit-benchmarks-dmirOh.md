# Structured Muse audit evidence

- Expand agent_audit_events with schema version, feature, dimension, scenario/check
  IDs and server-assigned agent actor. Retain legacy observations and exact retries;
  add action_board as a run area and a partial index for benchmark assertions.
- Extend shared Node/Edge/MCP validation for context, decisions, qualitative
  assertions and observed usage. Self-checks require rubric/expected/observed/status
  and earlier same-run evidence; reject forged evaluator identity, missing evidence,
  malformed metrics and conflicting retry envelopes. Missing evaluation is explicit.
- Publish agent-audit guide version 2 and developer context 104 in local source.
  Muse directions cover all five retained features, context/preferences/evidence,
  meaningful decisions, per-dimension self-checks, pinned fixtures/rubrics,
  repeatability limits, task versus audit metrics, missing capture and safe retries.
- Applied migration to hosted Lookout (osyrlausutnqzlegxmnd); aligned the CLI-created
  migration filename with the hosted migration version 20261107005745. Verified
  hosted scoped start/append/read/replay, evaluator spoof rejection, missing-evidence
  rejection and API grants using synthetic records in a rolled-back transaction.
  No synthetic accounts, connections, runs or events remain. No audit-related
  security-advisor findings; pre-existing unrelated findings are unchanged.
- Validation: full suite 948 tests: 943 passed, 5 paused Community tests skipped;
  focused audit/guide/workflow suite 30 passed; data validation 158 roles;
  git diff --check. Initial sandboxed suite could not bind loopback; full suite
  passed with loopback access. Fictional fixtures cover all five areas and populated
  legacy migration compatibility. No frontend audit UI, so no demo UI changes.
- Limits: no push or gateway/MCP/Node deployment. Hosted Muse needs normal main
  workflow release, then developer-context/tool discovery refresh and agent-audit
  v2. Logging remains explicit; automatic host traces, independently authenticated
  runner/evaluator ingestion, benchmark execution and score aggregation are not
  implemented. Agent self-checks never become independent grades or product state.
