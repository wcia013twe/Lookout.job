# JOB03/JOB04 per-pair reporting

After each EVAL pair terminates, the existing chat runs the shared exact-model
subscription grader, saves its unchanged `output/review.json` as
`ROOT/grading/independent-submission.json`, and invokes the frozen case finalizer.
No feedback is returned to a participant. Both participant and grader remain
`gpt-5.6-terra` with medium reasoning.

The post-grade connection is:

```sh
node scripts/jobs/report.mjs --root ROOT --campaign JOB-EVAL-01-03 --evaluation-id EVAL-01 --grader-run GRADER_ATTEMPT/grader-run.json --output EXPORT_DIR --publish
```

It verifies exact-model/read-only/cleanup grading provenance and replays the case's
deterministic finalizer over a temporary local evidence copy. It emits only
sanitized common records, then calls both existing commands for each condition:

```sh
node scripts/evals/langfuse.mjs --record EXPORT_DIR/baseline.json --receipt-dir EXPORT_DIR/langfuse
node scripts/evals/langfuse.mjs --record EXPORT_DIR/baseline.json --receipt-dir EXPORT_DIR/langfuse --verify
```

The Lookout record follows identically. Common verification uses paginated
observation/score reads. `EXPORT_DIR/report.json` binds immutable records and keeps
local adherence/status references. `EXPORT_DIR/delivery-N.json` records each
bounded delivery-only attempt. The existing exporter writes project/trace-specific
acceptance and `.verification.json` receipts under `EXPORT_DIR/langfuse/`.
Readback must be verified before calling the pair fully reported.

If delivery fails, reuse only saved records:

```sh
node scripts/jobs/report.mjs --deliver EXPORT_DIR --publish
```

At most three delivery attempts are allowed; verified delivery is idempotent.
Neither participant nor grader is rerun for an export problem. Continue permitted
remaining cases and retain an export-only blocker if delivery remains unavailable.
For a terminal failed/pending-grade attempt, use a NEW output directory and
`--structural-only`; quality and task success stay null. Explicit short
`--repair-status` and `--confound-status` identifiers preserve validity status.

There is no existing detailed JOB03/JOB04 remote exporter. Full reviews and native
adherence remain in immutable local `grading/final.json`; common summaries are the
supported remote path. JOB04 has no predefined overall quality/pass aggregate, so
those common fields remain null instead of inventing a threshold. Unnormalized
whole-runtime tool/wake counts remain null; detailed diagnostics stay local.
Raw profiles, resumes, prompts, reviews and credentials are never spread into the
common record. Export provenance uses the shared allowlist. This adapter changes
no frozen participant source, task, rubric or model and starts no background service.

A delayed read-only check may confirm eventual visibility after the three delivery
attempts. Use the existing Langfuse command with --verify and a NEW receipt
directory; do not upload again. Preserve the original failed delivery receipts.
A separate completion receipt must bind the unchanged common record hash and
the matching trace/experiment identity to each successful verification receipt.
JOB04 EVAL-01 baseline and both EVAL-03 conditions required this path; their
original failed delivery receipts stay unchanged.

A grader process completing is not an accepted review. For JOB04 EVAL-02, the
exact-model grader completed, but its unchanged submission failed assignment-hash
validation. No amended attestation, regrade or replacement is accepted. Its
failure-only export retains unknown quality/task success, independently of the
verified transport readback. Environment interruption and rejected review remain
explicit in the local evidence index and change note.
