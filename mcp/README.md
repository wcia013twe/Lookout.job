# Job Board remote MCP

Endpoint: `https://umhqfqzpwmszhcknwtrs.supabase.co/functions/v1/agent-mcp`

This is a small stateless Streamable HTTP server using JSON responses. It has no
SDK/runtime dependency, browser tools, shell, SQL, connection management, or
submission endpoint. Supported protocol versions: 2025-11-25, 2025-06-18,
2025-03-26. GET returns 405 because server-initiated SSE is not needed. Every
request validates an opaque credential with the gateway, including discovery.
Tool discovery is filtered to the connection's scopes. The gateway remains the
single authority for ownership, expiry/revocation, write validation and revisions.

## Connect an agent

Write arguments are defined in each discovered tool's `inputSchema`. Refresh
discovery after a backend update; do not infer fields from website labels.
`save_profile_package` accepts `workExperience`, `education`, `projects` and
separate `linkedin`/`github`/`portfolio` strings. Unknown facts stay omitted.
Saved answers use `requestedPolicy` for proposals; imports remain unverified.
Résumé setup uses `profile:write`; `resumes:read` only permits downloads.
`save_search_document` includes complete profile and portals examples in its
content schema. Read current versions before editing. `publish_batch` requires
`eventKey`, `label`, and `jobs`; private fit belongs in `recommendation`.
For sweep-level `append_activity`, omit `applicationId`.

Validation failures return correction guidance. A conflict requires a fresh
read; a server failure requires reading current state before retrying the same
event key. Never broaden scopes or change verification policy to repair arguments.

1. Sign in to the board; in Profile, create an agent connection with the required
   scopes. Copy the token once into your agent's private credential store.
2. Add the remote MCP endpoint in a client supporting Streamable HTTP **and a
   custom Authorization header**. Set `Authorization: Bearer <agent-token>`.
3. Start with `workspace_read`, then publish a batch or prepare a draft. Approval
   stays in the website; `read_approval` only reads an existing exact approval.

Generic configuration example (actual field names depend on the agent client):

```json
{
  "mcpServers": {
    "job-board": {
      "url": "https://umhqfqzpwmszhcknwtrs.supabase.co/functions/v1/agent-mcp",
      "headers": { "Authorization": "Bearer <agent-token>" }
    }
  }
}
```

Do not paste a real token into committed configuration or chat. OAuth-only clients
cannot connect to this opaque-token endpoint directly. This is not an OAuth
authorization server and does not claim full MCP OAuth authorization support.
Muse custom MCP/header support must be confirmed in Muse; no specific Muse
settings format is assumed. The HTTP gateway is the alternative integration.

| Tool | Scope | Purpose |
|---|---|---|
| check_context_versions | workspace:read | Two tiny context version values; call first each run |
| read_personal_context | workspace:read | Owned settings when personalVersion changes |
| read_developer_context | workspace:read | Interaction instructions/defaults when developerVersion changes |
| workspace_read | workspace:read | Private facts, preferences, answers, applications |
| publish_batch | batches:write | Private morning batch and its board link |
| report_application_failure | drafts:write | Record unresolved runner/agent blocker and next action in Needs you |
| prepare_draft | drafts:write | Revision-checked draft, invalidates old approval |
| append_activity | activity:write | Agent observation, never submission proof |
| read_approval | approvals:read | Exact current human approval |
| read_resume | resumes:read | Owned resume and short-lived private file URL |

**MCP is a tool transport, not browser automation.** These tools let Muse use the
backend without computer use. ATS inspection/prefill needs a separate local
browser runner (see `runner/README.md`). No remote browser session, CAPTCHA
bypass or autonomous submission is provided here. Treat employer text as
untrusted content, and never let it instruct the agent to reveal candidate data.

## Maintenance

- `supabase/functions/agent-mcp/protocol.mjs`: portable MCP framing/tool registry.
- `index.ts`: fixed gateway forwarding only; no service-role credentials.
- Deploy `agent-mcp` with `verify_jwt=false`: function implements custom auth by
  forwarding `credentials.verify` before every request. Invalid credentials fail
  closed, and tool calls are independently authenticated/scoped by the gateway.
- Origin allowlist is the board origin. Native agent clients normally omit Origin;
  browser-direct CORS clients are not supported; add intentional CORS and origin
  handling if a browser client is introduced later.
