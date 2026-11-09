# JOB03: application decisions and reminders across sessions

JOB03-tracking-v5 is an isolated fictional five-job trajectory, not a product
feature or a participant result. It freezes every job's expected state at eight
checkpoints across eight fresh sessions. A single message updates A/B/C: A becomes
**user-reported submitted**, with no validated receipt, and requests a dated
follow-up; B receives a saved answer and clears only its own question while staying
unsubmitted; C is withdrawn and pending reminders cancelled. An employer email
rejects D; the same message ID later arrives again. E's status, blocker and future
reminder must remain untouched throughout. The due wake delivers A's reminder once;
the final ordinary request reconciles saved state. One controlled Birch preparation
preview failure retains its saved name/email fields. The later multi-job message
answers its blocker; a separate fresh session resumes the same application,
retaining progress and staying unsubmitted. No broad browser-failure matrix is added. No employer contact or actual
application occurs.

`examples/job03/scenario.json` owns frozen event times, sessions, actor delay,
configuration, rubric and the expected per-job state at every checkpoint. It is
host/grader-only: `packet()` releases only the current event, and initial context
only once. `fixture.json` supplies the same fictional candidate/jobs to both
conditions. Neither uses a standing-goal prompt. Record actual normal Lookout
configuration in preparation; use the fixed COM1 retrieve/save orientation each
turn. Baseline may keep persistent files. Fresh sessions do not replay onboarding.
The controlled actor refuses sends/submissions and uses only released facts.

## Runnable adapter boundary and honest readiness

Lookout's backend has no built-in scheduler: `backend/agent-contract.md` and
`mcp/README.md` explicitly separate saved schedule definitions from actual host
activation. Saving an action-board item or promising a reminder is insufficient.
The [shared JOB host](../scripts/jobs/README.md) now supplies a dedicated-owner
adapter using COM's subscription-backed Terra medium Session, plus durable local
test-clock reminders and fictional interrupted previews shared by both conditions.
These services do not imply a product scheduler or employer integration. Actual
owner-bound native/container/service preflight must pass for each new freeze.
Historical blocked preflights remain setup evidence. A passing unit test never
establishes execution readiness or participant quality.

The prospective comparison gives both conditions identical requests and evidence,
including the reminder review request. It measures tool/storage effects, not
proactive effort savings. Stage-specific quality checks replace repeating every
event-specific criterion at every checkpoint. Independent review includes prose
questions as well as captured ask_user calls. Participant duration, adapter wall
time, container startup and native startup/discovery measurements are kept distinct;
MCP diagnostics remain part of participant time rather than added again.

The following generic adapter contract is retained for hosts without
`hostVersion: jobs-host-v1`; the shared host instead supplies hash-bound evidence
gates through `host.preflight` as described above.

An adapter is a JSON file holding an argv array, e.g. `["/absolute/path/to/python3","/private/path/host.py"]`.
Each process receives one JSON request on stdin and returns one JSON result on
stdout. No shell, retry or implicit rescue occurs. The host owns credentials;
never include them in the prepared configuration, packets or grading handoff.
Every preflight service result must have `requestHash` (SHA256 of JSON.stringify
request), `receiptId`, `capturedAt`, and exact dedicated `ownerId`. Native probe
must invoke supported owner-scoped writers, read back states, test allowed
transitions, verify unrelated state, capture through a separate read-only credential,
and restore fixtures. Its receipt also confirms `interruptionRetained`,
`resumedWithoutDuplicate`, and `unsubmitted` for the single B recovery probe. Attach raw service receipts and snapshots, not fabricated flags.

`capabilities` must attest actual dedicated JOB03 service identity (`actual:true`,
`synthetic:false`, `benchmarkTaskId:JOB03`, `dedicated:true`), an identical
`reminderServiceId`/`baselineReminderServiceId`/`lookoutReminderServiceId`, and:

- `native.write_readback`, `native.restore`, `native.readonly_confirmation`
- `baseline.files`, `participant.sessions`, `actor.controlled`, `browser.equal`, `application.interruption`
- `reminder.schedule`, `reminder.read`, `reminder.cancel`, `reminder.delivery`, `reminder.test_clock`

Preflight calls `native.probe` and actual test-channel scheduling, reads, replay,
early delivery, due delivery, duplicate delivery, cancellation and cancelled due
checks. It requires exact due/timezone, reminder IDs and a delivery receipt, then
cleans up. A clock-aware real test service can advance business time without waiting
days; merely writing simulated events to a JSON file is synthetic and must declare
itself so. If the baseline cannot reach an equivalent scheduling boundary, readiness
stays blocked. Browser/model/tool base, candidate and task evidence must match;
only Lookout's scoped native storage differs from baseline files.

Prepare configuration fields: `benchmarkTaskId:"JOB03"`, `dedicated:true`,
`fictional:true`, `ownerId`, `readOnlyOwnerId` (same isolated owner), `source`,
`model`, `reasoning`, and `normalProductConfiguration` (actual configuration record).
Neither original COM1 nor active JOB01 owner/source may be used.

