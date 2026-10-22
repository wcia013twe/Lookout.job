# Muse feature parity

The website and MCP use the same database ownership and concurrency rules. Agent credentials never take an arbitrary owner ID. Browser RPCs derive the person from `auth.uid()`; agent dispatch derives the owner from the verified, scoped, unrevoked credential. Gateway payload validation rejects unknown arguments.

| User action | Website backend | MCP tool / scope | Boundary |
| --- | --- | --- | --- |
| Inspect / update preparation | `readPreparation`, `savePreparation` | `read_preparation_plan` / `workspace:read`; `update_preparation_plan`, `complete_preparation_task` / `drafts:write` | Saved version required; stale saves fail. Agent planning preserves completed work. |
| Inspect skips | `readSelectionDecisions` | `read_skipped_opportunities` / `workspace:read` | Owned records only. |
| Reconsider skip | `reconsiderSelection(id, expectedReconsideredAt)` | `reconsider_skipped_opportunity` / `activity:write` | Both call the shared owned mutation. Empty timestamp means no prior request; changed tokens fail. Does not apply or alter preferences. |
| Inspect / change quiet settings | `readQuietMode`, `saveQuietMode(settings, expectedPersonalVersion)` | `read_quiet_mode` / `workspace:read`; `update_quiet_mode` / `profile:write` | Same exact settings validation and optimistic personal version. Unrelated preferences survive under lock. Returns `{settings, personalVersion}`. |
| Deliver updates | Runtime transport | `read_delivery_policy`, `acknowledge_delivery` / `workspace:read`, `activity:write` | Policy is advice; acknowledge only after delivery. Owned events and current synthetic decision/deadline IDs only. No built-in background scheduler. |
| Inspect process timeline | `readApplicationTimeline` | `read_application_timeline` / `workspace:read` | Owned immutable milestones, stable chronology, unknown dates remain null. |
| Record process milestone | `recordApplicationMilestone` | `record_application_milestone` / `activity:write` | Shared SQL bounds and timestamp rules. Browser source is user; agents require email message ID, subject, excerpt and received timestamp. A dated event requires explicit timestamp confirmation and timezone. Idempotent event keys reject changed evidence. Never changes status, receipt or approval. |
| Inspect completion record | `readSubmissionRecord` | `read_application_record` / `workspace:read` | Historical attempt materials only; unrelated profile/answer-library/settings snapshots omitted. Human-reported progress is distinct. |
| Download historical résumé | Signed private storage URL | `read_resume` / `resumes:read` | Read the résumé ID from the record. URLs expire and must not enter logs or saved records. |
| Approve exact application | Signed-in `approve_application` | `open_human_application_action(action: approve)` / `workspace:read` | Human-only. Tool returns owned board URL, current revision, `humanOnly: true`, `performed: false`; never mints approval. |
| Resolve uncertain attempt | Signed-in `resolve_submission_attempt` | `open_human_application_action(action: resolve_submission)` / `workspace:read` | Human verifies employer portal/email and records a note. Tool never resolves, retries, or clicks Submit. |

Generic website preference sync uses `save_preferences_preserving_quiet`; it cannot overwrite a concurrently saved quiet setting. Actual quiet changes use the scoped quiet RPC with its current personal version. Guest settings remain local and have no server action.

The human-action URL includes the owned application UUID. The website opens that application after account-scoped workspace hydration. A foreign UUID remains inaccessible.

Milestones include submitted, recruiter calls, technical rounds, interviews and outcomes. Email excerpts remain untrusted source material. Date uncertainty is explicit; adding a milestone does not automatically replan preparation. Human corrections append a new event with a new key and a clear correction label, preserving the original observation.

## Career Toolkit manuals

- Website: `/career-toolkit/` and statically generated `/career-toolkit/<skill>/`.
- Agent: existing read-only `read_guide({id: "career-<skill>"})`, workspace:read.
- Same canonical catalog supplies the UI/manual examples and generated guide bundle;
  `scripts/build-career-toolkit.mjs --check` verifies bundle and source hashes.
- Search, categories, example selection and clipboard copy are local read-only UI
  operations. They create no task, grant, approval, schedule or account write.
- A saved application adds only company/title to a copied request; the agent must
  resolve current owned context through existing tools. No file URLs or credentials.
- Demo requests are explicitly fictional and prohibit real account/external actions.
- Guide routing, scope checks, clone isolation and payload validation have local
  tests. Hosted availability requires the normal gateway release and live verification;
  no deployment or installed upstream executable is claimed by this feature.

Private Network is a presentation layer over the existing contact collection.
Company targets have collection `companies`, company, followUpDate and JSON notes.
The website reuses `save_outreach_contact` and the outreach sync service; agents use
existing `list_contacts`/`save_contact` under existing ownership, revision and scope
checks. No new MCP tool or backend service is advertised. See
[Network UI mapping](../docs/private-network.md).

## Career artifacts and learning goals

The artifact workspace adds scoped list/read/save/archive operations and learning
goal read/save operations. Browser and MCP share the same owned database service
and optimistic versions. Existing planner reads and session completion now include
learning tasks and saved artifact references under one daily budget. See the
[full mapping and release limits](../docs/career-artifacts.md). Local parity tests
do not establish deployed availability; release the migration, gateway/config,
MCP and frontend together and verify the hosted round trip.
