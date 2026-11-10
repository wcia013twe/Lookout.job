# JOB02 plan: batch preparation, questions and live form filling

Status: local harness implemented; live targets, human-ingress proof and complete
readiness remain blocked. No JOB02 participant run. JOB01 is independent and must not be changed by this work.

## Research question and scope

Does Lookout reduce time, cost and required user interactions when preparing a small
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
   human card answers and, for completed blocker responses, change events; baseline receives the same semantic answers
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
  source key/revision, deployed route and identity after verifying the selected stack.
  The participant has no access to this human session or credential. A completed
  blocker uses `accept` with confirmed shown answers; this is not final application
  approval. Partial `save` retains unresolved blockers and does not emit an
  `action_decision`; the fixed wake must read current state.
- Capture the saved response and its exact `action_decision`/`savedResponse` event
  when completion emits one; retain the partial-save receipt otherwise. Then
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
| Cost | Reuse the [shared cost contract](eval-cost-accounting.md): actual structural usage deltas and complete/partial/unknown coverage; participant costs separate from preflight/harness and final grader. Empty rates mean no USD estimate; never turn unknown into zero or claim a subscription bill. |
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


## Implemented commands and retained verification

The implementation is confined to `scripts/job02`, `examples/job02` and focused
benchmark tests. It changes no product service or UI. The fictional rehearsal
forms are its detached demo coverage; they cannot be mistaken for employer results.

- `node scripts/job02/rehearse.mjs NEW_OUTPUT`: real local browser exercise of all
  three fictional paths for both condition adapters, screenshots/field captures,
  conditional fingerprint conflict, resume-byte hash and denied POST/GET submission.
- `node scripts/job02/account.mjs create ROOT N01_MANIFEST RESUME`: new dedicated
  local owner, candidate clone/read-back and scoped connection; never resets an
  existing account or touches the original candidate account.
- `node scripts/job02/cli.mjs prepare --root ROOT --candidate KIT --reference REF
  --runtime RUNTIME [--scenario SCENARIO] [--actor ACTOR] [--cost-policy POLICY]`:
  freeze private inputs/executables. Templates deliberately contain unselected URLs,
  unreviewed answers and no assumed pricing; preparation does not certify readiness.
- `python3 -B scripts/job02/preflight.py --root ROOT --output NEW_PROBE`: actual
  pinned container/MCP/browser path on fictional forms, no participant inference
  or employer access. Missing deployed schemas fail and retain a failure receipt.
- `node scripts/job02/cli.mjs preflight --root ROOT --receipts GATE_MAP`: validate
  all named bound receipts and unresolved-error ledger. It writes blocked readiness
  when any actual gate is missing. Receipts must come from observed probes; manually
  setting `ready` cannot bypass recalculation or the pinned image check.
- Only after passing every gate: `python3 -B scripts/job02/runner.py --root ROOT
  --pair-id NEW_PAIR`. This creates one exclusive attempt, preserves failures and
  emits the final-grader handoff plus separate read-only confirmation attempt.
- Coordinator assigns a fresh reviewer through `cli.mjs assign --root ROOT
  --reviewer AGENT --coordinator OPERATOR --excluded EXCLUDED_JSON`; reviewer follows
  frozen instructions and supplies `cli.mjs finalize --root ROOT --submission REVIEW`.
  Result summaries use the shared eval contract offline; no live Langfuse export
  or automatic agent spawning is performed by these commands.

Fourteen focused tests pass, including actual HTTP auth/write-error propagation,
unknown facts, actor scope, evidence drift, forged readiness, self-grader exclusion
and an incorrect live value failing despite perfect semantic ratings. Synthetic
browser rehearsals passed; these do not prove deployed native ingress or live ATS
safety. Two actual setup defects were caught before inference: a shared-runner import
collision and a missing change-feed acknowledgement scope. Both failed setups were
retained; a separate final setup passed actual subscription/container/MCP/browser
probes for both conditions, with receipts linking both defects to the fix. Full
readiness still reports blocked, and a launch-check receipt proves rejection before
participant execution. Real human ingress, live target safety, full stop-boundary
and failure rehearsals, grader handoff/telemetry and reviewed private references
remain mandatory. Harness/preflight and grader billing are not collected by this
pass; their cost remains unknown, separate from prospective participant counters.

## Prospective frozen-form correction

JOB02-batch-v2 enforces each target’s frozen expectedFingerprint during inspection
and before fill/upload. Pre-reviewed conditional branches may be enumerated in
expectedFingerprints (up to 20 hashes); unreviewed changes cannot be accepted by
reinspection. Live forms without a frozen fingerprint are rejected. A sticky
form-drift.json receipt prevents further writes, and the host records pair-stop.json
without starting the other condition or creating a comparable paired grade.
The corrected fictional browser rehearsal tests these guards for both conditions.
Historical v1 preflight receipts are not readiness for the v2 source; prepare and
verify a new setup. Live-target and authenticated-response gates remain required.


## Prospective matched-task v3 audit

`JOB02-batch-v3` / `JOB02-review-v3` gives both conditions identical task intent,
continuation request and prescribed initiation count. First-message candidate
onboarding differs only by its intended storage delivery. There is no proactive
initiation advantage claim. Lookout receives genuine native initialize prose and
default tools, including its normal audit procedure; supporting schemas require
participant discovery. Isolation filters schemas and checks both wrapper and inner
permissions, without rewriting native guidance. All actual startup, discovery,
read/write and verification work remains in time/cost. Separate structural
startup/discovery latency and byte diagnostics do not subtract that overhead.

