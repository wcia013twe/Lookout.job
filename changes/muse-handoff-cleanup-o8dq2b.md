# Muse application handoff cleanup

Consolidated the active Muse browser procedure and removed conflicting paused-runner and replacement-job instructions. Compact draft responses remain the default; an inspected successful full response can replace only the immediate draft read. Human handoffs still verify the Action Board, and submission still requires fresh authorization and evidence.

Recovery rereads current application/request/attempt state, preserves human answers and terminal request history, distinguishes historical idempotent receipts from current state, and retries acknowledgement alone after a verified saved outcome. Shared-connection host processes must serialize their writers; no browser ownership is inferred from a connection claim.

Existing MCP tools and database writers are unchanged. Developer151, application-workspace37 and change-resumption6 align core instructions, tool descriptions and feed routing. No API, migration, service, dependency or workflow store was added.

Validation: 42 focused application/prefill/guide/recovery tests and four detached demo tests passed. Data validation passed for 158 roles. Final `npm test`: 1,157 passed, five skipped, zero failures (116 seconds). Final affected guide/tool checks: 36 passed. `git diff --check` passed. Serialized startup plus bootstrap is within the 6 KB limit. The full persisted draft/revision comparison uses migrated SQL; host recovery cases are explicitly injected fictional handlers, not proof of real Muse behavior. Demo recreation preserves a terminal uncertain request, rejects reclaim, leaves the role unapplied and resets independently.

Verification limits: no hosted deployment, runtime activation, real account changes, employer actions or Muse host recovery were performed. A local guide/protocol cleanup does not establish that a running gateway or host has refreshed it. Frontend production code is unchanged; no frontend build was needed. Existing unrelated main-checkout edits were preserved.

Validation also exposed an existing UTC week-rollover collision in the material date test: seeded demo content matched its broad search. The assertion now counts only the exact document created by that test, preserving its duplicate check without changing product behavior. The three focused material-date tests and final full suite pass.
