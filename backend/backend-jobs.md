# Bounded backend jobs

The Node API/worker adds a narrow `search_ats` execution path alongside the
existing Edge gateway and personal-agent tools. It requires the backend-job
migration, a configured API and a running worker. The committed contracts and
local tests alone do not establish hosted deployment or worker availability.

A job takes only `kind: search_ats`, `input: {profileId}` and a stable `eventKey`
(1–160 nonblank characters without control characters). Source configuration and
profile rules come from the owned active saved profile, never caller-provided
code, URLs, SQL, owner identities or lease tokens. Supported public ATS sources
can be scanned and official observations saved with coverage diagnostics.
Unsupported sources, incomplete coverage and unknown eligibility remain explicit;
a queued/running row is not a completed search or a verified fit assessment.

| MCP tool | Operation | Website service |
| --- | --- | --- |
| `submit_backend_job` | `backend.jobs.submit` | `backendJobs.submit(payload)` |
| `read_backend_jobs` | `backend.jobs.read` | `backendJobs.read({jobId?})` |
| `cancel_backend_job` | `backend.jobs.cancel` | `backendJobs.cancel({jobId,expectedVersion})` |

MCP reads require `workspace:read`. Both write tools require
`workspace:read`, `preferences:write` and `drafts:write`; discovery hides them when
any required scope is missing. `backend_job_dispatch` derives the connection and
owner from a valid scoped credential and rejects caller-supplied `connectionId`.
The authenticated website adapter calls `backend_job_action`, deriving owner
from the Auth session. Browser submits explicitly select an
owned scoped `connectionId`; browser cancellation remains a human-owned action.
Both routes use the same database ownership, current-version and validation path.
The website adapter checks account identity before and after each request.

Jobs return sanitized current rows; worker lease secrets are not exposed. Reuse
an event key for an exact retry; changed requests need a new key. Cancellation
uses the current job version and cannot rewrite completed work.

My Agent routines in `preferences.search.schedule` are the single schedule
configuration. Muse's actual authorized runtime owns recurrence; on each real
scheduled invocation it submits one bounded Node job and reads the outcome.
Saving a routine does not configure a runtime scheduler by itself. Connection
setup still registers only explicitly enabled/assigned routines and does not run
their work. Node polls the job queue; it has no recurring search scheduler.

The retirement migration archives existing backend schedules in the owned private
request ledger, then removes the schedule table and timer execution path. It does
not create Muse runtime automations or duplicate those old schedules into My
Agent. Old jobs keep their historical `schedule_id` as provenance without a
foreign key or executable schedule. Existing jobs, results and My Agent routines
remain intact. Archived configuration is removed by the existing workspace reset.
Old scheduler tools and direct API/SQL operations are rejected after release.
Deploy the database migration, gateway/MCP contract and Node worker together;
older workers that still call the removed timer need restarting on this release.

The search tools grant no LLM reasoning, arbitrary guide execution, browser control,
resume generation, messaging, approval, application submission or Circle sharing.
Guide text stays instructions unless an actual bounded executor is configured.

`createBackend(client).backendJobs` is the browser service boundary; this pass
adds no new page. The detached demo provides a memory-only `backendJobs` service
with fictional queued, running, completed, partial, failed and cancelled states.
Submitting demo work only adds a queued fixture; there are no schedule methods
or timer fixtures. Reset/rebuilding the demo restores its job fixtures.

Verification covers strict nested payloads, injected identities, schema bounds,
MCP scope filtering/forwarding, browser RPC parity/account changes, idempotent
fictional retries, cancellation/version conflicts, demo isolation/reset, and
conditional versioned guide descriptions. `tests/backend-scheduler-removal.test.mjs` verifies a seeded upgrade through an
actual Node HTTP/MCP server and disposable SQL database.
`node scripts/check-local-scheduler-removal.mjs` checks archival, timer rejection
and queue/website/reset safeguards on real local Docker PostgreSQL, rolling back
all schema and fixture changes. Neither proves a hosted release.

`queue_application_job` adds a separate scoped `applications.submit_job` boundary for durable guarded application execution; it is not a new search kind accepted by generic submit_backend_job. See [Discover application jobs](../docs/discover-application-jobs.md).
