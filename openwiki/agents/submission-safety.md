---
type: workflow
title: Application Preparation and Submission Safety
description: The guarded path from a revisioned application draft to one browser submission attempt, including authorization, duplicate prevention, confirmation evidence, and human recovery.
tags: [applications, approval, runner, submission, safety]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-15T07:09:51.577Z
sources:
  - id: openwiki-source-d1a22cc381bbd73a73205d18
    resource: repo://runner/README.md
  - id: openwiki-source-cf4167480dffbb09e7950dce
    resource: repo://runner/submit.mjs
  - id: openwiki-source-7bb9b00c83ad9bf024ec6b07
    resource: repo://supabase/functions/agent-gateway/submission-authorization.mjs
generated: { by: "codex", at: "2026-10-15T07:09:51.577Z" }
---

# Application Preparation and Submission Safety

Preparation, authorization, execution, and evidence are separate states. A prepared draft is not an application submission, routine automatic authorization is not human approval, and a runner-observed confirmation is not a signed employer API receipt.

## Prepare an exact execution snapshot

The local runner inspects the live employer form, fingerprints it, hashes the selected private resume, and prepares exact question records. Automatic answers must trace to verified profile facts or a uniquely matching, verified saved answer whose policy permits reuse. Resume selection must resolve through the current default or an unambiguous keyword rule. Missing, unfamiliar, or ambiguous values stop at **Needs you**.

Automatic submission is limited to canonical HTTPS Greenhouse forms and one resume upload. Important matches, unknown tiers, and auto-apply-off require human approval of the current revision and snapshot. Routine matches may instead receive server-generated automatic authorization after the gateway revalidates current policy, profile, answers, resume ownership, hashes, and form metadata. Neither route creates a fake approval.

## Revalidate before one click

`submit_application` reloads current server context, opens the canonical job, prefills supported native controls, and validates every required value, the resume bytes hash, form fingerprint, upload scope, and a single unambiguous enabled Submit control. It then requests an atomic attempt claim and a fresh, one-use click permit tied to the application revision and personal settings version.

Only after those checks does the runner click once. A replayed or lost start response cannot become another permit. An existing active, uncertain, or confirmed attempt blocks a second click. Claims and starts also freeze draft edits so execution cannot drift from the authorized snapshot.

## Confirmation and uncertainty

Success requires a supported confirmation marker that was absent before the click, a known success phrase, no remaining visible form, and the same canonical job URL or its confirmation path. The stored receipt is explicitly labelled runner-observed Greenhouse confirmation.

Any exception after start is uncertain, even when the browser appears not to have clicked. The runner reports that state and never retries execution. If confirmation was observed but reporting failed, it retains a private pending report and retries only `report_submission_result`; it must not click again. Failure reports omit raw exceptions, answers, credentials, and signed file URLs.

## Human recovery

Uncertain outcomes move to **Needs you**. The user checks the employer portal or email. They may record progress as user-reported, which remains distinct from runner confirmation. Only the signed-in human can mark an attempt verified not submitted and allow a fresh attempt; the old attempt is cancelled, the blocker is cleared, and current authorization is required again. Agents cannot invoke that recovery boundary.

Unsupported ATSs, CAPTCHAs, extra documents, custom widgets, ambiguous controls, and unknown confirmation pages remain manual. Fixture browser/MCP tests cover orchestration, while database scenarios cover ownership, scopes, one-use permits, frozen drafts, uncertainty, and explicit recovery; no real employer application is submitted by the test suite.

See also [Gateway and MCP](gateway-and-mcp.md) and [Discovery and Tracking](../workflows/discovery-and-tracking.md).