The grading audit found that a correctly retained unknown could fail solely from
not reaching live readiness. The frozen reference now specifies each expected
outcome: manual handoff, ready, or ready with a supported unresolved blocker.
Independent semantic evidence is still required; wrong observed factual values
still fail. This rule applies equally to both storage formats.

Read-only selection from the original frozen board found three available targets:
Adobe R172083 (Workday), Garner Associate Software Engineer (Greenhouse 6174210004)
and Verkada Backend Engineer - Connectivity (Greenhouse 5194598007). See
[bounded target records](../examples/job02/live-targets.json). No fields were filled
and no files uploaded. Both Greenhouse pages contain React/custom combobox controls
and invisible reCAPTCHA/third-party frames. The current simple native-field adapter
cannot establish a complete, accurate ready state on these forms. Their upload and
autosave side effects remain unverified. These are harness capability/safety
blockers, not participant failures. Do not silently substitute controlled fixtures
and label the resulting run live. Fixture rehearsals remain valid failure-injection
infrastructure. A live paired pilot requires supported adapters and passing gates.


## Explicit controlled clearing pilot

The user authorized a controlled-form clearing pilot while live targets remain
blocked. `controlled-scenario.json` uses clearly fictional employers and frozen
HTML served entirely by browser interception; every other request is aborted.
It is labeled controlled clearing, never live employer validation. The personal
question asks both motivation and prior product use, making the missing user fact
concrete. Actual authenticated native cards/responses are rehearsed on a separate
sacrificial local owner before creating the participant owner. A JSONB key-order
verification defect was caught there and fixed using structural exact equality;
no human write was silently replayed.

The controlled path retains the same two-session task, no-submit boundary, matched
prompts, native default/on-demand surface, and time/effort/quality/cost accounting.
Its prospective registration and final structural export use the same project and
receipt directory through `scripts/job02/langfuse.mjs`; no private candidate facts,
answers, raw transcripts or browser field values are uploaded. Model/subscription
availability is established only by the actual single paired attempt; failures
remain failures with no paid-API fallback, model substitution or rescue.


## First controlled pair: validity hold

The single completed controlled pair is preserved at `/Volumes/External SSD/Lookout/tmp/job02-controlled-clearing-v1-20261109-4`. Fresh independent review found no comparable-effectiveness conclusion is justified: supplied résumé/profile identity differed, exact-field grading privileged one source, and a narrow necessary product-use question received different actor facts from a combined motivation question. Native draft writes returned owned-record-not-found because supplied target aliases had no corresponding owned native records. The container had writable `/workspace/output`, but the common task prompt did not identify it. These are harness limitations; do not turn computed exact-reference scores into a winner. Any subsequent trial requires prospective repairs, a new dedicated owner/freeze, actual readiness receipts and independent grading.

Prospective readiness now additionally requires four actual, hash-bound receipts:

- `candidate_consistency`: compare the supplied résumé, readable profile and native profile with each exact reference; resolve conflicts in the next approved candidate pack or mark alternatives/unknowns fairly before freezing. Never change the preserved pack.
- `actor_equivalence`: replay combined and narrower questions, paraphrases, unknowns and ambiguity against both response ingress paths; equivalent requested facts must yield equivalent facts. The example product-use matcher regression covers the observed narrow question; it is not proof of complete semantic coverage.
- `owned_target_lifecycle`: on dedicated sacrificial records, prove each exact target ID/URL maps to an owned native job and can prepare/read back its draft, manual card or answer card. The actual participant owner must have the frozen equivalent prerequisites. Schema discovery or an unrelated successful card does not satisfy this receipt.
- `storage_orientation`: prove the exact participant mount is writable, survives a fresh session, and the identical task request names `/workspace/output`. Native storage remains the product default; both conditions know their available file path.

All four are mandatory gates. Each needs an actual passing receipt bound to the next freeze before its trial. Controlled fixtures remain isolated; live employer forms still have separate custom-widget/upload/autosave blockers.

## Prospective v3: intent and field authority

The completed controlled-v2 pair is retained at `/Volumes/External SSD/Lookout/tmp/job02-controlled-clearing-v2-20261109-2`; independent review marked comparison invalid. Its actor matched employer names only after usage verbs, so equivalent product-use questions released different facts. Its exact email reference also ignored a specific saved application-email instruction. Diagnostic scores remain private; structural exports explicitly mark invalidity and omit comparative quality/task success.

Controlled-v3 uses a target-scoped product-use intent predicate with independent usage/topic checks; employer order, product pronouns and supported tense/paraphrase variants do not affect the predefined answer. Other targets and unrelated personal unknowns remain unresolved. Metamorphic tests and actual parity receipts must cover both observed question forms plus independent paraphrases before another freeze; the actor never depends on condition.

For application fields, an explicit active application-profile instruction outranks generic résumé contact information. Preserve both facts with distinct meanings. Derive the application-email reference from all supplied active profile instructions, fail closed on conflicting or unresolved application-specific instructions, and use verified contact fallback only when no specific instruction exists. Validate the readable/native/full-settings/reference authority together. A different contact email is not itself a contradiction. No original N01 files or saved preference values are rewritten to make a reference pass.


See [the independently reviewed controlled pilot results](job-controlled-pilot-results.md) for the final comparison, native-workflow limitations and retained evidence.

Prospective account setup now migrates legacy search profiles into canonical documents and revisions using the product serializer, verifies native read_search_context, and snapshots both tables. The three-target lifecycle must pass searchProfileId and verify the saved selected profile. This setup correction does not retroactively clear historical native failures; see the supplemental result caveat. Only profile documents are reconstructed from the frozen legacy source; no unseen rules or portals are invented.
