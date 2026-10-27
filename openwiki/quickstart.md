---
type: guide
title: Quickstart and Task Routing
description: Contributor entry point for SSD-isolated work, local services, current profile/tracker navigation, labeled Muse synchronization and separate frontend/backend verification boundaries.
tags: [quickstart, contributors, development, testing, mcp]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-27T03:54:51.227Z
sources:
  - id: openwiki-source-6766b7a0c14857435d2077c9
    resource: repo://.github/workflows/deploy.yml
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-ee1b3e21718542a757d4d790
    resource: repo://backend/runtime/README.md
  - id: openwiki-source-a9e1c6c32dfd334ae56d3f3e
    resource: repo://lib/mcp-services.mjs
  - id: openwiki-source-8bdb9080f51dd31bf9d211bd
    resource: repo://lib/muse-change-feed.mjs
  - id: openwiki-source-012f2c78e3b1446dfc35803f
    resource: repo://Makefile
  - id: openwiki-source-772292b8604c1bdb82fdf033
    resource: repo://next-app/components/appearance-settings.tsx
  - id: openwiki-source-76afc9721711ec0c4fade891
    resource: repo://next-app/components/applications.tsx
  - id: openwiki-source-720bdfcccf0a2396c967b4d5
    resource: repo://next-app/components/profile-menu.tsx
  - id: openwiki-source-baa0beacbe69e73461042a6e
    resource: repo://next-app/components/profile-workspace.tsx
  - id: openwiki-source-5c5dc57d5c7c840354826599
    resource: repo://next-app/next.config.mjs
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-e427ac8f776114f15ac33a12
    resource: repo://scripts/feature-delivery.mjs
  - id: openwiki-source-f6d61f277a1bbda883e922be
    resource: repo://scripts/local-frontend.mjs
  - id: openwiki-source-5e0e032552d77cb40052782b
    resource: repo://supabase/functions/agent-gateway/instructions.json
generated: { by: "codex", at: "2026-10-27T03:54:51.227Z" }
---

# Quickstart and Task Routing

Job Signal Board is a public job catalog plus a private, agent-assisted candidate workspace. The production UI is a static Next.js/React/Tailwind export on GitHub Pages; Supabase owns identity, private data, files, and agent authorization; configured Node services and the separate local runner own bounded execution. Muse supplies reasoning and its actual runtime schedule.

## Set up a feature checkout

Use Node.js 22 or newer. Keep the shared `main` checkout for inspection and landing. Start each writing task in its own checkout:

```sh
npm run feature:doctor          # first use or setup trouble
TMPDIR="/Volumes/External SSD/Lookout/tmp" npm run feature:start -- <name>
cd <returned-checkout>
npm_config_cache="/Volumes/External SSD/Lookout/npm-cache" npm ci
npm_config_cache="/Volumes/External SSD/Lookout/npm-cache" npm ci --prefix next-app
```

Work only in the returned `codex/…` branch. Complete its generated file under `changes/`, including checks and honest limits, before committing.

## Run the application and checks

```sh
npm run dev             # delegates to next-app
npm test                # domain, gateway, runner, and database scenarios
npm run validate:data   # canonical catalog shape and uniqueness
npm run build           # static production export
```

For local Docker-backed development, start Docker and install the Supabase CLI,
then use `make dev` (or `make up`) from the task checkout. This starts local
Supabase first and the frontend at `http://localhost:3000` using the local API
and anonymous key. Use `make install` for initial locked dependency setup,
`make services` / `make frontend` for separate startup, and `make status` for
service details. Ctrl-C stops the frontend; `make down` stops the containers
and preserves data. Check ownership before operating a stack bound to another
checkout. Keep Docker storage, dependencies and build output on the external
SSD. See [local startup details](operations/testing-and-delivery.md#local-docker-services-and-frontend)
and the root [Makefile](../Makefile). `npm run dev` retains the hosted default.

Use `npm run test:db` only for focused database debugging. Real Google sign-in, private file round trips, live MCP clients, and employer forms still require explicit live verification; tests do not submit real applications.

## Route work by behavior

- **Understand runtime and ownership boundaries:** read [System Architecture](architecture/system-overview.md). It explains the static client, shared domain modules, cloud controller, Supabase services, agent adapters, and runner.
- **Change catalog discovery or the tracker:** read [Discovery and Application Tracking](workflows/discovery-and-tracking.md). Update `data/jobs.json` before catalog UI, preserve statuses, and remember that opening or queueing is not applying.
- **Add or change an agent-facing action:** read [Agent Gateway and MCP Contract](agents/gateway-and-mcp.md). The website and MCP must share backend ownership, validation, scopes, and versions; do not add generic database tools.
- **Touch preparation, approval, or execution:** read [Application Preparation and Submission Safety](agents/submission-safety.md). Human approval, automatic policy authorization, browser execution, user-reported progress, and observed confirmation are distinct.
- **Validate, commit, land, or publish:** read [Testing, Data Validation, and Feature Delivery](operations/testing-and-delivery.md). Routine completion lands locally; a PR is only for requested review, protected CI, or production publication. Frontend deployment does not release backend migrations, gateway/MCP config or Node services.

## Current workspace and agent flow

My Profile opens About me, with Job preferences, My Agent and Appearance as the other sections. Onboarding replay and Dashboard tour live in Appearance; Sharing & privacy remains in profile navigation. Job Tracker owns the Stats tab, including bounded counters and the current-outcome application-flow chart.

MCP `initialize` supplies the shared startup instructions automatically. On the first authorized work run after connect/reconnect, Muse refreshes context and uses `read_muse_changes` to pick up labeled platform updates. Each event names the current record/read tool; Muse reads it and acknowledges handled IDs. Timelines include interview reschedules. This is context synchronization, not a new behavior engine or permission to execute work. Connection setup still stops after setup.

My Agent remains the user-managed schedule configuration. Its personal runtime triggers authorized work and submits a bounded Node search job when supported; Node has no duplicate recurring-search scheduler. The worker produces verified/screened/deduplicated shortlists, while Muse writes analysis and publishes private batches. See the linked workflow pages for coverage and version limits.

## Source-of-truth rules

`data/jobs.json` owns the public catalog. `supabase/migrations/` owns the database schema. `supabase/functions/agent-gateway/instructions.json` owns developer interaction defaults and requires a `developerVersion` increment when its advertised contract changes. Production React work belongs in `next-app/`; root `lib/` holds shared domain/browser modules; the retired static frontend is no longer present. Personal records and profile documents remain canonical backend data; Muse context and change pointers do not become a second factual store.

Never infer ownership from caller-supplied user IDs, expose service-role credentials, put private resumes in public assets, forge approval, or treat status as submission proof. Preserve unfamiliar edits and resolve overlap in the feature checkout rather than resetting another session's work.

## Deliver

After relevant checks pass, commit the intended files and run `npm run feature:land` from the feature checkout. Report the checkout, branch, local-main commit, checks, publication status, and any remaining uncommitted work.
