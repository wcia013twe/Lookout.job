# Converge main and hide Community tab

- Merge the incoming MCP Events and OAuth source changes with local main, preserving both sets of agent documentation and the newer developer contract version.
- Comment out the Community navigation entry; Circle routes and existing content remain available.
- Validation: catalog validation, frontend typecheck, and static production build passed. Full suite: 1,418 passed and one failed in the incoming secret-staging test on macOS; the focused test reproduces the failure.
- Limits: no hosted deployment or live integration verification; no interface recording was captured.