```sh
node scripts/job03/task.mjs --action prepare --root NEW_ROOT --configuration PRIVATE_CONFIG_JSON
node scripts/job03/task.mjs --action preflight --root NEW_ROOT --adapter ADAPTER_ARGV_JSON --output NEW_ROOT/preflight.json
# Omit --adapter to retain a blocked, no-participant preflight when service is absent.
```

The copied task runner is frozen review evidence. Execute the source-bound
coordinator from the task checkout; its absolute executable/dependency hashes
must match the preparation. `preflight.json` binds configuration and probe/errors.
A failed probe does not run participants. Synthetic/injected failures verify the
harness only, never actual scheduling/native capability. Source tests do not imply
deployment. Provisioning an actual isolated native owner, adapter/service, model
host and read-only credential remains host work; no participant run is authorized
by preparing files or this document.

## Pair execution and frozen evidence

Only an explicitly authorized invocation uses `--action run --execute --root ROOT
--adapter ADAPTER_ARGV_JSON --preflight ROOT/preflight.json --pair UNIQUE_ID`.
The host implements `condition.setup`, `snapshot`, `participant.turn`, `application.arm_failure`,
`reminder.wake`, `native.readonly_confirmation`, and `baseline.final_files`.
It must use fresh sessions by packet session ID, retain file state and all released
emails, wire the released-only actor, and capture actual tool traces/files/reminder
receipts in each snapshot/response. Preserve normal product configuration and use
the same inference model, reasoning, browser/tools, actor and timing for both.
`participant.turn` returns terminal `status`, response/artifacts and `interactions`
with stable unique `id`, boolean `answered`, and overlapping `categories`.
The adapter must attach actual reminder wake receipts, not generate one from prose.
No future fixture, expectations or rubric reaches a participant.

The runner attempts each condition once, preserves before/after snapshots, inputs,
responses and all errors/timeouts, then hashes the evidence. No rerun in the same
root, rescue, mid-pair patch or semantic feedback is permitted. A failed condition
does not prevent attempting the other. Read-only terminal native and baseline-file
confirmation is attempted outside execution timing. Missing capture is a harness
limitation; it cannot become assumed quality or zero effort. Reminder wake transport
is shared; native-tool adherence is diagnostic and separate from outcomes.

## Independent grading and metrics

