# COM2: Application communication continuity — stream v1

## Purpose and comparison

COM2 follows one fictional application through scheduling, completion reports, advancement,
additional-information requests and a definitive terminal event. It measures accurate
communication state, required user interactions and execution time across sessions.
A milestone does not automatically require an outgoing message. Interview preparation,
study materials, coaching, application forms, real sends and submissions are out of scope.
COM1 concerns evolving networking preferences; COM3 remains a separate discovery design.

Both conditions receive the same full personal background, resume and initial application/contact
facts. Non-resume information arrives once in a readable first message; there is no harness-created
baseline profile or replay. Baseline may keep notes. Lookout has equivalent cloned native
context and saves its work in normal native records; no local mirror is required. Neither receives
a standing career-goal prompt. The recorded controlled host configuration permits scheduled
application-communication checks with read/prepare/save authority. This is not a claim that a real
account has live inbox integration or a running schedule. Both conditions receive storage orientation.

The fixture application is Alder Systems Platform Engineer AS-417, already Submitted according
to a user report dated November 15, 2026. `receipt` is null. The separate Birch Data application,
Jules contact, personal profile and resume are preservation sentinels. All events and people are fiction.

## Notification stream

Times advance through simulation; no calendar-day waiting occurs. Each row is released only
when reached. Rows with the same session resume it; all others start a new isolated session.
There are 12 turns in 7 sessions. Confirmation and its duplicate calendar notice are batched
naturally rather than forcing another user initiation. The later stale reminder merits one
ordinary review request; it does not instruct the baseline to create a reply.

| Turn / session | Released input | Lookout | Non-Lookout | Required outcome |
| --- | --- | --- | --- | --- |
| 1 / onboarding | Full context, resume, application/contact facts | Initial message and native context | Same initial message, resume | Preserve reported submission and unrelated records |
| 2 / availability | Nov 16 recruiter asks for Nov 17–18 screen availability | Generic configured wake; email accessible | “Help me respond to this request for availability.” | Identify missing availability; ask or save accurate pending question |
| 3 / availability | User supplies Tuesday 2–4 or Wednesday 10–12 Eastern | Same user message | Same user message | Accurate unsent draft with both windows |
| 4 / confirmation | User reports sending only that availability reply | Same user message | Same user message | Save user-reported send, without agent-send or broader claims |
| 5 / confirmation | Screen confirmed Nov 17 at 2:30 Eastern; calendar duplicates same appointment | Wake; email and calendar | “Check the scheduling updates.” | One scheduled screen; no new reply or human task |
| 6 / reschedule | Coordinator confirms replacement Nov 18 at 10:30 Eastern, no reply needed | Wake; replacement email | “Check this scheduling change.” | Supersede Tuesday time, preserve history, no redundant reply |
| 7 / screen outcome | User reports completing screen, no advancement decision yet | Same user message | Same user message | User-reported completion only |
| 8 / screen outcome | Recruiter confirms advancement and Nov 23 at 11 AM technical interview | Wake; email | “Review this interview update.” | Employer-evidenced advancement; scheduled, not completed; no reply |
| 9 / additional information | Nov 20 request for earliest start date by Nov 23 noon | Wake; email | “Help me answer this recruiter request.” | Preserve missing fact and deadline; do not infer from graduation |
| 10 / additional information | User supplies January 19, 2027, explicitly unsent | Same user message | Same user message | Save correct unsent reply; no approval/send claim |
| 11 / closure | Nov 23 at 9 AM rejection, technical interview cancelled, information no longer required | Wake; terminal email | “Review this application update.” | Terminal state, no active interview or obsolete reply task; preserve history |
| 12 / closure | At 10:30 AM old technical-interview reminder arrives | Wake; stale calendar reminder | “A calendar reminder appeared after that update. Check whether anything is needed.” | No reopening, duplicate task, or outgoing message |

Each substantive turn has 300 seconds; onboarding and stale-only review have 180 seconds.
Both use subscription Codex `gpt-5.6-terra`, medium reasoning. No API model tokens, live web,
shared personal instructions, participant subagents, or future packets. All observed failures
remain; no rescue, silent retry, mid-run patching or semantic feedback to participants.

## Setup and capabilities

`examples/com2/scenario.json` is the versioned rubric/stream and `fixture.json` is the fictional
starting state. `scripts/com2/` is a standalone, frozen adaptation of repaired N01 grade-v2/runtime
contracts, deliberately independent of the actively running COM1 scripts.

Prepare requires a **dedicated** verified local account receipt with `benchmarkTaskId: COM2`,
`apiUrl: http://127.0.0.1:54321`, `mcpUrl: http://127.0.0.1:8080/mcp`, and an `@example.test` email.
The actual auth user's server-owned app metadata must also contain `benchmarkTaskId: COM2`.
Never relabel the COM1 account to satisfy this guard. A source directory must contain that receipt,
`cloned-context.private.json`, and `suite/initial-state.json` with equivalent native profile facts.
Account provisioning is external to these scripts; no COM2 account was provisioned or reset in this pass.

```sh
python3 scripts/com2/prepare.py --source <dedicated-account-source> --background <baseline-kit> --destination <new-private-root>
python3 scripts/com2/preflight.py --task-dir <new-private-root> --output <new-preflight-directory>
```

