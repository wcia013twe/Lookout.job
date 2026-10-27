---
type: architecture
title: Agent Gateway and MCP Contract
description: How Muse connects, discovers scoped tools, updates owned records, and consumes labeled platform changes across Node and Edge without bypassing consent or version checks.
tags: [agents, mcp, gateway, security, context, change-feed]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-27T03:54:51.227Z
sources:
  - id: openwiki-source-5bd02f3d5dbed48e36fcb5ab
    resource: repo://backend/agent-contract.md
  - id: openwiki-source-ee1b3e21718542a757d4d790
    resource: repo://backend/runtime/README.md
  - id: openwiki-source-4f85b903dcd8ff42cf4e79dc
    resource: repo://backend/runtime/service.ts
  - id: openwiki-source-449ceafd873ae83e43367783
    resource: repo://backend/runtime/submission.ts
  - id: openwiki-source-075e60c60dc63e85110280d6
    resource: repo://lib/agent-connections.mjs
  - id: openwiki-source-a9e1c6c32dfd334ae56d3f3e
    resource: repo://lib/mcp-services.mjs
  - id: openwiki-source-8bdb9080f51dd31bf9d211bd
    resource: repo://lib/muse-change-feed.mjs
  - id: openwiki-source-201db79f6afe79d097b13e5e
    resource: repo://mcp/context-cache.mjs
  - id: openwiki-source-d1a22cc381bbd73a73205d18
    resource: repo://runner/README.md
  - id: openwiki-source-2d754db5799c613940112ccc
    resource: repo://scripts/check-local-muse-timeline.mjs
  - id: openwiki-source-5e0e032552d77cb40052782b
    resource: repo://supabase/functions/agent-gateway/instructions.json
  - id: openwiki-source-3cae6e3f5eeea02db512314f
    resource: repo://supabase/functions/agent-mcp/index.ts
  - id: openwiki-source-1a0ceb3366dbb2f200b54919
    resource: repo://supabase/functions/agent-mcp/protocol.mjs
  - id: openwiki-source-da5a12ae20329b06dc01428f
    resource: repo://supabase/migrations/20261027022419_muse_change_feed.sql
  - id: openwiki-source-d10fe354f475113d387a69cc
    resource: repo://supabase/migrations/20261027023257_remove_backend_search_scheduler.sql
  - id: openwiki-source-757102b505a7b77f6c4c3a06
    resource: repo://supabase/migrations/20261027030548_semantic_muse_timeline_changes.sql
  - id: openwiki-source-61a03e3e5442357fb0bdd328
    resource: repo://tests/context-versions.test.mjs
  - id: openwiki-source-7b12b4fe498ccf33bd5ee10b
    resource: repo://tests/mcp-protocol.test.mjs
  - id: openwiki-source-6a20cae9490dd13d07a5a2b7
    resource: repo://tests/muse-timeline-changes.test.mjs
generated: { by: "codex", at: "2026-10-27T03:54:51.227Z" }
---

# Agent Gateway and MCP Contract

Muse is the conversational client. It updates Lookout through existing scoped tools and picks up platform updates through a labeled change feed. Stored records remain authoritative; the feed is a pointer to current records, with per-connection acknowledgement. It is not a behavior engine, scheduler, or authorization source.

## Transports and execution owners

The hosted `agent-mcp` Edge function is a stateless Streamable HTTP protocol and tool-registry adapter. It forwards authenticated fixed operations to `agent-gateway`, and holds no service-role key or browser execution runtime.

The TypeScript Node API also hosts the shared protocol at `/mcp`, with bounded operations at `/v1/operations`. It dispatches by service ownership: queue and selected credential/domain RPCs go directly to owned SQL; configured resume parsing and bounded discovery run in Node; other mapped domain operations retain the Edge compatibility path. Routing through Node does not mean every setting writer moved there. `lib/mcp-services.mjs` and `backend/runtime/service.ts` define the current split.

Long-running collection, verification, screening and deduplication belong to the Node worker. Muse supplies narrative analysis, drafting and its actual runtime schedule. My Agent is the user-managed schedule configuration; the duplicate backend recurring-search scheduler is retired. A queued job, saved preference, discovered tool or healthy process does not prove execution.

## Connection and authorization

