# Shared benchmark transport

- Replace six transport implementations with one shared HTTP-to-stdio transport
  and small case argument adapters. Preserve JOB02's graceful EOF shutdown.
- Bind the shared source into new COM01–04/JOB01 freezes; JOB02 already includes
  Python sources from scripts/evals. Historical frozen checkouts stay unchanged.
- Document testing goals, setup mismatches, harness defects and Lookout defects
  in one shared harness reference. No new workflow layer or case registry.
- Validation: 47 affected Node checks passed (including five shared Python
  transport/freeze tests), data validation passed (158 roles), diff check passed.
  Full npm test: 1,277 passed, five skipped, one failed. The unchanged connected
  Action Board SQL scenario also fails in isolation with Invalid human decision;
  no SQL, backend, domain or Action Board test source changed in this pass.
- Limits: no participant inference, account writes, product/demo changes or
  hosted deployment; JOB03/04's unlanded host dependency was flagged to its owner.
