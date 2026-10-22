---
type: workflow
title: Circle Knowledge and Sharing
description: How private Circles review and publish member contributions, expose permitted source context, and supply Network company intelligence.
tags: [circles, knowledge, sharing, search, network]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-22T07:08:18.987Z
sources:
  - id: openwiki-source-81c5adab9ce20a401e545d9a
    resource: repo://backend/circle-knowledge.md
  - id: openwiki-source-bbf1af92c885d4090c46fedd
    resource: repo://docs/private-network.md
  - id: openwiki-source-af8b41841ca6a187ed57a4d1
    resource: repo://next-app/components/company-intelligence.tsx
  - id: openwiki-source-55c2b75fda0ff90d61fc2afe
    resource: repo://next-app/lib/network-demo.mjs
  - id: openwiki-source-63a8badbc6b4c42e2bd92685
    resource: repo://supabase/functions/agent-gateway/knowledge.mjs
  - id: openwiki-source-a728c113df52e9fab2b0abb6
    resource: repo://tests/circle-knowledge.test.mjs
generated: { by: "codex", at: "2026-10-22T07:08:18.987Z" }
---

# Circle Knowledge and Sharing

Circle contributions are member-authored, revisioned threads. The published revision is the shared source; a newer private draft does not replace it for other members. Replies stay inside their source thread. Circle membership and post visibility are checked on reads and writes. Leaving or removal blocks future access but does not rewrite past contributions.

## Review and publication

The browser calls `knowledge_action` and agents use scoped gateway/MCP tools. Both reach the same private database action. New contributions and edits create private revisions. Freeform reports, attached context, offers and personal disclosures require exact human review before agent publication. The narrow standing permission covers only a closed public-resource template. Website publication is itself the person's explicit sharing action. Agents cannot approve their own text or manufacture user-confirmed provenance.

Content may include a human message, structured insight, role/stage/company, experience date, public sources, uncertainty and bounded application/referral context snapshots. These fields belong to the reviewed revision. Internal application IDs, private messages and signed links are excluded from shared context. Reported provenance describes the member's classification; it is not independent server verification.

## Search and source use

`search_circle_knowledge` accepts a single `circleId` or `scope: current_memberships`. Company identity can be a canonical `companyId` or unresolved company text, never both. A company, role and stage combination must match one primary, attached application/referral or offer context. Membership, publication, visibility, author and context filtering precede pagination. Each root post appears once, even with multiple matching aliases or attachments. Results keep stable author IDs, Circle labels, dates and source-thread links.

Network's company Overview requests permitted current-membership results and shows source experiences under **From your Circles**. Its Stripe new-grad demo adds explicitly labeled authored example takeaways linked to fictional source conversations. Real account content does not gain an automatic summary merely by opening a company.

Reading a thread is not citation use. An agent may record an opaque, revision-specific citation receipt only after actually using a published source in an answer or preparation plan; counts are deduplicated by human and can be retracted. The Circle publication feed separately supports ordered event scanning, with unavailable sources invalidated rather than replayed from cache.

## Release boundary

The local migration and tests cover permissions, publication, current memberships, hidden or withdrawn sources, cursor behavior and website/MCP parity. The Circle release remains gated; the repository's hosted migration prerequisites and two-account verification must be completed before treating Network intelligence as a live hosted feature.

See [Network Company Hub](network-company-hub.md), [Gateway and MCP](../agents/gateway-and-mcp.md), and [Submission Safety](../agents/submission-safety.md).
