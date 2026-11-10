# MCP host authentication: preparation only

Decision, 2026-11-10: do not connect ChatGPT to ordinary Supabase user tokens.
No OAuth route, client, hook, role, grant or connection is activated by this document.
The existing opaque-token MCP endpoint and event feature remain unchanged.

## Verified boundary and unresolved dependency

`backend/runtime/service.ts` accepts `jb_agent_` credentials, hashes them and routes
through connection-authorized RPCs or the existing agent gateway. Human connection
management is explicitly excluded. The event implementation binds subscriptions to
that same connection and checks expiry/revocation before delivery.

The deployment worker verified the existing GCP runtime provider is
`https://osyrlausutnqzlegxmnd.supabase.co`; the browser source default in
`next-app/lib/supabase-config.mjs` agrees. Earlier OAuth discovery from project
`umhqfqzpwmszhcknwtrs` describes an older project and establishes nothing about this
runtime's OAuth configuration. Private OAuth/subscription metadata reads on the
current project were denied for project scope; they are stopped, not retried here.
No live host subscription has been verified. Parent public-provider checks found
`/auth/v1/.well-known/oauth-authorization-server` and `/auth/v1/oauth/authorize`
return HTTP 404 `feature_disabled` (OAuth server is disabled). Ordinary OIDC
metadata and ES256 JWKS return 200; those do not establish OAuth availability.

[Supabase token-security documentation](https://supabase.com/docs/guides/auth/oauth-server/token-security)
explains that OAuth scopes govern identity claims rather than database access.
Ordinary issued tokens therefore cannot safely substitute for scoped agent tokens.
[Upstream Auth PR 2898](https://github.com/supabase/auth/pull/2898), merged November 3,
adds default-deny isolation of OAuth-client sessions from account endpoints.
Deployment of that fix to this provider has not been established. Its presence
would solve only the Auth endpoint boundary, not database or Lookout permissions.

## Smallest candidate using the existing provider

This is a conditional implementation design, not a proven supported integration:

1. Use Supabase authorization code with PKCE S256 and a dedicated static public
   client, with the exact callback copied from the host's MCP management UI.
   Do not assume dynamic registration or invent a callback. Keep the provider's
   code exchange, refresh rotation and revocation implementation.
2. A human-only consent page loads provider authorization details, displays the
   host/client, and binds approval to one owned existing Lookout connection and
   its current scopes/expiry. It must not accept an owner or connection from the
   agent as authority. Denial, wrong owner, stale consent and revoked connections
   fail closed. No operation authorizes submissions or changes existing scopes.
3. Before issuing any host token, a reviewed server-side token hook must issue an
   MCP-only audience and a dedicated database role with no accessible privileges.
   Bind the claims to server-owned consent and client/session identity. Apply
   identical isolation to authorization-code issuance and every refresh; reject
   missing/stale bindings rather than fall back to a human token. Do not derive
   authorization from editable user metadata or OIDC scope strings.
4. The Node resource server validates signature with the configured provider JWKS,
   exact issuer, resource audience, expiry, client, session and isolated role.
   A service-only database bridge rechecks the consent/grant/session and existing
   connection, then invokes the existing operation authorization. It must never
   export an existing credential/hash or manufacture a replacement opaque token.
   Existing Edge fallback routes must use the same bridge before OAuth is enabled;
   forwarding an OAuth bearer to a human-authenticated gateway is forbidden.
5. Event subscriptions retain the existing connection identity for deterministic
   IDs/deduplication, plus the consent/grant binding for revocation. Recheck both
   on subscription mutation and each delivery; grant revocation must stop pending
   callbacks even while the underlying opaque connection remains valid. Refresh
   must not create a second subscription or extend the connection's expiry.
6. Only then expose protected-resource metadata and the matching OAuth challenge.
   The existing opaque credential path stays supported with its current authority.

A custom audience or a role name alone is not proof of isolation. PostgreSQL PUBLIC
function/schema grants, SECURITY DEFINER functions, Storage, Realtime, GraphQL,
Auth account APIs and Lookout human endpoints must all be tested. Creating a new
role or token hook is a live permissions/configuration decision, not a routine
credential substitution. If the provider cannot enforce this before token issuance
and refresh, reject this approach; do not quietly ship a homegrown OAuth broker.

## Offline implementation and acceptance gates

Before implementing the candidate, establish from supported provider contracts
how the authorization ID, OAuth grant and session can be bound atomically to the
approved connection before the token hook executes, including refresh. A guessed
claim/session join could bind another grant or accidentally issue a human token.
This remains unresolved, so this preparation deliberately adds no partially wired
authentication code or migrations to automatic deployment paths.

Required test cases for that implementation:

- JWT wrong signature/issuer/audience/client/role, missing session, expiration,
  human-token substitution and JWKS rotation fail closed.
- Cross-owner consent, spoofed client/connection, replayed approval and a race
  between revocation and exchange cannot mint usable access.
- Initial and refreshed host tokens cannot read/write tables, invoke human RPCs,
  access Storage/Realtime or change password, MFA, identities or user metadata.
- Existing connection scopes/expiry and human action-time approvals remain the
  final authority for every Node, Edge and queue route.
- Disconnect/revoke stops access, refresh and event deliveries. Retry and refresh
  preserve stable delivery/subscription identities and do not acknowledge work.
- Provider/DB failures deny authority; rollback disables only the new OAuth path
  and preserves existing opaque connections and service configuration.

## Exact production approval and host handoff

After review and offline isolation tests, request action-time approval naming:

- The verified production project `osyrlausutnqzlegxmnd`, exact reviewed hook/role/
  consent-mapping changes, and the resource URL `https://34-148-155-27.sslip.io/mcp`.
- Enable the currently disabled OAuth server and set its reviewed consent path,
  without changing ordinary sign-in behavior.
- One static public PKCE client, its exact verified host callback URI and permitted
  redirect list; no shared secret is expected for a public client.
- One named owned Lookout connection, its displayed scopes and maximum lifetime,
  and the host's persistent access/refresh grant. No broader permissions implied.

The callback, selected connection, verified provider isolation behavior and reviewed
configuration do not yet exist as a complete approval package. Do not ask for a
blanket approval to unspecified credentials/access. Host connection approval and
provider configuration are separate from deploying the event code. A successful
host subscription, signed callback and resulting dot run must be observed before
claiming wakeups or retiring an existing watcher.

References: [provider setup](https://supabase.com/docs/guides/auth/oauth-server/getting-started),
[MCP authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication),
[OAuth flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows),
[custom token hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook),
and [ChatGPT authentication](https://developers.openai.com/plugins/build/auth).
