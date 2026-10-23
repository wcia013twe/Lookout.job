# Code Mode benchmark pilot

- Added an isolated fictional email-to-Lookout replay comparing sequential direct,
  parallel direct, and trusted local code orchestration using the same scoped MCP
  operations. Production behavior and agent instructions are unchanged.
- Saved raw offline results and a reproducible protocol with explicit limitations,
  fair live-model baselines, adverse cases and adoption gates.
- Validation: offline replay passed 14 invariant assertions; npm test passed all
  459 tests; npm run validate:data passed. No frontend or service changes; demo
  fixtures/interactions remain unchanged because no product feature was added.
  Experiment fixtures are fictional, reset per run, and perform no external writes.
- Limits: no live model endpoint was configured. No measured model token, latency,
  cost or semantic accuracy improvement; no production sandbox, hosted MCP or
  email integration verification. The replay uses mock persistence and identity.


Follow-up: added a database-backed replay through the production email milestone
operation, request/MCP validation, dispatcher and migrated local PGlite database.
All 27 size/arm/repetition runs and 18 adverse-case runs passed. Snapshots prove
identical milestones, no cross-owner writes, unchanged statuses and no forged
receipts or approvals. Synthetic response-loss retry remains idempotent. This
closes the mock-persistence gap locally; hosted gateway/client and model metrics
remain unverified. Authentication availability was rechecked without exposing keys.
