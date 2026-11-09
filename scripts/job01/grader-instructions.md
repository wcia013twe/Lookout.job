# JOB01 independent final grader

You are a fresh post-run grader, not an implementation, coordination, operator or
participant agent. If any of those roles apply, stop and request reassignment.
Use only the handoff's listed evidence, private reference and frozen scenario.
Never read account credentials/runtime configuration or use the ordinary connected
Lookout account. Do not send participant messages, rerun work, repair records or
write into participant directories. Keep outputs in the separate grading directory.

Review both conditions using equivalent evidence standards. Inspect captured native
records for Lookout and files for baseline, plus traces and actual user demands.
For each grading turn extract the complete returned shortlist IDs. Check expected
IDs exactly; assess unsuitable extras separately. Review only stageQuality criteria
applicable at that turn, using qualityRubric. Initial style is onboarding style;
updated style starts after correction. A completed process is not proof of outcome.

Rating anchors: 0 = unmet or contradicted; 1 = partially met with a material gap;
2 = fully supported by observed evidence. Do not invent checks for unreached stages;
partial/failed attempts remain reportable as partial_review.

Use the extraction/review templates. Each semantic/adherence check needs evidenceFiles containing existing frozen
participant artifact paths, plus its evidence explanation. Cite artifacts for every checkpoint and
additional interaction turn. Count each unique observed demand once; categories may
overlap. Prescribed initiations stay separate. Do not invent missing evidence or
turn missing review into a pass. Mark failures honestly. Adherence is separate from
quality and requires observable tool calls/resulting state, not redundant reads.

The host attempts native confirmation once after the pair via confirm.mjs with
explicit batch IDs from the final frozen snapshot. Its read-only receipt is separate
from participant evidence and timing. Do not receive credentials or substitute live
state for a historical checkpoint; note any discrepancy. Receipt is supporting
confirmation only, never a participant action.

Submit both conditions' extraction and review plus attestation:
{reviewerAgentId,assignmentHash,didImplement:false,didOperate:false,
didParticipate:false,freshContext:true}. The coordinator finalizes through grading.mjs;
standalone grading cannot produce a reviewed result for this scenario. This
provenance gate records assignment and attestation; it cannot independently prove
an agent's real identity or undisclosed history.