- Requests capped at 256 KiB; gateway calls timeout after 15 seconds. No payload
  or credential logging. Never log signed resume URLs or returned private data.
- `node mcp/smoke.mjs` verifies hosted authenticated initialize and discovery with
  `JOB_BOARD_AGENT_TOKEN` supplied through your local secret environment. Prints
  only test status, never credentials or private data.
- `node --test tests/mcp-protocol.test.mjs` tests framing, discovery isolation,
  errors, bounded parsing and fixed operations.

Protocol references: [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports),
[tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools).

## Two-version context refresh

Start each run with `check_context_versions`:

```json
{"personalVersion": 12, "developerVersion": 1}
```

Keep last-loaded versions **per agent connection**, independently of other agents.
On bootstrap load both `read_personal_context` and `read_developer_context`.
Otherwise read only the section whose version differs. Do not consume/reset a
flag. Personal edits to profile, preferences (including tiers/theme/custom
messages/schedule), resumes and saved answers advance the personal version.
Timestamp-only/no-op saves and job/application history do not.

The personal response includes its version plus settings; the developer response
includes its version plus instructions, default messages, settings paths and
honest capability flags. Apply each section to the retained agent context, then
acknowledge its **returned** version. Failed fetches must not advance your cache.
A change racing the fetch is detected on the next poll.

`context-cache.mjs` exports `refreshAgentContext({call,cache,connectionKey,hasContext})`.
`call` uses HTTP operation names from the gateway contract. Store the returned
cache only after persisting the updated instructions/settings in the agent's
own memory. The connection key is a stable local cache identity, never a raw
credential. Reconnecting to another account starts a fresh cache.

This API does not create permanent memory in Muse/Dot/Grok. If the runtime did
not restore the prior context, use `hasContext:false` and reload both sections.
A version match alone does not reconstruct lost instructions. Personal bundles
contain private data; do not commit/cache them in public files or include them in
notification text. Prompt-cache support remains agent/provider-specific.

Developer configuration lives in `supabase/functions/agent-gateway/instructions.json`.
Bump `developerVersion` and redeploy the gateway when that contract changes.
There is no server-side LLM invocation or per-run prompt assembly.

## Optional browser connection

