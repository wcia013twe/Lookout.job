# Actionable artifact validation errors

- Reproduced missing save_artifact fields returning generic JSON-RPC Invalid tool arguments and a practice artifact with preparedFor returning Dated preparation required.
- Shared schema validation now names missing/invalid field paths without echoing caller values or unknown keys. MCP applies it after authentication and scope checks, before forwarding writes; browser and gateway retain the same validator.
- preparedFor errors identify the YYYY-MM-DD requirement and restriction to weekly_prep/interview_brief. Undated practice remains valid; date eligibility, ownership, scopes, optimistic versions and persistence rules are unchanged.
- Validation: 23 focused artifact/MCP tests passed; npm test passed 577 tests including database scenarios; npm run validate:data passed (158 roles); npm run build passed; git diff --check passed. Existing fictional artifact demos passed in the suite; new fictional regression fixtures cover invalid dates, missing fields, privacy, parity and scope precedence.
- Limits: no live writes or reports; hosted behavior and session-specific failures remain unverified. No merge, deployment, credential/access changes or production data changes. Shared protocol import and dispatch area may overlap other MCP fixes.
