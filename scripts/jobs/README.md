# Shared JOB pilot host

Prospective JOB03/JOB04 host wiring reuses the subscription-backed COM participant
session, transport, service client, structural usage accounting and MCP diagnostics.
Historical freezes and active COM owners/runs are not modified.

Prepare a new private root with `python3 -B scripts/jobs/host.py prepare --case
JOB03|JOB04 --root ROOT --source-manifest PRIVATE_MANIFEST --background
BACKGROUND_DIRECTORY`. The host creates its receipts directory when probing.
Preparation clones a fresh fictional local owner and verifies the exact context
and resume. It never resets the source owner. Keep all roots private.

Start `python3 -B scripts/jobs/host.py serve --root ROOT`. This process holds only
that owner's lock. It serves the argv recorded in `ROOT/adapter.json` to the
existing case coordinator. Use `node scripts/job03/task.mjs` (or job04) with
`--action preflight --root ROOT --adapter ROOT/adapter.json --output
ROOT/receipts/preflight.json`. Inspect ready/status/blockers; process exit alone is
not readiness. Only then use the same coordinator with `--action run --execute
--root ROOT --adapter ROOT/adapter.json --preflight ROOT/receipts/preflight.json
--pair UNIQUE_PAIR_ID`.

The actual no-inference preflight tests native artifact/milestone save and
readback, restores only its fictional fixtures, checks native guide versions,
starts both isolated subscription containers, and verifies default-tool discovery
and wrapper scope. JOB03 adds durable SQLite reminders with a fixed event clock
and one interrupted fictional preview. These services are identical for both
conditions; they establish neither a Lookout scheduler nor employer integration.
Independent final review follows both attempts. Readiness, successful reads and
completed turns are never quality passes.

Both conditions get identical requests and evidence. Storage orientation and
native startup differ intentionally. Proactive effort savings are unmeasured.
Prospective participant-turn time uses monotonic elapsed time and includes actual MCP startup/discovery/tool latency. Wall time, wall-minus-monotonic drift and budget overruns are retained separately; significant drift/overrun confounds timing. Historical times remain unchanged. Adapter
wall time and container startup are separate; MCP timing/bytes are diagnostics
within the turn, not additional elapsed time. All native calls within participant
turns remain product costs. Final confirmation and grading are outside participant
metrics. Unpriced or partial usage stays unknown.

Keep historical roots and failed no-inference receipts. Runtime files, interpreter,
image, inputs and evidence gates are hash-bound. Changes require a new freeze,
never a repaired participant. Stop only this setup's host/containers afterward.

After both attempts terminate, run `python3 -B scripts/jobs/audit.py --root ROOT
--output ROOT/receipts/structural-audit.json`. It checks captured intent/evidence
parity and integrity, reports time/cost coverage, and hashes supplemental actual
prompts/full onboarding for the reviewer. It does not grade quality or publish to
Langfuse. Retain backend-clock alignment and shared-host-load limits when interpreting
time or calendar behavior; a harness-clearing pilot is not a measured comparison.

## Post-pair audit and prospective launch block (2026-11-09)

`jobs-host-v2`, JOB03-tracking/grade-v4 and JOB04-preparation/grade-v3 add
DNS/TLS probes inside both containers without authentication or inference, native
backend clock comparison, and per-turn clock rechecks. All stage timestamps must
align within five minutes of the backend clock. The compressed multi-day fixtures
currently fail this gate: an isolated backend clock aligned per stage is still
required. Do not mutate the shared backend clock or shift only one condition's
facts, remove date-dependent native tools, or bypass the gate to launch a pair.
A DNS/TLS pass does not establish ongoing model availability.

The November 9 historical JOB03 pair completed 8/8 turns in each condition;
JOB04 completed 7/7 baseline and reached 3/7 Lookout turns before timeout. JOB04's
raw stderr records model-endpoint DNS failures, while the 300-second turn took
about 588 wall seconds. JOB03 also has a completed wall-budget overrun. The old
runtime did not record monotonic/wall drift, so suspension, clock adjustment,
Docker/host delays and participant behavior cannot be fully separated. This is
external-failure evidence and a timing confound, not a clean participant timeout.
No historical attempt was resumed or retried.

Audit v2 retains failed-turn elapsed time and supplemental native-call diagnostics
from raw host traces even when the coordinator received no response. These
observations do not backfill frozen usage counters. JOB04's total participant
cost and failed-turn effort remain incomplete; subscription billing and unpriced
processing stay unknown. Scripted prompts are not observed human effort.

A fresh independent reviewer graded the terminal frozen evidence after both
attempts, with a user-authorized Terra 6.1 medium grading-only exception. All
participants remained pinned to subscription Terra 5.6 medium. JOB03 has quality
gaps in both conditions; JOB04 Lookout remains a partial review with four
unreached checkpoints. Clock/transport/timing confounds prevent a measured
comparative claim. Private submissions, attestations and final results are saved
alongside the historical runs, without changing freezes or recorded outcomes.

Finalization now verifies frozen inputs, rubric, manifests, reviewer binding and
run evidence without requiring today's execution files to equal retired runtime
bytes. New execution still requires all original runtime/executable hashes.
Separate implementation/operator audits cannot supply semantic ratings.

