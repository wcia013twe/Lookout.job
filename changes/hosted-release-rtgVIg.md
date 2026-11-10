# Hosted release synchronization

- Reconcile published main with accumulated committed local work, preserving both documentation histories.
- Update the connected-board SQL regression for the existing application-owned interview confirmation boundary; assert interview proposals remain off the Action Board and canonical correction still preserves evidence.
- Configure GitHub public API/MCP URLs for the existing HTTPS GCP endpoint. Preserve execution/submission switches as disabled.
- Validation: catalog validation (158 roles), frontend typecheck and production build passed. Full suite initially found one stale interview-board fixture; focused repaired SQL scenario passed. Integrated full suite: 1,318 passed, 5 skipped, zero failures. A concurrent local-main pass supplied a stronger authenticated-writer regression, retained during integration.
- Release: PR #83 merged as 1a54994d; hosted backend, CI and Pages deployment 42748313688 succeeded. GCP preflight stopped before mutation because the isolated checkout lacked the provider cache. Inspection also found missing Docker inputs in the source allowlist; include the agent package and builder, and stamp exact GCP runtime provenance before building. Regression verifies every Docker COPY input is archived.
- Limits: GCP retry and authenticated account checks pending. Unrelated shared-checkout edits and local account data are excluded.
