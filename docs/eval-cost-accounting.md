# Cost as the fourth evaluation dimension

Quality, active time, effort and cost remain separate. No combined score is added.
This is prospective harness support: frozen historical workspaces/runs are not
modified or re-executed. Prepare a new workspace after landing; existing freezes
will correctly reject changed executable hashes.

## Capture and accounting

Each COM case's `Session.turn` (and the COM1 session reused by JOB) reads **only structural counters**
from the current isolated container's session log before/after a turn. It selects
`event_msg/token_count/info.total_token_usage` and session model identifiers.
It never exports prompts, credential files, reasoning text or host session history.
The counter delta handles resumed sessions without counting earlier turns again.
The old stdout usage object remains raw evidence, not an additional billable item.

`stage-run.json.cost` holds counter provenance and delta. `run.json.cost` and
`cost.json` contain the whole-trajectory report, also exposed in grade output.
Coverage is complete, partial or unknown. Missing, decreasing or malformed counters,
no new usage event, killed containers and missing terminal turns do not become zero.
Partial observed totals are diagnostic only; full totals and model cost stay null.
Input includes cached input; uncached=input-cached. Reasoning output is a subset,
not added again. Different/unknown session models cannot receive a guessed rate.
The collector's compatibility with the pinned runtime has syntax inspection only;
a future authorized run must verify counters against its raw structural receipts.

## Frozen rates and external costs

All COM and JOB prepare commands accept `--cost-policy /absolute/policy.json`. Without it,
`examples/evals/cost-policy.json` is copied before the workspace is frozen.
Default rates are empty: the requested model has **no assumed API-equivalent rate**.
The policy is never mounted into the participant workspace.

Each `rates` entry requires an exact `model`, HTTPS `sourceUrl`, ISO `asOf` date,
`inputUsdPerMillion`, `cachedInputUsdPerMillion`, `outputUsdPerMillion`,
`outputIncludesReasoning: true`, and `cacheWriteIncludedInInput: true`.
This calculator supports that pricing convention only (no distinct cache-write fee,
context-tier price or inferred alias). Use a different versioned adapter for other
pricing conventions. Use a sourced, applicable rate; a placeholder model price is
not a measurement. No prices are fetched or changed during a run.

Formula: `(uncached input × input rate + cached input × cached rate + output × output rate) / 1e6`.
Values are **estimated API-equivalent USD**, never subscription charges.
`billedUsd` remains null. Pricing sources, dates and policy digest are retained.

External fields `toolUsd`, `infrastructureUsd`, `lookoutProcessingUsd` are explicit
**fixed per-attempt attributable amounts**, not shared-account totals. Any amount,
including zero, requires `externalCosts.source` identifying the receipt or verified
allocation basis. These fields default to null. Do not put a whole cohort's bill
into each attempt's policy. Variable external costs require a future per-attempt
receipt adapter; no automatic provider billing or Lookout service metering is claimed.
Total USD is available only when model and all external components are known.

## Langfuse

COM and JOB exporters add their existing prefix plus `cost_*` scores. The common
result contract optionally accepts the same top-level `cost` report and exports
`eval_v1_cost_*`. Coverage always travels with cost. Null metrics are omitted.
These are root-level **summary scores**, not synthetic model generation spans,
so Langfuse generation totals do not double count them.

To register common cost score definitions without changing live dashboards:

```sh
npm run evals:langfuse -- --setup --scores-only
```

No live upload, historical backfill, dashboard edit or participant run is performed
by installing this change. Dashboard cost panels can consume these new scores.
Common BOOLEAN scores are encoded as 0/1 on ingestion and compared as booleans on
readback, matching Langfuse's API contract.

## Cost per success for the paper

Create a manifest with `cohortId` and `attempts: [{"run": "/absolute/run", "success": false}]`.
Success must come from the independently graded whole-trajectory verdict; use null
for unreviewed attempts. Include every attempted run, including failures.

```sh
python3 scripts/n01/cost.py --aggregate /absolute/cohort.json --output /absolute/cost-summary.json
```

The output is created exclusively (no overwrite). Duplicate episode IDs are
rejected. Versions, models, conditions, pilot status and pricing-policy digests
remain separate groups. Cost per success = **all attempt costs / successes**.
It is null when there are no successes, any missing judgments or missing costs.
Model-only cost per success is reported separately from all-component cost.
The manifest defines the cohort; aggregation does not discover or silently exclude
attempts. This is descriptive accounting, not an uncertainty/significance estimate.

## Verification limits

Syntax checks and catalog validation only. No participant inference, runtime
integration test, historical regrading, pricing validation against invoices, or
live ingestion was executed. Existing frontend demo fixtures are unaffected;
`examples/evals/cost-policy.json` is the detached, no-price configuration example.