## Isolated clock substrate (not yet connected to the pilot host)

`isolated_clock_database.py` creates a new owner-labeled PostgreSQL container and
volume with no network and no published ports. It replays the exact repository
migrations over a minimal fictional Auth/Storage SQL bootstrap; it neither clones
shared database contents nor changes production schema or clocks. The native HTTP,
Auth and Storage services are not established by this fixture. Every existing root
is rejected for preparation; stop checks container ID/owner/network and preserves
its volume and receipts.

Build the separate pinned test image with:

```sh
docker build -f scripts/jobs/clock-postgres.Dockerfile -t lookout-job-clock-postgres:0.1 scripts/jobs
python3 -B scripts/jobs/isolated_clock_database.py prepare --virtual-clock --root NEW_PRIVATE_ROOT
python3 -B scripts/jobs/probe_isolated_clock.py NEW_PRIVATE_ROOT
python3 -B scripts/jobs/isolated_clock_database.py stop --root NEW_PRIVATE_ROOT
```

The clock uses a ticking process-local `libfaketime` offset, leaving monotonic
host timing intact. A fixed absolute clock was rejected after an actual native
`pg_sleep` probe failed to complete; that setup and failure are retained. The
JavaScript fixture loader uses the same offset file and is never imported by a
production entry point. Clock advancement requires an explicit timezone, refuses
rewinds and records native SQL readback. Both paths fail closed on invalid data.

The reusable no-inference proof creates only fictional rows in its own empty
fixture: native artifact save/shelf reads change as the date passes; native sleep
progresses; the unmodified preparation feature dispatcher saves/reads a plan with
JavaScript and SQL on the same simulated date. This establishes the clock substrate,
not complete host parity or readiness. Native HTTP/MCP, full candidate-context
cloning, per-stage clock acknowledgements and complete paired host preflight must
still be connected and verified. The existing host-v2 launch gate remains closed.


## Native HTTP clock integration and retained launch blocks

Prospective `jobs-host-v3` connects the isolated database to unmodified product
PostgREST, Edge gateway and Node API on dedicated private networks. Only the
loopback MCP endpoint is published. Image IDs, native source hashes and immutable
Edge npm payload hashes are bound in the freeze. Use a fresh backend root:

```sh
python3 -B scripts/jobs/isolated_backend.py prepare --root NEW_BACKEND_ROOT --at 2026-11-09T14:00:00Z
python3 -B scripts/jobs/host.py prepare --case JOB04 --root NEW_PILOT_ROOT --source-manifest PRIVATE_MANIFEST --background BACKGROUND_DIRECTORY --backend NEW_BACKEND_ROOT
```

The earlier `serve` and coordinator preflight commands then apply. Stop with
`isolated_backend.py stop --root NEW_BACKEND_ROOT`; owner/ID guards preserve
unrelated services and retained volumes. Do not restart a shared Docker engine.
The bootstrap provides SQL Auth/Storage tables, not real Auth/Storage services.
Both participants receive the exact local PDF; remote Storage retrieval remains
unverified. Full canonical settings, including false/null/zero/empty fields, are
included once in baseline onboarding and verified against the native clone.

SQL and JavaScript use the same ticking simulated clock. Each stage is observed
without a native task read; host clock control is separate harness time. Preflight
restoration is permitted only before any attempt and only for the bound pilot.
Discovery, startup instructions, guides and JSON/Unicode tool responses pass
through unchanged. All granted native tools remain available on demand; scope
and ownership are enforced by the native server. Real discovery, audit calls,
reads/writes and verification inside turns count as product costs. The native
audit-contract probe rolls back its fictional transaction. Negative permission
proof requires a real scope/ownership denial; HTTP 406 is a protocol error.

JOB03-tracking/grade-v6 and JOB04-preparation/grade-v4 prescribe the same
retrieve/save/verify obligations in each storage orientation. Actual prompt text
and hash are captured; invalid/partial timing remains unknown, with wall time
retained separately. Scripted requests are not observed human effort.

Two earlier full no-inference freezes passed the then-current 17 JOB03 / 15 JOB04
gates. They do not clear subsequent tool-surface and reference changes. The next
fresh attempt failed before provisioning because Docker stopped responding;
private logs and all preceding failed/prototype roots are retained. No inference
was launched. Final-source native-surface/audit gates still need a live run.

JOB03 v6 reconciles the prospective withdrawn-state reference: its active
preparation blocker is cleared, while initial/historical saved evidence remains.
The reference-contract gate rejects terminal references that retain active
preparation blockers. Historical frozen references/grades remain unchanged.
Shared reminder and preview services accept either the saved application key or
native UUID and normalize both to one state; the same identifiers and tool
schema are supplied to both conditions. Unknown IDs fail without mutation.
A preflight gate proves key/UUID idempotence and one-time interruption recovery.
The partial form is deliberately the shared fictional preview service, including
saved name/email field markers; it is not a seeded employer form or a native
question-prefill test. Native initialSavedState retains the same fixture evidence.
Actual standalone service proof passed; both cases still need the final-source
live native/container preflight. No new pair is cleared by this work.
