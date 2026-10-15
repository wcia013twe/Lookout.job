---
type: workflow
title: Discovery and Application Tracking
description: How public catalog roles move through Discover, browser tracking, owned agent batches, private application records, and evidence-aware timelines.
tags: [discovery, catalog, tracking, applications, timeline]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-15T07:09:51.577Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-d15addbecb7d058f078b8413
    resource: repo://lib/application-timeline.mjs
  - id: openwiki-source-76afc9721711ec0c4fade891
    resource: repo://next-app/components/applications.tsx
  - id: openwiki-source-506169f27421ac479505243e
    resource: repo://next-app/components/discover.tsx
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-1e0988be4eaa8a50e225c41d
    resource: repo://scripts/validate-data.mjs
generated: { by: "codex", at: "2026-10-15T07:09:51.577Z" }
---

# Discovery and Application Tracking

The product keeps four kinds of state distinct: the shared public catalog, browser-local opened-role tracking, owned private batches and applications, and submission evidence. A role can move between views without implying that an application was sent.

## Public catalog and Discover

`data/jobs.json` is the canonical static discovery feed. Each role carries a stable ID, canonical application URL, employment type, discovery date, source freshness, priority, and initial or preserved application status. Catalog maintenance verifies employer or ATS links, records unknown posting dates as `null`, labels source recency honestly, and deduplicates by URL before normalized company/title/location.

Discover selects the latest catalog date by default, excludes IDs already opened into the tracker, and supports historical day, employment-type, and text filters. Results are rendered as a full-time section followed by an internship section. The public feed remains browsable without login.

## Opening versus applying

Opening an application link adds the role ID to the client-side tracker and removes it from the latest Discover view. It does not submit, approve, or prove an application. Queuing a role creates preparation state for the agent; it also does not submit.

Applications merges tracker IDs with private workflow application IDs. When both exist, private workflow fields take precedence; otherwise the tracker status starts at `New`. The compact list exposes search, full-time/internship filters and counters, active versus rejected/withdrawn views, and hiring-stage filters. A user updates the status after applying or as the process changes.

## Private batches and cloud applications

A connected agent can publish an owned morning batch after reading private preferences and verifying public employer postings. Public employer facts may enter the shared catalog, but fit notes and recommendations remain private batch-item data. Login identifies the owner; possession of a batch UUID alone grants no access.

Signed-in draft, approval, blocker, submission-attempt, and progress state is authoritative in Supabase. Browser changes may remain locally pending during sync trouble, but client state cannot replace backend ownership, revision, approval, or receipt checks.

## Timeline semantics

The timeline normalizes dated milestones and durable activity without manufacturing dates. Valid timestamps are ordered chronologically; undated stages are inserted by process order. Interview, offer, rejection, and withdrawal updates can come from user reports, email-backed milestones, or records, and retain their source and phase.

A status or milestone is not submission evidence. The timeline marks observed confirmation only when the application's receipt passes the confirmation validator and matches the application URL. Otherwise a submitted status or user-reported activity remains a tracking claim. Scheduled interviews are also distinct from completed interviews, and terminal outcomes prevent callback prioritization.

See [System Architecture](../architecture/system-overview.md) and [Submission Safety](../agents/submission-safety.md).
