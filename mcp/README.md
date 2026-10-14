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

`read_developer_context.skills` includes the complete versioned cold-outreach skill. Check `read_outreach_workspace` (`workspace:read`) each connected run for queued company requests and contact revisions. Save researched contacts and messages using `save_outreach_package` (`drafts:write`) with requestId, stable eventKey and contacts. Existing contacts require id/expectedRevision; preserve changed human details by rereading on conflict. The platform retains human outreach status and never sends messages. No local skill installation, prompt copy or JSON import is part of the user flow.

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
