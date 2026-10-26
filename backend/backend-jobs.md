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
| `save_backend_schedule` | `backend.schedules.save` | `backendJobs.saveSchedule(payload)` |
| `read_backend_schedules` | `backend.schedules.read` | `backendJobs.readSchedules()` |

MCP reads require `workspace:read`. All three write tools require
`workspace:read`, `preferences:write` and `drafts:write`; discovery hides them when
any required scope is missing. `backend_job_dispatch` derives the connection and
owner from a valid scoped credential and rejects caller-supplied `connectionId`.
The authenticated website adapter calls `backend_job_action`, deriving owner
from the Auth session. Browser submits and schedule saves explicitly select an
owned scoped `connectionId`; browser cancellation remains a human-owned action.
Both routes use the same database ownership, current-version and validation path.
The website adapter checks account identity before and after each request.

Schedules take `kind`, `input`, `intervalMinutes` (15–10080), explicit `enabled`,
`expectedVersion` and `eventKey`, plus `id` when updating. New schedules require
version 0; edits require the current positive version. Jobs and schedules return
sanitized current rows; worker lease secrets are not exposed. Reuse an event key
for an exact retry; changed requests need a new key. Read/reconcile conflicts.
Cancellation uses the current job version and cannot rewrite completed work.

Saving an enabled interval is a request for future execution while the worker
runs and the scoped connection remains valid. Only create or enable schedules on
explicit user authorization. These schedules are separate from My Agent's saved
personal-runtime routines and do not activate them during connection onboarding.
No tool grants LLM reasoning, arbitrary guide execution, browser control,
resume generation, messaging, approval, application submission or Circle sharing.
Guide text stays instructions unless an actual bounded executor is configured.

`createBackend(client).backendJobs` is the browser service boundary; this pass
adds no new page. The detached demo provides a memory-only `backendJobs` service
with fictional queued, running, completed, partial, failed and cancelled states.
Submitting demo work only adds a queued fixture. Demo schedule saves start no
timers, network calls or worker; reset/rebuilding the demo restores its fixtures.

Verification covers strict nested payloads, injected identities, schema bounds,
MCP scope filtering/forwarding, browser RPC parity/account changes, idempotent
fictional retries, cancellation/version conflicts, demo isolation/reset, and
conditional versioned guide descriptions. Database checks and actual Node
API/worker round trips must be run separately before reporting live execution.
