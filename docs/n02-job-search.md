# N02: Job selection and analysis across sessions

N02-search-v2 measures time to task, effort to task and quality of completion. It ends with
saved jobs and analyses; drafting and live form filling belong to N03.

The main artifact is the **final list of up to X target jobs plus their analyses**.
`targetLimit` defaults to 10 provisionally; fix it in the scenario before a paired
run. Cumulative saved history and interested roles are not the target list.

Both conditions use the same frozen Jobright source, resume, initial context,
model and reasoning settings. Baseline receives non-resume context in its first
message and may save notes; the harness creates no profile file. Resume remains
accessible. Fresh sessions retain saved state without onboarding replay or a
standing-goal prompt. Record actual Lookout host configuration before execution.

`examples/n02/scenario.json` defines initial search, confirmed career change,
style correction and fresh-session continuation. The two changes share session 2
but have separate checkpoints. Lookout receives its recorded wake prompt;
baseline receives a prescribed initiation. There is no drafting reminder.

## Frozen source and private reference

Source infrastructure lives at `fixtures/job-board/<snapshotId>/`: manifest and
jobs JSON are content-bound. No live search or changing evidence during a pair.
An operator creates a **private**, independently reviewed reference:

```json
{
  "snapshotId": "<manifest snapshotId>",
  "sourceHash": "<manifest files.jobs.json>",
  "status": "reviewed",
  "reviewer": "<reviewer>",
  "batches": {
    "initial": [{"id":"<job ID>","finalFit":"strong","rationale":"<candidate evidence and gaps>","evidence":["<source and resume references>"]}],
    "later": [{"id":"<job ID>","finalFit":"plausible","rationale":"<candidate evidence and gaps>","evidence":["<source and resume references>"]}]
  }
}
```

This is a final-preference reference only, not a before/after assessment matrix.
Strong and plausible entries form the qualifying target pool; plausible entries
are acceptable alternatives. Labels are strong/plausible/weak/ineligible/unknown. The example labels are schema
illustrations, **not ground truth**. Listing-only evidence cannot justify invented
requirements, availability or deep fit claims. Include complete frozen descriptions
where available and label uncertainty. Reference is never mounted or hosted on the
board. Baseline and Lookout packets contain identical selected job records.

```sh
node scripts/n02/task.mjs --source <snapshot-directory> --reference <private-reference.json> --stage initial_search --condition baseline --output <new-packet.json>
```

Lookout additionally requires `--configuration <private-config.json>` containing
`source` (actual configuration provenance) and `wakePrompt` (actual wake text).
Stage IDs are in the scenario. Onboarding/resume transport remains host-owned.

## Evidence and grading

A host writes a terminal run JSON with version, episodeId, condition, snapshotId,
sourceHash, startedAt (epoch seconds), status (completed/timed_out/execution_failed/harness_failed), and
finalTargetJobIds, and checkpoints. Each checkpoint contains stage, executionSeconds,
simulatedCompletionMinute, and interactions with nonnegative counts for
scriptedInitiations/questions/repeatedContext/reminders/corrections/approvals.
Keep native records, saved files and tool traces alongside it; independently
extract the final target IDs from these records, not participant claims. Preserve
other saved/interested jobs separately; they do not count toward the target cap.

Review JSON binds `evidenceDigest` to SHA256 of JSON.stringify(run) and names a
reviewer. `checkpoints[stage]` contains only preference_handling and continuity.
`finalSelection` contains the scenario quality keys (analysis accuracy, saved and
applied preferences, style, preservation). Each rating is
`{rating: 0|1|2, evidence: "<artifact location and rationale>"}` for not met/partial/met.
`finalSelection.alternatives[jobId]` may contain
`{accepted:true,evidence:"<source/resume rationale>"}` for defensible unlisted
alternatives. Adherence remains separate with `{status,evidence}`. Missing review
stays review_required. Preserve immutable supporting artifacts; the run binding
does not independently hash external artifact files.

```sh
node scripts/n02/task.mjs --source <snapshot-directory> --reference <private-reference.json> --run <run.json> --review <review.json> --output <new-grade.json>
```

Report execution seconds separately from simulated completion minutes. Scripted
initiations are not measured human effort. Final quality includes target coverage, selection fit, evidence accuracy, retained
and applied preferences, style and preserved interests. Coverage divides defensible
final targets by min(X, number of reviewed qualifying targets), capped at 1.
Accepted alternatives can substitute for reference targets. Fewer jobs receive
full coverage when fewer qualify; no count penalty forces weak selections. Unknown
selections require review instead of being automatically labeled poor. Coverage
is relative to the reviewed reference, never exhaustive corpus recall. Intermediate
checkpoints assess preference handling and continuity only. Semantic analysis may use any storage
or presentation format. Separate adherence from all three outcome dimensions.

## Langfuse integration and limits

The adapter reuses the existing N01 credential policy and pinned CLI transport.
One prospective dataset item represents the whole trajectory, bound to snapshot
and source hash. It contains structural metadata only, not resume, reference labels
or private records. Preview registration before writing:

```sh
node scripts/n02/langfuse.mjs --register --manifest <manifest.json> --dry-run
node --env-file=<private-env> scripts/n02/langfuse.mjs --register --manifest <manifest.json>
node --env-file=<private-env> scripts/n02/langfuse.mjs --run <run.json> --grade <grade.json> --dry-run
node --env-file=<private-env> scripts/n02/langfuse.mjs --run <run.json> --grade <grade.json>
node --env-file=<private-env> scripts/n02/langfuse.mjs --run <run.json> --grade <grade.json> --verify
```

The score plan uses time/effort/quality prefixes and separate adherence categories.
The exporter creates a trajectory root, stage spans, experiment/dataset-item links
and root scores via OpenTelemetry, with project-bound registration and ingestion
receipts. Use the same `--receipt-dir` for registration, export and verification.
`--verify` checks observations, scores and experiment read-back; ingestion delay
may require another verification, never a participant rerun. Stage spans represent
sequential execution duration, not simulated event waits or exact model calls.

`node scripts/n02/smoke.mjs <manifest.json> <new-directory>` creates explicitly
synthetic transport evidence without fit scores or participant content. Live
registration and synthetic five-span/fourteen-score experiment read-back were
verified on 2026-11-09. The immutable v1 scenario is retained as
`scenario-v1.json`; v2 uses its own dataset/item and registration receipt. This proves plumbing only. No participant runner, account
reset, live wake, or completed evaluation is claimed by these adapters.
Do not reuse the networking-specific N01 runner unchanged.

Fix execution limits, event/response timing and user-actor answers before a pair.
Preserve failures and timeouts, distinguish harness failures, freeze checkpoints,
and provide no hidden retries or participant rescue. Future events and review
labels stay outside participant workspaces. Internal infrastructure has no product
UI/demo or new MCP action; existing scoped product capabilities are what is graded.