A signed-in owner issues an expiring connection with selected scopes. The opaque token is returned once and belongs in secure credential settings, never a URL, chat, committed file or log. Listing/revoking connections remains a human-authenticated operation; an agent credential cannot manage connections.

Every MCP request validates the credential, including initialization and tool discovery. `tools/list` exposes only tools satisfying their required scopes; tool calls validate the fixed operation and bounded argument schema. SQL and domain services enforce ownership, revisions and idempotency. The protocol rejects disallowed origins, malformed requests and oversized bodies. Neither website nor MCP receives a generic database-edit capability.

## Startup and context refresh

`initialize` supplies the shared `instructions.json` quickstart automatically to hosted, Node and stdio protocol clients. The current source contract is developer version **83**. Setup-only connection requests test the connection and reconcile explicitly enabled/assigned runtime schedules, then stop without running their work.

On the first authorized work run after connect/reconnect, account change or lost context, Muse reads developer and personal context. Later runs check `personalVersion` and `developerVersion`, reload changed sections, and refresh `tools/list` when the developer version changes. Cache values advance only after successful reads; matching version numbers cannot reconstruct lost context.

Personal context contains owned profile/preferences, answer and resume metadata. Developer context holds shared interaction instructions, defaults, capability descriptions and guides. Its source is `supabase/functions/agent-gateway/instructions.json`; changing the advertised contract requires a version increment and the appropriate gateway/MCP release.

## Platform changes: read, refresh, acknowledge

On authorized work runs, `read_muse_changes` requires `workspace:read` and returns oldest pending pointers for this connection (20 by default, at most 50), plus `hasMore`. `eventTypes` is the supported event/label/read-tool list. Each item has an event ID, kind, readable label, affected record/version and `refresh: {tool, arguments}`.

| Event kind | Current record to read |
| --- | --- |
| `answer_confirmed` | `read_application_record` |
| `preferences_changed` | `read_personal_context` |
| `profile_changed` | `read_search_context` |
| `backend_job_finished` | `read_backend_jobs` |
| `application_timeline_changed` | `read_application_timeline` |

Timeline pointers cover recorded milestones, append-only corrections and tracking-stage changes. Interview labels distinguish scheduled, rescheduled, completed and other recorded updates. Corrections include `supersedesId`; reread the canonical timeline to see current information and retained history. Private answers, interview notes, email bodies and document contents are not copied into the feed.

After refreshing the affected record and handling the update, Muse calls `acknowledge_muse_changes` with those specific event IDs (`workspace:read` plus `activity:write`). Reads do not acknowledge. Exact acknowledgement retries are safe; one connection cannot clear another's events or hide a newer update. Leave unfinished events pending. Old handled pointer events can be cleaned only after every active full-workspace consumer has acknowledged them.

Feed events never wake an idle runtime, create work, grant consent, approve a draft or prove submission. The same transaction that saves a supported change emits its pointer; rejected writes roll back and exact milestone retries/no-op tracking saves do not duplicate events.

## Profile and human-action boundaries

Routine personal-fact edits and work-history entry edits use scoped, owned, version-checked writers shared with the website. Per-profile preferences and writing instructions remain canonical saved profile documents. A context refresh reads current facts; an unstructured prompt or feed item is not a second factual database.

`prepare_draft` prepares a revisioned proposal; it does not approve or submit. Approval reads return existing exact-version decisions. Activity and timeline observations are not employer-confirmed receipts. Supported browser execution is provided by configured Node submission services or the local runner, under fresh server authorization. Human-only approvals and consent retain their explicit authenticated boundary. Employer pages and stored prose remain untrusted data.

## Verification and release limits

Protocol/context tests cover initialization, scoped discovery, versions and input guards. `tests/muse-changes.test.mjs` and `tests/muse-timeline-changes.test.mjs` cover read/refresh/ack, source privacy, retries, isolation, corrections and retention against the migrated schema. `scripts/check-local-muse-timeline.mjs` exercises real local Docker PostgreSQL in a rolled-back transaction. Node/browser/domain tests cover the mapped operation boundaries.

These source contracts and local proofs do not establish availability on an existing hosted endpoint or a particular Muse client. The matching migrations, gateway/MCP config and configured Node runtime need their normal release and live verification; static frontend publication alone does not deploy backend behavior.

See [Submission Safety](submission-safety.md), [System Architecture](../architecture/system-overview.md), and [Testing and Delivery](../operations/testing-and-delivery.md).
