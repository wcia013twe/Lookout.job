# COM4 — Introduction continuity

Current prospective comparison: COM4-stream-v4 / COM4-grade-v3. Both conditions receive identical task requests and released evidence; scheduled initiation is disabled. Native Lookout startup, default tools and participant-driven discovery are retained with account/tool isolation. Earlier notification-stream descriptions below are historical where they describe generic wakes. No proactive effort advantage is measured.

Implemented prospective `COM4-stream-v2`; no participant execution. **7 sessions, 12 turns**, 3,480-second per-condition ceiling. Dates in every prompt are the simulated business clock; no real waiting.

## Notification stream

| Turn | Session | Date | Input | Required outcome |
|---|---|---|---|---|
| 1 | onboarding | 2026-11-10 | onboarding (onboarding) | boundaries |
| 2 | offer | 2026-11-10 | introduction_offer (external) | conditional_bio |
| 3 | promise | 2026-11-11 | bio_reported_sent (user_update) | bio_provenance |
| 4 | promise | 2026-11-11 | promise (external) | promise_tracking |
| 5 | waiting | 2026-11-17 | before_deadline (external) | wait_before_due |
| 6 | waiting | 2026-11-19 | overdue (external) | overdue_followup |
| 7 | introduced | 2026-11-20 | introduction_arrived (external) | introduction_resolved |
| 8 | introduced | 2026-11-20 | availability_request (external) | availability_needed |
| 9 | scheduling | 2026-11-20 | availability_windows (user_update) | availability_draft |
| 10 | scheduling | 2026-11-20 | availability_reported_sent (user_update) | availability_send_provenance |
| 11 | resolution | 2026-11-21 | confirmation_and_stale_reminder (external) | resolution |
| 12 | resolution | 2026-11-21 | final_reconciliation (reconciliation) | saved_state; report_accuracy |

Both receive the same complete onboarding/resume and genuine user updates. Lookout receives generic scheduled review wakes; baseline receives concise initiation requests. Baseline files persist; native Lookout records persist. The predeadline and overdue checks share one waiting conversation; the introduction arrives in a fresh session. The final request is identical and does not disclose rubric facts.

## Outcomes and supported storage

- Track conditional bio, user-reported sends, Ivo’s dated promise, appropriate predeadline inaction, overdue next step, fulfilled introduction, linked Mina conversation, requested/provided availability and confirmed informational meeting. A short justified wait after the deadline can pass; no fixed nudge cadence or actual sending is required.
- Dedicated-owner live writer/readback verified supported `save_contact` fields: `notes`, `relationship`, `message`, `followUp`, `followUpDate`. The existing notes conversation format `lookout-conversation-v1` supports sourced messages and meeting records; readable relationship/notes can express responsible party, commitment ID, timing and resolution. Equivalent supported representations pass; no invented interaction API or unsupported nextAction/relationshipUpdates requirement.
- The product UI derives its waiting label from last message direction. Grade underlying commitments/history/follow-up date, flag misleading UI labels separately; never invent a sent message to change a label.
- Preserve material provenance and unrelated records. Legitimate event-backed status changes and revision of superseded drafts are allowed. Onboarding acknowledgement alone is neither proof of understanding nor a failure; no requested onboarding summary is imposed.

## Grading and final verification

Follow [common final-state grading](com-final-state-grading.md) and [readiness gates](com-run-readiness.md). Passive stage snapshots receive no in-run feedback. Durable quality checks require native after-state or baseline saved-file citations. Final `saved_state` requires independent terminal receipt and pre-final snapshot; `report_accuracy` additionally cites the report. A baseline final-report file is legitimate durable state, but cannot erase earlier continuity failures. Native adherence remains diagnostic.

