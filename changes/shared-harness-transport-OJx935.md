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