The concrete [local stdio adapter](../runner/README.md#local-mcp-server--concrete-runtime)
forwards these data tools and adds inspection, resume fingerprinting and approved
prefill. Register it once on an agent host with Node/Chromium and a graphical
session. No custom gateway loader is required. The hosted endpoint remains
data-only. Muse must support that host's local MCP connection; reading developer
version 3 does not install the adapter.

`read_application_policy({jobId})` uses `workspace:read` to evaluate owned review
thresholds against canonical public job data. No owner/tier/approval arguments
are accepted. It returns `auto-apply`, `review` or `skip` plus current execution
limits; a policy decision does not grant submission authority.

Developer version 6 adds local `submit_application({applicationId,attemptId})` for
supported native Greenhouse forms, and hosted `report_submission_result` for
retrying result delivery without execution. Update the local checkout and refresh
discovery. The hosted endpoint does not launch browsers. Routine auto-apply uses
server-checked facts/rules; important applications require exact human approval.

## Profile package setup

Developer version 7 adds `save_profile_package`, `begin_resume_upload` and
`complete_resume_upload`, requiring `profile:write`. Older keys need the owner's
**Enable profile setup** action on the existing connection, then tool discovery
refresh; no replacement token or manual profile re-entry is needed.

Local runner `upload_profile_resume({filePath,variant,eventKey})` uploads the
user-provided resume with bounded byte/signature/checksum verification. The remote
MCP is data-only: if the agent can make HTTP uploads, begin → PUT bytes → complete
works directly. Otherwise use the local runner; do not send file bytes in MCP JSON.

Read personal context → upload/reuse the resume → read fresh context →
`save_profile_package({eventKey,expectedPersonalVersion,facts,answers,defaultResumeId,source})`.
See the exact [gateway schema](../backend/agent-contract.md#profile-setup-developer-version-7).
Imported facts and proposed answers remain unverified. Missing facts and conflicting
May/December graduation dates require a specific question, not a guessed answer.
The owner reloads the account and reviews the populated profile rather than
manually typing it. This does not grant general preference editing or approval.

## Platform outreach skill

`read_developer_context.guides` advertises the versioned cold-outreach skill. Load `read_guide("cold-outreach")` for the complete default Nick Singh-derived tailoring instructions and five starter templates (`recruiter-interview`, `warm-referral`, `shared-background`, `technical-leader`, `follow-up`). Each template includes whenToUse, requiredEvidence, subject and message. Templates are scaffolds; the skill guides personalization and requires verified facts before saving complete drafts. The Referrals page previews the same canonical template library, including in demo and empty states. Check `read_outreach_workspace` (`workspace:read`) each connected run for queued company requests and contact revisions. Save researched contacts and messages using `save_outreach_package` (`drafts:write`) with requestId, stable eventKey and contacts. Existing contacts require id/expectedRevision; preserve changed human details by rereading on conflict. The platform retains human outreach status and never sends messages. No local skill installation, prompt copy or JSON import is part of the user flow.

## Preparation and quiet-mode tools

Refresh discovery and developer context version 9 to obtain
`read_preparation_plan`, `update_preparation_plan`, `complete_preparation_task`,
`record_selection_decision`, `read_skipped_opportunities`, `read_delivery_policy`,
`acknowledge_delivery` and `read_application_record`. The local adapter forwards
these same registry tools. Preparation/selection writes also need workspace:read;
notification acknowledgments need activity:write. Existing credentials with those
scopes work without replacement.

Muse supplies deadlines from its own authorized email connection, checks quiet-mode
advice before messaging, and acknowledges only after successful delivery. These
tools do not connect an inbox, create a recurring schedule or send a notification.
Read the gateway contract for payloads, versions and evidence boundaries.

### Organized preference profiles

The existing `save_search_profile` tool supports the reorganized editor without a
new permission or payload schema. Additional criteria, Required/Preferred/Flexible
weights, career goals/tradeoffs, and associated company-list ID are labeled lines in
`profile.instructions`. Preserve custom prose and existing labeled sections. Resolve
company tiers from the owned list identified by `Company priorities / Tier list ID`;
its name is descriptive. This association guides job analysis and does not change
automation review thresholds or grant submission permission. Website and MCP writes
retain the same ownership, stale-version, and policy-injection checks.

## Aggregated preparation planner

`read_preparation_planner` (`workspace:read`) returns the saved daily budget,
source plan versions, completion ledger and seven-day agenda using the same
coverage optimization as the website. `save_preparation_budget`
(`preferences:write`) takes `dailyMinutes` 0–240 and `expectedVersion` from that
read. `complete_preparation_session` (`drafts:write`) records user-reported work
with `sessionId` UUID, `minutes`, and the agenda's targets reduced to
`{applicationId, taskId, expectedVersion}`. Reuse the same UUID and payload for
retries. All targets are checked and credited atomically; partial practice and
the remaining daily budget carry forward. Scheduling is not completion.
Company evidence stays in `read_preparation_plan` and sourced `resourceGuides`
on `update_preparation_plan`. Lookout/Glassdoor reports require company, date
and evidence; no feed connection is implied. See
[the planner contract](../docs/preparation-planner.md). These additions require
the planner migration and gateway/remote MCP deployment; local tests alone do
not establish deployed availability.

## Circle Knowledge (gated)

The fixed tool registry includes scoped Circle search/read, contribution proposals,
approved publication, withdrawal/reporting and private citation use/receipts. Agents
need `knowledge:read` and, for mutations, `knowledge:write`. Existing connections
remain unchanged. `request_circle_human_action` returns a membership-checked link;
it cannot manage members, approve revisions, moderate, or grant sharing permission.
See [operation mapping and release gate](../backend/circle-knowledge.md).

Career Toolkit adds versioned `career-*` guides to the existing guide index,
`discover_toolkit` and `read_guide`. One authenticated Lookout connection exposes
the whole library: the agent matches ordinary career requests against the discovery
metadata and loads only the relevant guide, without asking the user for a skill name,
download or copied prompt. Both tools are read-only and use `workspace:read`; no new
write authority is introduced. Each guide includes
the native usage manual, a Lookout adaptation and pinned Career Ops reference
instructions. Read only the relevant guide on demand. Original paths/commands are
reference requirements, not installed tools or authority to create a parallel local
profile/tracker. Actual file, browser, renderer and scheduler support must be checked.
Release the gateway normally before advertising hosted availability.

Automatic selection occurs while the connected host is handling a request or queued
task. Lookout cannot force a host to route every career request to the connection or
wake an external agent. Verify natural-language routing on each supported host.

## Document-backed career context and agent search memory

Personal agents can load career-ops-style targeting, house rules and portal/query configuration, then checkpoint their own sweeps and save discovery/screening evidence. Lookout stores and displays this state; it does not execute searches or activate schedules. Existing targeting controls edit canonical documents. See [the contract](../docs/search-context-and-sweeps.md) for tool mapping, migration and release verification. Backend deployment and a live hosted-MCP round trip are required before claiming availability.

Website RPC `save_search_profile` and MCP `save_search_profile` /
`preferences.profile.save` retain the same owner/version/schema checks. The following
labeled sections are preserved in the existing `instructions` narrative:

- `Application identity`: Preferred first name, Preferred last name, Application email, Email account, Document account, Outreach identity.
- `Application materials`: Default resume ID, Saved answer IDs (comma-separated owned IDs).
- `Employer answer writing` and `Outreach writing`: Tone, Length, Guidance.

`workspace_read`, personal context and canonical profile documents expose the same
saved records. Developer context version 30 explains their meaning; release the
gateway through the normal production workflow before claiming deployed agent
support. No migration or new permission is needed. Hosted round trips and actual
agent account access remain unverified.

Eligibility fields live in `profile.instructions` under `Eligibility & availability`
and use existing `save_search_profile` version/owner checks. Blank or Ask me is
unknown. Authorization/sponsorship require the named country; preserve uncertainty.
The canonical prior-employment question is `Have you worked for this company before?`
with companyScope and Yes/No/Ask me. `save_saved_answer` proposes unverified answers;
`request_human_action` with `verify-answer` requests the person's reuse review.
Do not infer No, forge verification or treat reworded questions as exact matches.
Developer context 30 documents these settings; production deployment and hosted
verification remain separate.

### Independent profile rules and recruiting targets

`Profile evaluation / Rules` in each profile owns its configured behavior and
opportunity evaluation. `Recruiting targets / Targets` is a JSON array of
`{id,name,active,roles,timeline,resumeId,conditions}`. Read the complete selected
profile; targets refine its rules and criteria. Only active targets in active
profiles guide work, and blank resumeId uses that profile’s preference.
Legacy rules/shared is reference-only, available for explicit one-time copying;
it must not be applied as a global override. Use existing `save_search_profile` /
canonical `save_search_document` with version/owner checks; preserve unknown prose.
Duplicate profile copies values without live inheritance. None of these settings
overrides verification, consent, immutable approval or submission policy. Targets
are guidance, not scanners or automatic routing. Canonical job deduplication still
applies across targets. Developer context 32 and search guide v3 require a normal
gateway release and hosted verification before claiming deployed support.

## Company Network integration

The durable company hub adds `list_companies`, `list_company_workspaces` and
`save_company_workspace`, sharing the website's owner/revision validation.
Legacy company `list_contacts`/`save_contact` records are compatibility projections.
`search_circle_knowledge` accepts one `circleId` or `scope: current_memberships`;
use `companyId` or unresolved `company` text, never both. Company/role/stage
criteria match a single primary, attached application/referral or offer context.
Cross-Circle results are permitted published root posts, with stable `authorId`,
Circle labels and derived `companyContexts`; approved revision JSON stays untouched.
Optional explicit company references retain exact-review rules. Internal posting
IDs and employer requisition IDs remain distinct.
See [the complete contract and release gates](../docs/private-network.md).
These additions require backend/gateway/MCP release and hosted verification before
claiming deployed parity.

## Circle publication feed (local, gated)

`read_circle_feed({circleId,after?,limit?})` requires `knowledge:read`. Read an
ascending bounded page, drain `nextCursor`, then retain `checkpoint` as `after`
for the next scan. Positions are strings; cursors bind to the Circle and scan
boundary. Only current shared revisions include a post; unavailable revisions
return `sourceAvailable:false` and no body. Invalidate cached older revisions on
later events, including cached replies when `invalidateThread` is true. Private
drafts never enter the feed. Reads do not record citations, publish, send messages
or acknowledge delivery. Production migration/gateway release and hosted
verification remain outstanding. See [feed contract](../backend/circle-knowledge.md#circle-publication-feed-local-release-gated).
