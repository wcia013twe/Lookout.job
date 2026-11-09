# JOB04: pipeline-aware interview preparation

JOB04-preparation-v3 uses the [shared JOB host](../scripts/jobs/README.md) with
per-freeze native/container preflight gates. JOB04 compares
specificity and factual grounding; it does not measure usefulness, coaching
quality or interview outcomes. No model run or account mutation is implied by a
passing scripted harness test.

## Scenario

Both conditions receive the same candidate/resume, fictional saved applications
and bounded employer evidence. Application A moves through the following events;
unrelated application B must keep its pending availability question and state.

| Checkpoint | Expected behavior |
| --- | --- |
| Submission acknowledgement | Record receipt; no unsolicited interview-prep pack |
| Confirmed recruiter screen | Save source-backed stage/date and targeted screen prep |
| User screen debrief | Retain reported migration-tradeoff gap; expected technical round stays unconfirmed |
| Confirmed technical round, fresh session | Save actual round and adapt prep to distributed systems plus reported gap |
| Duplicate invitation + meeting-link correction | Update logistics, reuse existing substantive prep |
| Rejection/cancellation | Close upcoming interview work; retain historical material |
| Final reconciliation, duplicate rejection | Retrieve saved state and explain accurate status, saved work and pending gaps |

Seven checkpoints span six sessions. Only adjacent technical/logistics turns share
a session. Neither receives a standing-goal prompt or automatic onboarding replay.
Both receive identical email-review requests, evidence, debriefs and final
reconciliation intent. Scheduled preparation is disabled for this comparison;
proactive effort savings are not measured. Lookout gets native retrieve/save guidance;
baseline may retain files. Candidate context appears once in baseline onboarding;
Lookout retrieves equivalent context. The actual runtime must verify parity.

The host reuses COM's pinned Terra medium subscription Session and structural cost
capture. Native initialization/default tools are forwarded with only scope/audit
isolation; supporting tools are discovered on demand. Each native call remains a
product cost. Startup/discovery latency and response bytes are diagnostics within
the turn. Container startup and adapter wall time are separately captured. Native
confirmation uses a separate workspace-read credential after participant timing.
Owner-specific application IDs are remapped consistently in released evidence.
Historical v1 roots and failed setup receipts are preserved. Interpreter symlinks
bind to the executable bytes rather than failing merely because of installation
layout. A completed pilot still needs fresh independent semantic review.

Interview guides and product configuration are frozen. No real scheduler, live
research, external contacts, submissions or automatic mock execution are involved.
Official/role evidence is the fixed fictional source packet; question predictions
must be labeled inference. Real source research is a later variation.

## Measures and grading

Time, effort, quality and cost are separate dimensions. No combined score.

- Time: actual active participant-turn duration. Event-to-completion minute is
  separately computed only when the independent reviewer confirms a complete
  checkpoint. Fixed answered-question waiting is reported separately.
- Effort: unique captured and independently cited additional user demands;
  prescribed initiations separate. Categories can overlap and must not be summed.
- Quality: stage-specific pipeline correctness, appropriate generation/non-generation,
  grounded candidate/role/round specificity, debrief adaptation, persistence,
  unrelated preservation and final report fidelity. Anchors: 0 unmet, 1 partial,
  2 fully supported. More text or company-name mentions alone earn no credit.
- Cost: existing [shared accounting](eval-cost-accounting.md) from structural
  per-turn counter deltas, with input/cached/output coverage. Default rates are
  empty, so USD is unknown, not zero. API-equivalent estimates are not subscription
  invoices. Preflight/harness/grader cost is explicitly unmeasured and excluded
  from participant totals. Freeze a separately reviewed rate policy prospectively
  if estimating USD; no live price lookup or retrospective rate changes.

A coordinator dispatches one fresh final grader, `fork_turns:none`, only after both
terminal attempts. Exclude implementers, coordinators, operators and participants.
Generated templates, role attestation, freeze hashes and actual artifact citations
are required before finalization. The grader extracts semantic saved state from
native records or equivalent baseline files and rates only relevant checkpoints.
Paired results compare grounded specificity, not usefulness. State/semantic results
remain visible when they disagree; a successful tool read is not a quality pass.

Native adherence is separate: used_correctly / attempted_but_failed / omitted /
not_applicable, supported by observable calls and resulting state. Terminal native
read-only confirmation and baseline file capture are outside participant time,
effort and cost. Failed confirmation stays a failed receipt. Completed process
status alone never proves that the preparation is saved or correct.

## Execution and readiness

The host-neutral CLI uses one JSON request/response per argv adapter process,
without shell interpolation. It never imports credentials. A real dedicated host
adapter is still required; a template or synthetic adapter cannot prove liveness.

```sh
node scripts/job04/task.mjs --action prepare --root NEW_ROOT --configuration PRIVATE_CONFIG.json --candidate COM_CANDIDATE_KIT
node scripts/job04/task.mjs --action preflight --root NEW_ROOT --adapter ADAPTER_ARGV.json --output NEW_ROOT/receipts/preflight-1.json
# Only after explicit run authorization and matching successful real preflight:
node scripts/job04/task.mjs --action run --root NEW_ROOT --adapter ADAPTER_ARGV.json --preflight NEW_ROOT/receipts/preflight-1.json --pair JOB04-pilot-1 --execute
```

