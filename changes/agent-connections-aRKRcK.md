# agent-connections

- Repair the deployed connection-manager scope regression that rejected the form's default profile setup permission. Preserve human-only issuance, owner isolation, expiration, revocation history and token hashing. Serialize issuance to retain the ten-active-connection limit.
- Redesign personal-agent setup around creating a named connection, copying its one-time MCP setup and managing active/revoked access. Add inline blank-name validation, action feedback, loading states and an explicit revoke confirmation. Clear a newly issued token when its connection is revoked or the account changes.
- Surface gateway rejection text correctly and advertise supported connection scopes so the UI only offers permissions accepted by that deployment.
- Add isolated, resettable fictional connection creation and revocation to demo mode. Browser verification covered blank-name validation, successful creation, revoke confirmation, revoked state and token dismissal, plus desktop and mobile layout.
- Validation: all 379 tests passed after the scope-discovery adjustment, catalog validation passed for 76 roles, and the production frontend build passed. Desktop and 390px mobile browser checks passed.
- Release scope: only the connection-manager migration and gateway connection-scope metadata are intended for live release. Pending career search migrations and MCP tools are outside this fix. No existing real connection was revoked during testing.
