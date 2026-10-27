# muse-dev-tunnel

- Added an optional `muse-dev` Docker Compose overlay forwarding ngrok to `api:8080`, plus `make muse-dev`, `make muse-dev-down` (tunnel only), and `make muse-dev-logs`. Normal startup excludes the tunnel; the tunnel waits for API health, has no host ports, disables request inspection, and does not restart with Docker.
- Added an ignored local tunnel credential file template and documented stable endpoint setup, separate local-account bearer credentials, connector host registration, shared-stack ownership, and live context checks. Upstream Host rewriting preserves the existing API allowlist; Origin and authentication checks are unchanged. The image follows ngrok's documented `latest` tag.
- MCP mapping: transport for existing scoped `/mcp` tools only; no new product action or tool. Hosted Muse compatibility and execution remain unverified. The API port also includes authenticated `/v1` routes; this is not a path-only proxy.
- Demo: existing fictional fixtures are unchanged because no product state or interaction was added. The focused demo/MCP run passed 35 checks; its database scope audit could not load missing PGlite.
- Validation: `feature:doctor`; Compose v5.6.1 configuration validation with fixture credentials; service enumeration confirms no tunnel with the profile disabled; missing-token/URL rejection; Make dry runs and missing-file setup feedback; `validate:data` (158 roles); `git diff --check`.
- Limits: root and frontend `npm ci` failed after registry DNS `ENOTFOUND` errors. `npm test` completed with 665 passes and 56 failures, including missing dependencies, a provider-count assertion (103 vs 108), and sandbox-denied local socket binding. Full output retained at `/private/tmp/muse-dev-tunnel-tests.log`. Docker engine access was denied by the execution sandbox; no containers were started, credentials created, or live tunnel/Muse round trip performed. Configuration validation does not verify image pulling, ngrok authentication, or backend availability.

## Follow-up: shared runtime environment file

- Tunnel settings now come from `backend/runtime/.env.local`, matching the existing Docker backend configuration. Moved the placeholders to the runtime example, removed the separate tunnel template, and updated Make commands and setup instructions. Only the ngrok token is forwarded to the tunnel container.
- Validation: Compose resolved with fictional runtime credentials; verified tunnel receives no Supabase key and default startup excludes it; Make dry run, data validation and diff whitespace checks. Live tunnel verification remains pending credentials and Docker access.

## Follow-up: verified startup against the existing backend

- Corrected the env-file location to the repository-root `.env.local`, where the user actually keeps ngrok settings. Added `MUSE_DEV_ENV` for selecting that file from an isolated checkout without copying secrets. Runtime backend credentials remain separate.
- Changed the tunnel into its own `lookout-muse-dev` Compose project attached to the existing backend network. Startup no longer rebuilds, recreates, or stops API/worker containers owned by another checkout.
- Added a mounted, read-only ngrok Traffic Policy denying every path except `/mcp` and rewriting the upstream Host header without the deprecated CLI option. Only the ngrok token enters the tunnel environment.
- Live verification: ngrok image pulled, session established, and tunnel started. Public `/mcp` POST reaches API and returns 401 without credentials. `/`, `/healthz`, `/v1/operations`, `/v1/resume-import` and a normalized traversal request return 403. Existing API stayed healthy and worker unchanged. Compose model validation, Make dry run, `validate:data` (158 roles), and diff checks pass. No demo state or product action was added; existing demo fixtures remain detached.
- Limits: authenticated Muse context/read/write flow was not exercised. Earlier full-suite dependency/sandbox failures remain documented above; no application logic changed in this follow-up. Tunnel service is intentionally left running for the user.

## Follow-up: local UI connection handoff

- Local frontend startup now derives the advertised MCP URL from the root `NGROK_URL`, overriding stale localhost connection instructions. Live preview forwards only that public URL, never the ngrok token or server credentials. Browser data traffic stays on local Supabase, with the local anonymous key explicitly overriding any hosted publishable-key setting. Hosted build defaults are unchanged.
- Scoped MCP mapping and fictional demo behavior are unchanged: this fixes the endpoint advertised by the existing connection setup, not a new backend operation.
- Validation: four launcher/env tests pass, including private-key exclusion, localhost override, HTTPS validation and hosted-mode isolation; data validation passes (158 roles). Live runtime checks are recorded below.

- Live verification: a disposable fictional local account and scoped agent token successfully read the same profile via direct Node MCP and public ngrok MCP; the account was deleted afterward. Startup also accepts ngrok dashboard hostnames without an explicit scheme and normalizes the advertised URL to HTTPS. Invalid configuration is checked before acquiring the preview lock.

- Final live check: restarted the existing local preview, then fetched the actual `/profile/` browser bundles and confirmed the advertised ngrok `/mcp` URL and `http://127.0.0.1:54321` data endpoint. The API container points to local Supabase through `host.docker.internal:54321`. Thirty-nine targeted launcher, MCP, scope and demo tests passed; the launcher tests were rerun after hostname normalization. A Muse connector still needs the human-created token in its secure settings; no real-account token was issued or connector registered by this task.
