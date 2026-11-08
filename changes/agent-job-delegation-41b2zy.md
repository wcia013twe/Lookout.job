# Agent-managed job analysis and application sets

- Application guide v23 gives any coordinating Agent the simple host-managed subagent flow: small nonoverlapping sets, saved analysis/drafts, exact website review, explicit user continuation and approved-only submission.
- Agent context retains assignments/session references; Lookout retains drafts, approvals, holds, attempts and receipts. Lost sessions recover through a replacement without replaying completed/uncertain work.
- Developer contract 133 and workflow references advertise the updated guide. Website/MCP validation and tools remain unchanged; no UI, schema, watcher or runtime added.
- Demo: existing fictional review and submission batch examples remain applicable; no new product state or interaction needs fixtures.
- Validation: focused guide/submission checks (11 passed), context delivery/version/budget probe, MCP/workflow checks (23 passed after updating two pinned version expectations), catalog validation (158 roles), and git diff --check passed. Final npm test: 1,085 passed, five skipped, zero failures (includes database scenarios). Frontend build omitted: no presentation, auth or client behavior changed.
- Limits: instructions do not install subagents, wake a host or create approval. Gateway release/client refresh, real host delegation/resume and real employer submission remain unverified. No hosted deployment or publication performed.

## Follow-up: orchestrator audits and repairs

- Application guide v24 / developer contract 136 requires the coordinating Agent to check every assigned role and its saved analysis/draft, fill evidence-backed omissions and correct mistakes before the review handoff. Unknowns stay explicit; human edits, holds and approvals remain protected. Submission summaries also require a saved-outcome audit.
- Existing scoped preparation/publication/submission/read tools remain the website/MCP boundary; no new product behavior or demo state is introduced.
- Validation: final npm test passed (1,096 passed, five skipped), focused guide/MCP/workflow tests passed (31), validate:data passed (158 roles), and git diff --check passed. An earlier full-suite execution session disappeared without a completion receipt; the complete rerun above passed. No frontend build needed for this instruction-only follow-up.
- Limits: instruction delivery and source checks cannot establish host compliance; gateway release/client refresh and live execution remain separate.
