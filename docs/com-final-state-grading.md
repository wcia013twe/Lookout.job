# COM1–COM4 final saved-state verification

Prospective contract, adopted after COM1-stream-v3. Historical runs retain their frozen prompts and grades. COM2 implementation and COM3/COM4 designs must reference this contract; implementation readiness is reported separately.

## Participant final reconciliation

Both conditions receive a final user request: “Review your saved workspace and tell me where things stand: what has happened, what remains pending, what drafts or next steps are saved, and anything that still needs my input. Distinguish completed actions from drafts or plans, and say if relevant information has not been saved.”

Lookout environment guidance directs the participant to retrieve its relevant native records before answering and reconcile discrepancies using supported scoped tools. Baseline guidance directs it to read its persistent files. Neither receives rubric details, expected answers, future facts or a reminder of missing task-specific facts. Correct material updates may be saved within this normal final turn; do not force redundant writes. Cite saved records/files where available. A final report is a claim to verify, not evidence that persistence occurred.

## Independent review after execution

1. Harness captures passive before/after snapshots throughout both trajectories; no semantic grading or feedback during execution.
2. After the participant terminates, capture final files and read-only native lookup receipts before resetting/reusing the account. The grader may use scoped Lookout lookup tools for contacts, applications, company workspaces and relevant personal context. Never expose write credentials or grant grader write authority.
3. Bind receipt to run ID, isolated owner, capture time, tool/query, result and record revisions where available. Keep full contents locally. A live read of an account changed by another run is not evidence for the earlier run; use its frozen terminal capture.
4. Independently compare released facts, final stored state and final report. Inspect earlier snapshots afterward for temporal accuracy and history. Later corrections cannot erase earlier unsafe actions; legitimate revisions need not preserve every superseded draft verbatim unless the scenario explicitly requires history.
5. Baseline gets equivalent final-file inspection and checkpoint snapshots. Chat-only output does not satisfy a required durable outcome in either condition.

## Required final checks

- **State accuracy:** people, preferences, commitments, dates, status, uncertainty and provenance agree with released evidence.
- **Continuity:** material decisions/outstanding work remain accessible across sessions; unrelated facts and explicit boundaries are preserved.
- **Report fidelity:** claims of saved work match actual stored records; drafts, user-reported actions and independently confirmed events are distinguished; unsaved or unverifiable work is honestly identified.
- **Resolution:** fulfilled obligations are resolved and duplicates do not recreate them; no invented progression or permissions.

Missing required capture invalidates that verification rather than becoming an assumed participant failure or success. An unavailable optional live lookup is explicitly reported; a complete bound terminal snapshot can still support review. Case-specific rubric defines required fields semantically, not exact prose. Native-tool usage stays diagnostic; factual outcome criteria apply equally to baseline notes.

## Case mapping

| Case | Terminal records to verify |
|---|---|
| COM1 | Latest confirmed preferences, relationship history, current drafts and next steps |
| COM2 | Application milestones, sourced communications, rescheduling/supersession, unresolved replies and terminal state |
| COM3 | Source-backed candidate assessment, contact limits, referral boundaries, unsent drafts and application provenance |
| COM4 | Introduction commitment, responsible party, promised timing, linked conversation and fulfilled/remaining obligations |

Version prompts, scenario, grader and evidence bindings prospectively. Publish only structural metrics to Langfuse; raw profile, messages, records and evidence remain local. Report quality, observed effort, execution time and native usage separately.

## Prospective COM01/COM02 outcome study

COM1-stream-v9 / COM1-grade-v8 and COM2-stream-v8 / COM2-grade-v7 retain
checkpoint diagnostics but score **eight and thirteen primary user outcomes**.
The frozen `qualityGroups` partition includes each checkpoint exactly once.
COM01 groups initial context, preservation and final factual reporting into one
source-fidelity outcome; COM02 groups closure and final state/report into one
closure outcome. All checks in a group must pass. The root `quality_fraction`
and common-summary quality use groups; `checkpoint_quality_fraction` is diagnostic.
Groups are scoring units, not independent errors or statistically independent tasks.
No historical grades, scenarios or exports are recalculated.

Fail a reached checkpoint only with a concrete, cited `userImpact`: wrong current
advice, a misleading current view, lost obligation, unusable draft, false claim or
violated boundary. Raw historical rows, superseded events and different storage
layouts are insufficient alone. Equivalent baseline files and native records are
accepted. A cancelled appointment still presented as the current next action is
a failure; an accurately archived invitation is not. COM02 terminal capture also
reads `read_application_timeline` using the existing workspace-read-only credential;
lookup failures remain explicit limitations. Cross-check effective records and the
report, rather than requiring every database field to be rewritten. Unreached or
unverifiable work is not an observed user error. A failing outcome does not identify
whether model behavior, product, harness or design caused it.

Sam's COM01 fixture now explicitly separates the reported conversation from an
unsent thank-you draft, in both initial native state and onboarding. A conflicting
profile/resume fact must remain uncertain unless released evidence resolves it;
no grader may silently prefer one date or penalize acknowledged uncertainty.

The question is **prompted communication continuity with Lookout versus persistent
files using the same model**, not proactive assistance, actual human-effort savings,
real-world hiring outcomes or dollar cost. Prescribed prompts, actual interaction
demands, execution time, tokens and native adherence remain separate measures.

Before collecting a new series, freeze four pairs per case: `--repeat 1` through
`--repeat 4` under one campaign, using fresh prepared roots and dedicated owners.
COM02 and COM03 reuse one owner-scoped fixture-ID helper so fresh accounts do not
collide on globally unique application IDs. Odd pairs run baseline first; even
pairs run Lookout first (two of each). Existing
orchestrators now share a cross-checkout pair lock and reject overlapping revised
COM01/COM02 execution. Run the series sequentially, avoid other benchmark workloads,
retain every failure, and do not stop/retry for favorable scores. The lock cannot
control unrelated host/provider load. Four pairs are a small counterbalanced pilot,
not a power calculation or permission to claim a statistical winner. Report each
paired result and its order, not just a pooled checkpoint total. Scheduled/proactive
benefits need a separately specified study; none is launched by this revision.
