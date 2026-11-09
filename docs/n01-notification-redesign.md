# COM1: networking across sessions — stream v2

## Research intent and onboarding

Compare required user interactions, completion time, and outcome quality for an ongoing networking workflow. Lookout adherence is a separate dimension. This is a prospective redesign, not a regrade of COM1 v6 or stream v1 or evidence of superiority.

Both conditions use Terra `gpt-5.6-terra`, medium reasoning, the same complete initial context and resume, fixed fictional networking evidence, and sequential isolated container sessions. Neither receives a standing career-goal prompt. The baseline receives all non-resume context in the first user message. The harness never mounts a profile file, creates a baseline state file, or replays onboarding in fresh sessions. The baseline may choose to save notes. Resume remains accessible. Lookout receives the same first message and its cloned native context; its records are not required to be mirrored to local files.

The controlled host configuration enables scheduled networking checks with read/prepare/save permission only. A wake says to review available updates; it supplies no event-specific next action. This is an explicit experimental host configuration, **not a claim that a real connected account currently has an enabled schedule**. Neither condition can send or submit. Actual time passing is simulated.

## Notification and interaction stream

| Stage | Shared information | Lookout receives | Non-Lookout receives |
| --- | --- | --- | --- |
| Onboarding | Resume, full background, interests, contacts, commitments, permissions | Initial message and equivalent native onboarding context | Resume plus all non-resume context in first message; no harness-created profile |
| Upcoming conversations | Dana/inference and Ivo/platform meetings, contact details and evidence | Calendar and simulated scheduled wake | “Help me prepare for my conversations with Dana and Ivo.” |
| Initial reaction | Emerging preference | “Talking to Dana made me realize I enjoy systems ownership more than model experimentation. I am curious about platform teams, but have not decided yet.” | Same message |
| Contact reply | Ivo's email offering to check potential platform fit; no referral promise | Email during scheduled wake | Same email plus “Help me assess this and draft a reply.” |
| Confirmed preference | Direction decision | “After speaking with Ivo too, platform engineering is now my primary focus. Keep inference infrastructure secondary, and keep existing conversations going.” | Same message |
| Later developments | Platform introduction offer and inference conversation opportunity | Notifications and wake in fresh session | Same evidence plus “Review these updates and help me with the next steps.” |
| Duplicate delivery | Same email with identical message ID | Notification and wake in fresh session | “This notification appeared again. Check whether anything else is needed.” |
| Grading | Same semantic outcome criteria | Quality, time, interaction counts and native adherence | Quality, time and interaction counts; assigned initiation reported separately |

The initial reaction resumes the preparation session. All other stages start fresh sessions. Seven turns have fixed budgets of 180/300/300/300/300/300/180 seconds. Contacts/events in this scenario are controlled fiction. Calendar/inbox tools expose only currently released evidence. Saved agent-created records remain available across sessions; future packets and rubric never enter participant containers.

## Telemetry and independent grading

The orchestrator records timestamped observable Codex events, original prompts privately, delivery receipts, native MCP requests/responses, controlled user interactions, stage durations/statuses, native before/after snapshots and output snapshots. Hidden reasoning is excluded. No model generations, token allocations, API costs or human effort minutes are invented from subscription logs.

Both agents can use `ask_user`. A fixed actor answers permissions/background questions and restates already-released preferences or contact facts. It otherwise says no additional information is available. It never volunteers reminders or supplies future preferences. Every answer adds five simulated minutes; it does not make the process sleep. Unanswered questions in final prose and other interaction demands require independent review, so a silent agent is not automatically declared effort-free. The actor is intentionally limited, not a validated model of real human behavior.

Metrics:

- Assigned onboarding, assigned initiation, and necessary user updates are separate counts.
- Observed question turns plus independently reviewed additional interaction demands. Never double-count an `ask_user` exchange in the additional list; categories are clarification, context restatement, correction, reminder, approval.
- Actual execution seconds, observable tool/command/file steps, and simulated waiting minutes. Both trigger delays are zero; simulated latency measures protocol assumptions plus answer delays, not measured human response time. Failed checkpoints have null waiting values, never zero; every stage exports reached/success indicators so failed cases remain visible.
- Eight semantic quality checks: initial context, preparation, tentative preference, reply, confirmed preference, follow-through, duplicate handling and preservation. Completed execution alone is not successful completion. Accept equivalent saved representations and grounded prose; do not grade exact field placement or exact wording.
- Six adherence checks: fresh context retrieval, tentative reaction saved, reply saved, confirmed preference saved, follow-through saved, duplicate checked. Classification: used correctly, attempted but failed, omitted, not applicable; successful calls stay pending review until the saved outcome is verified. Unreached opportunities are reported separately and excluded from adherence fraction; coverage is always reported. Baseline adherence is not applicable and excluded from an adherence fraction.

The local deterministic grader validates terminal status, counts observations, matches expected tool opportunities, validates stage completeness and checkpoint-specific evidence references, and binds review to evidence, scenario and grader versions. Missing logs invalidate grading instead of becoming zero effort. Semantic criteria and native outcome correctness require an independent reviewer with cited local files. No paid LLM judge is invoked. A missing review produces `pending_review` with no quality score. Review all checkpoints, preservation and visible user questions; missing stages cannot earn credit. Review is external to participants and must never be used to coach them mid-run.

