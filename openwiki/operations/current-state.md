# Current State and Recent Changes

Reviewed against repository source and committed change notes on 2026-11-06. The other OpenWiki pages were generated on 2026-10-27 and may be stale; this supplement is not a complete regeneration. Confirm details in code and tests before relying on them.

## Workspace and preferences

The assignment scope currently pauses Community, shared interview reports, packs, appearance extras, XP/leaderboards and the dashboard tour behind a reversible feature switch. Discover, Applications, Network, Career Toolkit, profile and agent settings remain in scope. See `changes/agent-audit-log-F48PPv.md` and the feature flags in `lib/` for the current boundary.

The workspace presents one profile and one selected résumé in the simplified flow; the detailed job-preferences editor was restored, while company tiers remain hidden. Job preferences include security clearance eligibility, company size ranges and selectable industries. Saved backend records are not restricted to a single profile merely by the UI. See `next-app/components/profile-workspace.tsx` and the relevant `changes/` notes.

“What your agent knows” contains optional decision briefs used in Discover fit analysis. The search guide directs agents to ground assessments in candidate and employer evidence and preserve unknowns. See `changes/agent-context-TdGVvy.md` and the canonical search guide under `supabase/functions/agent-gateway/skills/`.

## Search and agent operations

A search preflight checks saved targeting before creating a run. Missing title filters can produce `search_filters_not_ready` with recovery details; the worker does not silently broaden targeting. The pinned Career Ops adapters provide filtering and ATS description retrieval subject to liveness and identity checks. See `changes/careerops-search-wiring-*.md` and `backend/runtime/`.

Private append-only agent audit runs and events have scoped start, append and read tools. Authorized core work and resumed change wakes use the agent-audit guide for logging; audit records are observations, not submission proof. Availability in a particular environment depends on its deployed migration, gateway and MCP versions. See `supabase/functions/agent-gateway/skills/` and `changes/agent-audit-log-F48PPv.md`.

Discover batch items can be removed through the scoped `remove_discover_job` action. Removal hides the owned item in Discover while retaining its batch history, shared catalog entry and applications. Availability depends on deployment of the migration and gateway; see `changes/discover-remove-7PMSxi.md`.

## Delivery and verification

New sessions must read the quickstart and this page. Use a separate feature checkout, preserve concurrent work, complete a change note and land routine completed work into local main as directed by `AGENTS.md`. Prefer the external SSD when available; use internal storage when it is not. Local code, hosted backend and published frontend can be at different versions. Do not infer deployment or live external behavior from local tests or change notes.
