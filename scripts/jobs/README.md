# Shared JOB pilot host

Prospective JOB03/JOB04 host wiring reuses the subscription-backed COM participant
session, transport, service client, structural usage accounting and MCP diagnostics.
Historical freezes and active COM owners/runs are not modified.

Prepare a new private root with `python3 -B scripts/jobs/host.py prepare --case
JOB03|JOB04 --root ROOT --source-manifest PRIVATE_MANIFEST --background
BACKGROUND_DIRECTORY`. JOB03 also needs `mkdir -p ROOT/receipts` before serving.
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
Participant-turn time includes actual MCP startup/discovery/tool latency. Adapter
wall time and container startup are separate; MCP timing/bytes are diagnostics
within the turn, not additional elapsed time. All native calls within participant
turns remain product costs. Final confirmation and grading are outside participant
metrics. Unpriced or partial usage stays unknown.

Keep historical roots and failed no-inference receipts. Runtime files, interpreter,
image, inputs and evidence gates are hash-bound. Changes require a new freeze,
never a repaired participant. Stop only this setup's host/containers afterward.
