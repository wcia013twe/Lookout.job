# JOB01/JOB02 controlled pilot results

Both controlled comparisons historically cleared their declared harness audits. A
supplemental investigation below identifies a missing setup prerequisite that those
audits missed; native-workflow comparisons need that qualification. Clearance does
not certify Lookout functionality or a general winner.
Both used the pinned subscription-backed Terra medium executor, matched task intent,
frozen evidence, fresh sessions and independent post-pair grading. No participant
coaching, in-run repair, silent retry, model substitution or application submission occurred.

| Observation | Baseline | Lookout |
| --- | --- | --- |
| JOB01 returned exact targets, initial → final | 8/10 → 9/10 | 4/10 → 7/10 |
| JOB01 active execution | 607.84 s; final stage timed out | 657.15 s; process completed |
| JOB01 observed additional response demands | 4 | 3 |
| JOB02 required final saved-work outcomes | Met on all three controlled targets | Met on all three controlled targets |
| JOB02 active execution | 168.32 s | 449.25 s |
| JOB02 container startup, separate | 3.93 s | 2.81 s |
| JOB02 condition wall duration | 176.26 s | 455.49 s |
| JOB02 observed question turns | 1 | 1 |
| JOB02 reported input tokens (cached subset) | 539,215 (481,536) | 2,743,461 (2,583,552) |
| JOB02 reported output tokens | 5,692 | 15,997 |

JOB01 quality includes applying and saving career/style changes, analysis, suitable
selections and continuity. Both saved returned work, but both had final format or
continuity gaps. Lookout did not save the career decision at its checkpoint; it saved
it later. Baseline's final timeout is retained, including work saved before timeout.
Target recall and durable saving are separate criteria.

JOB02 quality uses equivalent durable-file/native-record standards. Both accurately
filled the supported controlled forms, incorporated the supplied personal answer,
preserved the manual handoff and stopped before Submit. Both met the frozen outcome
rubric (1.00); this is not a usefulness or live-employer assessment.
**Lookout's native workflow did not pass:** context retrieval was used correctly,
but six persistence/card/response/verification adherence checks were attempted and
failed. Final quality was achieved through durable workspace files. The six failed
native draft requests used current job and owned résumé IDs; the generic native error
leaves its precise cause uncertain. Older account/résumé metadata in baseline prose
is retained as fixture hygiene debt; the actual requests used current IDs. Do not
turn outcome quality into a claim that native cards or application records worked.

Each condition received four prescribed JOB01 turns (two initiations, two updates)
and two prescribed JOB02 initiations. These are scripted counts, separate from the
observed demands above. Proactive user-effort savings were not tested. JOB01's later
release is at simulated minute 2880; JOB02 has 1445 fixed simulated waiting minutes.
These schedule parameters are separate from actual execution and human effort.

JOB02 token coverage is complete for both sessions in both conditions. JOB01 baseline
coverage is only three of four stages; its full token total is unknown. Dollar costs,
subscription allocation, unmetered product processing and billed totals remain unknown.
Cached tokens are a subset of input tokens, not extra tokens to add. Native discovery,
reads, writes, failures and verification remain real participant costs; independent
terminal confirmation and grading are excluded from participant execution metrics.

## Retained evidence and limits

- JOB01: `/Volumes/External SSD/Lookout/tmp/job01-controlled-v5-20261109-1`.
  `receipts/clearance.json`, `grading/final.json`, `grading/reviewer-summary.md` and
  the retained diagnostic correction/read-back receipts bind the result. Eight wrapped
  context/guide reads were reclassified from frozen events; totals and semantic ratings
  did not change. Original source, exports and correction receipts remain available.
- JOB02: `/Volumes/External SSD/Lookout/tmp/job02-controlled-clearing-v3-20261109-1`.
  `receipts/clearance.json`, `grading/final.json`, `grading/validity-review.json`,
  `grading/native-id-validity-audit.json` and both Langfuse read-backs bind the result.
  Independent review verified 84 source/input bindings and 80 participant artifacts;
  native terminal confirmation succeeded. Setup reviewer and final grader are separate.
- JOB02 v1/v2 remain invalid comparisons with raw evidence retained and comparative
  quality/task-success exports withheld. New v3 setup corrected actor fact release,
  application-specific email authority and ownership/storage prerequisites prospectively.
- Both are single, unblinded controlled pilots. JOB02 uses intercepted fictional forms;
  live Workday/Greenhouse controls, CAPTCHA, upload and autosave remain separate blockers.
  No live employer application readiness, submission or broad causal advantage is established.

See [JOB01 design](job01-job-search.md), [JOB02 design](job02-application-plan.md)
and [shared harness boundaries](../scripts/evals/README.md).


## Supplemental canonical-profile investigation

The retained JOB01 native search-context responses contain no profiles initially,
although its cloned personal preferences contain the active `general` profile.
The clone scripts copy legacy preferences but do not clone canonical
`search_documents`; matching personal-context settings therefore does not prove
that native search/application context is equivalent.

All six failed JOB02 draft requests selected `searchProfileId: general`. A read-only
check of its retained fictional owner found no canonical search documents, while
legacy preferences still contain `general`. The successful sacrificial lifecycle
probe omitted `searchProfileId`, so it did not exercise the failing prerequisite.
The unchanged prefill implementation rejects a selected profile absent from
canonical search context with P0002, before calling the draft writer. Offline replay
of the captured request reproduces that path; a fictional regression demonstrates
that supplying the canonical profile reaches the writer. This supports a concrete
fixture explanation for the native failures, rather than a demonstrated product
persistence defect. No historical owner, grade, clearance receipt or run was changed.
The live read is supplemental evidence, not a historical snapshot of an uncaptured
table; frozen clone source and JOB01 search reads provide the historical support.

JOB01 also retrieved personal context successfully and nevertheless called supplied
authorization, relocation, compensation and culture preferences unknown. Its career
update was saved late and its corrected output style did not survive continuation.
These remain observed context-application/continuity misses; the missing canonical
profile is a setup confound, and a single participant pair cannot isolate causality.

Before another comparison, prospectively clone/verify canonical profile documents
through a shared fixture helper and run the exact selected-profile lifecycle path.
Preserve original results, qualify their attribution, and avoid a participant rerun
until the prerequisite is verified. This investigation changes no product behavior.
