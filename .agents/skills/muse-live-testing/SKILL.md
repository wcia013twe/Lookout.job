---
name: muse-live-testing
description: Run controlled live Lookout tests with Muse and diagnose pickup, drafting, reporting, or heartbeat failures. Use for coordinating with Muse and verifying saved outcomes, not routine job search or unrelated infrastructure work.
---

# Live testing with Muse

## Establish the test

1. State the exact acceptance path and non-goals. For an application test, use AI Apply → Muse claim → saved draft → recorded result. Do not retest working search or redesign delivery infrastructure unless a measured failure points there.
2. Read current workflow guides and tool schemas. Resolve the intended connection and existing application/request state before writing. Historical IDs, versions, browser indices, and deployment claims are not current evidence.
3. Agree on one bounded instruction with Muse: target role, draft-only or other explicitly authorized scope, expected saved result, and prohibited actions. Preparation is not submission approval. Preserve old jobs and uncertain submissions.
4. Set up one controlled baseline. Record the request/event identity, current application revision, job version, and timestamps. Do not duplicate an active request. A fresh draft and a reused-draft test measure different things; label them separately.

## Coordinate efficiently

- Use the available purpose-built tools for records and the authorized browser surface for messaging Muse. Follow host browser instructions, refresh locators after UI changes, and verify a message appears in the transcript before resending. Never interfere with unrelated tabs or expose credentials.
- Give Muse one concrete task and expected evidence at a time. Ask for the exact call, payload shape, response, and current step when a failure appears; do not ask for a broad speculative diagnosis first.
- At 60 seconds without pickup or meaningful progress, nudge Muse directly: “Check your Lookout feed, continue the existing authorized request, and report the current step or exact blocker. Do not queue a duplicate or retry an uncertain submission.”
- Inspect actual progress after the nudge. A typing indicator alone is not proof of progress or a hang. Escalate only a concrete unrecoverable blocker or required human approval; elapsed time alone does not justify abandoning the test. Continue safe independent investigation.
- Keep audit capture concise and use existing domain records. Log required call/result evidence without secret URLs or private reasoning. Do not build parallel workflow stores or let logging replace the actual test.

## Verify before interpreting

- Measure queue → wake/feed read → claim → draft saved → result recorded separately. Use server timestamps where available. Distinguish measured RPC duration, Muse-reported timing, and inferred model/runtime overhead.
- Read saved application, execution result, and relevant review handoff independently. A chat assurance, active spinner, acknowledged event, or completed backend status alone does not prove a correct draft or employer submission.
- Check the selected résumé reference and bytes when identity matters; identical filenames do not prove identical content. Check factual answers against owned evidence, actual employer questions against inspection, and unknowns explicitly. Do not invent eligibility, dates, compensation, referrals, or consent.
- Preserve human edits. For a targeted answer correction, inspect the current `prepare_draft` schema and use its supported `draft.answerUpdates` path at the fresh revision. Full-question saves may intentionally preserve existing answers; a no-op does not prove the draft is immutable. Read back the changed field and unchanged neighbors.
- Treat `prepared`, awaiting approval, submitted, and uncertain as distinct outcomes. Never retry an uncertain external submission. A completed report is a historical snapshot; do not rewrite it to pretend a later draft correction existed earlier.

## Fix narrowly and retest

- Keep server ownership, version, approval, and uncertainty checks. Skip only preclaim reads covered by exact event metadata. Never assume an application revision from a job version or assume revision zero; read missing metadata only.
- Use distinct stable operation keys such as `claim:<event-id>`, `report:<event-id>`, and `finalize:<event-id>`, following the current contract. Replay a key only with the identical payload. A key/payload rejection proves rejection, not that the intended write landed: reconcile current state before any further write, never blindly rekey.
- Reproduce the observed failure, apply the smallest fix, and repeat the same scenario. Keep runtime changes separate from source-only guidance. No claim of deployment or improvement without corresponding evidence.
- Finish with a short verdict for each acceptance criterion, remaining limits, exact saved outcome, and whether any employer action occurred. Do not declare the overall objective complete when speed or quality remains unverified; do not ask the user to perform repairs the available tools can safely handle.

## Anti-patterns

- Scope drift into working search, worker gates, watchdogs, or architecture before proving they block the requested path.
- Accepting Muse's explanation as root cause instead of checking the exact request, response, and persisted state.
- Changing multiple variables before a baseline, or presenting reused-draft timing as a full-drafting speed improvement.
- Repeated polling, status narration, exhaustive context reloads, or audit ceremony without a new debugging question.
- Guessing that VM recovery, missing temporary files, or model latency explains a delay without independent evidence; label such accounts as reported until verified.
- Treating a rejected write as success, a no-op as immutability, a heartbeat as completed work, or draft preparation as submission consent.
- Handing work back prematurely, making the user relay messages, or fabricating personal answers to make a test look complete.
