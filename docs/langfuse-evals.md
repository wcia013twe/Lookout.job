> Current dashboard: **Eval Case & Run**. Use exactly two Tags filters:
> `eval-case:<scenarioId>` and `eval-run:<repeat>` (defaults COM1 / 1).
> Both conditions appear in the same selected view. Native hosted Langfuse labels
> these dropdowns Tags; custom field labels are not configured. Widget environment
> remains benchmark, excluding pilot/synthetic exports. Empty panels are expected
> until compatible measured results are exported. Old exports are not backfilled.
> Run numbers may repeat across campaigns; trace labels include condition, campaign,
> scenario version and grader version to keep distinct attempts in separate rows.
> Status count must be one per row: a higher count is ambiguous and must not be
> interpreted as one result. This view has no cross-case success-rate summary.
> Earlier campaign overview instructions below describe the superseded layout.

# Reusable Langfuse evaluation setup

## Daily use

1. Run and grade locally. One evaluated unit is the entire multi-session trajectory.
2. Have the grader/orchestrator produce a result matching `examples/evals/result.json`.
3. Preview: `npm run evals:langfuse -- --record /absolute/result.json --dry-run`.
4. Publish: `npm run evals:langfuse -- --record /absolute/result.json`.
5. Read back after ingestion: add `--verify` to the same command. An upload failure never reruns a participant.
6. Open **Eval Overview v1** for aggregate views, or **Experiments** to compare conditions/repetitions item by item.

The exporter reads configuration from root `.env.local`. It uses the installed `langfuse` CLI (validated API snapshot 4.71.0); override `LANGFUSE_CLI` with an executable path if needed. No LLM calls or API model tokens are used by setup/export.

## Setup once per project

```sh
npm run evals:langfuse -- --setup
```

This creates/reuses seven score configurations, one dashboard and eight comparison-table widgets. It uploads configuration only: no private profile, historical run, sample result or synthetic performance. It discovers objects by versioned names to avoid duplicates. Existing score definitions must match. Existing dashboard/widget edits are preserved; create a new config version for incompatible changes. Dashboard APIs are marked unstable by Langfuse; fail explicitly if the API changes.

The dashboard excludes `verification` and `benchmark-pilot`. Filter **traceRelease** to one campaign. Most tables group by **traceVersion** (scenario ID/version/grader version) and **traceName** (condition), avoiding pooled quality across incompatible scenarios. The attempt-outcome table groups by condition and execution outcome. Select a scenario/grader version when narrowing that table.

Widgets: attempts by outcome; evaluated-attempt denominator; task success rate; reviewed quality; median active seconds; median tool calls; median wakes; review coverage. Time/effort include all outcomes, not only successes. The dashboard does not interpret a short failed attempt as fast successful completion. Missing judgments are omitted; review coverage makes that missingness visible.

## Version 1 record contract

Required fields are illustrated in `examples/evals/result.json`:

- `schemaVersion: 1`
- `campaignId`, `suiteId`, `suiteVersion`: experiment grouping and local dataset identity. Bump suiteVersion when the scenario set/evidence definition changes.
- `scenarioId`, `scenarioVersion`: stable full-trajectory item identity, not individual wakes. Bump scenarioVersion for changed input evidence or task semantics.
- `condition`, `repeat`, `episodeId`: condition, positive repetition, and globally unique attempt identity. Use a new repetition for a genuinely separate attempt; do not replace terminal failures.
- `model`, `reasoning`, `harnessVersion`, `graderVersion`: explicit comparable execution/evaluation definitions. Grader changes require a new graderVersion; this creates distinct experiment and score identities.
- `evidenceDigest`: SHA-256 of the local evidence, computed and checked by the grader before constructing the record. This summary exporter validates format, not the contents of evidence stored elsewhere.
- `startedAt`, `endedAt`: actual Unix epoch seconds. The root span's elapsed wall time is distinct from active execution seconds.
- `status`: completed, timed_out, execution_failed, setup_failed, artifact_failed or harness_failed.
- `pilot`, `synthetic`: explicit booleans. Synthetic exports use `verification`, pilots `benchmark-pilot`, measured attempts `benchmark`.
- `evaluation.reviewed`: independent final judgment available.
- `evaluation.taskSuccess`: boolean or null; `quality`: normalized 0–1 or null. Both must be null when unreviewed. Incomplete execution cannot be full task success.
- `evaluation.activeSeconds`, `toolCalls`, `wakesUsed`: nonnegative values, or null if not reliably observable. Count each tool invocation once; sum actual active execution across wakes, excluding simulated waiting, grading and upload.

Only named structural fields are exported. Extra fields are not transmitted. Do not put user information into identifier fields. The fixture is wholly fictional and unreviewed; it is not research evidence and is not uploaded by setup.

## Experiment identity and future compatibility

The local dataset ID derives from suite identity/version. The item ID derives from scenario identity/version. Each campaign/condition/repetition/model/harness/grader combination is a separate experiment. Each whole trajectory produces one **summary root observation** with common scores, satisfying Langfuse's one-item-per-experiment constraint. Local dataset correlation IDs are supported by OpenTelemetry experiments; no live dataset is created or modified by this setup.

A summary links through `session.id = episodeId`; detailed tool/wake traces remain in the existing tracer/exporter. This exporter does not duplicate or reconstruct detailed traces. N01/N02's existing scenario-specific exporters remain intact and do not automatically populate the common dashboard. Their graders should additionally emit this record when the orchestrator is ready to adopt the shared contract. Use only this common mapping for cross-scenario overview metrics.

Receipts are project-scoped under ignored `.langfuse-exports/evals/`; use `--receipt-dir` for a stable location across checkouts. Keep receipts. Local assignment records reject different evidence/results for the same experiment item; locks serialize exports. IDs are deterministic. Uploads can be repeated after an ambiguous network failure, but remote transport is not exactly-once. The local binding guard is not a distributed lock across machines: share receipts or assign attempts centrally. Acknowledgement is distinct from read-back verification.

## Scope and verification

Source syntax and repository data validation are recorded in the change note. Setup performs live configuration read-back. No participant runs, real grades, stale history or synthetic scores are uploaded as part of setup. Future result ingestion remains a separate operation; empty tables are expected until compatible measured records arrive. No product UI, backend schema, MCP authority or browser demo changes.

## Cost dimension

Prospective COM/JOB runs now include an optional top-level cost report. See
[usage capture, pricing and paper aggregation](eval-cost-accounting.md). Register
common cost scores with `--setup --scores-only` to preserve dashboard layouts.
Unknown cost is absent, never zero; model estimates are not subscription invoices.
