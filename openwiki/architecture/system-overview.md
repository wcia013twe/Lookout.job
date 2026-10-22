---
type: architecture
title: System Architecture
description: Runtime and ownership boundaries across the static React client, shared domain layer, Supabase services, agent interfaces, and local browser runner.
tags: [architecture, nextjs, supabase, agents, data-flow]
sources:
  - id: openwiki-source-bbf1af92c885d4090c46fedd
    resource: repo://docs/private-network.md
  - id: openwiki-source-a8bb617ebaa9fdedae69cc1d
    resource: repo://lib/cloud.mjs
  - id: openwiki-source-5c5dc57d5c7c840354826599
    resource: repo://next-app/next.config.mjs
  - id: openwiki-source-dc9ae5ef6910469df9693341
    resource: repo://next-app/README.md
  - id: openwiki-source-e511468b88bd67d2e4f7a0d8
    resource: repo://runner/runtime.mjs
  - id: openwiki-source-491126b88c8fadf4e4211275
    resource: repo://supabase/functions/agent-gateway/index.ts
  - id: openwiki-source-e9706719c14c4ee8d36442ff
    resource: repo://supabase/migrations/20261022060633_durable_company_hub.sql
generated: { by: "codex", at: "2026-10-22T07:08:18.987Z" }
verified:
  - by: openwiki/0.7.2
    at: 2026-10-22T07:08:18.987Z
---

# System Architecture

Job Signal Board combines a public static application with private account services and optional agent execution. The core design keeps presentation, durable authorization, and browser side effects in separate runtimes.

## Static production client

`next-app/` is the production Next.js App Router, React, and Tailwind application. It exports static files to `out/` for GitHub Pages; there is no request-time Next.js server or Server Action session layer. Build scripts copy only public catalog and branding assets into `public/`, and the service worker caches public offline assets rather than private Supabase responses or signed resume links.

Routes and components render Discover, Applications, Needs you, Profile, and related workspace surfaces. `next-app/lib/workspace.jsx` adapts React to the repository-level store and cloud controller. Shared domain modules in root `lib/` remain the source for workflow, resume, answer, and synchronization rules instead of being copied into each UI.

## Browser state and cloud synchronization

Guests use browser-local state. Signed-in users keep a separate account workspace that the serialized cloud controller loads and persists through `backend/client.mjs`. One worker serializes writes; unsynced edits remain locally marked dirty, and sync conflicts or failures pause rather than discarding browser changes. Owned batch URLs are validated and loaded after authentication; an unavailable private batch falls back to public jobs without disabling account sync.

## Supabase ownership boundary

Supabase supplies identity, private relational state, private resume storage, and Edge Functions. `supabase/migrations/` is the schema source of truth. Browser calls and agent calls converge on backend ownership, revision, and state-transition checks instead of trusting client state.

Network has its own owner-scoped company workspaces linked, when unambiguous, to maintained shared company identities. Contacts and applications remain separate owned records. Circle posts and published revisions remain the source for shared experience; Network requests permitted current-membership results instead of copying intelligence into company records. The client displays prepared demo takeaways only inside its isolated fictional demo state.

`agent-gateway` is the privileged service boundary. Human connection management verifies a Supabase access token; agent operations require an opaque `jb_agent_…` credential whose hash, expiry, revocation, and scopes are checked through database functions. The gateway bounds request size, maps database errors to stable HTTP status codes, and signs owned resume URLs for only 60 seconds.

## Agent and runner layers

The hosted MCP endpoint is a stateless adapter over gateway operations. It provides scoped data tools but no browser. The separate `runner/` process forwards those hosted tools and adds narrowly defined local operations for form inspection, resume fingerprinting, deterministic prefill, and guarded Greenhouse submission.

One runner process owns one dedicated Playwright page. It exposes no general click, evaluate, or shell tool, rechecks scopes and current revisions, and keeps browser automation out of the frontend bundle. Unsupported or uncertain cases return to the human-facing **Needs you** workflow.

## Principal data flows

Public discovery reads the generated catalog without login. A connected agent can publish an owned private batch containing public job references plus private recommendations. The browser loads that batch for its authenticated owner, prepares revisioned application state, and synchronizes it to Supabase. Submission execution then loads fresh gateway context and private files into the local runner; results return through validated gateway transitions and appear in the private application timeline.

See [Discovery and Tracking](../workflows/discovery-and-tracking.md), [Network Company Hub](../workflows/network-company-hub.md), [Circle Knowledge](../workflows/circle-knowledge.md), [Gateway and MCP](../agents/gateway-and-mcp.md), and [Submission Safety](../agents/submission-safety.md).
