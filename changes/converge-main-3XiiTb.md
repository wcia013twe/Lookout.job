# Converge main and hide Community tab

- Merge the incoming MCP Events and OAuth source changes with local main and retain both agent documentation updates.
- Comment out the Community navigation entry. Preserve the newer live dependency removals alongside incoming OAuth dependencies and reconcile the lockfile.
- Make secret staging checksum verification work with both Linux and macOS checksum utilities.
- Validation: 1,426 tests passed; catalog validation, frontend typecheck, and production static build passed.
- Limits: no hosted deployment or live integration verification; no interface recording was captured.
