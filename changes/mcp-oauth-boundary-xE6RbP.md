# Scoped MCP host OAuth bridge

- Added the maintained oidc-provider 9.13.3 authorization-code/PKCE implementation,
  private durable adapter and immutable human-approved connection grants. Existing
  Supabase sessions authenticate only the Lookout consent UI; host access/refresh
  tokens are separate opaque values. No old agent credentials are copied.
- Added fixed-client/resource readiness checks, discovery and original-browser
  one-time consent completion. OAuth routes and database policy default disabled.
  Preserved legacy agent tokens, fine-grained scopes and human-only actions.
- Consolidated existing SQL credential lookup without duplicating domain behavior.
  Grant/connection checks remain inside operation transactions. Events retain their
  deterministic identity while adding immutable grant binding and revocation cleanup.
- Added actual HTTP/SQL tests for code+refresh, exact resource/redirects, replay and
  concurrent use, consent ownership/CSRF/browser binding, expiry/revocation,
  provider restart, legacy compatibility and event grant lifecycle. Focused host
  and existing event suite: 17 passed. Earlier direct-hook research remains inactive
  under backend/oauth-preparation and is explicitly superseded in documentation.
- Independent review fixes cover subscription binding races, displayed expiry,
  token-expiry capping, invalid-grant handling, cleanup/capacity, frame protection
  and indexed authority resolution. PGlite serializes SQL; genuine multi-session
  PostgreSQL concurrency remains a release smoke-check requirement.
- Fictional detached consent demo and focused OpenWiki/source documentation added.
  Aggregate/build/typecheck receipts are reported with the final handoff. Earlier
  interrupted/setup-failure logs remain local and are not counted as passing checks.
- No push, live deployment, credentials, client registration, grants or provider
  configuration changes. Activation requires the precise reviewed server keys,
  configuration and named connection consent described in docs/mcp-host-oauth.md.