Prepare only writes private local inputs and freezes code, corpus, background and image.
Preflight checks subscription login, container isolation, actual schemas, owner assignment and
required snapshot tables without model inference or domain writes. Reset occurs only when an
explicit participant run begins, guarded by owner assignment, lock, known application IDs and
absence of unexpected audit records. The shared source account lock serializes paired conditions.

Native milestones support email/user-reported provenance, scheduled/completed/received phases,
confirmed times and supersession. `record_application_progress` is intentionally unavailable:
its human-report boundary is unsuitable for treating an email as a user report. The grader accepts
an accurate timeline-derived terminal state without requiring a particular applications.status
column. Native contact drafts or private artifacts may preserve replies; no exact field placement
is graded. Cancellation must be represented correctly in current saved work, while original evidence
remains. Actual deployed schemas must pass preflight; source availability alone is not runtime proof.

Current backend triggers may derive preparation-plan records from milestones. These automatic
backend side effects are not agent-created preparation materials and are not penalized as such.
The agent may not create preparation content or call preparation workflows.

## Grading, actor and metrics

The actor answers only from already released facts. Before availability/start-date updates it
says the user will check and respond shortly, without exposing future answers. After release it
may restate the answer. Resume questions refer to the supplied resume; sending remains prohibited.
Unknown questions receive an explicit uncertainty response. A specific waiting blocker can satisfy
an interim checkpoint; do not reward guessing. Five simulated minutes per answered exchange is a
protocol assumption, not measured human time. Questions repeated after a promised update are reviewed
for necessity; the actor does not provide strategy hints or save work for either condition.

Independent semantic review cites each checkpoint's actual output/state/trace and separately
verifies native outcomes. An existing file or successful tool call is not enough. Repaired grading
requires complete receipts/logs/snapshots, scenario/grader/evidence binding, independent reviewer
attestation, unique interaction IDs, and after-state evidence for milestone as well as save writes.
Missing telemetry is invalid, not zero effort. Unreached native opportunities are excluded from the
adherence fraction and coverage is reported. A missing review stays pending, never successful.

Quality covers availability, accurate drafts, reported sending, deduplicated confirmation,
rescheduling, source-correct completion/advancement, additional information, terminal reconciliation,
stale-event restraint and preservation. Short acknowledgement is allowed; invented obligations,
redundant required replies, forged approvals/receipts and real sends fail applicable checks.
Checkpoints are boolean semantic judgments; quality fraction is descriptive and strict full pass
requires every criterion plus completed execution. The entire trajectory is one case, not twelve samples.

Report assigned onboarding/initiations, necessary user updates, observed answered questions,
separately reviewed unanswered demands, execution seconds, steps, simulated waiting and coverage.
No-action checkpoints count as successful outcomes. Failed checkpoints have null waiting, not zero.
Native adherence is separate from task quality; no reminder is injected if Lookout is omitted.

## Langfuse and execution

Detailed structural export uses `scripts/com2/langfuse.mjs`, with COM2-specific dataset/trace/score
identities, stage spans and root scores. Personal context, resume, message content and hidden
reasoning remain local. Pilots use `benchmark-pilot`; synthetic checks use `verification`.
The connected `langfuse` CLI / API snapshot 4.71.0 is reused, with `LANGFUSE_CLI` override.
The shared evaluation summary additionally uses `scripts/evals/contract.mjs` and its existing
Eval Overview dashboard; no competing cross-case score definitions are created.

```sh
node scripts/com2/langfuse.mjs --register --dry-run
# After independent scenario review, register metadata using the private environment:
node --env-file=<private-env> scripts/com2/langfuse.mjs --register --receipt-dir <private-receipts>
python3 scripts/com2/orchestrate.py --task-dir <private-root> --pair-id <unique-pair> --repeat 1 --pilot --langfuse-env <private-env> --receipt-dir <private-receipts>
```

The orchestrator runs conditions sequentially, then creates pending grades/review templates and
exports detailed structural results. It also saves an unreviewed common-summary record locally.
The common exporter binds an experiment item immutably, so **do not publish its pending summary**;
wait for independent review. Review a copy of the template, then:

```sh
python3 scripts/com2/grade.py --run <run> --scenario <private-root>/suite/scenario.json --review <review-copy> --output <new-grade.json>
node --env-file=<private-env> scripts/com2/langfuse.mjs --run <run> --grade <new-grade.json> --scenario <private-root>/suite/scenario.json --receipt-dir <private-receipts>
# Repeat the previous command with --verify after ingestion.
python3 scripts/com2/summary.py --run <run> --scenario <private-root>/suite/scenario.json --grade <new-grade.json> --campaign <campaign-id> --output <new-summary.json>
node --env-file=<private-env> scripts/evals/langfuse.mjs --record <new-summary.json> --dry-run
node --env-file=<private-env> scripts/evals/langfuse.mjs --record <new-summary.json> --receipt-dir <shared-receipts>
# Repeat the shared-export command with --verify after ingestion.
```

Both exporters fail explicitly on partial ingestion/read-back problems; repair reporting without
rerunning participants. Root review and a dedicated-account preflight are required before COM2
participants. No live COM2 registration, participant inference or database reset is claimed here.

## Verification and demo boundary

Focused synthetic tests cover staged actor facts, matched evidence binding, missing logs, review
version mismatch, native after-state requirements, duplicate interaction counts, no-action rubric,
shared-summary validation, pilot/synthetic routing and private-content exclusion. The fixtures are
fictional, local and never participant results. This evaluation-only pass changes no product UI,
MCP authority or database schema; fictional COM2 fixtures provide its isolated demo coverage.
