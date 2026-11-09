# COM3: Appropriate connections after applying

**6 sessions; 10 staged interactions per condition.** Implemented as COM3-stream-v1; fixed-corpus search approved. One interaction here means one released participant turn, not a measured unit of human effort.

## Intent and initial state

Find defensible professional connections for an already-submitted application, preserve relationship boundaries and revise the next step across sessions. COM1 tests changing networking preferences; COM2 tests application communication/status; COM3 tests connection discovery and selection. Networking is not assumed to produce a referral, interview or hiring advance.

Use fictional Linden Search, Early-Career Engineer — Retrieval Platform, LS-417. User-reported submission is yesterday; status Submitted has no employer-confirmed receipt. Relevant existing profile evidence includes internship retrieval/reranking/evaluation, database query optimization, and a Rust/versioned-storage project. Do not infer production ownership of large-scale search systems, referral entitlement, or relationships with fictional employees. The complete actual resume/profile stays private and identical across conditions.

Initial fictional people: Maya Chen, former class-project collaborator now at Linden, with no referral promise; Evan Cole, former Linden employee with an explicit no-recruiting-outreach boundary; one unrelated contact/application sentinel. No sends, forms/submission, interview prep or coaching. Neither condition gets a standing-goal prompt. The Lookout host configuration must explicitly authorize scheduled read/research/prepare/save networking reviews for relevant applications; saving an application alone does not create that authority.

Baseline gets complete non-resume context once in readable onboarding, accessible resume and optional self-created notes. Lookout gets informationally equivalent native context and the same message. Condition storage orientation follows COM1-stream-v3. Future facts, rubric and reference labels remain hidden.

## Notification stream

| Turn / session | Released information | Lookout | Baseline | Required behavior |
| --- | --- | --- | --- | --- |
| 1 / onboarding | Full context, resume, reported LS-417 submission and relationship boundaries | Onboarding and native context | Same onboarding | Preserve provenance and supplied facts; acknowledgement is sufficient |
| 2 / discovery | Scheduled review of existing application; initial source corpus | Generic configured networking wake | “I applied to LS-417. Find suitable people I could contact and help me choose a useful next step.” | Search, assess current role/team/relationship evidence, save defensible options or uncertainty |
| 3 / discovery | “Maya and I worked on a class project. We haven’t discussed referrals. I’d rather reconnect without immediately asking for one.” | Same message | Same message | Respect relationship strength and tactful ask; no invented hiring-team link |
| 4 / evidence update | Company newsletter links current retrieval-infrastructure team page; older candidate profile is outdated; new sources released | Generic wake; newsletter accessible | “Check whether these team updates change who I should contact.” | Reconcile source dates/authority; revise or retain choices with supported reasoning |
| 5 / reconnection | User independently reports sending Maya a specific exact frozen message about understanding the company | Same user report including exact text | Same message | Record only that reported send, not “your draft” or another person's outreach |
| 6 / reconnection | Maya: “I’m not on that team. I can share what working here is like, but I can’t offer a referral.” | Generic wake; email | “Help me decide how to respond to Maya.” | Preserve referral boundary and informational value; suitable reply or respectful closure |
| 7 / focused discovery | “One additional person is enough. I want to understand the team’s work. Don’t ask anyone to push my application.” | Same message | Same message | Apply contact cap and informational intent |
| 8 / focused discovery | Engineering newsletter links a talk on segment compaction/retrieval evaluation; two defensible current contacts become discoverable | Generic wake; newsletter and sources | “Find one suitable person for that conversation and draft a short message.” | At most one additional appropriate target; specific supported technical reason and one clear ask |
| 9 / reconciliation | Duplicate Maya reply, identical message ID; role stops accepting applications but does not decide existing applicants | One wake, both notices | “Review these updates and tell me whether our networking plan should change.” | No duplicate task or inferred rejection; assess continued informational value |
| 10 / reconciliation | Shared final saved-state reconciliation request | Retrieve native records then report | Read persistent files then report | Report what happened, pending work, saved drafts/next steps and missing input; distinguish completed/draft/unsaved |

Five shared user messages: turns 1/3/5/7/10. Five review activations: 2/4/6/8/9. Lookout has five scheduled wakes and zero prescribed initiation prompts; baseline has five prescribed initiations. Both have five raw external notifications, including one duplicate; the first review has no new external notification. Agent-requested questions/answers are additional observed interactions, unknown before execution. Do not count forwarding a notification and its accompanying request as two user turns.

Use frozen origin plus minute offsets for an explicit ordinary business clock in every prompt, identical across conditions. The container wall date is not the workflow date. Validate source dates against that clock before freezing.

## Search evidence — approved fixed corpus

Implemented reproducible v1: 30 frozen fictional documents, deterministic ordinary text search and full-source reads, identically accessible to both conditions. Include role/team pages, current/archived profiles, alumni directories, technical work, plausible alternatives and distractors. No relevance labels, answer lists or private rubric in visible sources. Later documents must be inaccessible even when an ID is guessed.

Shared tools: search_sources(query,cursor) returns source ID/title/snippet/date/next cursor; read_source(sourceId) returns the full released source/provenance. Log query, returned IDs and read IDs. Freeze sources, ranking implementation and release schedule. Existing COM1 runner disables web search; it cannot establish discovery without new shared source tools.

This is controlled-corpus discovery, not measured open-web coverage. Live search is outside this version.

