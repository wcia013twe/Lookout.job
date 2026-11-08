# gcp-api-staging

- Mount the existing worker staging volume read-only in the GCP API at the same configured path, enabling retained source-lead reads through the existing scoped MCP/API operation. No schema or demo behavior changes.
- Validation: deployment tests, catalog validation, parsed Compose mount/path checks and git diff checks.
- Limits: no GCP deployment or live cloud worker-write/API-read verification performed.
- Root locked dependencies installed. Frontend dependency installation hit internal disk exhaustion; the partial task-local install was removed. No frontend build was run for this Compose-only fix.
