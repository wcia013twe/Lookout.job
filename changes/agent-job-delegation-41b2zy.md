# Agent-managed job analysis and application sets

- Application guide v23 gives any coordinating Agent the simple host-managed subagent flow: small nonoverlapping sets, saved analysis/drafts, exact website review, explicit user continuation and approved-only submission.
- Agent context retains assignments/session references; Lookout retains drafts, approvals, holds, attempts and receipts. Lost sessions recover through a replacement without replaying completed/uncertain work.
- Developer contract 133 and workflow references advertise the updated guide. Website/MCP validation and tools remain unchanged; no UI, schema, watcher or runtime added.
- Demo: existing fictional review and submission batch examples remain applicable; no new product state or interaction needs fixtures.
- Validation: focused guide/submission checks (11 passed), context delivery/version/budget probe, MCP/workflow checks (23 passed after updating two pinned version expectations), catalog validation (158 roles), and git diff --check passed. Final npm test: 1,085 passed, five skipped, zero failures (includes database scenarios). Frontend build omitted: no presentation, auth or client behavior changed.
- Limits: instructions do not install subagents, wake a host or create approval. Gateway release/client refresh, real host delegation/resume and real employer submission remain unverified. No hosted deployment or publication performed.
