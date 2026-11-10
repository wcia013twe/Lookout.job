# MCP host OAuth bridge (source only, disabled by default)

The bridge uses `oidc-provider@9.13.3` for OAuth authorization codes, S256 PKCE,
opaque access/refresh tokens, rotation, replay detection and revocation. Supabase
continues to authenticate people only inside Lookout. No Supabase human access or
refresh token is stored by this adapter or sent to ChatGPT. The older direct-token
experiment under `backend/oauth-preparation/` is research, not an activation path.

## Implementation

- `backend/runtime/oauth.mjs`: fixed client/resource configuration, durable provider
  adapter, discovery, signed interaction/session cookies, consent tickets and
  issuer endpoints. Production requires an explicit private configuration file.
- `20261110174636_mcp_host_oauth.sql`: private provider records/grants, disabled
  singleton policy, immutable owner/connection/scopes/expiry binding, atomic
  consumption/revocation, bounded opportunistic expiration cleanup, and scoped
  connection resolution. Existing credential lookup expressions are consolidated
  through one indexed connection-ID resolver without copying an old credential or
  duplicating domain operations. Existing operation validators and permissions stay
  authoritative. Grant/connection locks serialize authority checks with writes.
- `main.ts`, `api.ts`, `service.ts` and the shared gateway/MCP transports: preserve
  legacy opaque tokens and accept the new 256-bit host opaque tokens only through
  durable authority resolution. Human JWTs cannot enter the agent path. Database
  policy disablement immediately denies new-token authority regardless of routes.
- `next-app/app/oauth/consent/page.jsx`: uses the person's existing signed-in Lookout
  session to review an owned connection and its exact scopes/expiry. Authorization
  stays inside Lookout. A one-time ticket returns to the issuer; the original
  signed browser interaction cookie is also required to finish. Wrong origins,
  framed UI, wrong users, changed scopes, extended expiry and ticket replay fail.
- Events retain deterministic connection/callback identity, additionally bind the
  grant, and recheck authority before delivery. Subscription locking prevents grant
  rebinding races. Revocation deletes its subscriptions, keys and queued deliveries;
  expired or disabled destinations are pruned without a polling worker.

The provider database adapter hashes opaque token/code IDs for lookup and removes
those IDs from stored payloads. Signed-cookie session identifiers remain private
in their session records to support the adapter's UID lookup contract. No human
JWT or existing agent credential/hash is fetched as an authorization shortcut.
Expired records are pruned opportunistically, up to 100 per write, with indexed
expiry and bounded outstanding unauthenticated interactions. There is no new worker.

## Host settings

Intended host mode: **provided** public client, not DCR or CIMD fetching.

- Client ID: `https://chatgpt.com/oauth/client.json` (verified public host metadata).
- Public callback from that metadata: `https://chatgpt.com/connector_platform_oauth_redirect`.
  Confirm the supported management flow actually uses that exact callback before
  activation; do not substitute guessed connector-specific IDs.
- Token endpoint authentication: `none`; no shared client secret.
- Grant types: `authorization_code`, `refresh_token` only. No JWT bearer machine grant.
- Base resource scope: `lookout`. Suggested requested scopes: `lookout offline_access`.
  `openid` is supported but unnecessary; there are no email/profile/phone claims.
- Issuer: `https://34-148-155-27.sslip.io/oauth`; resource:
  `https://34-148-155-27.sslip.io/mcp`. The library supplies RFC 9207 issuer binding.
- Resource metadata: `/.well-known/oauth-protected-resource/mcp`; authorization
  metadata: `/.well-known/oauth-authorization-server/oauth`.

`lookout` denotes access through the explicitly selected existing connection. It
is not a replacement for its fine-grained scopes. OIDC scopes never grant database
permissions. Access tokens last at most five minutes; refresh/grant lifetime is
capped by the displayed human-approved expiry, connection expiry and configured
maximum (at most 30 days). Expiry/permission changes cannot extend prior consent.

## Exact approval needed before activation

Source approval/deployment alone does not authorize new persistent host access.
Present a concrete setup package with these values before changing production:

1. Existing Lookout GCP service and Supabase project `osyrlausutnqzlegxmnd`; reviewed
   migration, fixed issuer/resource and exact website consent URL (including the
   deployed site's base path). No Supabase OAuth-server enablement is needed.
2. The provided public client ID, verified callback and two grant types above.
3. New persistent ES256 issuer signing key(s) and at least 32-byte cookie-signing
   key(s), created/stored using the existing secure operator workflow only after
   action-time approval. These are server-only, never plugin-package values or chat
   content. No existing credentials need replacement or extraction.
4. One named existing connection, the actual displayed scopes and approved expiry.
   A seven-day initial grant cap is a conservative proposed setup value; choose it
   explicitly in the activation approval. No new connection scope is implied.
5. The host's supported Connect/consent flow, which grants background refresh
   access and subscriptions. Grant approval does not approve applications or other
   human-only actions. Finish with an observed subscription, signed callback and
   resulting dot run before claiming activation or retiring another watcher.

After approval, use the existing deployment workflow for tested merged code. Store
an owner-readable-only (0600) JSON file outside source with `issuer`, `resource`,
`consentUrl`, `clientId`, `redirectUri`, `jwks` (private ES256 JWKs with kid/use=sig),
and `cookieKeys` (base64 random keys). The existing `scripts/deploy-gcp.mjs` accepts that approved local file as its
second argument when OAuth is explicitly enabled. It transfers it on SSH stdin to a private staging file, verifies its SHA-256,
and under the existing deployment lock atomically installs it at `/etc/lookout/oauth/config.json` with mode 0600 for the
existing container node UID 1000, and uses a read-only API-only Compose override.
The worker receives no signing-file mount. No secrets enter source archives or image
layers. Set `LOOKOUT_OAUTH_CONFIG_FILE=/run/lookout-oauth/config.json` and
set `LOOKOUT_OAUTH_ENABLED=true`. Configure the singleton database policy to match
that client/resource, approved maximum lifetime, and `enabled=true` through the
existing trusted operator path. Startup fails if policy, keys or URLs are missing
or inconsistent. The file contains signing secrets; never log or upload it.

Only the website's consent origin is allowed for its authenticated consent API.
The issuer routes require the same host allowlist as the existing Node API. The
client and callback are an explicit allowlist; dynamic registration and arbitrary
client metadata fetching are disabled.

## Rollback and verification limits

**Full kill switch:** set `private.mcp_oauth_policy.enabled=false` through the trusted
operator path. This denies existing host tokens and deliveries while preserving
legacy `jb_agent_` access. `LOOKOUT_OAUTH_ENABLED=false` alone disables issuance and
OAuth routes, not already-issued token authority. Revoke individual grants to delete
their provider records/subscriptions/queued deliveries. Keep old signing/cookie keys
only for an explicitly reviewed rotation interval; removing keys invalidates sessions.

Local tests use ephemeral keys, modeled human authentication, a real HTTP provider
and actual migrated PostgreSQL logic in PGlite. Concurrent HTTP requests exercise
one-time consumption, but PGlite serializes database execution; production multi-
connection lock/race behavior needs a real PostgreSQL release smoke check. No live
client, secret, grant, subscription or host connection is established by these tests.
