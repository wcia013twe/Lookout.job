# Resume setup after refresh

- Save the current setup scene in versioned, account-scoped localStorage and show Step N of 6 with an honest browser-save indicator. Storage failure remains non-blocking.
- Resume transient role reveals at the preview entry; clear checkpoints after successful completion and workspace reset. No private form data or authority is added to this navigation cache.
- Demo uses the same interaction with isolated demo-epoch keys; tests cover refresh, account isolation, demo reset epochs, corrupt/blocked storage and reset.
- MCP mapping: navigation-only browser preference; existing onboarding state/submit tools remain authoritative for setup completion and agent connection.
- Validation: full npm test (845 passing), focused checkpoint tests (3 passing), npm run validate:data (158 roles), production build, git diff --check, Impeccable detector (no findings).
- Limits: no manual browser or cross-device verification; checkpoints are local to this browser. Existing unrelated shared-checkout edits were preserved. Initial sandbox test-server restriction and npm install failure were resolved with permitted execution.

## Follow-up: remove agent invitations

- Removed “Invite your own agent” and its waiting-room dialog from setup, including demo setup. Existing saved agent selections remain readable; the normal agent choices and secure connection flow remain available. No backend or MCP behavior changed.
- Validation: production build, data validation and whitespace check. No manual browser verification.

## Follow-up: simplify connector setup

- Replaced the onboarding chat-instruction handoff with “Add a connector in your agent,” server URL and token copy controls. Collapsed access/privacy and revocation details and removed redundant creation metadata. Simplified Cappy preview guidance.
- Copying the token enables a connection check; only the existing backend agent confirmation marks it connected. Account-settings instructions and shared credential-free handoff remain unchanged. Existing scoped connection/onboarding tools continue to own issuance, revocation and readiness.
- Demo uses a fictional preview interaction without copying credentials or creating a connector.
- Validation: full npm test, production build, data validation, whitespace check, design detector. No manual browser or live external connector verification.

## Follow-up: plain-language connector directions

- Added a single plain-language direction to find agent settings, add Lookout, paste the server URL and token, and save. The same direction appears in the fictional demo.
- Validation: production build, data validation, whitespace check and design detector. Copy-only change; no external agent settings or live connector verified. No backend or MCP contract changes.
