---
type: architecture
title: System Architecture
description: Runtime and ownership boundaries across the static React client, canonical account data, Edge services, Node execution, Muse change sync and optional Circle intelligence.
tags: [architecture, nextjs, supabase, agents, data-flow, node]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-27T03:54:51.227Z
sources:
  - id: openwiki-source-5bd02f3d5dbed48e36fcb5ab
    resource: repo://backend/agent-contract.md
  - id: openwiki-source-9c3db0099e9f49932a5ab28c
    resource: repo://backend/client.mjs
  - id: openwiki-source-ab7c96c03cc7d35075e96ff3
    resource: repo://backend/intelligence/service.ts
  - id: openwiki-source-ee1b3e21718542a757d4d790
    resource: repo://backend/runtime/README.md
  - id: openwiki-source-4f85b903dcd8ff42cf4e79dc
    resource: repo://backend/runtime/service.ts
  - id: openwiki-source-59fbab138f8a655b0be18622
    resource: repo://backend/runtime/worker.ts
  - id: openwiki-source-1b750ccbbba8d691ecef1a74
    resource: repo://docs/intelligence-v1-spec.md
  - id: openwiki-source-41c6057c81314b2b102ebe9c
    resource: repo://docs/interview-intelligence-platform.md
  - id: openwiki-source-a8bb617ebaa9fdedae69cc1d
    resource: repo://lib/cloud.mjs
  - id: openwiki-source-a9e1c6c32dfd334ae56d3f3e
    resource: repo://lib/mcp-services.mjs
  - id: openwiki-source-8bdb9080f51dd31bf9d211bd
    resource: repo://lib/muse-change-feed.mjs
  - id: openwiki-source-c2565295ed5c42c265f796fe
    resource: repo://lib/profile-sync.mjs
  - id: openwiki-source-10b284b4d36ef128b35a8d39
    resource: repo://next-app/components/application-profile-context.tsx
  - id: openwiki-source-d28350a21befcd07cb2ca6d4
    resource: repo://next-app/lib/account-workspace.jsx
  - id: openwiki-source-70edbb94f068146a752dd992
    resource: repo://next-app/lib/demo-runtime.mjs
  - id: openwiki-source-a675f1c438dee1055568ede9
    resource: repo://next-app/lib/demo-workspace.jsx
  - id: openwiki-source-980a00b6ef8d3f93f906cc6c
    resource: repo://next-app/lib/workspace.jsx
  - id: openwiki-source-5c5dc57d5c7c840354826599
    resource: repo://next-app/next.config.mjs
  - id: openwiki-source-e8c7a238c8d038536bfeb509
    resource: repo://next-app/scripts/finalize-export.mjs
  - id: openwiki-source-d4b49891072a908c1aa558de
    resource: repo://next-app/scripts/prepare-public.mjs
  - id: openwiki-source-0426071fbb3110101b8e91ac
    resource: repo://runner/mcp-server.mjs
  - id: openwiki-source-e511468b88bd67d2e4f7a0d8
    resource: repo://runner/runtime.mjs
  - id: openwiki-source-491126b88c8fadf4e4211275
    resource: repo://supabase/functions/agent-gateway/index.ts
  - id: openwiki-source-5e0e032552d77cb40052782b
    resource: repo://supabase/functions/agent-gateway/instructions.json
  - id: openwiki-source-da5a12ae20329b06dc01428f
    resource: repo://supabase/migrations/20261027022419_muse_change_feed.sql
  - id: openwiki-source-d10fe354f475113d387a69cc
    resource: repo://supabase/migrations/20261027023257_remove_backend_search_scheduler.sql
  - id: openwiki-source-a89745146b3086aa3b11f618
    resource: repo://tests/cloud-sync.test.cjs
generated: { by: "codex", at: "2026-10-27T03:54:51.227Z" }
---

# System Architecture

Lookout combines a static React application, owned Supabase records, a scoped agent interface and optional execution services. Presentation, durable authorization, reasoning and browser side effects have different owners. A feature existing in source does not establish that its hosted runtime or migration is deployed.

## Static production client

`next-app/` is the production Next.js App Router/React/Tailwind frontend. `output: export` produces static files for GitHub Pages; there is no request-time Next.js server, cookie session layer or Server Action backend. Public asset preparation/offline caching excludes private account responses, resumes and signed download URLs. The retired static frontend is no longer a development target.

