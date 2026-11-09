# JOB03: application decisions and reminders across sessions

JOB03-tracking-v1 is an isolated fictional five-job trajectory, not a product
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
The repository does not currently supply an actual JOB03 shared reminder service
or dedicated owner adapter. **JOB03 is blocked for participant execution until an
actual service and owner-bound adapter pass preflight.** No source-only or synthetic
check can set measured readiness. The retained local blocked preflight is a setup
result, not a participant attempt. No production change is proposed to hide this gap.

An adapter is a JSON file holding an argv array, e.g. `["python3","/private/path/host.py"]`.
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
node NEW_ROOT/suite/task.mjs --action preflight --root NEW_ROOT --adapter ADAPTER_ARGV_JSON --output NEW_ROOT/preflight.json
# Omit --adapter to retain a blocked, no-participant preflight when service is absent.
```

The copied task runner supports prepared roots independently of a changing shared
checkout. `preflight.json` binds freeze/configuration and includes every probe/error.
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

Main dimensions remain actual execution seconds, unique observed interaction turns
and outcome quality. Actor delay is explicitly simulated waiting, not real human
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
