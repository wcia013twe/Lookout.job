---
type: workflow
title: Application Preparation and Submission Safety
description: Guarded profile-aware preparation, Node/local-runner submission and batch recovery, plus the separate evidence boundary for user-reported interview timelines and corrections.
tags: [applications, approval, runner, submission, safety, interviews]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-27T03:54:51.227Z
sources:
  - id: openwiki-source-ee1b3e21718542a757d4d790
    resource: repo://backend/runtime/README.md
  - id: openwiki-source-64cc972ace33cd923ac4c23c
    resource: repo://docs/interview-reporting.md
  - id: openwiki-source-d15addbecb7d058f078b8413
    resource: repo://lib/application-timeline.mjs
  - id: openwiki-source-8bdb9080f51dd31bf9d211bd
    resource: repo://lib/muse-change-feed.mjs
  - id: openwiki-source-d1a22cc381bbd73a73205d18
    resource: repo://runner/README.md
  - id: openwiki-source-cf4167480dffbb09e7950dce
    resource: repo://runner/submit.mjs
  - id: openwiki-source-5e0e032552d77cb40052782b
    resource: repo://supabase/functions/agent-gateway/instructions.json
  - id: openwiki-source-174a1dc3e39ac1cf43a4878f
    resource: repo://supabase/functions/agent-gateway/resume-selection.mjs
  - id: openwiki-source-7bb9b00c83ad9bf024ec6b07
    resource: repo://supabase/functions/agent-gateway/submission-authorization.mjs
  - id: openwiki-source-6754d9731de2cd79188fe9ec
    resource: repo://supabase/functions/agent-gateway/submission-batches.mjs
  - id: openwiki-source-808f3e988762f62725a76feb
    resource: repo://supabase/migrations/20261027030033_interview_reporting.sql
  - id: openwiki-source-63ba3adbfc5072aafa11a603
    resource: repo://tests/interview-reporting-check.sql
  - id: openwiki-source-4b7cee5a6619781a44bf50c1
    resource: repo://tests/submission-batches-check.sql
  - id: openwiki-source-b5c58820c0cbb1b667667b95
    resource: repo://tests/submission.test.mjs
generated: { by: "codex", at: "2026-10-27T03:54:51.227Z" }
---

# Application Preparation and Submission Safety

Preparation, authorization, execution, and evidence are separate states. A prepared draft is not an application submission, routine automatic authorization is not human approval, and a runner-observed confirmation is not a signed employer API receipt.

## Prepare an exact execution snapshot

The shared runner implementation inspects the live employer form, fingerprints it, hashes the selected private resume, and prepares exact question records. Automatic answers must trace to verified profile facts or a uniquely matching, verified saved answer whose policy permits reuse. Resume selection must resolve through the selected active application profile and current versioned assignments; ambiguous or conditional assignments require review. Missing, unfamiliar, or ambiguous values stop at **Needs you**.

Automatic submission is limited to canonical HTTPS Greenhouse forms and one resume upload. Important matches, unknown tiers, and auto-apply-off require human approval of the current revision and snapshot. Routine matches may instead receive server-generated automatic authorization after the gateway revalidates current policy, profile, answers, resume ownership, hashes, and form metadata. Neither route creates a fake approval.

## Execution surfaces

The local stdio runner and the configured Node service reuse the same guarded native Greenhouse implementation. Node submission is opt-in through `LOOKOUT_SUBMISSION_ENABLED`; it does not run as part of discovery jobs. A Node batch accepts 1–10 unique owned application/version references and executes sequentially during its request. Each child obtains current authorization and its own single-use claim. Read saved batch/application/attempt state after a lost response. Active leases return busy; expired leases resume only unfinished items using stable child attempt IDs. Terminal results replay without another click, and partial batches retain independent successes and blockers. Repair pre-click issues and use a new event key/current revisions for eligible work; uncertainty never authorizes another attempt.

## Revalidate before one click

`submit_application` reloads current server context, opens the canonical job, prefills supported native controls, and validates every required value, the resume bytes hash, form fingerprint, upload scope, and a single unambiguous enabled Submit control. It then requests an atomic attempt claim and a fresh, one-use click permit tied to the application revision and personal settings version.

Only after those checks does the runner click once. A replayed or lost start response cannot become another permit. An existing active, uncertain, or confirmed attempt blocks a second click. Claims and starts also freeze draft edits so execution cannot drift from the authorized snapshot.

## Confirmation and uncertainty

Success requires a supported confirmation marker that was absent before the click, a known success phrase, no remaining visible form, and the same canonical job URL or its confirmation path. The stored receipt is explicitly labelled runner-observed Greenhouse confirmation.

Any exception after start is uncertain, even when the browser appears not to have clicked. The runner reports that state and never retries execution. If confirmation was observed but reporting failed, it retains a private pending report and retries only `report_submission_result`; it must not click again. Failure reports omit raw exceptions, answers, credentials, and signed file URLs.

## Human recovery

Uncertain outcomes move to **Needs you**. The user checks the employer portal or email. They may record progress as user-reported, which remains distinct from runner confirmation. Only the signed-in human can mark an attempt verified not submitted and allow a fresh attempt; the old attempt is cancelled, the blocker is cleared, and current authorization is required again. Agents cannot invoke that recovery boundary.

Unsupported ATSs, CAPTCHAs, extra documents, custom widgets, ambiguous controls, and unknown confirmation pages remain manual. Fixture browser/MCP tests cover orchestration, while database scenarios cover ownership, scopes, one-use permits, frozen drafts, uncertainty, and explicit recovery; no real employer application is submitted by the test suite.

## Interview reporting and corrections

During an authorized conversation or source check, Muse may record process facts with `record_application_milestone` and private interview reflections with `save_artifact`. Website reports are authenticated `user` observations; Muse can preserve a candidate statement as `user_reported`, or attach actual email evidence. Unknown exact timestamps remain null. Reports never grant approval, create employer-confirmed receipts or silently change application status.

Corrections/reschedules append a new milestone with `supersedesId`; ownership and one-successor checks reject stale competing corrections. History remains, while current views ignore replaced entries. Correcting a timeline does not automatically rewrite a saved preparation plan; stale plan details require an explicit versioned update. Private interview notes remain versioned artifacts, and saving them does not share them to a Circle.

The Muse change feed carries compact timeline pointers and reschedule labels, so a later authorized run can read current records and acknowledge handled updates. It does not monitor email, wake Muse or create a runtime schedule. Source/local fixture proof must not be reported as a hosted release or real employer submission.

See also [Gateway and MCP](gateway-and-mcp.md) and [Discovery and Tracking](../workflows/discovery-and-tracking.md).
