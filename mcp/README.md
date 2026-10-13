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
| workspace_read | workspace:read | Private facts, preferences, answers, applications |
| publish_batch | batches:write | Private morning batch and its board link |
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
