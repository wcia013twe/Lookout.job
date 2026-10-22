---
type: workflow
title: Network Company Hub
description: Durable private company workspaces, identity resolution, browser sync, Network presentation, Circle source retrieval, and the fictional Stripe example.
tags: [network, companies, workspace, migration, circles]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-22T07:08:18.987Z
sources:
  - id: openwiki-source-bbf1af92c885d4090c46fedd
    resource: repo://docs/private-network.md
  - id: openwiki-source-64495bcad1a7596093da6543
    resource: repo://lib/company-sync.mjs
  - id: openwiki-source-af8b41841ca6a187ed57a4d1
    resource: repo://next-app/components/company-intelligence.tsx
  - id: openwiki-source-73a1445ac514c7a092e2895c
    resource: repo://next-app/components/network-targets.tsx
  - id: openwiki-source-e9706719c14c4ee8d36442ff
    resource: repo://supabase/migrations/20261022060633_durable_company_hub.sql
  - id: openwiki-source-3b24b03a0b561dfcd6da1175
    resource: repo://tests/company-hub.test.mjs
generated: { by: "codex", at: "2026-10-22T07:08:18.987Z" }
---

# Network Company Hub

Network is the company-facing workspace. Its Companies list opens a company detail with **Overview**, **People & outreach**, and **Applications**. The Overview leads with a next step, readable brief, personal focus and permitted Circle sources. Opening a suggestion or reading Circle context does not create a company or private workspace.

## Records and identity

The maintained `public.companies` registry owns canonical identity, domain and explicit aliases. Owners and agents cannot edit it through Network. Resolution links only unambiguous registered names or aliases; unknown names can remain private. Parent and brand names are separate unless the registry explicitly aliases them.

`public.company_workspaces` owns each person's text target ID, optional shared company ID, typed research and priority fields, dated sources, follow-up, archive state, explicit owned contact/application links and revision. One owner may have one linked workspace per registry company. Legacy duplicate targets remain separate unresolved records for review. The list keys rows by workspace ID, preserving both. Private name or website edits re-resolve the link without changing shared identity.

Contacts, applications, postings and Circle revisions keep their own records. Explicit links and known company identities support grouping; normalized name matching remains for unresolved legacy data. Process involvement still requires an application tag or exact posting URL. A Circle employer requisition ID is distinct from an internal posting or application ID.

## Saves, migration and offline work

The website calls `company_action`; scoped MCP tools expose `list_companies`, `list_company_workspaces` and `save_company_workspace` through the same private company action. Saves send the complete record and current expected revision, including archive state. They validate owner, links, field bounds and identity. Legacy contact tools project or route company targets to this service; old direct company-contact writes receive a reload-required error.

The additive migration imports company targets transactionally and retires their outreach rows. Original notes remain as recovery evidence; malformed notes also become reviewable research. IDs, owner, available timestamps, revisions, archive state and content survive. Browser storage separates people from companies and imports guest or owner-local legacy targets idempotently. Dirty local edits survive offline work and retries; a revision conflict preserves the draft until the person chooses to reload saved content.

## Overview and Circle context

Adding a company asks for its name and optional role/team focus. Small inline editors handle focus, next step, brief and settings; each uses the same revision-checked save. Research sources, explicit links and archive settings remain available through disclosure. People/outreach and Applications retain their dedicated views.

**From your Circles** searches published contributions across the viewer's current memberships using a company ID or unresolved text name. It shows source experiences and thread links; optional search narrows them. Permissions and context matching occur before pagination. The fictional resettable Stripe new-grad example demonstrates how candidate evidence, a gap to verify, Jamie alumni outreach, an application and Circle conversations can fit together. Its example takeaways are authored demo content, not live generated summaries or verified Stripe hiring claims.

## Verification and release

Company-hub tests cover migration, malformed and duplicate records, aliases, ownership, revision conflicts, sync and compatibility. The Circle suite covers website/MCP filtering and publication permissions. The browser check exercises desktop/mobile Network and fictional account flows. Hosted backend migration prerequisites and two-account permissions remain unverified; backend and gateway release must precede publishing the dependent frontend.

See [Circle Knowledge](circle-knowledge.md), [Gateway and MCP](../agents/gateway-and-mcp.md), and [System Architecture](../architecture/system-overview.md).
