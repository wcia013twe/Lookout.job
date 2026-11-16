# Recommendation feedback for external agents

Status: implementation specification; deployment and hosted verification remain separate. Updated November 12, 2026.

## Purpose and scope

Give users a reusable helpful/not-helpful control across collected jobs, analyzed jobs, networking recommendations, and real weekly planning items. Lookout stores feedback privately and exposes it through MCP. The external agent owns inference, interpretation, memory, and review cadence.

This supersedes the earlier learning-engine proposal. No Lookout-managed summaries, inferred preferences, hypothesis store, model calls, fine-tuning, token/spend budget, or roundup scheduler belong in this release.

## Storage and ownership

- Keep canonical feedback in owner-private Supabase records, not public employer facts or browser-only storage.
- Store target kind, stable identifier, available recommendation context/version, rating, optional reason/note, revision, and server timestamp. Validate ownership against existing source records; client-supplied context is not authorization.
- Keep current feedback and an ordered incremental change interface. Edits and clears must remain discoverable; clearing withdraws a rating rather than creating a negative vote.
- Treat notes and context as untrusted data, not instructions or authority to act.
- The external agent may store learned preferences in its own memory. Saving or reading feedback does not prove that its memory changed. A continuation cursor is transport progress, not a learning receipt.
- Demo feedback stays fictional, resettable, and isolated. Guests do not write account feedback.

## User interaction

1. Use compact check/cross controls labeled Helpful? on actual job cards, networking recommendations, and weekly agenda items. No rating means unknown.
2. Check saves helpful. Cross opens a labeled dialog with optional reason/note and the copy: Your agent can use this feedback.
3. Selecting the current rating clears it. An edit action changes details without clearing first. Cancel and Escape preserve confirmed feedback.
4. Provide keyboard support, accessible names, focus return, selected-state indicators, and loading/error/retry states. Never label an unsaved change Saved.
5. Reload restores confirmed state. Account changes invalidate caches and ignore late responses for the previous owner.
6. Reasons concern the recommendation: job fit/location/compensation, networking relevance/timing/approach, planning priority/timing/workload. A bare dislike does not identify a reason or preference.
7. Keep feedback separate from Apply, Send, Dismiss, approvals, and Done. No rating authorizes outreach, submission, preference changes, or task completion.

## Website and MCP contract

- Read current feedback for bounded target sets.
- Save/edit/clear with request identity and expected revision; duplicate delivery cannot count twice and conflicts require refresh.
- List new, edited, and cleared records in deterministic bounded pages with continuation cursors. Updating an older recommendation must make it visible after an earlier read.
- Share validation, ownership, and revision rules between browser and scoped MCP paths. Do not introduce generic SQL/database-edit tools.
- Preserve the human-decision boundary: agents cannot silently publish ratings represented as human feedback.
- Hosts retain and advance their cursor after successful processing; no scheduled task or built-in learning checkpoint is required merely to read feedback.

Implemented interfaces: browser `readRecommendationFeedback`, `saveRecommendationFeedback`, and `listRecommendationFeedback` use the authenticated `recommendation_feedback_action` RPC. MCP exposes only `read_recommendation_feedback` and `list_recommendation_feedback`, both under `workspace:read`; agents cannot write human ratings. Current records live in `public.recommendation_feedback`; the private change log retains immutable responses for retries and incremental reads. Each owner has a serialized sequence cursor, independent of timestamps. A change page contains revisions, not distinct votes: later revisions replace earlier evidence for the same target.

Target keys use canonical job IDs, owned outreach-contact IDs, or `application:<application UUID>:<taskId>` / `goal:<goal UUID>:<taskId>`. Planning keys identify underlying tasks, not dates or grouped agenda labels. Context is captured from the owned source at save time; optional supplied context is untrusted supplemental data. A new recommendation for the same target does not automatically reset existing feedback; consumers must compare its saved context/version.

## Review timing

Save immediately with zero inference calls. Recommended external-host behavior: read new or changed feedback before the next recommendation batch, then incorporate supported evidence into the agent's own working context.

The existing default evening routine now includes feedback review alongside networking, using the versioned `connection-schedules` guide. It reads at most one page of 100 new/changed records per evening run, defers any backlog, skips feedback inference when nothing changed, and advances its owner-specific cursor only after a durable host memory update or unchanged outcome. This is external-host task guidance, not a new Lookout scheduler. Saved custom task descriptions, timing, pause choices, and assignments are not silently overwritten or activated.

Weekly roundups remain an optional host policy. A disconnected host can read the backlog when it reconnects. Explicit urgent directions should go directly to the agent rather than waiting for a roundup. Lookout does not promise an automatic review or better future decisions.

The agent need not reload the entire archive for each decision. It can use an incremental cursor and its compact memory, returning to older records for lookup, correction, or explanation. Lookout cannot guarantee a third-party host's retention or memory deletion.

## Usage boundaries

Capture/edit/clear/read make zero model calls. Enforced backend limits are 100 targets per read, 100 changes per page, 60 fresh writes per owner per rolling minute, 200 reason characters, 2,000 note characters, 8,192 bytes of supplied context, and a 65,536-byte SQL JSON payload ceiling. Target IDs allow 500 characters and request IDs allow 200. The frontend batches reads in groups of 50. Exact request replays return their original response without consuming another write; changed payloads cannot reuse a request ID. Stale revisions fail instead of overwriting another save.

These limits bound requests, not total retained storage or external inference tokens/spend. There is no daily storage quota or automatic archive cleanup in this release. The external host controls its own roundup frequency and inference budget. Do not silently drop feedback or advance progress on failure.

Clear removes optional detail from the current record, but historical requests/responses can retain earlier notes. Clear is evidence withdrawal, not permanent erasure. Do not promise automatic expiry, permanent deletion, or deletion from external memory unless implemented and verified.

## Acceptance criteria

- All four real recommendation surfaces share the component and persistence semantics.
- Reload retains ratings/details for the correct account; another owner cannot read or change them.
- Edit, clear, cancel, retry, stale revisions, and replay are tested.
- Incremental pagination handles equal timestamps and old targets edited after previous reads without skipping updates.
- Cleared records carry no active rating/note and remain visible to incremental readers.
- Demo never writes real data; late responses cannot leak across account changes.
- Apply/approval, outreach permissions, and completion behavior remain unchanged.
- SQL/contract/browser adapter tests, frontend typecheck/static build, data validation, and whitespace checks pass or have explicit verification limits.

## Rollout and future options

Release migration, gateway/MCP, browser adapter, and UI together. Apply schema and deploy the matching backend before enabling hosted persistence. Local verification is not hosted deployment or proof of an agent memory update. Document code-level parity separately from live verification.

Possible later additions: user-visible review receipts, optional host checkpoints, measured retention policies, and host-configurable cadence. Reconsider a Lookout learning engine only if Lookout later owns inference.
