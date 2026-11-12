# One-second agent polling

- Package 0.2.2 defaults to one-second count polling (up to 10% jitter); the existing 10-second wake cooldown remains. Updated the example, setup guides, developer version and pinned dev-tunnel archive. Existing explicit host configurations require an update and service restart.
- Validation: focused watcher, MCP contract and public transport tests passed; data validation, backend typecheck and production frontend build passed. Full suite ran with one outdated developer-version assertion, corrected and verified in the focused rerun. Fictional watcher feed coverage exercises wake and retry behavior.
- Limits: no hosted deployment, package publication or remote host installation was performed. One-second polling increases count endpoint traffic; cooldown and network delays can still delay wake delivery.
