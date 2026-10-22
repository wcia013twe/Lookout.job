---
type: guide
title: Quickstart and Task Routing
description: A concise contributor entry point for running Job Signal Board locally, choosing the correct subsystem, validating changes, and delivering them safely.
tags: [quickstart, contributors, development, testing]
sources:
  - id: openwiki-source-daf31e1da3487fbfbe26e703
    resource: repo://.github/INTEGRATION.md
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-81c5adab9ce20a401e545d9a
    resource: repo://backend/circle-knowledge.md
  - id: openwiki-source-bbf1af92c885d4090c46fedd
    resource: repo://docs/private-network.md
  - id: openwiki-source-dc9ae5ef6910469df9693341
    resource: repo://next-app/README.md
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
generated: { by: "codex", at: "2026-10-22T07:08:18.987Z" }
verified:
  - by: openwiki/0.7.2
    at: 2026-10-22T07:08:18.987Z
---

# Quickstart and Task Routing

Job Signal Board is a public job catalog plus a private, agent-assisted candidate workspace. The production UI is a static Next.js/React/Tailwind export on GitHub Pages; Supabase owns identity, private data, files, and agent authorization; a separate local runner owns narrowly scoped browser automation.

## Set up a feature checkout

Use Node.js 22 or newer. Keep the shared `main` checkout for inspection and landing. Start each writing task in its own checkout:

```sh
npm run feature:doctor          # first use or setup trouble
npm run feature:start -- <name>
cd <returned-checkout>
npm ci
npm ci --prefix next-app
```

Work only in the returned `codex/…` branch. Complete its generated file under `changes/`, including checks and honest limits, before committing.

## Run the application and checks

```sh
npm run dev             # delegates to next-app
npm test                # domain, gateway, runner, and database scenarios
npm run validate:data   # canonical catalog shape and uniqueness
npm run build           # static production export
```

Use `npm run test:db` only for focused database debugging. Real Google sign-in, private file round trips, live MCP clients, and employer forms still require explicit live verification; tests do not submit real applications.

## Route work by behavior

- **Understand runtime and ownership boundaries:** read [System Architecture](architecture/system-overview.md). It explains the static client, shared domain modules, cloud controller, Supabase services, agent adapters, and runner.
- **Change catalog discovery or the tracker:** read [Discovery and Application Tracking](workflows/discovery-and-tracking.md). Update `data/jobs.json` before catalog UI, preserve statuses, and remember that opening or queueing is not applying.
- **Change company research, contacts, or Network:** read [Network Company Hub](workflows/network-company-hub.md). It separates shared company identity from private workspaces and keeps application/contact ownership intact.
- **Change Circle contributions or company intelligence:** read [Circle Knowledge and Sharing](workflows/circle-knowledge.md). Published revisions, membership, review and source context govern what Network can show.
- **Add or change an agent-facing action:** read [Agent Gateway and MCP Contract](agents/gateway-and-mcp.md). The website and MCP must share backend ownership, validation, scopes, and versions; do not add generic database tools.
- **Touch preparation, approval, or execution:** read [Application Preparation and Submission Safety](agents/submission-safety.md). Human approval, automatic policy authorization, browser execution, user-reported progress, and observed confirmation are distinct.
- **Validate, commit, land, or publish:** read [Testing, Data Validation, and Feature Delivery](operations/testing-and-delivery.md). Routine completion lands locally; a PR is only for requested review, protected CI, or production publication.

## Source-of-truth rules

`data/jobs.json` owns the public catalog. `supabase/migrations/` owns the database schema. `supabase/functions/agent-gateway/instructions.json` owns developer interaction defaults and requires a `developerVersion` increment when its advertised contract changes. Production React work belongs in `next-app/`; root `lib/` holds shared domain/browser modules; `legacy/` is retained reference presentation, not the destination for new UI.

Never infer ownership from caller-supplied user IDs, expose service-role credentials, put private resumes in public assets, forge approval, or treat status as submission proof. Preserve unfamiliar edits and resolve overlap in the feature checkout rather than resetting another session's work.

## Deliver

After relevant checks pass, commit the intended files and run `npm run feature:land` from the feature checkout. Report the checkout, branch, local-main commit, checks, publication status, and any remaining uncommitted work.
