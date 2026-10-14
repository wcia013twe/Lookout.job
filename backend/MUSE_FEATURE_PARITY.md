# Muse feature parity

The website and MCP use the same database ownership and concurrency rules. Agent credentials never take an arbitrary owner ID. Browser RPCs derive the person from `auth.uid()`; agent dispatch derives the owner from the verified, scoped, unrevoked credential. Gateway payload validation rejects unknown arguments.

| User action | Website backend | MCP tool / scope | Boundary |
| --- | --- | --- | --- |
| Inspect / update preparation | `readPreparation`, `savePreparation` | `read_preparation_plan` / `workspace:read`; `update_preparation_plan`, `complete_preparation_task` / `drafts:write` | Saved version required; stale saves fail. Agent planning preserves completed work. |
| Inspect skips | `readSelectionDecisions` | `read_skipped_opportunities` / `workspace:read` | Owned records only. |
| Reconsider skip | `reconsiderSelection(id, expectedReconsideredAt)` | `reconsider_skipped_opportunity` / `activity:write` | Both call the shared owned mutation. Empty timestamp means no prior request; changed tokens fail. Does not apply or alter preferences. |
| Inspect / change quiet settings | `readQuietMode`, `saveQuietMode(settings, expectedPersonalVersion)` | `read_quiet_mode` / `workspace:read`; `update_quiet_mode` / `profile:write` | Same exact settings validation and optimistic personal version. Unrelated preferences survive under lock. Returns `{settings, personalVersion}`. |
| Deliver updates | Runtime transport | `read_delivery_policy`, `acknowledge_delivery` / `workspace:read`, `activity:write` | Policy is advice; acknowledge only after delivery. Owned events and current synthetic decision/deadline IDs only. No built-in background scheduler. |
| Inspect completion record | `readSubmissionRecord` | `read_application_record` / `workspace:read` | Historical attempt materials only; unrelated profile/answer-library/settings snapshots omitted. Human-reported progress is distinct. |
| Download historical résumé | Signed private storage URL | `read_resume` / `resumes:read` | Read the résumé ID from the record. URLs expire and must not enter logs or saved records. |
| Approve exact application | Signed-in `approve_application` | `open_human_application_action(action: approve)` / `workspace:read` | Human-only. Tool returns owned board URL, current revision, `humanOnly: true`, `performed: false`; never mints approval. |
| Resolve uncertain attempt | Signed-in `resolve_submission_attempt` | `open_human_application_action(action: resolve_submission)` / `workspace:read` | Human verifies employer portal/email and records a note. Tool never resolves, retries, or clicks Submit. |

Generic website preference sync uses `save_preferences_preserving_quiet`; it cannot overwrite a concurrently saved quiet setting. Actual quiet changes use the scoped quiet RPC with its current personal version. Guest settings remain local and have no server action.

The human-action URL includes the owned application UUID. The website opens that application after account-scoped workspace hydration. A foreign UUID remains inaccessible.