The workspace provider lazy-loads separate account and detached-demo runtimes. Account initialization adapts React to the shared store/cloud controller and `backend/client.mjs`; root `lib/` owns shared domain behavior. Private pages require account access. Explicit `?demo=1` uses fictional memory-only state and services without loading the persistent account store or Supabase client. Demo reset recreates fixtures and never becomes a live account write.

## Browser state and canonical records

Signed-in browser state is an account-scoped cache and draft workspace. The serialized cloud controller retains unsynced changes, fences late account-switch responses and reconciles remote refreshes. Owned batch locators load after authentication; missing/foreign batches can fall back to public catalog data without disabling account sync.

Supabase records and migrations are authoritative for personal facts, application profiles, permissions, drafts, timelines and private assets. Personal-fact saves use typed versioned patches, preserving unrelated fields; stale overlapping edits require reconciliation. Verification is a separate human action rather than an incidental consequence of a fact save. Application-profile preferences and writing instructions remain canonical saved profile documents, with structured projections for consumers. Muse's conversational memory is a cache of this context, not another factual database.

## Backend ownership and routing

Supabase supplies Auth, owned relational data, RLS and private storage. The Edge gateway verifies human access tokens for connection management and opaque agent credentials for scoped operations. It maps safe failures and signs owned resume downloads for a short lifetime. Service-role credentials never enter browser configuration.

Node hosts the shared MCP transport at `/mcp` and bounded operations at `/v1/operations`. `lib/mcp-services.mjs` maps domain operations to direct owned SQL, Node execution or existing Edge compatibility. This is an execution split, not a requirement to move every lightweight setting writer into Node. Website and MCP converge on ownership, validation, consent and version checks.

The API and worker are separate processes. A leased `search_ats` job collects supported ATS sources, verifies postings, screens saved preferences, deduplicates and persists a shortlist. Muse supplies interpretation, candidate-specific reports, ratings and subsequent authorized work. Configured Node resume extraction returns a reviewable proposal; it does not silently verify imported facts. My Agent is the user-managed recurring-task configuration; the personal runtime schedules those tasks and submits bounded jobs. The duplicate backend recurring-search scheduler is retired, while Node queue polling, retries, cancellation and lease fencing remain.

## Muse and platform synchronization

The hosted MCP adapter forwards fixed operations to Edge; Node and local stdio expose the shared protocol with their configured capabilities. Every request verifies credentials, discovery is scope-filtered, and `initialize` supplies the current shared startup instructions.

Muse writes through existing scoped tools. On authorized work runs it reads `read_muse_changes`, follows each labeled event's exact read pointer to current records, refreshes its context and acknowledges handled IDs. Five event types cover confirmed answers, preferences, application profiles, backend job results and application/interview timelines. Timeline corrections/reschedules retain history. Acknowledgements are per connection; reads do not consume events. The feed is not a behavior engine, push wake-up, work request or consent grant.

## Browser execution and human review

The local runner adds narrow form inspection, resume fingerprinting, deterministic prefill and guarded native Greenhouse submission. Its dedicated browser page exposes no general click/evaluate/shell tool. Configured Node submission reuses that implementation with isolated per-request browser contexts; bounded batches still independently authorize each child. Neither frontend rendering nor discovery jobs execute submissions.

Prepared drafts, exact human approvals, routine automatic policy authorization, user-reported timeline observations and runner-observed confirmations remain distinct. Unknown or uncertain submission outcomes go to authenticated human recovery rather than automatic retry. See [Submission Safety](../agents/submission-safety.md).

## Circle knowledge and intelligence

Production Circle interview lookup reads current permitted published source revisions, matches the exact posting, and respects membership and knowledge/workspace scopes. Empty results remain empty; the platform does not invent a company/title fallback. This lookup does not require a vector store or server-side model.

`backend/intelligence/` is a separate optional Node ingestion/evaluation surface with explicit demo or owner-scoped private targets, embeddings/metadata and evidence-graph facilities. Its local tests and configured services are not proof of a globally published knowledge backend. Private processing does not authorize public sharing, and model reasoning/presentation remains a Muse/host responsibility.

See [Discovery and Tracking](../workflows/discovery-and-tracking.md), [Gateway and MCP](../agents/gateway-and-mcp.md), and [Testing and Delivery](../operations/testing-and-delivery.md).