No rescue, in-run repair, silent replacement or retry. Stop a failed condition, preserve artifacts, and still attempt its paired condition. Grade only after both have terminated. Reporting failures do not rerun participants. A rubric/scenario change requires a new prospective version and new registration; keep the old results.

## Run, review and export

The executable specification is `examples/n01/scenario.json`. Implementation is in `scripts/n01/`; frozen runtime-v4 and completed campaigns are unchanged.

1. `python3 scripts/n01/prepare.py --source <previous-isolated-COM1-root> --background <baseline-kit> --destination <new-private-root>` creates private inputs, shares the same account lock, and freezes inputs/executable files plus container image. It does not reset an account. Keep the executable checkout available for the freeze lifetime.
2. `python3 scripts/n01/preflight.py --task-dir <new-private-root> --output <new-private-receipt-directory>` checks subscription login, container isolation and actual tool schemas, without inference, resets or domain writes.
3. `node --env-file=<private-env> scripts/n01/langfuse.mjs --register --receipt-dir <private-receipts>` registers only checkpoint metadata, boolean rubric keys and policy. Detailed prompts, names, preferences, profiles, resumes and hashes of personal evidence are not in the dataset registration. Registration is already done for this version in the connected project.
4. `python3 scripts/n01/orchestrate.py --task-dir <new-private-root> --pair-id <unique-pair> --repeat 1 --pilot --langfuse-env <private-env> --receipt-dir <private-receipts>` executes the pair, then creates pending grades and review templates and exports structural results. Drop `--pilot` only for a frozen measured campaign. The pinned CLI is `langfuse-cli@1.3.1` (API schema 4.71.0); `LANGFUSE_CLI` can identify an installed executable. Secrets remain on the orchestrator host.
5. Complete a copy of each `review-template.json`; do not overwrite the template or source evidence. `python3 scripts/n01/grade.py --run <run> --scenario <private-root>/suite/scenario.json --review <review-copy> --output <new-grade.json>` rejects incomplete/stale review. Keep evaluator identity and evidence citations.
6. Export with `node --env-file=<private-env> scripts/n01/langfuse.mjs --run <run> --grade <new-grade.json> --receipt-dir <private-receipts>`. Add `--verify` to read back observations, experiment and scores. `--dry-run` builds mapping offline. Read-back failure is explicit, including ingestion delay; never relaunch a participant to fix telemetry.

A whole trajectory is one dataset item and one trace. Each condition/repetition/pair gets a separate experiment; stages are child agent spans and observable events are nested below them. Scores attach to the trajectory root. Stable IDs and original timestamps support retries of reporting, but partial ingestion is an error. Local export receipts are per project. Personal content stays local; run exports contain structural metrics and run identifiers, without profiles, message bodies or personal evidence hashes. Evidence hashes are checked locally. The existing historical exporter remains separate.

Synthetic verification uses `environment=verification`, `pilot=true`, `synthetic=true`, model `fixture-no-model`. It is not a participant result and must be excluded from measured comparisons. Product UI/demo, production database and live external communications are unchanged.

## Verification evidence

Focused Python and Node tests cover prompt visibility, baseline/native separation, pending review, omissions, successful-call-with-wrong-outcome, timeout, stale evidence, review path escape, question counts, trajectory grouping, root scores, deterministic IDs, private-content exclusion and partial-ingestion failures. The fictional no-model fixture exercises both export conditions without spending model tokens.

Live read-back status and actual preflight receipts are reported in the change note. A live telemetry smoke test is not an end-to-end participant benchmark. Semantic grading remains manual by design; no automatic semantic judge or paid API has been configured.

## Grading audit corrections (v2)

Review templates default independence to false; the reviewer must explicitly attest independence. Completed runs require all seven terminal stage receipts and required logs/snapshots. Quality passes require the matching stage output/trace/state evidence; a manifest alone is insufficient. Native writes additionally require the corresponding after-state snapshot. Reviews cannot pass unreached/incomplete checkpoints. Missing telemetry is an invalid grading result, not a participant omission.

Captured question IDs are source-file line references. Additional unanswered demands must identify unique completed agent-message lines, explicitly exclude duplicates of captured questions, and are reported separately from answered exchanges. Reusing an interaction ID is rejected. Human semantic judgment is still required to detect paraphrased duplicate questions.

Waiting time is explicitly labelled simulated waiting, not task-completion time. Stage success and reached coverage accompany exported waiting metrics. Stage-specific native logs and user-actor answers now follow the active turn even when a session resumes.

## Case names and prospective storage guidance

COM1 is the former N01 networking continuity case. COM2 covers application-stage communication; COM3 is the planned post-application connection discovery case. Historical N01 runs remain unchanged. The existing scripts/n01 and examples/n01 paths remain compatibility entry points.

COM1-stream-v3 adds condition-specific storage orientation to every turn, including every fresh session. Lookout is explicitly instructed to retrieve and save relevant recruiting state through its tools; baseline may retain files across sessions. No standing career goal or event-specific answer is added. Native adherence is a usage diagnostic, separate from quality, user interactions and time. The quality rubric is unchanged; the earlier onboarding-observability and draft-history interpretation limitations remain and this rerun is a pilot.
