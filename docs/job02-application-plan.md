# JOB02 plan: application drafting and live form filling

Status: design plan; implementation, target selection and preflight pending.

## Research question

Does Lookout reduce time and required user interactions when preparing an accurate
application and filling a live form across sessions, while maintaining writing
quality and respecting the stop-before-submit instruction?

## Scope

Use one preselected job and the same live application form for both conditions.
Discovery and job selection belong to JOB01. Complete the initial golden path
before adding preference changes, multiple applications or difficult ATS recovery.

Reuse the COM1/JOB01 candidate profile, resume and controlled user actor. Freeze the
same starting career and writing preferences for both conditions. Do not make JOB02
depend on either participant's JOB01 performance or inherit unequal run outcomes.
Lookout uses an isolated native account; baseline gets complete context in its
first message and may save persistent notes. Both retain their saved state across
fresh sessions without automatic onboarding replay.

## Two-session flow

| Stage | Shared task/evidence | Lookout | Baseline |
| --- | --- | --- | --- |
| Prepare | Selected job, canonical application URL, resume, candidate facts, writing preferences; prepare and fill, stopping before Submit | Normal task request and standard native retrieval/save orientation. Drafting follows the existing application workflow; no separate draft-generation prompt. | Equivalent task request plus first-message personal context; files may persist. |
| Continue in a fresh session | Same target and current live form; same prior permissions | Recorded scheduled continuation with relevant native state available. | Prescribed request to continue the application, using retained files. |
| Finish | Form filled to the permitted stopping point; application answers/draft and genuine blockers saved | Native records plus browser evidence | Saved files plus equivalent browser evidence |

The session boundary occurs after the fixed preparation turn, not after a
coordinator decides the work is good enough. Agents may inspect the live form
while drafting. Both have equivalent browser capabilities, network access, timing
and fixed user-response facts; Lookout additionally has its native workspace.
Neither receives hidden answer keys or in-run coaching.

## Target and live evidence

Select an accessible native Greenhouse, Ashby or Lever form compatible with the
current preparation tools. It should contain factual fields, resume upload and at
least one substantive written response so both filling and writing can be graded.
Exclude login, CAPTCHA and Workday/company-site handoffs from this first golden
path; current product guidance hands those back to the user.

Before freezing, inspect the actual form, its conditional questions and upload
behavior. Confirm that filling/uploading does not create an application or send
an employer notification before Submit. Freeze the job description, initial form
structure and field-level reference answers with provenance. Preserve uncertainty
in conflicting graduation facts or unknown eligibility; ask the controlled actor
when needed rather than inventing answers.

Capture the form actually seen by each participant and final visible values,
selected choices, uploaded-file evidence and validation errors. Grade against
that live evidence. If the form changes between conditions, retain both records
and mark comparability limits; do not silently substitute a fixture or another job.

## Completion and grading

Completion means supported fields are accurately filled, substantive answers are
saved, and genuine unresolved requirements are identified. Submit is never clicked;
no approval to submit or submission receipt is required. Partial completion and
access failures remain visible outcomes.

Use one fresh final grading agent for both conditions after execution, following
the JOB01 assignment and evidence-binding pattern. The grader did not implement,
operate or participate in either run. Native read-only confirmation uses only the
dedicated test account and remains outside participant metrics. Baseline saved
files receive equivalent outcome checks.

| Dimension | Evidence and measure |
| --- | --- |
| Time to task | Actual preparation/filling execution duration; separately report fixed simulated wake/user-response delays. |
| Effort to task | Unique observed user interaction turns; prescribed initiations separate; overlapping categories only as breakdowns. |
| Quality of completion | Correct live field values and resume; grounded written answers; saved writing preferences applied; no invented facts; accurate blockers and stopping state. Report field accuracy and substantive writing quality separately. |

Use frozen 0/1/2 anchors for semantic writing judgments. Include concrete checks
for the candidate's style, factual support, role relevance and compliance with form
length limits. Missing evidence cannot become a pass. Report Lookout tool adherence
separately from quality; successful calls alone do not establish correct saves.

## Implementation sequence

1. Select and inspect the shared target; confirm supported browser paths for both
   conditions and validate the no-submit boundary, including resume upload.
2. Freeze scenario, candidate context, field reference, actor facts, session budgets,
   event/response timing, grader instructions and runtime versions. Register a
   prospective JOB02 Langfuse item using the existing time/effort/quality contract.
3. Add isolated two-session execution, browser/form evidence capture and separate
   native confirmation. Reuse proven host components without modifying JOB01's
   active frozen checkout or accounts. Test any new browser-capture boundaries.
4. Preflight both conditions without filling a real application. Verify synthetic
   telemetry and final-grader handoff; then run one explicitly authorized paired
   pilot. Preserve timeouts, failures and setup errors; no silent retries or rescue.

Ready-to-run gate: shared target and browser support verified; equivalent inputs,
fixed actor/timing and independent grader instructions frozen; preflight passed;
submission control unavailable or guarded with a verified stop boundary. This plan
alone does not establish readiness or authorize a JOB02 application run.
