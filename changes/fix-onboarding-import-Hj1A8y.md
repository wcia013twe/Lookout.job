# Fix onboarding Simplify import crash

- Mount the scoped Simplify import controller when onboarding displays its import handoff; provide the required controller and reset the handoff across account/demo scope changes.
- Reuse the existing fictional demo CSV preview, save and reset interactions and scoped backend/MCP contract; no new actions or fixtures.
- Validation: all 531 npm tests passed, including fictional import/reset and scoped adapter/MCP tests; npm run validate:data passed (147 roles); production static build passed, including /onboarding.
- Limits: no interactive browser or live-account import performed.

## Secure connection instructions follow-up

- Clarify in onboarding, the shared demo steps and clipboard feedback that copied setup contains a secret token and belongs only in secure plugin/MCP settings or the agent’s secure connection form. The waiting screen now gives a credential-free chat request.
- Existing scoped connection issue/revoke and runtime-check boundaries remain unchanged; no service actions added.
- Verification: all 531 tests passed (including fictional demo connection/import and scoped contracts); data validation passed (158 roles); production build passed. Copy-only changes were reviewed in source; no interactive browser or live secure-form connection verified.

## Require sign-up or sign-in first

- Make authentication the first required step for real onboarding, including returning from later scenes after signing out. Remove the guest skip into Circle/workspace setup.
- Explain that Google creates a new account or signs in an existing one; preserve the existing OAuth return to onboarding. Remove the fictional demo option from the authentication step.
- Reuse the existing human-only OAuth boundary and scoped connection tools; no new backend or MCP actions. Onboarding always exits demo mode, including old demo links and blocked tab storage. Demo remains available elsewhere.
- Verification: all 532 tests passed, including onboarding OAuth return and the new demo-entry boundary regression; data validation passed (158 roles); production build passed. No live Google OAuth or interactive browser verification performed.
