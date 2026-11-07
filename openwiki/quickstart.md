---
type: engineering quickstart
title: Lookout engineering quickstart
description: Task-oriented reading map for safely changing the Lookout job-search workspace. Routes contributors from a change area to its authority, workflow, operations, and focused verification guidance.
tags: [quickstart, engineering, navigation, workflows, verification]
verified:
  - by: openwiki/0.7.2
    at: 2026-11-07T02:52:01.830Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-012f2c78e3b1446dfc35803f
    resource: repo://Makefile
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
generated: { by: "openwiki/0.7.2", at: "2026-11-07T02:52:01.830Z" }
---

# Lookout engineering quickstart

Use this page to choose the smallest set of context needed for a change; it is a reading map, not a replacement for the implementation. **Source code, migrations, and tests are authoritative.** The linked pages explain the current design and test intent, but a passing local fixture or build does not establish that an external provider, agent host, hosted deployment, or employer action is live. Start with the source and focused tests for the boundary you will change, and use [current implementation state](operations/current-state.md) to state verification limits accurately.

## Start here

1. Read [`AGENTS.md`](../AGENTS.md) for repository working rules, delivery flow, domain placement, catalog constraints, demo isolation, and MCP parity requirements.
2. Read [system architecture and trust boundaries](architecture/system-overview.md) when a change crosses the browser, Supabase, agent gateway/MCP, Node runtime, runner, or external agent boundary.
3. Find the task row below and read its linked workflow/domain page **before** changing its writer, record lifecycle, authorization, or user-facing status language.
4. Locate the closest test in [`tests/`](../tests/) and run it first. Add database, catalog, typecheck, build, or whole-suite checks only as the change reaches those authorities; the [verification strategy](testing/verification-strategy.md) gives the escalation rules.
5. Before describing a change as released or live, check [current implementation state](operations/current-state.md) and validate the correct deployment unit and intended environment.

## Route by the change you are making

