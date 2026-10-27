# Deploy hosted Lookout backend

- Integrate current published backend contract fixes with the committed local application, preserving scope checks, detailed validation and runtime source identity. Developer contract advances to 87.
- Release the schema and three authenticated functions to project osyrlausutnqzlegxmnd from the main-only production workflow, before frontend publication. Keep local Docker configuration separate and preserve unrelated shared-checkout edits.
- Point frontend/runner defaults and fictional browser fixtures at the new hosted project; existing logo CDN assets remain on the original public cache. No private data/account transfer is included.
- Demo boundaries remain fictional and resettable; project-host changes update their network mocks without adding real writes. Existing scoped MCP services remain the same; deployment adds no generic data tools.
- Validation: full npm test, focused merge-contract tests, production build, data validation and whitespace checks. Hosted migration/function/source readback and auth checks recorded in the delivery response.
- Limits: Google OAuth allowlist, external secrets and separately hosted Node processing/worker features require their own configuration; do not claim those live based on an Edge deployment.

## Deployment packaging follow-up

- The first hosted workflow stopped before migration application because the committed generated toolkit exceeds Node’s default child-process output buffer. Read committed source with a bounded 32 MiB buffer and sanitize read failures; add a regression check against the actual generated bundle.
- Validation: full npm test and data validation; previous production frontend build remains unchanged by this packaging fix.

## Hosted verification

- Production backend workflow 40597204859 succeeded from merged source 5967c5e770b65b087a5cd0f9dffb4d51a316e872. All 77 migrations and agent-gateway, agent-mcp and workspace-reset are deployed. Gateway/MCP bundle readback reports that exact source; developer contract 87 is live.
- A disposable fictional hosted account verified sign-in, human token issuance, authenticated MCP initialization, 103 scoped tools, onboarding read/connection test, developer context, anonymous denial and durable token revocation. The account was deleted; a database check found zero verification accounts remaining and no public tables without RLS.
- Full suite: 867 passing. Production build/data validation passed.
- Google provider and hosted/local redirect allowlist are configured, but Google still rejects the new callback with redirect_uri_mismatch. The full-site workflow was canceled and backend-only deployment used so the existing public website remains on its previous working backend. Add the new callback in Google Cloud before switching the public site. Private account data was not copied; optional Node API/parser/worker hosting is outside this deployment.
