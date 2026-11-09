# N02: Job selection and analysis across sessions

N02-search-v3 grades **whether all ten predetermined targets appear in the returned
saved-job list at each grading turn**, plus the quality of their analyses. Ten is
not an output cap. Additional suitable roles are allowed and reviewed separately.
A later turn has its own expected ten. No application drafting, filling or sending.

## Candidate, sessions and evidence

Reuse the N01 candidate resume/onboarding infrastructure. Both receive the same
facts and model settings; baseline receives non-resume context in its first message
and may save notes. Fresh sessions retain state without replay. No standing goal.
Record actual Lookout configuration. Source packets use the same frozen board and
Jobright detail evidence; they do not establish live employer availability.

1. Initial job email: Lookout sees the email during a configured scheduled wake;
   baseline gets the identical uploaded email and a user request to act.
2. Fresh session: both get the same career-priority update and style correction,
   with a checkpoint after each.
3. Fresh session: another equivalent email delivery releases the later batch.

The condition-specific initiation is deliberate. Email bodies and job records
match; future evidence and target labels remain private. Baseline prompts do not
replay preferences. `examples/n02/scenario.json` owns stage requests and timing.

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
node scripts/n02/task.mjs --source <snapshot-directory> --reference <private-reference.json> --stage initial_search --condition baseline --output <new-packet.json>
```

Lookout also needs `--configuration <private-config.json>` with configuration
`source` and actual `wakePrompt`. Packet includes current jobs, email and delivery
mode, never expected IDs. Onboarding, isolated account state and participant
execution are host-owned; do not use the networking-specific N01 runner unchanged.

## Evidence and grading

Run JSON has version, episodeId, condition, snapshotId, sourceHash, startedAt (epoch
seconds), terminal status, and checkpoints. Each checkpoint has stage,
executionSeconds, simulatedCompletionMinute, and interactions with nonnegative
scriptedInitiations/questions/repeatedContext/reminders/corrections/approvals.
Grading stages also require `savedJobIds`, independently extracted from the
returned/saved target list at that turn. Keep raw native records, files and tool
traces; cumulative unrelated history is not the returned list.

Review binds `evidenceDigest` to SHA256 of JSON.stringify(run), names a reviewer,
and supplies `checkpoints[stage][qualityKey] = {rating:0|1|2,evidence:"location and rationale"}`.
All checkpoints review preference_handling and continuity. Grading turns also
review the scenario quality keys: analysis accuracy, saved/applied career and
style preferences, style adherence and preserved interests. Missing review stays
review_required. Adherence uses scenario keys with status/evidence separately.

```sh
node scripts/n02/task.mjs --source <snapshot-directory> --reference <private-reference.json> --run <run.json> --review <review.json> --output <new-grade.json>
```

- **Time:** actual execution duration separately from simulated completion time.
- **Effort:** observed questions, reminders, repeated context, corrections and
  approvals; prescribed initiations remain separate from measured human effort.
- **Quality:** exact expected-target recall at each grading turn (matched/10),
  matched/missing/unexpected IDs, plus semantic analysis and preference checks.

Nine expected targets plus an excellent alternative is still 0.9 exact recall;
the alternative can receive a favorable semantic assessment. Extras never reduce
recall automatically. Intermediate update turns do not require per-job analysis
matrices. Independent review judges quality across equivalent storage formats.

## Langfuse and readiness

The adapter reuses N01 CLI/credential transport, registers one trajectory item,
exports root/stage spans and root scores, and verifies experiment/score read-back.
Only structural metadata is uploaded. Version/condition bind trace IDs; stage
spans explicitly describe a duration-derived synthetic timeline, not wall-clock
capture. Keep the same project and receipt directory:

```sh
node --env-file=<private-env> scripts/n02/langfuse.mjs --register --manifest <manifest.json> --receipt-dir <private-receipts>
node --env-file=<private-env> scripts/n02/langfuse.mjs --run <run.json> --grade <grade.json> --receipt-dir <private-receipts> --dry-run
node --env-file=<private-env> scripts/n02/langfuse.mjs --run <run.json> --grade <grade.json> --receipt-dir <private-receipts>
node --env-file=<private-env> scripts/n02/langfuse.mjs --run <run.json> --grade <grade.json> --receipt-dir <private-receipts> --verify
```

V1/v2 scenarios and live datasets remain immutable; v3 uses separate registration.
Synthetic telemetry verifies plumbing, not participant quality. Fix actor answers,
budgets, timing, target references and configuration before a paired pilot. Preserve
failures and distinguish harness failures; no rescue or silent retries. Do not run
the paired pilot until explicitly authorized. Internal infrastructure adds no
product UI/MCP action; existing scoped capabilities are what is graded.
