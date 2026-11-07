# Agent audit logs

Collection only: no scoring, judge, model execution, automatic Muse capture or
external submissions. Tables are private to their owner and append-only for API
roles. Database administrators can maintain them; this is not tamper-proof storage.

- `public.agent_audit_runs`: immutable task, area, live/controlled mode, metadata,
  originating connection, server ingestion time and retry key.
- `public.agent_audit_events`: run ID, ordered server sequence, event retry key,
  kind, summary, tool name, optional client event time, JSON evidence and recording
  connection. Client timestamps and outcome claims are observations. A stored
  submission claim does not replace the actual submission-attempt receipt.

## Agent tools and access

| MCP tool | Database operation | Required scopes |
| --- | --- | --- |
| `start_agent_audit_run` | `agent_audit_dispatch` → `audit.start` | workspace:read, activity:write |
| `append_agent_audit_events` | same → `audit.append` | workspace:read, activity:write |
| `read_agent_audit_run` | same → `audit.read` | workspace:read |

Node routes directly to the dedicated credential RPC. Edge exposes the same
validated operations and RPC. Both derive ownership from the validated connection;
callers cannot supply an owner. Revoked/expired connections fail closed. Any current
connection for the same owner with appropriate scopes can resume logging; each
new event records its actual connection ID. Retried events keep their original ID.

Signed-in owners can read the same tables with the normal Supabase client/RLS or
inspect them in Supabase Table Editor. There is no new frontend audit UI. Anonymous
clients cannot access logs. Authenticated clients cannot insert, update or delete
rows, and the service API role has only select/insert privileges. Account deletion
and the existing explicit workspace reset remove logs; no automatic expiry or
scheduled pruning is introduced.

## Capture convention

The developer-context lookup now requires `read_guide` → `agent-audit` for authorized
Discover, Applications, Networking and Career Toolkit work, including resumed change
wakes. Startup routes to the same guide; the developer version refresh invalidates
stale instructions. This is instruction-driven capture, not a host interception hook.

Start one run per task execution with a stable eventKey. Metadata should include
actual model/configuration, runtime, code commit, prompt/guide versions, task and
experiment IDs, fixture version, candidate/profile version and initial context.
Unknown values stay absent or explicitly unknown. Large snapshots can be appended
as events rather than repeated on every event.

Suggested event kinds: `run.started`, `message`, `context.snapshot`, `tool.call`,
`tool.result`, `decision`, `source.snapshot`, `state.snapshot`, `artifact`, `usage`,
`error`, `user.question`, `user.answer`, `run.finished`, `run.failed`,
`run.interrupted`. Use data for toolCallId, parentEventKey, applicationId,
backendJobId, source URL and retrieval time, redacted source text, document IDs and
hashes, actual token usage/cost/latency, stop reason and missing-capture indicators.
Keep observable actions and brief decision summaries; never hidden chain-of-thought.

Append promptly, at most 25 events and 200 KB encoded JSON per request, with at
most 128 KB per event's data (and run metadata). Oversized evidence can use multiple
redacted events with artifactId/chunkIndex/totalChunks. Keep failed and partial
runs. A crashed run remains incomplete unless a later observer records that fact.
Do not log audit-tool calls recursively. Save a request before each domain tool call
and its result/error afterward, sharing a toolCallId. If capture fails, pause the
logged test before the next domain action; recover exact pending writes and identify
known gaps. Verify the terminal event by paginated read-back before claiming the log
was saved. Missing host-native observations must remain explicitly unavailable.

Redact secrets before storage. The API/database reject common secret field names,
Lookout credentials, Bearer strings and signed Storage links. This is a guard
against accidents, not complete free-text secret detection. Store durable private
artifact references instead of short-lived signed URLs; do not expose candidate
content in public run exports.

Every event has a stable per-run eventKey. Exact retries return the existing row;
changed content conflicts. Batches are atomic. Server sequence is ingestion order,
not reconstructed execution time. Read 1–20 events per page, then supply
`afterSequence: nextSequence` while `hasMore`. Save the last cursor to read later
arrivals after an interrupted capture.

## Fictional example

```json
{"eventKey":"fictional-task-1","task":"Find a suitable backend role","area":"discover","mode":"controlled","metadata":{"fixtureVersion":"v1","model":"record-actual-model"}}
```

Pass the returned run ID to append:

```json
{"runId":"<returned UUID>","events":[{"eventKey":"step-1","kind":"tool.result","toolName":"verify_job_posting","summary":"Fictional posting checked","data":{"toolCallId":"call-1","url":"https://example.test/jobs/1","status":"active","latencyMs":25}}]}
```

The tests use fictional users, runs, events and isolated databases. They cover
ownership, append-only privileges, exact replay, conflicting-batch rollback,
pagination/late events, secret rejection, scopes, revocation, Node/MCP routing and
workspace-reset fencing. No real user content or employer application is used.

## Release boundary

The migration can be applied independently to the existing Lookout database.
Gateway/MCP and Node tools still need the normal committed-main release. Refresh
agent tool discovery/developer context and read `agent-audit` after release.
Creating tables does not automatically record Muse messages or native tool traces;
Muse or its host must call these tools with available redacted observations.
