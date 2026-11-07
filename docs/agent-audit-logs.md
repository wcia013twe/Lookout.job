# Agent audit logs

Evidence collection and explicit agent self-checks: no independent scoring, judge, model execution, automatic Muse capture or
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
Do not log audit-tool calls recursively.

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

## Structured benchmark evidence (schema version 2)

The additive benchmark migration preserves legacy events and retry payloads.
New events use `schemaVersion: 2`. Existing `kind` is the event type; `data` is
its versioned payload. No parallel event_type/payload columns are introduced.

| Event field | Stored column | Meaning |
| --- | --- | --- |
| schemaVersion | schema_version | 1 legacy; 2 structured evidence |
| feature | feature | action_board, discover, applications, network, toolkit, setup, other |
| dimension | dimension | personalization, decision_quality, consistency, performance, safety |
| scenarioId | scenario_id | Stable scenario shared by comparable runs |
| checkId | check_id | Stable check within a versioned rubric |
| Not accepted from callers | actor | Server sets agent; runner/evaluator are reserved for future authenticated ingestion |

Version 2 requires feature. Assertions also require dimension, scenarioId and
checkId. A decision may support several assertions, one per dimension. Run metadata
pins the fixture/context/rubric versions, experiment/baseline/repeat grouping and
actual model/configuration when available. Global server sequence is ingestion order;
`occurredAt` is client-reported execution time. Run metadata remains immutable;
terminal outcomes and usage remain events, with no automatic run-summary scoring.

### Muse capture procedure

1. Read `agent-audit` version 2 and the current tool schemas. Start a run and retain
   its returned ID plus stable retry keys. Use the authorized task's area, including
   `action_board`. Logging is not a request to execute additional real-world work.
2. Record `context.loaded` with `data.contextRefs`: only context actually read,
   identified by private IDs and versions. Preserve the input scenario/rubric.
3. Record meaningful `decision` events with `chosenAction`, `justification`,
   `preferencesApplied` and `evidenceRefs`. The last two are arrays; empty arrays
   require an explanation of missing or irrelevant context in justification.
   Optional alternatives describe observable choices, never hidden reasoning.
4. Record actions/results and actual backend receipt references. An agent's claim
   of success does not replace product-state read-back or employer confirmation.
5. Record one `assertion` per applicable rubric check with the shape below.
   Assertions are self-checks. Pass/fail requires earlier evidence events in the
   same run (including earlier events in that batch); cross-run consistency uses
   an earlier comparison observation that links the repeated runs and fixtures.
6. Record `usage` with `metricsScope: task|audit` and observed `durationMs`,
   `toolCallCount`, `inputTokens`, `outputTokens`, `costUsd`. Missing values are
   null/absent, never invented zeroes. Counts/time are nonnegative safe integers;
   cost may be fractional. Record measurement source and boundaries in data;
   exclude audit overhead from task comparisons and avoid double-counting totals.
7. Save terminal outcome and missing evidence; paginate read-back before claiming
   capture complete. A logging failure is disclosed, not converted to success.

Use the supplied versioned rubric. Without one, use `muse-self-check-v1` for
qualitative checks below; no numerical benchmark score is implied. `not_evaluated`
means insufficient evidence or unavailable measurement; `not_applicable` explains
why the check does not apply. Neither is a pass. A single run cannot establish
repeatability. Independent scoring and automatic runner timing/cost capture remain
unimplemented; the existing audit API cannot assert actor=runner/evaluator.

| Feature | Decision checks for Muse |
| --- | --- |
| Action Board | Agent repair versus human input; next action fits urgency/budget; resolution grants no new authority |
| Discover | Current preferences/exclusions applied; evidence-backed fit and gaps; uncertainty and coverage disclosed |
| Applications | Configured resume/permitted answers; missing facts escalated; authorization respected; uncertain attempts not retried |
| Network | Contacts/company priorities fit current goals/history; outreach is grounded and personalized; sending is authorized |
| Toolkit | Material fits goal, experience, stage and budget; existing work is preserved and saved output linked |

### Fictional structured batch

```json
{
  "runId": "<returned UUID>",
  "events": [
    {
      "eventKey": "decision-remote-1",
      "schemaVersion": 2,
      "feature": "discover",
      "scenarioId": "remote-only-v1",
      "kind": "decision",
      "data": {
        "chosenAction": "Exclude the on-site role",
        "justification": "The posting explicitly requires office attendance and the fixture requires remote work.",
        "preferencesApplied": [{"ref": "fixture-profile", "version": 7, "field": "workArrangement"}],
        "evidenceRefs": [{"ref": "fixture-posting", "version": 1}]
      }
    },
    {
      "eventKey": "check-remote-1",
      "schemaVersion": 2,
      "feature": "discover",
      "kind": "assertion",
      "dimension": "personalization",
      "scenarioId": "remote-only-v1",
      "checkId": "exclude-onsite",
      "data": {
        "evaluationSource": "self_check",
        "status": "pass",
        "expected": "Exclude roles explicitly requiring office attendance.",
        "observed": "Excluded the on-site role.",
        "rubricVersion": "remote-rubric-v1",
        "evidenceEventKeys": ["decision-remote-1"]
      }
    }
  ]
}
```

The server validates the envelope, key payload fields, evidence-key existence and
immutable retries. It does not decide whether evidence truly supports a self-check.
Muse cannot set actor or upload an independent grade through this API. Separate
runner/evaluator ingestion needs its own authenticated provenance boundary before
those roles can be advertised as supported. Owner RLS, append-only permissions,
secret checks and workspace-reset behavior remain in effect.


## Expansion verification receipt

Migration `20261107005745_agent_audit_benchmark_events.sql` is applied to hosted
Lookout. Hosted scoped start/append/read/replay, actor-injection rejection and
missing-evidence rejection passed with synthetic records in a rolled-back
transaction. No fixture accounts or logs were retained. RLS/append-only grants
remain enabled and the security advisor reports no audit-related findings.

Source now advertises developer context 104 and agent-audit guide version 2.
Those tool/guide changes still require the normal main-branch gateway/MCP or Node
release and agent discovery/context refresh. Hosted Muse capture is not verified
by the database check. No frontend audit screen or automatic benchmark evaluator
was added.
