# JOB02 plan: batch preparation, questions and live form filling

Status: design only. No targets selected, harness implemented, readiness certified
or JOB02 participant run. JOB01 is independent and must not be changed by this work.

## Research question and scope

Does Lookout reduce time and required user interactions when preparing a small
application batch, resolving missing information and filling supported live forms
across sessions, while preserving factual and writing quality?

Use three preselected targets shared by both conditions. Discovery belongs to
JOB01. Reuse its starting candidate profile and resume, not participant-generated
outcomes. Lookout receives an isolated native account and standard retrieve/save
orientation; baseline receives complete context in its first message and may keep
persistent files. No automatic onboarding replay in later sessions. Draft generation
is part of application preparation; do not add a separate drafting prompt.

| Target | Required outcome | Evidence |
| --- | --- | --- |
| Workday/manual | Save the canonical employer link and precise manual-completion handoff; stop before account creation, sign-in, question preview or filling. | Actual destination, owned unfinished application and rendered/read-back action card. Keep inspection incomplete; no invented questions. |
| Personal-input question | Inspect a supported form, save the exact unresolved question, request needed input, then incorporate the controlled user's response. | Question identity, choices/limits, saved answer card, actor response receipt and final draft/live values. |
| Clean Greenhouse | Inspect all reachable conditional questions, fill supported fields and correct resume, save draft and reach a verified ready-to-submit stopping point. | Full live form inspection, final visible values, upload evidence, validation state and saved draft. No Submit click. |

Prefer a native Greenhouse form for the personal-input target too, keeping ATS
coverage small. Its real form must contain a question whose answer depends on a
withheld personal fact or intent. “Why do you want to apply?” is not automatically
a blocker: grounded drafting is valid when known motivation suffices. Do not
manufacture an employer question to force the desired interaction. Unknown facts
remain unknown, including eligibility or conflicting dates.

## Two-session stream

1. **Prepare the batch:** Both receive the same three jobs, evidence and instruction
   to prepare applications and fill supported forms, stopping before Submit. Lookout
   follows existing native preparation/card flow; baseline saves equivalent drafts,
   specific questions and next steps in files/chat. Both have the same actual browser
   capabilities, network access and budgets.
2. **Controlled response:** At the frozen response boundary, the actor answers only
   questions actually requested, using predefined facts. Lookout receives saved
   human card answers/change events; baseline receives the same semantic answers
   through its user-message channel. Unasked facts are not volunteered. A missing
   request remains a participant outcome, not grounds for coordinator assistance.
3. **Fresh-session continuation:** Lookout receives the fixed simulated wake;
   baseline receives a prescribed continuation request. Both reconcile saved state,
   apply answers to the right application/field and complete independent work.
   Workday remains manual; answering its card does not authorize automation.
4. **Capture and grade:** Freeze final browser and durable-state evidence before a
   fresh independent grading agent reads either condition. No participant rescue.

Freeze exact session budgets, wake/response delays and stopping rules before
execution. The first boundary is fixed, not chosen after checking output quality.
Keep browser state equally across conditions; record whether fresh session means
new model context with retained browser cookies/pages. Neither condition receives
hidden target outcomes, answer keys or grading instructions.

## Controlled answers and native response boundary

Freeze one answer sheet distinguishing already available facts, withheld reusable
facts, job-specific personal intent and genuinely unknown facts. Include accepted
semantic paraphrases and explicit reuse scope. The actor returns the requested fact
or “unknown”; it never coaches, repairs malformed cards or supplies extra hints.
Scope personal motivation to its job; reuse factual answers elsewhere only when
meaning, options and user permission support it.

Use the existing product boundaries, not an agent-writable fake card:

- Participant saves exact observed questions through `prepare_draft`, preserves
  human edits and reads `read_action_board`. One application's unresolved fields
  belong to its existing Need your input card. Workday is a fieldless manual blocker.
- A separate controlled-human actor uses the authenticated website/service
  `respondActionBoard` client → `respond_action_board` RPC boundary for the dedicated
  test account (see [client](../backend/client.mjs)). Freeze its actual payload,
  source key/revision, deployed route and identity after verifying the selected stack. The participant has no access to this human session
  or credential. Answer-only blocker responses grant no final approval.
- Capture the saved response plus its `action_decision`/`savedResponse` event, then
  verify the same application and question IDs through read-only state. Participant
  refreshes current state and uses its supported draft writer; the actor does not
  complete application work on its behalf. Missing events must not be replaced by
  secret chat hints. Baseline receives the same response once with its field context.

Current source supports draft-derived cards and human-only responses, but does not
prove this harness can deliver them. Deterministic `inspect_application`/
`try_application` registrations are paused; source/tests alone do not establish
participant browser availability. Verify the actual host tools for both conditions.
See [application-workspace](../supabase/functions/agent-gateway/skills/application-workspace.json),
[runner limits](../runner/README.md) and
[application workflow](../openwiki/workflows/application-submission.md).

## Grading gates

Use one fresh final grader for both conditions, following JOB01's frozen
assignment, artifact binding and independence attestation. It neither implements
nor operates the runs. Confirm native state read-only under the dedicated test
account; inspect baseline files equivalently. Keep grader activity outside metrics.

| Dimension | Checks |
| --- | --- |
| Time to task | Actual execution duration through each permitted outcome; fixed simulated waiting reported separately. Incomplete work retains its timeout, not a successful completion time. |
| Effort to task | Unique required user interaction turns, including repeated/unnecessary requests; scripted initiations separate. Category counts may overlap and must not be summed. |
| Quality of completion | Per-target routing/completion, question coverage and necessity, answer accuracy, resume identity, grounded writing/style, durable answers and honest blockers. Report each target and before/after checkpoint; batch averages must not hide a failed target. |