Configuration must identify a dedicated local owner and matching read-only owner,
actual captured product configuration, model/reasoning and explicit runtimeFiles
covering the adapter entry script/binary and dependencies. Adapter argv and file
hashes are bound by preflight and rechecked at run. All scenario, grader, evidence,
candidate, guide, cost-policy and coordinator files are frozen at preparation.
Changing any requires a new setup. One run attempt per root; no resets or rescue.

Readiness requires actual receipts for:

1. Matching model, current guides, isolated sessions and released-only evidence;
   no future facts, grader inputs or credentials visible to participants.
2. Complete native/baseline candidate and resume parity.
3. Native save/read, revision/read, exact replay, stale and foreign-owner rejection,
   linked debrief, round correction, unrelated preservation, no practice credit,
   separate read-only confirmation and restoration of disposable probe data.
4. No-inference host rehearsal of fresh/resumed sessions, controlled actor,
   duplicates, closure, readback/capture failures, timeout and missing usage.
   Unresolved errors block ready. Synthetic test success is not a live receipt.

Readiness is not established by documentation or unit booleans. Adapter owners
must retain concrete backend/runtime evidence supporting those receipts. Missing
host/native capability blocks launch; existing native product source/discovery
alone is insufficient. Capture setup failures under unique receipt filenames and
preserve them when correcting infrastructure; never silently retry participants.

## Adapter contract

Requests contain operation, benchmarkTaskId JOB04, ownerId and, for condition work,
condition and stage/session. Every response binds requestHash (SHA256 of
JSON.stringify(request)), receiptId, capturedAt and ownerId. No secrets may appear
in responses; authentication stays host-side. Operations:

- capabilities: actual/non-synthetic isolated runtime, capabilities, guide versions.
- context.parity: matching full profile/preferences and resume hash, backed by reads.
- native.probe: disposable write/revision/conflict/read/restore evidence listed above.
- host.rehearsal: no-inference injected-failure and session-isolation proof.
- condition.setup: initialize the dedicated native fixture for Lookout or isolated
  baseline files; never reset ordinary account state or the other condition's files.
- snapshot: pipeline, milestones/sources, full artifacts/revisions/links, active prep
  tasks and sentinel state. Native and baseline representations may differ.
- participant.turn: bounded real model execution, session/resume, trace, toolTrace,
  saved files, interactions with unique ID/question/answered/categories, isolation
  receipt, and optional cost in the existing structural-delta format. Unknown usage
  remains unknown. The adapter must apply actor() to released-only user events;
  it cannot volunteer answers, infer completion or leak future reference facts.
- native.readonly_confirmation / baseline.final_files: post-terminal durable evidence,
  with owner/query/revision attribution. These never alter participant state.

The adapter must preserve raw receipts/traces. Runtime/transport failure is a
harness failure; a recorded model timeout or execution failure is a participant
outcome. Both conditions are retained. Missing required capture remains
unverifiable. No adapter or live backend is bundled by the scenario coordinator.

After execution, dispatch the grader from grading/handoff.json, record its returned
agent ID and explicit exclusion roster, then provide the assignment hash:

```sh
node scripts/job04/task.mjs --action assign --root ROOT --reviewer FRESH_AGENT_ID --excluded EXCLUDED_ROLES.json
node scripts/job04/task.mjs --action finalize --root ROOT --submission GRADER_SUBMISSION.json
```

Final JSON is local. No external telemetry upload or dashboard change is performed.
Use the existing common cost contract if a later authorized exporter is added.

## Historical v1 verification

Fourteen focused tests pass, including a scripted paired protocol exercise with
no model calls, injected invalid receipts/readback/restore/capture prerequisites,
modified adapter/rubric/evidence rejection, symlink escape, partial attempts and
missing/valid cost accounting. The scripted adapter is explicitly a unit fixture;
it does not establish actual host readiness. A macOS /var versus /private/var path
binding defect was observed and corrected before those tests passed.

An actual prepare/preflight invocation using the retained private candidate kit
produced ready:false without inference or native calls. Its private receipt is
`/Volumes/External SSD/Lookout/tmp/job04-preflight-20261109-1/receipts/preflight-1.json`;
the safe summary is `examples/job04/preflight.blocked.json`. A dedicated owner,
actual configuration and host adapter/probe receipts were missing. That version's
decision was **NO-GO for a participant run** until live gates passed. No production
runtime, personal account or external scheduler was changed.

Prospective v2 uses the shared JOB host and actual per-freeze gates described
above. Both conditions' native/container preflights passed before the paired
pilot launch. The interpreter-path failure in an earlier no-inference setup is
retained. Launch readiness does not establish participant completion or quality.


## November 9 terminal audit and prospective clock block

See the [shared JOB audit](../scripts/jobs/README.md#post-pair-audit-and-prospective-launch-block-2026-11-09)
for the independently reviewed historical attempts, timeout/transport evidence,
monotonic timing repair and current blocked readiness. Historical frozen versions
remain unchanged. New host-v2 preparations require native clock alignment as well
as no-inference native/container/transport gates; the compressed multi-day fixture
cannot currently pass clock alignment on the shared real-time backend. Do not
interpret completed turns or a partial review as a measured quality advantage.
