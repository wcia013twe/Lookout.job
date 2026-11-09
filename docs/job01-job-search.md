# JOB01: Job selection and analysis across sessions

JOB01-search-v4 grades **whether all ten predetermined targets appear in the returned
saved-job list at each grading turn**, plus the quality of their analyses. Ten is
not an output cap. Additional suitable roles are allowed and reviewed separately.
A later turn has its own expected ten and requires a complete updated shortlist,
not only additions. This is lookup and analysis, not interest tracking. No application drafting, filling or sending.

## Candidate, sessions and evidence

Reuse the N01 candidate resume/onboarding infrastructure. Both receive the same
facts and model settings; baseline receives non-resume context in its first message
and may save notes. Fresh sessions retain state without replay. No standing goal.
Every turn includes standard storage orientation: Lookout must use its tools for
context, preference updates and saved shortlists; baseline may retain local notes.
This is fixed onboarding/transport guidance, never a failure-triggered reminder.
Record actual Lookout configuration. Source packets use the same frozen board and
Jobright detail evidence; they do not establish live employer availability.

1. Initial job email: Lookout sees the email during a configured scheduled wake;
   baseline gets the identical uploaded email and a user request to act.
2. Fresh session: both get the same career-priority update and style correction,
   with a checkpoint after each.
3. Fresh session: another equivalent email delivery releases the later batch.

The condition-specific initiation is deliberate. Email bodies and job records
match; future evidence and target labels remain private. Baseline prompts do not
replay preferences. `examples/job01/scenario.json` owns stage requests and timing.

## Private reference and packets

`fixtures/job-board/<snapshotId>/manifest.json` binds `jobs.json` by hash. Keep this
private reference outside the participant workspace and public board:

```json
{
  "snapshotId": "<manifest snapshotId>",
  "sourceHash": "<manifest files.jobs.json>",
  "status": "reviewed",
  "reviewer": "<independent reviewer>",
  "batches": {
    "initial": [{"id":"<visible job ID>"}],
    "later": [{"id":"<visible job ID>"}]
  },
  "expectedTargets": {
    "initial_search": ["<exactly ten unique visible job IDs>"],
    "continuation": ["<exactly ten unique visible job IDs>"]
  },
  "targetRationales": {
    "<job ID>": {"rationale":"<candidate match>","materialGap":"<gap>","evidence":["<source and resume references>"]}
  }
}
```

The array strings above illustrate schema, not literal valid target sets. Review
labels against candidate facts and frozen evidence; do not fabricate eligibility
or deep scope. Expected targets are a predefined evaluation subset, not exhaustive
corpus ground truth. Candidate conflict or unknown citizenship stays uncertain.

```sh
node scripts/job01/task.mjs --source <snapshot-directory> --reference <private-reference.json> --stage initial_search --condition baseline --output <new-packet.json>
```

Lookout also needs `--configuration <private-config.json>` with configuration
`source` and actual `wakePrompt`. Packet includes current jobs, email and delivery
mode, never expected IDs. Onboarding, isolated account state and participant
execution are host-owned; do not use the networking-specific N01 runner unchanged.

## Evidence and grading

Run JSON has version, episodeId, condition, snapshotId, sourceHash, startedAt (epoch
seconds), terminal status, and checkpoints. Each checkpoint has stage,
executionSeconds, simulatedCompletionMinute, and interactions with nonnegative
uniqueTurns plus scriptedInitiations/questions/repeatedContext/reminders/corrections/approvals.
Grading stages also require `savedJobIds`, independently extracted from the
returned/saved target list at that turn. Keep raw native records, files and tool
traces; cumulative unrelated history is not the returned list.

Review binds `evidenceDigest` to SHA256 of JSON.stringify(run), names a reviewer,
and supplies `checkpoints[stage][qualityKey] = {rating:0|1|2,evidence:"location and rationale"}`.
`stageQuality` lists only criteria applicable at each turn. Initially assess
onboarding career/style adherence, analysis accuracy and selection suitability.
Career/style update turns assess only the newly saved preference. Continuation
assesses the complete current shortlist, analysis, saved/applied preferences,
corrected style, suitability and continuity. `qualityRubric` defines these checks.
No initial expectation anticipates future corrections. Missing review stays
review_required. Adherence remains separate.

