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

1. Use Supabase authorization code with PKCE S256 and public-client token
   authentication (`none`). Prefer CIMD only if provider support is established;
   obtain the exact client metadata URL and callback from the host management UI.
   Otherwise use one approved predefined public client. The host also supports
   DCR, but provider support is not established. Never guess identifiers, invent
   callbacks or assume dynamic registration. Preserve the OAuth resource parameter
   and matching token audience throughout authorization, exchange and refresh.
   Keep the provider's code exchange, refresh rotation and revocation implementation.
2. A human-only consent page loads provider authorization details, displays the
   host/client, and binds approval to one owned existing Lookout connection and
   its current scopes/expiry. It must not accept an owner or connection from the
   agent as authority. Denial, wrong owner, stale consent and revoked connections
   fail closed. No operation authorizes submissions or changes existing scopes.
3. Before issuing any host token, a reviewed server-side token hook must issue an
   MCP-only audience and a reserved nonexistent database role that PostgREST cannot assume.
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
The offline prototype below avoids ambiguous pending authorization state with a
terminal per-user/client binding. Resource validation and provider account isolation
remain unresolved, so no authentication route or automatic migration is activated.

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
- The verified CIMD metadata URL if supported, or one predefined public PKCE
  client otherwise; its exact verified host callback URI and permitted redirect
  list. No shared secret is expected for a public client.
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

## Executable offline boundary (follow-up)

`backend/oauth-preparation/boundary.sql` is intentionally outside migrations. It
implements a PostgreSQL token hook and authoritative resolver against modeled
provider session/consent tables and the real migrated Lookout connection schema.
One immutable `(user_id, client_id)` binding pins connection, approved scopes,
consent ID/time, resource and expiry. Revocation is terminal; deletion, switching
connections and extending lifetime are rejected. Refresh uses the same checks.
There is no consent writer, execution grant, live hook configuration or RPC route.

The prototype uses a deliberately **nonexistent** `lookout_mcp_no_database` role,
not a new granted role: PostgreSQL cannot switch to it. If a role with that name
appears, issuance and resolution fail closed. This avoids PUBLIC-privilege leakage
through a new role, but does not establish isolation of Auth, Storage or Realtime.
Human session claims remain unchanged. OAuth profile metadata is stripped, expiry
is capped, and the audience is exactly the bound resource.

`backend/oauth-preparation/boundary.mjs` verifies ES256 tokens with the maintained
`jose` library and re-resolves authoritative state on every use. It rejects human
tokens, mixed audiences, wrong clients, invalid sessions and stale connections.
It returns identity only, never a credential/hash. It is not imported by the Node
runtime, so legacy agent-token and human-only paths remain unchanged.

`tests/mcp-oauth-boundary.test.mjs` runs the actual SQL with the fully migrated
Lookout schema in PGlite, modeled Supabase session/consent rows, and ephemeral ES256
keys. Eighteen scenarios cover issuance/refresh, real signatures/JWKS, wrong claims,
terminal revocation, immutable bindings, owner/scope/expiry mismatches and denied
SQL access. These tests are not a real provider integration test, a resource
parameter test or a proof of account API isolation. They do not prove concurrent
revocation is serialized with a later tool write; the eventual dispatcher must
perform authorization and the operation in one transaction.

## Concrete provider limitation found in source

Inspection of official Supabase Auth commit
`1357a5b90faa0e575e25030dc690bb228fdce721` found:

- `internal/tokens/service.go` calls the custom hook during initial issuance and
  refresh, carries the OAuth client ID, and permits custom audience/role claims.
- `internal/hooks/v0hooks/v0hooks.go` supplies identity, claims and authentication
  method to that hook, but no authorization/resource identifier.
- `internal/api/oauthserver/authorize.go` omits `resource` from authorization
  details. `handlers.go` checks a supplied resource during code exchange against
  the authorization, but refresh does not pass its resource to the token service.
  The hook can pin an audience by client binding, but cannot itself prove the
  requested resource matched on both flows. Dedicated-client pinning is narrower
  than the required end-to-end resource-parameter validation.

Thus the tested hook is useful boundary preparation, not a complete direct-provider
solution. A provider-supported resource validation path and real account isolation
are still needed. Parent public health checks identify production Auth as v2.197.0,
whose release predates account-isolation fix #2898; role/audience do not repair old
Auth account APIs. No direct host JWT issuance is safe to activate on that evidence.

## Bounded library alternative

The smallest alternative worth implementing is the maintained OpenID-certified
[`oidc-provider`](https://github.com/panva/node-oidc-provider), with Supabase used
only to authenticate the human inside Lookout. Its existing PKCE, resource
indicators, opaque tokens, refresh and revocation machinery would own the protocol.
Use one explicitly configured public client with an exact host callback and one
resource; leave DCR and experimental CIMD disabled unless separately required and
verified. Human Supabase tokens never become host access/refresh tokens.

Required adapter work is a durable private provider store, a human consent
interaction binding the grant to an existing connection, and one internal scoped
dispatch boundary shared by opaque legacy tokens and provider grants. Grant/connection
revocation must be checked atomically for tool writes and for event delivery.
This removes the dependency on exposing provider JWTs, but introduces signing/cookie
keys and persistent grant storage. It has not been implemented or installed here;
those live credentials/configuration and the host grant require action-time approval.
Do not substitute an in-memory production store or implement OAuth manually.
