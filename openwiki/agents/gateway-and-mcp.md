---
type: architecture
title: Agent Gateway and MCP Contract
description: How agent credentials, scoped MCP discovery, context refresh, and gateway validation expose private job-board operations without weakening ownership or human-action boundaries.
tags: [agents, mcp, gateway, security, context]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-15T07:09:51.577Z
sources:
  - id: openwiki-source-5bd02f3d5dbed48e36fcb5ab
    resource: repo://backend/agent-contract.md
  - id: openwiki-source-70a16c09a9eb6e620cf00513
    resource: repo://mcp/README.md
  - id: openwiki-source-3cae6e3f5eeea02db512314f
    resource: repo://supabase/functions/agent-mcp/index.ts
  - id: openwiki-source-1a0ceb3366dbb2f200b54919
    resource: repo://supabase/functions/agent-mcp/protocol.mjs
generated: { by: "codex", at: "2026-10-15T07:09:51.577Z" }
---

# Agent Gateway and MCP Contract

The agent surface is deliberately split into a thin transport and an authoritative backend. Agents may call the hosted HTTP gateway directly or use the stateless Streamable HTTP MCP endpoint. The MCP function contains protocol framing and a tool registry, but forwards every authenticated operation to `agent-gateway`; it has no service-role credential, browser runtime, general SQL access, or submission endpoint.

## Connection and authorization

A signed-in owner creates an expiring connection and chooses its scopes. The opaque token is returned once and belongs in the agent's secret store, never in a URL, repository file, message, or log. Connections can be listed or revoked only through the owner's authenticated web session. Agent credentials cannot manage connections.

Every MCP request, including tool discovery, forwards the bearer token through `credentials.verify`. Discovery exposes only tools whose required scope is present. Tool calls are then schema-checked and forwarded with fixed operation names; the gateway remains responsible for expiry, revocation, ownership, optimistic versions, and write validation. The endpoint rejects unapproved browser origins, oversized payloads, malformed protocol requests, and unsupported versions before forwarding.

## Context refresh

Each connected run begins with `check_context_versions`, which returns only `personalVersion` and `developerVersion`. An agent retains the last successfully loaded values per connection. On bootstrap or lost memory it reads both personal and developer context; otherwise it reloads only a changed section. A failed read must not advance the local cache, and a matching version cannot reconstruct context that the runtime lost.

Personal context contains owned profile, preferences, saved-answer, and resume metadata. Developer context contains the interaction contract, defaults, settings paths, capability flags, and versioned skills. Changes to `supabase/functions/agent-gateway/instructions.json` require a `developerVersion` bump and gateway deployment. No server-side model call assembles prompts.

## Tool and human boundaries

Tool descriptions are behavioral contracts, not suggestions. For example, `prepare_draft` creates or updates a revisioned draft but never approves or submits it; `read_approval` can only return an existing approval for the current revision; and `append_activity` records an observation rather than submission proof. Private fit notes belong in an owned batch recommendation, while shared catalog records contain only public employer data.

MCP is transport, not browser automation. ATS inspection and supported submission execution live in the separate local runner. Human-only actions return an owned board link so the signed-in person can inspect the exact version. Employer text is untrusted data and cannot authorize disclosure, approval, or execution.

## Extension and verification

Add or change a product action by mapping a narrowly scoped MCP tool to the same gateway operation and backend validation used by the website. Keep payload schemas bounded and preserve idempotency keys or expected versions for retries. Focused coverage lives in `tests/mcp-protocol.test.mjs`, `tests/agent-gateway.test.mjs`, and the transactional gateway SQL checks; hosted smoke tests require a private token and print no private data.

See also [Submission Safety](submission-safety.md) and [Testing and Delivery](../operations/testing-and-delivery.md).