```sh
node scripts/job01/task.mjs --source <snapshot-directory> --reference <private-reference.json> --run <run.json> --review <review.json> --output <new-grade.json>
```

- **Time:** actual execution duration separately from simulated completion time.
- **Effort:** unique observed interaction turns. Questions, reminders, repeated
  context, corrections and approvals are overlapping breakdowns, never summed.
  Prescribed initiations remain separate from observed effort.
- **Quality:** exact expected-target recall at each grading turn (matched/10),
  matched/missing/unexpected IDs, plus semantic analysis and preference checks.

Nine expected targets plus an excellent alternative is still 0.9 exact recall;
the alternative can receive a favorable semantic assessment. Extras never reduce
recall automatically, but unsuitable extras reduce selection-suitability quality. Intermediate update turns do not require per-job analysis
matrices. Independent review judges quality across equivalent storage formats.

## Langfuse and readiness

The adapter reuses N01 CLI/credential transport, registers one trajectory item,
exports root/stage spans and root scores, and verifies experiment/score read-back.
Only structural metadata is uploaded. Version/condition bind trace IDs; stage
spans explicitly describe a duration-derived synthetic timeline, not wall-clock
capture. Keep the same project and receipt directory:

```sh
node --env-file=<private-env> scripts/job01/langfuse.mjs --register --manifest <manifest.json> --receipt-dir <private-receipts>
node --env-file=<private-env> scripts/job01/langfuse.mjs --run <run.json> --grade <grade.json> --receipt-dir <private-receipts> --dry-run
node --env-file=<private-env> scripts/job01/langfuse.mjs --run <run.json> --grade <grade.json> --receipt-dir <private-receipts>
node --env-file=<private-env> scripts/job01/langfuse.mjs --run <run.json> --grade <grade.json> --receipt-dir <private-receipts> --verify
```

Historical N02 scenarios and JOB01 v1/v2 remain archived with their datasets unchanged.
JOB01 v3 has its own registration. Pilot experiments and scores are explicitly
labeled pilot; synthetic verification remains separate from measured runs.
Synthetic telemetry verifies plumbing, not participant quality. Fix actor answers,
budgets, timing, target references and configuration before a paired pilot. Preserve
failures and distinguish harness failures; no rescue or silent retries. Do not run
the paired pilot until explicitly authorized. Internal infrastructure adds no
product UI/MCP action; existing scoped capabilities are what is graded.

## Ready-to-run paired pilot host

`pilot.py` reuses N01's pinned subscription executor and its candidate profile/PDF,
not N01's networking scenario or reset procedure. A fresh local-only test account
is cloned and read back; the original candidate account is never changed. Historical
N02/JOB01 setup failures remain separate from participant results.

Preparation freezes the executable files, candidate files, reviewed private target
reference, stage packets and Docker image. Both conditions use gpt-5.6-terra with
medium reasoning. Four turns have 300-second limits; career/style changes share a
session and the final email starts fresh. Baseline may retain its own notes; only
its first turn includes the full initial profile. Lookout reads its cloned native
profile. Both retain the same resume.

For email turns, Lookout receives `read_inbox` during a configured scheduled wake.
Baseline receives the same email as an uploaded file plus a user request. Each
condition sees only released jobs. The baseline has `ask_user` but no Lookout tools.
The controlled actor acknowledges unresolved graduation/citizenship facts without
inventing an answer. This pilot is provisional source-based screening, not certified
eligibility or verified live employer availability.

The participant container is attached only to an internal Docker network. An
isolated gateway permits TLS connections to the inference hosts and forwards to
one bearer-protected workspace bridge. Live job sites, the full public archive,
direct internet sockets, future packets and grading references are unavailable.
Preflight checks login presence, actual tool schemas, mounts and network routing;
it performs no inference or participant domain writes. An inference-host HTTP
response is a connectivity check, not proof a future model turn will succeed.

```sh
# Preparation only; ROOT must hold a newly cloned dedicated account receipt.
node scripts/job01/account.mjs create ROOT N01_PRIVATE_MANIFEST N01_RESUME_PDF
python3 -B scripts/job01/pilot.py prepare --root ROOT --n01 N01_BASELINE_KIT --reference PRIVATE_REVIEWED_REFERENCE
python3 -B scripts/job01/pilot.py preflight --root ROOT --output ROOT/preflight-1

# Starts both conditions once. Do not invoke until starting the pilot is intended.
python3 -B scripts/job01/pilot.py run --root ROOT --pair-id JOB01-pilot-1
```

