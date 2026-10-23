# ChatGPT Sites hosting

Integration note (2026-10-23): this document retains the PC branch’s historical
release evidence. This convergence did not verify or publish a Sites or backend
release. GitHub Pages remains the production workflow; Sites is an optional
build target. Current code also retains the public logo-cache fallback.

The Sites project is `appgprj_6ad991ce4c6081918aee8f35ab4fbc6c` and its assigned
origin is https://lookout-job-signal-board.tenderibex16.chatgpt.site.
The tracked `.openai/hosting.json` preserves that identity. Reuse it; do not
create another project for subsequent releases.

## Historical release evidence (2026-10-22)

The Site is publicly deployed. Anonymous HTTP requests to the homepage,
`/discover/` and `/manifest.webmanifest` returned 200. No browser interaction,
authenticated account or iPhone login round trip has been verified.

Gateway version 23 includes the merged Sites origin addition. To avoid releasing
unrelated differences between repository main and the older deployed gateway,
the native Supabase deployment retained all 26 deployed files and changed only
the CORS allowlist. A read-back confirmed the exact intended contents. Live
preflights return 204 for Sites and Pages, lookalike/other Sites return 403, and
unauthenticated operations return 401 with or without a browser Origin. Existing
gateway instructions and developerVersion were preserved.

The Auth redirect allowlist still requires owner configuration and confirmation.
Do not treat the public frontend checks as proof that Google login works on the
new origin. This migration does not release unrelated newer gateway capabilities.

## Architecture

Sites hosts the static React frontend. Supabase remains authoritative for Google
identity, private candidate data, files, scoped agent credentials and HTTP/MCP
operations. Public hosting does not make private records public. No ChatGPT
sign-in, Sites database, connector access or new MCP server is introduced.
The existing demo mode uses fictional, isolated fixtures on either host.

The direct website and the Sites entry open the same frontend. Text interaction
still requires a separately connected Muse/personal agent. This deployment does
not install a ChatGPT plugin or establish an agent connection.

## Build and release

Keep this GitHub repository authoritative. GitHub Pages remains available while
Sites is verified. In the isolated feature checkout, install with `npm ci` and
`npm ci --prefix next-app`, then run:

```sh
npm test
npm run validate:data
npm run build:sites
```

`build:sites` clears `NEXT_PUBLIC_BASE_PATH`, builds the normal `next-app/out/`
export, then copies it into root `out/`, the directory Sites supports. Neither
output is committed. The ordinary Pages build and its URL prefix are unchanged.
The static catalog is bundled, so catalog changes need another Sites release.

Use the Sites plugin source workflow with a fresh short-lived repository
credential. Open the existing Site source before editing, integrate changes from
this repository, and resolve diverged history without force pushing. Package the
exact source commit and static build, save a version, then deploy that version.
For the source helper's ordered commands, use `npm run build:sites`; if it already
passed with unchanged inputs, no remaining build command is needed. Keep
credentials in memory/stdin; never commit them or copy them into this document.

### Logo.dev configuration

`NEXT_PUBLIC_LOGO_DEV_TOKEN` is a publishable frontend key saved in the connected
Site's environment settings. For this static export, retrieve that value through
Sites and pass it as an environment variable when running `npm run build:sites`.
Runtime environment updates alone do not modify the already-built JavaScript;
rebuild, save and deploy a new version after changing the key. Keep the key out
of tracked source and pass it through memory/stdin when preparing a release.
Logos load directly from Logo.dev; the old Supabase logo bucket is unused.

Sites maintains its own managed source repository. A push to GitHub alone does
not publish this Site. Automatic public publishing is not configured. Changes
made through Sites must be reconciled back into this repository before the next
release; avoid maintaining independent versions of the app.

## Backend release prerequisites

1. In Supabase Authentication → URL Configuration, add the exact new root URL
   `https://lookout-job-signal-board.tenderibex16.chatgpt.site/` to Redirect URLs,
   retaining existing Pages and localhost redirects. Keep the existing default
   Site URL until cutover. The Google provider callback remains the same Supabase
   `/auth/v1/callback`; its secret and the database do not move.
2. Release the committed gateway CORS allowlist addition through the production
   backend release process after merge. Only this exact Sites origin is allowed;
   other `chatgpt.site` origins remain denied. Do not deploy a feature branch
   directly to the shared production backend.
3. Verify the hosted gateway OPTIONS request returns 204 with the exact allowed
   origin; unauthenticated POSTs must remain denied and native MCP requests must
   retain token/scope/ownership validation.

The connected Supabase MCP tools do not expose Auth URL configuration. This
repository currently contains a Pages deploy workflow but no backend deploy
workflow. Do not infer a successful backend release from frontend publication.

## Cutover checks and limits

Open the public URL signed out, follow nested routes directly, and check static
assets, the catalog, fictional demo mode, manifest and service worker. Complete
Google sign-in as the intended user and verify profile, private batch links,
applications, resume access and agent-connection management. Confirm that the
same authenticated workspace is visible through the existing scoped MCP tools.
Creating a credential remains an explicit user action; never create one just to
test the deployment without a separate request.

Browser storage and sessions are origin-specific. Cloud-backed records can load
after sign-in, but unsynced local edits, anonymous tracking and local preferences
do not automatically transfer. Preserve the old app until these are accounted
for. On iPhone, add the new URL to the Home Screen and test the login return and
reopening it; the old Home Screen shortcut continues pointing at Pages.

Rollback by redeploying a known saved Sites version or continuing to use Pages.
Do not remove the Pages deployment or its allowed origin until cutover is proven.
