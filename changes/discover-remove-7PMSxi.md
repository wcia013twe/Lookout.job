# Remove Discover roles through the agent

Add a scoped, idempotent removal action for owned batch items. Discover hides removed items while preserving batch history, catalog jobs, and applications. The website RPC and agent operation share the same owner-checked function. Agent discovery refreshes on developer version 109.

Validation: full npm test (956 passed, 5 skipped), data validation, focused MCP/database checks, and production build passed. The fictional batch projection covers hidden and visible roles without account writes.

Limits: deployment and live account behavior require the normal production release and verification.