The host refuses a second attempt in the same workspace and requires a matching
successful preflight. Failures/timeouts are retained; neither condition is rescued.
Both conditions are attempted before grading. Native before/after snapshots, tool
traces, file snapshots and hashes support equivalent independent extraction.

Raw runs intentionally omit `savedJobIds`; missing extraction is not zero recall.
An independent extractor cites frozen artifact paths and provides the actual saved
IDs at each grading turn. Additional prose interaction demands are counted only
once, separately from captured `ask_user` exchanges. Then:

```sh
node scripts/job01/extract.mjs --run RUN_DIRECTORY --extraction PRIVATE_EXTRACTION_JSON --output RUN_DIRECTORY/run.reviewable.json
node scripts/job01/task.mjs --source SNAPSHOT_DIRECTORY --reference PRIVATE_REFERENCE --run RUN_DIRECTORY/run.reviewable.json --output RUN_DIRECTORY/grade.pending.json
# Complete the separate semantic review, then regrade and export through langfuse.mjs.
```

Extraction shape: `{reviewer, checkpoints: {[stage]: {savedJobIds, evidence:
["stage-1/output/saved.md"], outcomeComplete, additionalTurns:
[{id:"stage1-extra1", evidence:["stage-1/trace.jsonl"], answered:true,
categories:["questions","repeatedContext"]}]}}}`. Supply an empty array when
there are no additional turns. Stable turn IDs and citations prevent double
counting; a turn can belong to several categories but counts once in uniqueTurns.
Captured ask_user turn IDs cannot be counted again. Every checkpoint needs evidence;
savedJobIds is required only at grading turns. Only reviewed completed outcomes
receive simulated completion time: event minute + active execution duration +
fixed delay per answered unique turn. No real human effort minutes are inferred.

## Independent final grading agent

JOB01 v3 freezes `grader-instructions.md` during preparation. After both terminal
attempts, the host emits `grading/handoff.json` and per-condition templates. It
attempts read-only native confirmation once using the dedicated account and all
explicit final owned batch IDs. Credentials stay in the host helper; the receipt
is outside participant hashes/timing. `confirmed` means reads succeeded, not that
live state semantically matches the snapshots. Failure remains an attached receipt.

The coordinator must launch a **fresh agent with fork_turns:none** after the run;
the shell cannot launch collaboration agents. Supply only handoff-listed evidence
and frozen instructions, never account credentials/configuration. The reviewer
must not have implemented, coordinated, operated or participated in the pair.
Record the real agent ID and an explicit exclusion roster covering those roles:

```sh
node scripts/job01/grading.mjs --action assign --root ROOT --reviewer FRESH_AGENT_ID --coordinator COORDINATOR_ID --excluded PRIVATE_EXCLUDED_AGENT_IDS_JSON
node scripts/job01/grading.mjs --action finalize --root ROOT --source SNAPSHOT_DIRECTORY --submission PRIVATE_GRADER_SUBMISSION_JSON
```

Submission has `{attestation,conditions:{baseline:{extraction,review},lookout:{extraction,review}}}`.
Attestation binds assignmentHash and reviewerAgentId and asserts didImplement,
didOperate and didParticipate false, freshContext true. Semantic/adherence entries
include `evidenceFiles` naming existing frozen participant artifacts, alongside
ratings and explanation. Anchors: 0 unmet/contradicted, 1 partial/material gap,
2 fully supported. Native confirmation is supporting evidence, never a substitute
for historical checkpoints. The final output binds its receipt and assignment.

Finalization uses existing extraction/grading and writes `grading/final.json` only
after validating both conditions. Missing assignment, changed rubric/evidence or
invented citation paths block finalization. Standalone `task.mjs` remains useful
for pending grades but cannot mark v3 reviewed. Unreached stages are reported;
failed/partial attempts remain partial_review without invented checks. Agent
identity/history is enforced by coordinator assignment plus reviewer attestation,
not claimed as independently provable by the shell. No participant rerun or rescue.

## Prospective capture-failure correction

JOB01-search-v4 records participant results, active duration and interaction evidence
before after-state/output capture. A failed capture is retained separately and the
executed checkpoint stays reached. Historical v3 pilot files, grades and source
checkout remain unchanged; prepare a new root to use this correction.
