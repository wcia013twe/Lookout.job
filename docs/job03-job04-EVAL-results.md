# JOB03/JOB04 EVAL-01–03 observations

Execution checkpoint: four pairs have accepted independent reviews; JOB04 EVAL-02
is environment-interrupted with a rejected grader submission, and EVAL-03 is running.
Historical pilots and diagnostic attempts remain separate. This document is not a
claim of a general product advantage or disadvantage.

Each case has three scheduled pairs in AB/BA/AB order (A=baseline, B=Lookout).
Participants and independent graders use subscription gpt-5.6-terra, medium.
There are no participant retries, replacement trials, grader retries or model substitutions.
JOB03 EVAL-01/02 retain their original deadlines. JOB03 EVAL-03 and all JOB04 pairs
use the prospectively frozen completion policy: healthy turns have no total limit.
Concurrent shared-host load remains a confound; keep those policy groups distinct.

## Accepted reviews and active time

| Pair | Baseline quality | Lookout quality | Baseline seconds | Lookout seconds |
| --- | --- | --- | --- | --- |
| JOB03-EVAL-01 | 0.954545 | 0.477273 | 320.628 | 1229.809 |
| JOB03-EVAL-02 | 0.954545 | 0.363636 | 302.372 | 1503.835 |
| JOB03-EVAL-03 | 0.795455 | 0.352273 | 330.916 | 1269.319 |
| JOB04-EVAL-01 | dimension ratings | dimension ratings | 445.493 | 1281.450 |

All six JOB03 condition reviews have strictPass=false. Completion is not a quality pass.
JOB04 defines no overall quality/pass aggregate. In EVAL-01, five dimensions tied at 2/2
for both; generation decisions rated baseline 2 and Lookout 1.666667. Full criterion
ratings and native adherence stay in private grading/final.json.

Active time includes real in-turn native startup/discovery, reads, writes, failures
and participant verification. Container setup is retained separately; independent
terminal confirmation, fixture preflight and grading are separate harness work.
Unavailable participant timing stays unknown; native tool latency is not subtracted.

## Scripted inputs and interaction demands

| Pair | Scripted initiations per condition | Baseline additional turns | Lookout additional turns |
| --- | --- | --- | --- |
| JOB03-EVAL-01 | 7 | 1 | 2 |
| JOB03-EVAL-02 | 7 | 0 | 4 |
| JOB03-EVAL-03 | 7 | 1 | 5 |
| JOB04-EVAL-01 | 6 | 0 | 0 |

JOB03 has eight prescribed checkpoint packets; JOB04 has seven. Scripted initiations
and simulated notification/debrief schedules are not observed human effort. Additional
turns are independently reviewed participant response demands. Answers come from the
fixed fictional actor; real human time and proactive effort savings were not measured.

## Recorded usage

| Pair | Condition | Input tokens | Cached input subset | Output tokens |
| --- | --- | --- | --- | --- |
| JOB03-EVAL-01 | baseline | 808913 | 704256 | 9129 |
| JOB03-EVAL-01 | lookout | 7214856 | 6753792 | 39486 |
| JOB03-EVAL-02 | baseline | 721947 | 621312 | 9310 |
| JOB03-EVAL-02 | lookout | 8663058 | 8116992 | 49295 |
| JOB03-EVAL-03 | baseline | 849733 | 741632 | 9965 |
| JOB03-EVAL-03 | lookout | 7857909 | 7357952 | 43280 |
| JOB04-EVAL-01 | baseline | 728516 | 621312 | 15603 |
| JOB04-EVAL-01 | lookout | 8427321 | 7922944 | 44535 |

Usage coverage is complete for these eight reviewed condition runs. Cached input is
a subset of input. Dollar billing, subscription allocation and unmetered product
processing remain unknown; token totals are not invoices.

## Interrupted attempt and reporting

JOB04 EVAL-02 completed Lookout 1/7 and baseline 0/7 checkpoints before Docker start/create
failures and an explicit snapshot errno 28 disk-exhaustion error. Preserve its failed
and partial work. These receipts do not support participant-quality attribution.
Central recovery cleared build cache only; owned services are stopped and retained.
Its single fresh exact-model grader completed, but the unchanged submission used an
incorrect assignment hash and failed validation. No repaired attestation or regrade
is accepted. Quality and full active time remain unknown.

All four accepted pairs have sanitized common export readbacks verified. JOB04 EVAL-01
baseline required a delayed read-only check; original failed delivery receipts remain.
The interrupted pair has verified failure-only exports, with quality/task success null.
The final pair still needs termination, its single independent review and reporting.
See [reporting procedure and limits](job03-job04-reporting.md). Private evidence indexes
bind run manifests, frozen sources, graders and delivery receipts; candidate contents,
prompts, reviews and credentials are excluded from common exports.
