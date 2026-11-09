# COM1 final durable-state reconciliation

- Added prospective COM1-stream-v4 eighth session, equal final-report request for both conditions, and independent saved_state/report_accuracy criteria.
- Terminal evidence captured only after participant termination, under account lock; owner/version/time/snapshot/file bindings prevent later reset-account evidence reuse. Scoped read-only tools supplement authoritative frozen snapshots; optional lookup errors are explicit.
- Existing frozen v3 checkout/runs/grades untouched. New exporter dataset identity, no private upload and no registration performed.
- Verification: 33 Python regression fixtures and 3 Node tests; validate:data passed (158 roles); fictional fixture is demo coverage. No account resets, participant runs, migrations or live terminal capture. Root dependency install succeeded; next-app npm ci failed with npm Exit handler never called; feature:doctor passed. UI unchanged.
- Full database suite not rerun for this harness-only change.