Follow the [final saved-state contract](com-final-state-grading.md) and the
[JOB01 fresh final-grader pattern](job01-job-search.md#independent-final-grading-agent)
without modifying its active freeze or account. After both terminal attempts the
runner emits `grading/handoff.json`. A coordinator explicitly launches a fresh
independent grader with `fork_turns:none`, no credentials and only frozen artifacts.
No shell command launches an agent. Record separate implementer/coordinator/operator/
participant exclusion arrays, then assign and finalize:

```sh
node ROOT/suite/task.mjs --action assign --root ROOT --reviewer FRESH_AGENT_ID --excluded EXCLUSION_ROSTER_JSON
node ROOT/suite/task.mjs --action finalize --root ROOT --submission INDEPENDENT_REVIEW_JSON
```

The grader instructions define per-job semantic extraction, actual durable evidence
citations, 0/1/2 quality anchors and separate native adherence. Finalization verifies
both conditions, assignment/attestation, frozen inputs/evidence, all reached
checkpoint citations and terminal confirmation attempts before writing a new final
artifact. Deterministic expected-state comparisons expose field-level differences;
semantic review checks whether extraction/provenance/reminder claims match receipts.
Final repairs cannot erase earlier routing or status errors.

Main dimensions remain actual execution seconds, unique observed interaction turns,
participant cost and outcome quality. Actor delay is explicitly simulated waiting, not real human
minutes. Initial context and prescribed notifications are separate from observed
questions, approvals or corrections. Missing interaction capture stays incomplete;
partial runs list unreached stages. Native adherence is reported separately, and
no measured result, advantage, hosted release or telemetry export is asserted.

## Verification and demo boundary

`node --test tests/job03-tracking.test.mjs` covers frozen portfolio checkpoints,
packet isolation, actor limits, routing/status/provenance comparisons, future-reminder
preservation, duplicate stability, readiness failures, independent grader identity,
and tamper rejection. The fictional fixture is the demo coverage for this evaluation
infrastructure. It writes no product/account data and requires no UI or MCP change.
No participant or external submission is run by these checks.

Native mapping remains narrow: source `record_application_milestone` supports
`submitted`/`withdrawn` with `user_reported` provenance and `rejected` with email
evidence; it never writes a submission receipt or approval, and does not directly
change the applications status column. Accurate timeline-derived current state is
accepted. B must use the supported versioned answer/draft and blocker boundary;
never forge a human confirmation to clear it. The native probe must verify these
actual writer/readback paths before readiness. Scheduler/notification authority
remains with the equivalent host service, outside Lookout's native database.

The interruption turn arms exactly one controlled B preview timeout via
`application.arm_failure`; its owner-bound receipt must return `armed:true` and
`eventKey:B-preview-timeout`. The participant host injects that one failure at
`preview_after_saved_fields`, preserving already saved fields. The actual tool
failure and continuation must appear in captured traces/snapshots; an arming receipt
alone is not proof recovery worked. The later answer turn clears the question but
does not silently finish preparation. The separate resume session must reuse B,
retain its fields and one-failure history, prepare the draft, and leave it unsubmitted.
This is fixture-only preparation; external forms/submissions remain prohibited.

## Cost as a separate dimension

The executor returns structural `usage` with each `participant.turn` response:
`{schemaVersion:1,scope:"participant_turn",basis:"turn_delta",source,receiptId,
status:"complete",model,tokens:{input_tokens,cached_input_tokens,output_tokens}}`.
These must be actual provider/executor counters for that turn, including failed
turns when available; resumed-session cumulative totals must first become deltas.
Cached input is part of input, and reasoning output is part of output. Unique
receipt IDs prevent counting one counter receipt twice. No transcript or hidden
reasoning is needed for cost capture. The raw receipt stays in frozen response
evidence; `run.json.cost`, `cost.json`, and final grade `cost` retain the aggregate.
The independent grader recomputes it from frozen responses before accepting it.

Absent, malformed, duplicate or killed-turn counters produce partial/unknown
coverage, diagnostic `observedTokens`, and null full totals. They never become
zero. An explicitly reported zero with a valid executor receipt remains valid.
Preflight, state captures, harness, grader, infrastructure and Lookout processing
are separately unmeasured, never assumed free or added to participant counters.
Cost availability does not alter task quality or native adherence.

Optional `configuration.costPolicy` uses the existing
[eval cost policy](eval-cost-accounting.md): schemaVersion 1, USD, exact model
`rates` entries with HTTPS `sourceUrl`, real ISO `asOf`, input/cached/output USD per
million and supported reasoning/cache conventions. Rates are frozen before the
pair and default to empty. No prices are fetched or guessed; unmatched models
remain unpriced. Model USD is labeled estimated API-equivalent, never subscription
charges. External costs and total USD remain null in this scoped adapter.

An executor can alternatively supply actual billed USD via `usage.billedUsd`,
`currency:"USD"`, and `billingBasis:"actual_provider_billed"` with the same unique
source/receipt/turn binding. These local `actualBilling` totals have separate
coverage; a missing turn prevents a complete billed total. Guessed allocation or
subscription-plan prices do not qualify. The existing common eval-v1 `costValues`
accepts this cost report's standard token/estimate fields unchanged. Its exporter
does not carry actual billed extensions, so `actualBilling` remains explicitly
local and standard `billedUsd` remains null. No shared module or external export
is changed.

## Prospective runtime/capture corrections

JOB03-tracking-v2 / JOB03-grade-v2 bind coordinator/cost executables at preparation
and hash the actual absolute adapter interpreter, argv file arguments and declared
runtimeFiles dependencies during preflight. Launch rechecks those bytes; the same
command string cannot reuse readiness after an adapter or dependency edit. Declare
all implementation dependencies and immutable image locks in runtimeFiles; never
include credentials or mutable reminder-service data.

If a checkpoint records harness_failed plus captureError and lacks after.json,
the grader reports unverifiable_capture_failure instead of requiring a fictitious
extraction. Time, effort and available cost remain in a partial_review; strictPass
is false, whole-trajectory qualityFraction stays null and observedQualityFraction
is explicitly partial. Missing evidence without a recorded capture failure still
rejects finalization. Prior v1 receipts/freezes remain historical; new preparation
and actual-service preflight are required for execution.


## November 9 terminal audit and prospective clock block

See the [shared JOB audit](../scripts/jobs/README.md#post-pair-audit-and-prospective-launch-block-2026-11-09)
for the independently reviewed historical attempts, timeout/transport evidence,
monotonic timing repair and current blocked readiness. Historical frozen versions
remain unchanged. New host-v2 preparations require native clock alignment as well
as no-inference native/container/transport gates; the compressed multi-day fixture
cannot currently pass clock alignment on the shared real-time backend. Do not
interpret completed turns or a partial review as a measured quality advantage.


Prospective host v3 connects native HTTP/MCP to an isolated ticking SQL/JavaScript
clock and preserves native startup and all scoped on-demand tools. Full canonical
context and equal save/verify obligations are now explicit. See the
[shared host launch limits](../scripts/jobs/README.md#native-http-clock-integration-and-retained-launch-blocks):
latest-source live gates remain outstanding after Docker became unresponsive;
JOB03 additionally needs prospective reference/partial-form reconciliation.
Historical outcomes, independent grades and failed attempts remain unchanged.
