# N02: Job selection and analysis across sessions

N02 measures time to task, effort to task and quality of completion. It ends with
saved jobs and analyses; drafting and live form filling belong to N03.

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
    "initial": [{"id":"<job ID>","initialFit":"strong","updatedFit":"plausible","rationale":"<candidate evidence and gaps>","evidence":["<source and resume references>"]}],
    "later": [{"id":"<job ID>","initialFit":"plausible","updatedFit":"strong","rationale":"<candidate evidence and gaps>","evidence":["<source and resume references>"]}]
  }
}
```

Labels are strong/plausible/weak/ineligible/unknown. The example labels are schema
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
sourceHash, status (completed/timed_out/execution_failed/harness_failed), and
checkpoints. Each checkpoint contains stage, executionSeconds, savedJobIds,
simulatedCompletionMinute, and interactions with nonnegative counts for
scriptedInitiations/questions/repeatedContext/reminders/corrections/approvals.
Keep native records, saved files and tool traces alongside it; independently
extract saved IDs from these records, not participant claims.

Review JSON binds `evidenceDigest` to SHA256 of JSON.stringify(run), names reviewer,
and has checkpoints keyed by stage, then each scenario quality key. Values are
`{rating: 0|1|2, evidence: "<artifact location and rationale>"}`. Ratings mean not
met/partial/met. Adherence uses scenario keys and `{status, evidence}` with
used_correctly/attempted_but_failed/omitted/not_applicable. Missing review stays
review_required and never becomes a quality pass. Preserve immutable supporting
artifacts; the run binding does not independently hash external artifact files.

```sh
node scripts/n02/task.mjs --source <snapshot-directory> --reference <private-reference.json> --run <run.json> --review <review.json> --output <new-grade.json>
```

Report execution seconds separately from simulated completion minutes. Scripted
initiations are not measured human effort. Quality includes strong-match coverage,
selection precision (strong or plausible), evidence accuracy, retained and applied
preferences, style and preserved interests. Semantic analysis may use any storage
or presentation format. Separate adherence from all three outcome dimensions.

## Langfuse integration and limits

The adapter reuses the existing N01 credential policy and pinned CLI transport.
One prospective dataset item represents the whole trajectory, bound to snapshot
and source hash. It contains structural metadata only, not resume, reference labels
or private records. Preview registration before writing:

```sh
node scripts/n02/langfuse.mjs --register --manifest <manifest.json> --dry-run
node --env-file=<private-env> scripts/n02/langfuse.mjs --register --manifest <manifest.json>
node scripts/n02/langfuse.mjs --run <run.json> --grade <grade.json> --dry-run
```

The score plan uses time/effort/quality prefixes and separate adherence categories.
Participant trace creation, dataset-run linking and score upload remain host
integration work; the CLI refuses standalone score upload. No participant runner,
account reset, live wake, or completed evaluation is claimed by these adapters.
Do not reuse the networking-specific N01 runner unchanged.

Fix execution limits, event/response timing and user-actor answers before a pair.
Preserve failures and timeouts, distinguish harness failures, freeze checkpoints,
and provide no hidden retries or participant rescue. Future events and review
labels stay outside participant workspaces. Internal infrastructure has no product
UI/demo or new MCP action; existing scoped product capabilities are what is graded.
