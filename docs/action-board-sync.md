# Action Board persistence and agent editing

The Action Board is a view of owned application, preparation and outreach records.
It does not need another table or a generic database-edit tool. Signed-in writes
use Supabase; guest preparation stays in the account-separated browser store and
is not automatically imported on sign-in. Demo uses disposable fictional memory.

| Board data/action | Supabase boundary | Agent tool and scope |
| --- | --- | --- |
| Application handoffs, blockers and draft answers | `applications`, revision-checked draft/failure mutations | `workspace_read` (`workspace:read`), `prepare_draft`, `report_application_failure` (`drafts:write`) |
| Interview dates, source evidence, resources and task completion | `preparation_plans`, `save_preparation_plan` | `read_preparation_plan` (`workspace:read`), `update_preparation_plan`, `complete_preparation_task` (`drafts:write`) |
| Shared weekly plan and completion history | `preparation_planner_settings`, `preparation_sessions`; `read_preparation_planner`, `save_preparation_budget`, `complete_preparation_session` | Same three tool names; `workspace:read`, `preferences:write`, `drafts:write`, respectively |
| Company research and dated next actions | `company_workspaces`, maintained `companies` identities; `company_action` | `list_companies`, `list_company_workspaces` (`workspace:read`), `save_company_workspace` (`network:write`) |
| Profile setup and approval/submission verification | Existing human-only verification and application mutations | `request_human_action`, `open_human_application_action` (`workspace:read`) return handoffs; they cannot grant approval |

Company targets use the complete typed record described in
[`private-network.md`](private-network.md). Legacy `list_contacts`/`save_contact`
company projections route through the same company workspace service. Agents must
preserve unrelated record fields and pass the current `expectedRevision`. Plan edits require the current
`expectedVersion`; session completion copies targets/versions from the planner.
Only record actual user-reported preparation progress. Editing dates or scheduling
work does not complete it. Opening an application link does not apply.

The browser uses the same owned SQL mutations as the gateway. Database ownership,
scopes and optimistic versions remain authoritative. Session completion is atomic
and idempotent across browser and MCP retries. See
[`preparation-planner.md`](preparation-planner.md) for the shared model and tests.

The planner refreshes its separate RPC snapshot after matching account cloud-ready
events (normally every 15 seconds while account sync is healthy), window focus and
reconnection. Agent edits to an existing application no longer require navigation
or a new application ID. Refreshes skip active planner writes, preserve unsaved
budget input and use generation guards to discard superseded responses. Individual
plan read/write adapters also reject responses if the signed-in account changes.

## Hosted audit on 2026-10-22

Read-only checks of project `umhqfqzpwmszhcknwtrs` found:

- `applications` and `preparation_plans` exist with RLS enabled.
- `save_preparation_plan` and `save_outreach_contact` exist.
- The current `companies` registry and `company_workspaces` tables and
  `company_action` RPC are absent.
- `preparation_planner_settings`, `preparation_sessions`,
  `read_preparation_planner`, `save_preparation_budget`,
  `complete_preparation_session` and `perform_platform_action` are absent.
- Hosted `agent-mcp` version 19's source does not include
  `read_preparation_planner`, `save_contact` or the new company workspace tools.

The repository supports these operations, but the hosted deployment is **not
ready** for the full current Action Board. In particular, an authenticated weekly
planner cannot load against the audited database. This audit did not change any
account records, create credentials or deploy code.

Release the reconciled migration chain and matching gateway/MCP from integrated
main before claiming hosted parity. Relevant repository migrations include
`20261014030000_platform_mcp_actions.sql`,
`20261014031000_mcp_contacts_uploads_progress.sql` and
`20261015205745_aggregated_preparation_planner.sql` and
`20261022060633_durable_company_hub.sql`. Do not blindly apply a list of
missing version numbers: the hosted migration history has some same-purpose
migrations under different timestamps. Check dependencies and actual definitions.
The existing Pages deployment does not deploy the backend; this repository has no
backend deployment workflow (see [`sites-hosting.md`](sites-hosting.md)).

After backend release, verify tool discovery with the intended connection/scopes,
then round-trip a user-authorized plan, budget, completion and company follow-up
through browser and MCP. Reload in another session to confirm persistence and
check stale-version rejection. Local database scenarios cover shared services,
scope denial, foreign ownership, atomic rollback and cross-transport retries;
they do not establish live-account readiness.

## Demo verification

`tests/action-board.test.mjs` simulates agent budget and existing-plan updates
through the disposable demo services, refreshes the board snapshot, and checks
that application IDs stay unchanged and a fresh fixture resets the edits. It also
checks account-filtered refresh events and listener cleanup. Existing interactive
demo budget/session controls continue using those same services without private
storage or employer actions.
