# CSV import discovery guidance

- Reproduced issue #57's read-only discovery shape with fictional MCP requests: workspace readers see imported history, while preview/save require tracking:write. The server's scope checks are correct; the shared instructions omitted this prerequisite.
- Make the import flow conditional on current tool discovery, explain the separate read/write scopes, stop safely when tools remain absent, and bump developerVersion from 59 to 60. No credential, scope, validation or authorization changes.
- Add a regression across read, context, legacy work without tracking:write, and work scopes; denied calls never forward. The guidance assertion fails before the fix. Existing fictional demo coverage is unchanged because this changes only the agent contract.
- Validation: focused Simplify/context tests passed 11 tests; data validation passed 158 roles; full npm test passed 574 tests. No frontend/auth/client implementation changed, so no frontend build was needed.
- Limits: no live connection inspection, production writes, synthetic reports or deployment. Actual caller scope and deployed backend version remain unknown. Backend release is required before clients receive the updated guidance.
