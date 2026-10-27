---
type: workflow
title: Discovery and Application Tracking
description: Public catalog and immutable private discovery batches, bounded Node shortlists, tracker/import state, truthful Stats flows and source-preserving interview timelines.
tags: [discovery, catalog, tracking, applications, timeline, stats]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-27T03:54:51.227Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-5bd02f3d5dbed48e36fcb5ab
    resource: repo://backend/agent-contract.md
  - id: openwiki-source-9c3db0099e9f49932a5ab28c
    resource: repo://backend/client.mjs
  - id: openwiki-source-0c7f31e62c839aa1c573fdc6
    resource: repo://backend/discovery-flow.md
  - id: openwiki-source-59fbab138f8a655b0be18622
    resource: repo://backend/runtime/worker.ts
  - id: openwiki-source-64cc972ace33cd923ac4c23c
    resource: repo://docs/interview-reporting.md
  - id: openwiki-source-19521f6a9d9c703d7fc9ab83
    resource: repo://lib/application-flow.mjs
  - id: openwiki-source-d23b920bfbca3c05d355e9b9
    resource: repo://lib/application-stats.mjs
  - id: openwiki-source-d15addbecb7d058f078b8413
    resource: repo://lib/application-timeline.mjs
  - id: openwiki-source-8bdb9080f51dd31bf9d211bd
    resource: repo://lib/muse-change-feed.mjs
  - id: openwiki-source-ba87799d224f8ac2b1743643
    resource: repo://lib/posting-age.mjs
  - id: openwiki-source-60521d3ab7fe97ad76b15c28
    resource: repo://next-app/components/application-flow-chart.tsx
  - id: openwiki-source-5937302dbe749b39ae6feb55
    resource: repo://next-app/components/application-list.tsx
  - id: openwiki-source-76afc9721711ec0c4fade891
    resource: repo://next-app/components/applications.tsx
  - id: openwiki-source-506169f27421ac479505243e
    resource: repo://next-app/components/discover.tsx
  - id: openwiki-source-1e0988be4eaa8a50e225c41d
    resource: repo://scripts/validate-data.mjs
  - id: openwiki-source-757102b505a7b77f6c4c3a06
    resource: repo://supabase/migrations/20261027030548_semantic_muse_timeline_changes.sql
  - id: openwiki-source-6a0923f6bd0e2a88a028a0e3
    resource: repo://tests/application-flow.test.mjs
  - id: openwiki-source-6a20cae9490dd13d07a5a2b7
    resource: repo://tests/muse-timeline-changes.test.mjs
  - id: openwiki-source-7600acccc7940fed397a7c66
    resource: repo://tests/posting-age.test.mjs
generated: { by: "codex", at: "2026-10-27T03:54:51.227Z" }
---

# Discovery and Application Tracking

The shared public catalog, opened-role tracker, private agent batches/applications and submission evidence are distinct. Opening, queueing or moving a role between views does not imply an application was sent.

## Public catalog and Discover

`data/jobs.json` owns the static public catalog. Preserve existing `applicationStatus`, verify canonical employer/ATS URLs, deduplicate by URL then normalized company/title/location, keep undisclosed posting dates null, and record source freshness honestly. Catalog targets are quality-led discovery goals rather than acceptance quotas. Run catalog validation before committing maintenance.

The signed-in board can display owned agent finds or the explicit public-catalog view; public data is not the same as anonymous access to private workspace pages. The selected application profile determines employment fit. The board supports discovery-day and text filters plus a separate posting-age filter; the latest discovery view hides tracker-opened roles. Full-time and internship sections remain distinct where both are eligible.

Employer publication age and availability checks are separate facts. A newer check does not make an old posting newly published. Unknown publication dates stay unknown and can be filtered explicitly. Source observations retain their actual checked date/status and extraction limits.

## One bounded search job, then Muse analysis

A configured Node/MCP runtime accepts `submit_backend_job({kind: search_ats, input: {profileId}, eventKey})` for one authorized search. The leased worker collects bounded supported sources, verifies employer observations, screens the current saved profile, deduplicates with copied Career Ops logic and persists `result.shortlist` in the same job. It is not a generic agent or arbitrary-code executor.

Muse reads actual job state and retained discovery IDs, checks coverage and eligibility gaps, writes candidate-specific reports and four evidence-backed ratings, then publishes a batch. Queue acknowledgement is not execution. Unsupported extraction, unknown liveness, blocked sources and truncation keep coverage partial. Settings/version changes fence stale results. My Agent's actual personal runtime owns recurring invocation; Node's duplicate recurring-search scheduler is retired.

## Private batches remain private records

Published agent batches are immutable snapshots. A new run publishes a new batch/event key; daily public-catalog maintenance does not regenerate an existing private batch. Employer facts may reference shared jobs, but personal recommendations, fit notes, ratings and source associations stay in owned batch items.

A batch URL/UUID is only a locator; authentication and ownership still control access. Missing or foreign private locators can fall back to catalog data without replacing private records or disabling account synchronization. A batch link alone never authorizes an application.

## Opening versus applying

Opening a posting records its ID in the client-side tracker and removes it from the latest Discover view. Preparing a draft creates owned preparation state. Neither action approves or submits the application.

Your Job Tracker combines tracker IDs, private workflow applications and imported history. Workflow state takes precedence over legacy tracker state. Imported records are deduplicated against the native list using the existing URL/company/title/location comparison. The compact list provides Active, Saved jobs and Closed views, search/type/stage filters and separate full-time/internship counters. Saved jobs includes opened roles and preparation drafts that have not progressed to applying; terminal outcomes remain visible under Closed.

## Stats and application flow

Stats is a Job Tracker tab, with bounded cards and colored icons for tracked jobs, applications, active interviews and offers. Totals use the same native/imported application list and progress interpretation as tracking. Draft preparation does not count as applying, and terminal outcomes do not inflate active interviews/offers.

A client-side Nivo Sankey below the cards partitions applications into current recorded Awaiting response, Screening, Interviewing, Offers, Rejected and Withdrawn outcomes. Its total matches the Applications counter. It does not invent intermediate history or infer ghosting from silence. Text counts accompany the chart; empty and single-outcome cases are supported. Data is rendered locally rather than sent to a chart service.

## Evidence-aware timelines

Timelines normalize recorded milestones/activity, order valid dated evidence chronologically and place undated process stages without inventing dates. Scheduled and completed interviews remain distinct. Candidate-reported observations, email evidence, explicit user progress and runner-observed confirmation retain their separate meanings; status alone is not an employer receipt.

Corrections/reschedules append a milestone with `supersedesId`, preserving original history and preventing competing successors. Current views exclude replaced events when deriving upcoming work and outcomes. A corrected timeline does not silently rewrite a saved preparation plan.

Timeline writes emit compact `application_timeline_changed` events. Muse's next authorized run reads the labeled change, follows `read_application_timeline`, refreshes its context and acknowledges the event. This does not create an email monitor, runtime wake-up or new work permission.

See [System Architecture](../architecture/system-overview.md), [Gateway and MCP](../agents/gateway-and-mcp.md), and [Submission Safety](../agents/submission-safety.md).
