# MCP coverage audit

Scope: every existing product workflow. UI presentation (tabs, animations, filtering
already-loaded records) is not a database action. Runtime-owned scheduling, external
social access and message sending are capability handoffs, never claimed backend tools.

| Workflow | Required MCP boundary | Current status |
| --- | --- | --- |
| Workspace, profile, preferences, answers, resumes, applications reads | workspace_read / read_personal_context | implemented |
| Search profile create/edit/pause | save_search_profile | deployed |
| Personal fact editing | save_profile_facts; human verification handoff | implemented locally; integration audit pending |
| Saved answer create/edit/delete | save_saved_answer, delete_saved_answer; human autofill consent | implemented locally; integration audit pending |
| Resume upload and metadata | create_resume_upload, finalize_resume_upload, add_resume_reference, read_resume | implemented locally; integration audit pending |
| Resume defaults/rules | save_resume_preferences | implemented locally; integration audit pending |
| Company ranking lists | save_company_tiers | implemented locally; integration audit pending |
| Notification and schedule preferences | save_notification_preferences; runtime schedule handoff | implemented locally; integration audit pending |
| Theme and message templates | save_theme_preferences | implemented locally; integration audit pending |
| Application automation permission | human action handoff | implemented locally; integration audit pending |
| Discover, latest batches, saving/opening roles | list_jobs, read_batch, mark_batch_item | implemented locally; integration audit pending |
| Draft preparation, failure, policy | existing preparation/draft/policy tools | implemented |
| Application progress reports | record_application_progress | implemented locally; integration audit pending |
| Submission and evidence | local runner and read_application_record | implemented |
| Exact approval and uncertain recovery | human action handoff | implemented locally; integration audit pending |
| Interview preparation tasks | existing preparation tools | implemented |
| Skipped opportunity reconsideration | reconsider_opportunity | implemented locally; integration audit pending |
| Contacts/referral drafts | list_contacts, save_contact, delete_contact | implemented locally; integration audit pending |
| Public leaderboard read | read_leaderboard | implemented locally; integration audit pending |
| Leaderboard alias/sharing | human action handoff | implemented locally; integration audit pending |
| Connection issue/revoke and sign-in/out | human action handoff | implemented locally; integration audit pending |
| My Agent task definitions and linked card widgets | save_notification_preferences, save_theme_preferences; read_personal_context; publish_batch/read_batch | shared database ownership/version checks verified locally and hosted; gateway discovery/frontend release and external-agent execution pending |
| Pack reveal/open state | local-only presentation; batch-item state through MCP | implemented locally; integration audit pending |

Human handoffs must give a specific link and requested action; they never approve,
verify personal facts, expand scopes, publish private data, or claim external execution.

## Validation and remaining gates

The branch registry contains 53 tools, preserving all 32 interfaces on the current
main branch and adding 20 product tools plus versioned search-profile editing.
The existing guide, outreach, profile setup, quiet settings, submission and
application timeline implementations remain canonical; no compatibility copy is
needed. The new simple reconsideration operation uses selection.reconsider.simple
so it cannot override the existing revision-token interface.

Local validation passes: 235 unit tests, database migrations and owner/scope/version
checks, catalog validation, rebuilt auth bundle and production static export.
The database suite covers profile preservation during ordinary browser sync and
the existing connection profile-setup permission control. Demo profiles include
an active general search and a paused part-time search; edits and reloads remain
isolated from account reads and writes.

Hosted storage verification and HTTP MCP action checks remain pending. The full
migration/function bundle has not been deployed. Earlier preference-only deployment
was approved; automatic approval review rejected the broader remote expansion of
write capabilities. This source change is published as a draft PR without
merge-ready; deployment still needs explicit approval. Do not claim live full parity.

Existing browser services remain supported. Migrating every legacy browser write
to the new shared product RPC is separate integration work; having an MCP boundary
does not imply those legacy paths are already unified.

## Circle Knowledge — implemented, gated pending hosted verification

Browser `knowledge_action` and gateway `agent_dispatch` share the private knowledge
action core. Search/thread reads, proposals/edits, publishing, withdrawal, reports,
and citation recording/retraction/history have scoped MCP tools. Membership, sharing
policy, exact approval and moderation have the explicit `request_circle_human_action`
boundary. Local role, scope, source-event, retry, revision and citation tests pass;
production parity is not advertised until deployment and hosted checks succeed.