A separate `workspace:read` grader credential captures profile/context versions and contacts after participant termination under the dedicated account lock. Capture and later grading verify profile owner/facts, contact owner/record/revision, run/scenario/time and snapshot/file hashes. An unavailable optional scoped read is reported; a complete bound snapshot is authoritative. Owner/state/version mismatches are invalid. Historical review uses frozen evidence, never a subsequently reset live account. Both conditions receive equivalent final-file review.

The controlled actor exposes only already released facts, refuses sending, and does not invent availability before the user supplies it. One captured question adds five simulated minutes. Assigned initiation, genuine updates, observed questions and unanswered demands remain separate. Waiting time is not human completion time.

## Setup and launch

Use `scripts/com4/provision.mjs <new-private-account-root> <approved-manifest> <resume>` then `provision-grader.mjs <account-root>` for a new dedicated owner. Server-controlled `benchmarkTaskId=COM4`, local-only URLs, owner/email guards and shared lock prevent other-owner reset. `writer-smoke.mjs <account-root> <new-receipt-name>` performs isolated field verification and restores fixtures.

`prepare.py --source <dedicated-account-root> --background <baseline-kit> --destination <new-private-run-root>` renders every native profile fact into readable shared onboarding, verifies resume hashes, saves parity receipt and freezes executable/input/container hashes. `preflight.py --task-dir <root> --output <new-receipt-dir>` verifies subscription/isolation/schema without inference or reset.

`python3 scripts/com4/orchestrate.py --task-dir <root> --pair-id <unique-pair> --repeat 1 --pilot --langfuse-env <private-env> --receipt-dir <private-receipts>` runs a pair only when authorized. Both conditions must terminate before independent review; preserve failures, no rescue or silent replacement. Native scope is read/network-write only; external sends/submissions unavailable.

After review, use `summary.py` for the shared `eval_v1` result, and the shared `scripts/evals/langfuse.mjs` exporter. `scripts/com4/langfuse.mjs` supplies detailed structural stage/tool/score traces and versioned dataset registration. Personal content, terminal records, resume and source hashes remain local. Synthetic verification and pilots must be excluded from measured comparisons.

## Verification limits

Fictional no-model fixtures cover grading, actor release gates, owner/time/hash binding, report-only evidence rejection, baseline final-report validity, native omissions, durable checkpoint evidence and private-data exclusion. Actual local save/read/restore and actual read-only terminal response shapes were verified separately. UI/product logic is unchanged. No model performance or research claim follows from readiness checks.

## Retained evidence

Both conditions can reread all previously released emails. The archive deduplicates message IDs; currentNotifications and notificationHistory preserve actual deliveries. Conflicting content under an existing ID fails loudly. Calendar evidence is explicitly historical and must be reconciled with later changes. User messages are not automatically replayed. Both conditions receive the same frozen business clock; future packets remain inaccessible.

The common dashboard `wakesUsed` field counts attempted participant turns (including user-triggered turns), not scheduled-only wakes. Case-level assigned initiation and observed interactions retain their separate meanings.

## Matched-intent pilot verification

Both cases passed actual no-inference preflight: subscription login, isolated containers, native startup/default surface, filtered discovery, wrapped guide reads, out-of-scope denial and rolled-back writer checks. Complete initial context and private account provenance were verified without exposing candidate contents. COM3 preparation now retains its source manifest for later setup reuse; the first attempt from an older manifest-less freeze remains preserved.

MCP startup/discovery latency and response bytes are cumulative request measurements within execution time, not extra wall time or model-only time. Wrapped calls and transport errors are captured. Real discovery, reads, writes and verification remain product costs. Prescribed turns, observed questions/demands, active execution, total wall time and token/cost coverage stay separate. Missing prices remain unknown. Scripted effort is not measured human cognitive effort.

Prospective PILOT03 (COM03) and PILOT04 (COM04) require both participants to finish before independent semantic review. No rescue, hints or participant retries. Completion is not a quality pass. Any resulting Lookout recommendations must be supported by frozen evidence and separated from harness repairs. This pass changes no product/UI behavior; fictional benchmark fixtures cover the changed harness.
