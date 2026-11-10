# Shared benchmark transport

- Replace seven transport implementations with one shared HTTP-to-stdio transport
  and small case argument adapters. Preserve JOB02's graceful EOF shutdown
  and the JOB03/04 host's stderr capture and daemon-thread setting.
- Bind the shared source into new COM01–04/JOB01/JOB03–04 freezes; JOB02 already includes
  Python sources from scripts/evals. Historical frozen checkouts stay unchanged.
- Document testing goals, setup mismatches, harness defects and Lookout defects
  in one shared harness reference. No new workflow layer or case registry.
- Validation: 88 affected Node checks passed (including five shared Python
  transport/freeze tests), data validation passed (158 roles), diff check passed.
  Full npm test before the final owner-closeout integration: 1,287 passed,
  five skipped, one failed. The unchanged connected
  Action Board SQL scenario also fails in isolation with Invalid human decision;
  no SQL, backend, domain or Action Board test source changed in this pass.
- Limits: no participant inference, account writes, product/demo changes or
  hosted deployment. Incoming main's JOB03/04 host was integrated before migration.

## COM01/COM02 review follow-up

- Revalidated all four PILOT-05 grades and evidence digests, all 87 frozen source
  bindings, and all 42 stage clocks; no capture failures/retries observed.
- Primary grades retained: COM01 baseline/Lookout 7/10 and 9/10; COM02 14/15
  and 11/15. Scores describe these trajectories, not product-defect attribution.
- Shared guidance now distinguishes design validity from execution clearance and
  permits unresolved attribution. Correlated scoring, one pair/case, concurrent
  timing and absent human-effort measurement limit general conclusions.
- Validation: documentation diff check and catalog validation; no new inference,
  account writes, primary regrading or product changes. Prior test limits above
  remain unchanged.

## Prospective COM01/COM02 design revision

- Version new scenarios/graders; score frozen user-outcome groups through one
  shared helper while retaining checkpoint diagnostics. Require cited impact
  for observed failures, not raw-storage conformity or automatic defect blame.
- Clarify Sam's unsent draft; preserve uncertainty for conflicting candidate facts.
  Capture COM02's actual read-only timeline for final-state review.
- Reuse COM03’s owner-scoped fixture-ID mapping in COM02 via one shared helper
  so the planned fresh owners do not collide.
- Reuse existing orchestrators with shared serial-pair locking and alternating
  order. Freeze a four-pair-per-case pilot plan; no participants launched here.
- Fresh freezes include the common grading contract alongside each scenario.
- Common summaries validate grouped scores; prospective exporters reuse the
  existing paginated verifier. Existing PILOT-05 sources and grades stay frozen.
- Validation: 21 affected Node checks passed; final 10-check fixture/freeze
  rerun passed after the shared fixture extraction and contract binding. Catalog
  validation (158 roles), diff check and 87 historical freeze bindings passed.
  Full SSD suite before the final extraction: 1,294 passed, five skipped, one
  unchanged connected Action Board SQL failure (Invalid human decision). An
  earlier internal-temp run stopped with ENOSPC; the SSD rerun completed.
- Limits: no new inference, live preflight, human study, Langfuse registration/
  export, product change or deployment. The four-pair plan has not been executed.


## Scheduled review: revised runner compatibility

- Fix stale COM01/COM02 runtime version guards left behind by the prospective
  scenario revision. Current preparations now configure; obsolete versions reject.
- Add a no-inference runner-configuration regression check. Frozen pilot files,
  participant execution, product behavior and shared services remain unchanged.
- Validation: four setup/design/transport Node checks and catalog validation (158
  roles) passed; COM01/COM02 stream and native-setup checks also passed. Live
  preflight remains unverified while shared Docker is unavailable.


## Docker recovery follow-up: shared bridge teardown

- Reproduced a separate bridge cleanup deadlock with a fictional worker emitting
  a partial response line. HTTP handler joining waited on the still-live worker.
- Stop the bridge worker before joining request threads; retain JOB02 graceful
  EOF behavior. Regression exercises both graceful and immediate shutdown.
- Validation: seven focused Node checks (including real local worker regressions),
  catalog validation (158 roles), and diff checks passed. No participant run, product
  behavior or frozen evidence changes.


## JOB01/JOB02 quality-gap investigation

- Located a missed canonical-profile fixture prerequisite; selected-profile draft
  calls can fail before the writer despite valid owned job/resume IDs. Existing
  setup probes omitted that field. Recorded source/evidence limits in the existing
  pilot report and handed prospective shared-clone repair to its owning chat.
- Added a fictional missing/present canonical-profile regression; no product,
  participant, historical account or frozen-result mutation.
- Validation: 12 application-preference checks, catalog validation (158 roles),
  and diff checks passed.
