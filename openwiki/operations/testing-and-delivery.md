---
type: operations
title: Testing, Data Validation, and Feature Delivery
description: SSD-isolated contributor workflow, local service ownership, layered website/MCP and timeline proofs, and the distinction between local landing, frontend publication and backend release.
tags: [testing, delivery, git, validation, deployment, local-services]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-27T03:54:51.227Z
sources:
  - id: openwiki-source-6766b7a0c14857435d2077c9
    resource: repo://.github/workflows/deploy.yml
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-7753b08239c5f11a343c1d15
    resource: repo://backend/local/README.md
  - id: openwiki-source-9025181f12900b1c2ae4adf5
    resource: repo://backend/README.md
  - id: openwiki-source-012f2c78e3b1446dfc35803f
    resource: repo://Makefile
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-2d754db5799c613940112ccc
    resource: repo://scripts/check-local-muse-timeline.mjs
  - id: openwiki-source-89c6ac00faaae4aa3278244e
    resource: repo://scripts/check-local-scheduler-removal.mjs
  - id: openwiki-source-e427ac8f776114f15ac33a12
    resource: repo://scripts/feature-delivery.mjs
  - id: openwiki-source-f6d61f277a1bbda883e922be
    resource: repo://scripts/local-frontend.mjs
  - id: openwiki-source-1e0988be4eaa8a50e225c41d
    resource: repo://scripts/validate-data.mjs
  - id: openwiki-source-97b055383ec9bb893da69323
    resource: repo://tests/feature-delivery.test.mjs
  - id: openwiki-source-6a20cae9490dd13d07a5a2b7
    resource: repo://tests/muse-timeline-changes.test.mjs
generated: { by: "codex", at: "2026-10-27T03:54:51.227Z" }
---

# Testing, Data Validation, and Feature Delivery

Repository work is designed for concurrent local sessions without sharing writable state. Documentation, catalog maintenance, dependencies, and code all follow the same isolated feature workflow.

## Start in an isolated checkout

Keep the shared `main` checkout for inspection and local landing. Run `npm run feature:doctor` on a new host or after setup trouble, then start work from shared local `main`:

```sh
TMPDIR="/Volumes/External SSD/Lookout/tmp" npm run feature:start -- <short-name>
```

The starter validates the name, clones committed local `main` into a unique temporary checkout, creates a `codex/…` branch, records the source checkout, and generates a task-specific change note. Install locked dependencies there with `npm ci` and `npm ci --prefix next-app`, using `npm_config_cache="/Volumes/External SSD/Lookout/npm-cache"`. Reuse that checkout for follow-ups and preserve unfamiliar edits rather than resetting or stashing them.

## Local Docker services and frontend

The root `Makefile` provides the local development entry point. Start your Docker
engine and install the Supabase CLI, then run these commands in the task checkout:

```sh
make install   # npm ci for the root and next-app; first setup only
make dev       # also make up, or simply make
```

`make dev` waits for `supabase start` to succeed before launching Next.js on
`http://localhost:3000`. `supabase/config.toml` configures the Docker stack and
first-start migrations come from `supabase/migrations/`. The frontend stays on
the host. `scripts/local-frontend.mjs` reads the running local stack's API URL
and anonymous key, checks for a loopback API host, and passes those browser-safe
values to Next.js. Account sync and displayed gateway/MCP connection URLs use
the selected backend. The service-role key is not selected for browser settings.
`npm run dev` keeps the hosted backend default.

`make services` and `make frontend` run the two steps separately. Ctrl-C stops
the foreground frontend; `make down` stops the local stack while retaining its
data. `make status` shows local service connection details. The frontend uses
port 3000 explicitly and fails if it is occupied. Studio uses port 54323, email
preview uses 54324, and the API uses 54321. Local Google sign-in needs its own
provider configuration; production secrets and hosted data are not copied.
A local MCP URL is reachable only by runtimes with access to that machine.

Keep dependencies, build output, caches and Docker's disk image on the external
SSD. Check stack ownership before starting or stopping containers: a running
stack can still be bound to a different active checkout. Demo behavior and
fixtures remain unchanged and isolated from real accounts.

Evidence: [Makefile](../../Makefile), [local frontend launcher](../../scripts/local-frontend.mjs),
[local configuration](../../supabase/config.toml), and [startup instructions](../../AGENTS.md).

## Record and validate the change

Complete `changes/<unique-feature-branch>.md` with the outcome, checks actually run, and verification limits; remove its draft marker. Commit only files owned by the task.

Use the smallest relevant focused checks while iterating, then satisfy the repository contract before delivery:

```sh
npm test
npm run validate:data
```

`npm test` includes the database scenario suite. Catalog validation reads `data/jobs.json`, requires the canonical fields, restricts employment types and priorities, and rejects duplicate IDs or application URLs. Use `npm run test:db` only for focused database debugging. Schema changes belong solely in `supabase/migrations/`; do not maintain a duplicate schema dump.

Frontend changes and auth/cloud/client changes require the production static build, `npm run build`, with frontend typechecking as appropriate. The retired static frontend/auth bundle is not an additional build target. Agent/product actions need website/MCP parity tests against the same ownership, validation, and version boundaries. Demo fixtures and interactions must cover representative states without touching real accounts or external submissions.

## Focused backend and agent proofs

Use protocol/context tests for MCP initialization, scope-filtered discovery and version refresh. Feed tests cover platform write → labeled event → current-record read → per-connection acknowledgement, including interview corrections and exact retry/retention behavior. `scripts/check-local-muse-timeline.mjs` validates the timeline lifecycle on real local PostgreSQL while rolling back its migration and fixtures; this does not permanently migrate a shared stack.

The Node queue/retirement tests cover on-demand job ownership, idempotency, leases, retries, cancellation and the absence of a recurring backend search scheduler. `scripts/check-local-scheduler-removal.mjs` exercises retirement/queue/reset guards inside a rolled-back local transaction. Profile-flow tests cover shared website/MCP versioned saves, preservation and conflict recovery. Choose the existing script whose prerequisites and account/stack ownership match the test; do not stop or rebind another checkout's stack to make a proof convenient.

Fixture and disposable-database tests are not live Muse, Google OAuth, APILayer quality, messaging, employer submission or hosted release verification. Explicit live scripts can consume external requests and must use deliberately chosen fixtures and configured credentials. Reports must state which layer actually ran. Source availability, tool discovery, process health and a queued job are distinct from successful execution.

## Land routine work locally

After checks pass, commit the feature and run this from its checkout:

```sh
npm run feature:land
```

Landing refuses `main`, a dirty feature checkout, or an unfinished generated note. It fetches current local `main`, merges it into the feature branch, then fast-forwards the shared local checkout. It does not push, create a pull request, or discard unrelated dirty files. Conflicts and overlapping local edits stop the operation for resolution in the feature checkout.

## Publish only when required

A pull request is optional. Use `feature:publish` only when the user requests GitHub review or production publication, or protected-branch CI is required. Publication integrates published `main`, pushes the feature branch, creates or updates one PR, labels it `merge-ready`, and wakes the queue. The frontend deployment workflow publishes GitHub Pages from main. Backend migrations, gateway/MCP config and Node runtime releases are separate; frontend publication does not deploy them. Follow the normal authorized backend release process after integration, and never deploy a feature branch directly to the shared Supabase project.

At handoff report the checkout, branch, local-main commit, checks, push/publication status, and remaining uncommitted work. Remove an isolated checkout only after its work is landed or deliberately backed up.

See also [Quickstart](../quickstart.md) and [Gateway and MCP](../agents/gateway-and-mcp.md).