| If your task changes… | Read first | Then inspect/change | Verify the boundary |
| --- | --- | --- | --- |
| Runtime topology, trust boundary, browser/backend split, or an external capability claim | [System architecture and trust boundaries](architecture/system-overview.md) | `next-app/`, `lib/`, `supabase/`, `backend/`, `runner/`, or `mcp/` at the owning boundary | [Current implementation state](operations/current-state.md) and [verification strategy](testing/verification-strategy.md) |
| A private record, RLS policy, RPC, migration, version check, lease, idempotency key, or data writer | [Data model, ownership, and consistency rules](architecture/data-and-ownership.md) | `supabase/migrations/` first; keep browser and server writers aligned with the schema | Run the closest SQL-backed test and `npm run test:db`; add owner, stale-version, and replay cases |
| Sign-in workspace state, autosync, account switching, browser cache, realtime refresh, or the isolated preview | [Browser workspace state, cloud sync, and demo isolation](concepts/workspace-sync-and-demo-mode.md) | `next-app/lib/workspace.jsx`, `lib/`, and demo factories; do not bring production clients into demo | `node --test tests/cloud-sync.test.cjs tests/demo-mode.test.mjs`, plus typecheck/build for UI changes |
| Onboarding, profile facts, resume import/upload/selection, saved answers, search preferences, or connection setup | [Onboarding, profile, resumes, and preference changes](workflows/onboarding-and-profile.md) | profile/resume components and owner-scoped services; preserve review and version invalidation | closest profile/resume/onboarding test, then database checks if the writer changes |
| Agent credentials, gateway operations, MCP tools, context versions, guides, scopes, or an agent-facing user action | [Agent credentials, gateway, MCP, and guide routing](concepts/agent-access-and-mcp.md) | `supabase/functions/agent-gateway/` and `agent-mcp/`; add only narrowly scoped parity tools | MCP protocol/scope tests, gateway tests, and database checks for new authority |
| Shared preparation documents, networking, referral/outreach, Circle activity, or consent-gated knowledge publication | [Career Toolkit, artifacts, network, and Circle knowledge](concepts/career-toolkit-and-circles.md) | owning private/shared records and membership/consent boundaries | focused toolkit/Circle tests and `npm run test:db` for persistent policy or publication changes |
| Search profiles, sources, worker execution, observation/screening, deduplication, or private Discover batches | [Job discovery, search runs, and private batch publishing](workflows/job-discovery.md) | backend queue/worker and canonical search writers; keep source coverage and candidate assessment separate | search pipeline/dedup/MCP tests, `npm run test:filter`, and `npm run test:db` |
| A catalog-only role update or static Discover presentation | [`AGENTS.md` catalog rules](../AGENTS.md#job-signal-board-maintenance) | `data/jobs.json` before UI code; preserve known statuses and canonical-URL deduplication | `npm run validate:data`, then consumer tests if behavior changed |
| Application preparation, policy, review, ATS form support, attempt recovery, or submission evidence | [Application drafting, authorization, and guarded submission](workflows/application-submission.md) | gateway authorization, database attempt state, and local runner together; never collapse prepared, approved, reported, and confirmed states | runner/submission focused tests plus `npm run test:db`; use the bounded E2E check only when applicable |
| ATS/CareerOps/HiringCafe adapters, provider behavior, file integration, or claims about an external source | [ATS, CareerOps, HiringCafe, and file integrations](integrations/ats-and-career-data-sources.md) | adapter boundary and provider constraints; preserve partial/inaccessible results rather than fabricating completeness | adapter/liveness/filter tests and environment-specific verification before making a live claim |
| Local setup, environment variables, Docker/Node API/worker modes, Edge Functions, migrations, or release automation | [Local stack, backend processes, and release boundaries](operations/local-and-release-runtime.md) | [`Makefile`](../Makefile), `supabase/config.toml`, backend runtime configuration, and deployment scripts | [Current implementation state](operations/current-state.md); distinguish local runnable behavior from deployed evidence |
| A frontend page, component, route, shared styling, or static-export behavior | [System architecture and trust boundaries](architecture/system-overview.md) | `next-app/app/`, `next-app/components/`, and shared models rather than duplicating domain behavior in the UI | closest focused test, `npm --prefix next-app run typecheck`, and `npm run build` |

## Safe change rules

- **Follow the authoritative writer.** `supabase/migrations/` defines the database schema; do not create a competing schema dump. Keep shared domain behavior in `lib/`, production presentation in `next-app/`, and server functions/migrations in `supabase/`.
- **Preserve trust boundaries.** Browser configuration uses publishable values only. Ownership comes from an authenticated user or validated agent connection, never a caller-supplied user ID. Do not add general SQL, shell, or approval-bypass tools.
- **Preserve outcome vocabulary.** Opening a posting is not applying; a draft, authorization/approval, user report, runner-observed confirmation, and uncertain attempt are different facts. Search `partial` means evidence was retained but coverage was incomplete.
- **Treat demo as detached.** New demo interactions must use fictional, resettable state and must not load account storage, cloud sync, private files, backend writes, or production MCP.
- **Keep website/MCP parity narrow.** A product action needs an existing scoped MCP operation or a narrowly scoped counterpart that shares backend validation, ownership, and version checks. Human-only actions must remain explicit boundaries.

## Local commands and release scope

Install locked root and frontend dependencies with:

```sh
make install
```

With the Supabase CLI and Docker engine available, `make dev` starts local Supabase services, the development MCP tunnel, and the frontend; `make services`, `make frontend`, `make status`, and `make down` separate those responsibilities. Local Supabase data and OAuth configuration are separate from hosted production. `npm run dev` retains the hosted-backend default, so choose the command that matches the environment you intend to test.

For a routine code change, use the repository feature workflow in [`AGENTS.md`](../AGENTS.md#development-and-delivery): start an isolated checkout with `npm run feature:start -- <name>`, make and validate the change there, record its verification limits in the generated change note, and land with `npm run feature:land`. Backend/migration/function changes have a different release boundary from the static frontend; do not represent a frontend build as a backend or integration deployment.

## Baseline validation, with honest limits

The ordinary baseline is:

```sh
npm test
npm run test:db
npm run validate:data
npm --prefix next-app run typecheck
npm run build
```

Run the focused test first and omit irrelevant checks only deliberately. `npm test` is the root Node test suite, `npm run test:db` runs database scenarios, `npm run validate:data` validates catalog data, and `npm run build` builds the frontend static export. These checks establish the contracts they exercise; they do not by themselves verify hosted Auth/Storage/OAuth, an MCP client, an external agent scheduler or notification channel, source-provider availability, or a real employer submission. Record those gaps in the change note and release communication.

## When documentation and implementation disagree

1. Prefer current source, migration history, and the closest test over this map or any workflow prose.
2. Determine whether the behavior is implemented, feature-gated, locally runnable, deployment-recorded, or still unverified using [current implementation state](operations/current-state.md).
3. Update the appropriate owned documentation and focused test alongside a material behavior change; do not advertise an unconnected external service as live.
4. If the change alters a cross-boundary invariant, read the linked architecture/workflow page and extend the focused regression coverage before landing.