Private independently reviewed reference must accept multiple supported candidates. For example, a current retrieval-infrastructure engineer with a relevant public talk and an engineer working on retrieval evaluation can both be valid. A prestigious but irrelevant employee, obsolete affiliation, unverified identity or opted-out person is not equivalent. No exact candidate ID is universally required. Zero contacts can pass when evidence genuinely lacks an appropriate route; add a separate no-eligible-match variant instead of rewarding skipped discovery in a corpus with strong matches.

## Outcomes and grading

Durable outcomes: source-backed contact assessment; relationship/team uncertainty; Maya conversation/referral boundary; current one-additional-contact limit; accurate unsent draft or justified abstention; current next steps; preserved application provenance and unrelated records. Use supported existing contact/application associations, not employer-name guessing.

Checkpoint criteria: discovery adequacy, defensible selection, accurate personalization, evidence/user-update adaptation, relationship boundaries, cross-session continuity, duplicate/closed-intake restraint and final usefulness. Accept equivalent saved representations, not exact prose/field placement. Preserve material provenance/history, not every superseded draft verbatim. A final repair cannot replace evidence of earlier correct continuity.

Apply [the shared final saved-state contract](com-final-state-grading.md): passive checkpoint snapshots during execution, semantic review only after termination, read-only owner/run/time-bound native lookup before reset, baseline-equivalent final file capture. Final report must agree with stored state; report alone is not persistence proof. Durable criteria require actual record/file evidence. Missing required capture is unverified/invalid, not assumed success or participant failure. Optional live lookup failure may use complete bound terminal snapshots with an explicit limitation. Grader receives only read authority. No mid-run feedback or rescue.

Native adherence separately: retrieve contacts/company/application/context; save meaningful contact/source/draft changes using save_contact and supported company workspace writers; merge application:<id> association without erasing existing tags. Do not require save_outreach_package, which needs a queued request. No redundant write for duplicates. Verify actual deployed schemas plus isolated writer/readback smoke before freezing; source contracts alone are not runtime proof.

Adversarial failures: claiming Maya promised a referral; targeting opted-out Evan or applying hiring pressure after turn 7; marking Rejected from closed intake or recreating old Maya work after duplicate delivery. Such failures remain even if the final report looks polished.

## Actor, budgets and telemetry

Actor answers only released facts/background, never future sources/candidates/preferences or strategic hints. Sending stays prohibited. Missing facts remain uncertain. Restatements and necessary clarifications are categorized separately; a precise legitimate waiting blocker may pass an interim checkpoint. Five simulated minutes per answer is a protocol assumption, not human time measured.

Both use subscription gpt-5.6-terra, medium. Turn 1 and 10 have 180 seconds; all other turns 300, total 2,760 seconds per condition. Proposed discovery limit 30 search/read calls per session, equal for both; fix after pilot before measured runs. No silent retries/extensions, participant subagents, hidden assistance or future-input leakage. Six fresh sessions retain self-saved/native state, with no automatic onboarding replay.

Whole trajectory is one dataset item; version COM3-stream-v1, COM3-grade-v1, COM3-harness-v1. Use shared eval_v1 summary identity/scores, structural detailed turn/tool telemetry and local private evidence. Shared wakesUsed must be documented as attempted participant turns; separately report actual scheduled wakes and assigned baseline initiations. No raw profile/resume/messages/records or hidden reasoning exported. Pending common summaries stay local until independent final review because shared result bindings are immutable. Compare actual active seconds separately from simulated waiting and quality/coverage; ten turns are not ten independent cases.

Before execution: settle search mode, review corpus/reference if chosen, implement release-gated tools, provision dedicated isolated owner, verify native reads/writer roundtrips/restoration and graded terminal capture, pilot without rescue, then freeze prospective measured inputs/rubric.

## Implemented setup — COM3-stream-v1

Six sessions; ten released interactions. The implementation uses the agreed controlled corpus: 30 searchable documents, with later versions released only at their assigned turns. Key role/team/talk documents contain substantive technical detail; source URLs resolve through read_source. This measures discovery and reconstruction within a bounded public-source corpus, not live-web recall. Both conditions have the same search/read allowance, 30 combined calls per fresh session.

Released emails persist for both conditions, deduplicated by immutable message ID. Current notification IDs and historical deliveries remain separate; no future documents or previous user prompts are injected. Both receive the same authoritative business clock. Terminal lookup uses a separate read-only credential; pre-final capture is passive snapshots/files only. Independent grading compares pre-final continuity against terminal reconciliation and requires durable record/file evidence at saved-work checkpoints. No participant execution occurs during readiness.

Implementation: scripts/com3 (isolated adaptation), examples/com3 (fixture/scenario/corpus). prepare.py verifies source/native/onboarding parity. writer_smoke.py validates contact, artifact, complete company-record payloads and their reads against the actual local bridge, then restores the owner. preflight.py is separately read-only. The first company smoke intentionally failed loudly on an incomplete payload; the corrected complete schema passed, and both attempts restored fixtures.

Validation: 11 search/release/actor/credential/telemetry boundary regressions and catalog validation pass; Python compilation passes. Semantic grading still requires an independent reviewer. No claim of participant performance or automatic semantic-judge validation is made.

Readiness receipts (private experiment-control directory): `com3-ready-v1` frozen inputs, `com3-preflight-v1` read-only bridge/container verification, `com3-writer-smoke-v2` successful write/read/restore receipt, `com3-langfuse-v1` prospective dataset registration and readback. Dataset: Lookout-COM3-stream-v1. No participant has run.
