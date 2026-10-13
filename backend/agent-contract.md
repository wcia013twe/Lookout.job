# Muse gateway HTTP contract

One small HTTP endpoint; no assumption that Muse accepts custom MCP servers.

`POST https://umhqfqzpwmszhcknwtrs.supabase.co/functions/v1/agent-gateway`

Headers: `Authorization: Bearer <credential>`, `Content-Type: application/json`.
Body: `{ "operation": "workspace.read", "payload": {} }`.
Agent responses wrap results in `{data: ...}`. Error responses have `{error: ...}`.
Do not put credentials in URLs, messages, job data, or logs. Store agent tokens in
Muse's local secrets. Service-role credentials stay exclusively inside the function.

## Connect a human-owned agent

Management uses the person's current Supabase Auth JWT, verified with `getUser`.
Use the existing client `functions.invoke('agent-gateway', {body})`.

- `connections.issue`: `{name, scopes, expiresInDays?}`; expiry defaults to 30 days,
  maximum 90. Returns `{connection, token}` once. Show the token once for copying;
  never persist it in browser state. Maximum 10 active connections per owner.
- `connections.list`: `{}` → `{data: [connection...]}`. No token/hash returned.
- `connections.revoke`: `{id}` → `{data: connection}`; only owned IDs accepted.

Connection fields: id, user_id, name, scopes, created_at, expires_at, revoked_at.
The UI should mark revoked/expired keys, and let users revoke lost credentials.
Agent credentials cannot manage connections. Human sign-in cannot bypass scopes by
calling agent operations. Public RPCs are executable only by service_role.

## Agent operations

Scopes can be narrowed independently. Agents have no approval/submission endpoint.

| Operation | Scope | Payload/result |
|---|---|---|
| `context.versions` | `workspace:read` | `{}` → exactly `{personalVersion,developerVersion}` |
| `context.personal` | `workspace:read` | `{}` → `{personalVersion,settings}` (owned profile/preferences/answers/resume metadata) |
| `context.developer` | `workspace:read` | `{}` → developer version, stable interaction instructions, defaults and capability flags |
| `credentials.verify` | Valid key, no extra scope | `{}` → id/name/scopes/expiry for authenticated discovery; no candidate data |
| `resumes.read` | `resumes:read` | `{resumeId}` → `{resume,url}` with 60-second private file URL or external reference URL |
| `workspace.read` | `workspace:read` | `{}` → profile, preferences, saved answers, resume references and latest 100 owned applications |
| `batches.publish` | `batches:write` | `{eventKey,label,date?,jobs}` → immutable batch, items and personalized `?batch=UUID` link |
| `drafts.prepare` | `drafts:write` | `{jobId,expectedRevision,draft,blocker?}` → application with current revision |
| `activity.append` | `activity:write` | `{eventKey,kind,applicationId?,data?}` → persisted event; actor is always agent |
| `approvals.read` | `approvals:read` | `{applicationId}` → owned application and exact approval matching current revision, or null |

A batch has at most 100 jobs. Existing catalog jobs use
`{jobId,recommendation?}`. New employer postings use
`{canonicalUrl,employer,recommendation?}`. `canonicalUrl` must be HTTPS;
`employer` accepts only whitelisted public job fields (company/title/location/description/compensation/etc.), never
candidate information. The public catalog is shared: put fit notes, personal
rankings and reasons only in the **private recommendation** object. Existing
catalog records are never overwritten by this endpoint. Duplicate jobs reject
and roll back the whole batch. Retry the same eventKey to receive the original
batch unchanged; use a new eventKey for a new morning batch.

A first draft uses `expectedRevision: -1`; existing drafts require the exact
revision from workspace.read. A stale revision returns 409. Updating a draft
invalidates approval through the existing database version trigger. Final-stage
applications cannot be drafted again. The draft uses the same resumeId,
questionsReviewed, questions and optional runner metadata as the web app.
Agents cannot mark questions reviewed. Changed drafts set questionsReviewed=false and enter Awaiting approval (or Blocked); the person must review and check the form in the UI. Exact retries ignoring that human-only flag preserve approval.

Transition activity is owned by database triggers; activity.append is for extra
agent observations, not proof of submission. Reusing an eventKey returns its
original event unchanged.

Approval response: `{application,approval}`; an approval has
`{id,user_id,application_id,revision,snapshot,approved_at}`. Snapshot contains
`{draft,profile,resume}`. No new approval is minted by reading it. Actual browser
submission requires separate runner capabilities and rechecking current approval.
Resume references include object paths, not bytes or permanent public URLs.
A separate resumes:read grant permits retrieving one owned file URL; object paths are derived exclusively from owned database rows. Never log signed URLs. The runner downloads the URL immediately; signed file links expire after 60 seconds.

## Verification and operations

`node --test tests/agent-gateway.test.mjs` validates key generation and the request
contract. Run `backend/agent-gateway-check.sql` through hosted SQL to verify
atomic batches, ownership, stale drafts, expiry and revocation without durable
fixture records (the transaction rolls back). HTTP 401/403/409/404 map to invalid
credential, missing scope, stale revision and missing owned record respectively.

The gateway deliberately has no schedules, SMS transport, ATS submit function,
queue framework, refresh tokens, or general SQL tool. An agent can search locally,
publish a batch, prepare drafts, and return the link to its user using its own
supported notification channel. Tokens require manual replacement after expiry.

Context operations accept no caller-supplied owner or cache state. Personal
version counters are private and read-only to clients. Checks never consume
updates, so several agents remain independent. Full settings are returned only
on explicit personal-context reads, not on the two-number check. Personal theme
messages take precedence over the developer defaults; neither can alter approval
or submission semantics. See `mcp/README.md` for cache/reset behavior.