**Before the answer:** Check the question was actually observed, necessary after
consulting available facts, specific and answerable, with correct job/field/options.
Group related missing fields without making the user decipher diagnostics. Baseline
may pass equivalent user-facing handoff quality without a Lookout card.

**After the answer:** Compare the exact actor response to saved and live values.
Facts use exact values or valid equivalent choices; written responses use frozen
0/1/2 anchors for fidelity to personal intent, factual support, role relevance,
style and length limits. Check correct field mapping, persistence across the fresh
session, allowed reuse and preservation of unrelated answers. Do not clear a
blocker while required fields remain unresolved. Merely copying the user response
into chat does not establish a saved or filled answer.

**Completion:** Workday's correct outcome is a manual handoff, not form readiness.
The input target must resolve what the actor answered and retain genuine unknowns.
Greenhouse must have observed complete inspection and accurate final live fields;
a saved draft, resume upload or “ready” message alone cannot pass. No actual
submission, approval forgery or unsupported Submitted status is acceptable.
Missing evidence is ungradable, never an inferred pass. Report native Lookout
adherence separately as correct / attempted but failed / omitted / not applicable.

## Prove the harness before starting participants

Implementation must emit receipts; this checklist is not a passing receipt. Use
small fictional fixture accounts and controlled forms for all rehearsal writes.
Never rehearse against a real employer application or overwrite historical runs.

| Gate | Required retained proof before readiness |
| --- | --- |
| Runtime and parity | Both actual participant containers can use the selected browser, inspect a controlled form, persist/reopen a page, access their own resume and retain output across sessions. Verify actual auth, tool schemas/scopes, target network paths and isolated account ownership. No inference-only connectivity check can stand in for browser proof. |
| Three-path rehearsal | Run the actual harness adapters on synthetic Workday redirect, missing-question and clean Greenhouse-like forms. Prove correct question/choice capture, file-byte/hash matching, final-value capture, card save/read-back, real controlled-human response ingress, fresh-session recovery and baseline-equivalent delivery. Retain expected-versus-observed assertions. This is infrastructure testing, not participant quality evidence. |
| Stop boundary | Prove final submission cannot execute through every exposed browser/tool path, including click, keyboard Enter and scripted form submission. Exercise the deny path against a controlled endpoint with a request counter. Resume upload/ATS autosave is separately inspected: if it creates an employer application or notification before Submit, the live target is ineligible. Do not assume a disabled button is a complete guard. |
| Fail-closed checks | Inject expired auth/tool denial, failed draft write/read-back, stale card revision, missing/misrouted actor event, changed form fingerprint/conditional field and missing final evidence. Each must record a specific failure and prevent readiness; none may yield an empty-success result or silently fall back to chat/fixtures. |
| Live target check | Read-only inspect the three exact canonical URLs and conditional structure with both host paths; record time, fingerprint and supported controls. Validate upload/autosave semantics from provider evidence or a controlled equivalent; unresolved live side effects block live use. Recheck immediately before each condition. Material drift stops that pair as incomparable; no silent target replacement. |
| Grading/telemetry rehearsal | Produce a synthetic complete trajectory and a deliberately incomplete one. Prove the independent grader handoff contains all evidence bindings, missing evidence cannot pass, timing/turn arithmetic is correct and native confirmation cannot write. Verify Langfuse export/read-back with synthetic labeling through the existing eval contract; never label a pilot as measured. |

Each failure gets an error ID, logs, classification and, after a code fix, a new
passing receipt linked to that ID. Keep failed receipts and attempts. An explicit
setup rerun is allowed before participants; no hidden retries. After participants
start, freeze errors/timeouts as outcomes; no repair-and-resume under the same run.

`readiness.json` must bind source hashes, runtime image/model/reasoning, actual
tool schemas and application guide versions, scenario/actor/rubric/grader hashes,
candidate/resume hashes, exact target URLs/form fingerprints, budgets/timing and
all gate receipt hashes. It must show zero unresolved harness errors. The launcher
must validate those bindings and fail before model execution if absent, failed or
stale; evidence that it rejects a tampered binding is required. Credentials stay
private and are referenced by nonsecret identity only.

A broken bridge, actor ingress, evidence recorder or launch guard is a harness
failure. An agent ignoring an available tool, asking again despite accessible
answers, mapping a value incorrectly or claiming readiness prematurely is a
participant failure. A live target outage/drift is an external-source failure.
Keep the failed attempt and its time; do not score infrastructure failure as poor
participant quality or silently rerun a condition. The independent grader may mark
affected comparisons ungradable. Uncertain classification remains explicit.

## Implementation order and current blockers

1. Select the three exact targets and read-only inspect them; verify safe live
   upload/autosave behavior and actual browser support before building extra layers.
2. Freeze the concise scenario, answer sheet, field reference, budgets and grading
   anchors. Implement only the missing JOB02 browser/evidence and controlled-human
   response adapters, reusing JOB01 capture/grader contracts without changing its
   active checkout, accounts or freezes.
3. Run the three-path rehearsal and injected failure gates, fix diagnosed harness
   errors, retain failure-to-fix receipts, then prepare a new bound readiness record.
4. Assign the fresh final grader, register the prospective JOB02 dataset/export
   using the existing pinned Langfuse transport, and verify synthetic read-back.
   Record exact resolved transport versions at freeze; no new SDK is needed.
5. Present readiness evidence and remaining limits before an authorized paired
   pilot. This plan does not launch participants or establish that a gate passed.

Current blockers are target selection and safe live side effects; actual browser
parity; controlled-human answer ingress; capture/submission guards; synthetic and
failure rehearsals; frozen grader/actor references; and receipt-bound readiness.
Do not start JOB02 until those have concrete passing evidence.
