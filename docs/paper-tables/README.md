# COM and JOB benchmark tables

These tables use the **Eval Case & Run** Langfuse dashboard's common metrics:
execution status, whole-trajectory task success, quality, active seconds, tool
calls, wakes, and reviewed status. Rows retain case, run, condition, version,
and release. There is no cross-case average. `results.json` is a sanitized,
timestamped readback, not a declaration that a campaign is final. The CSV
also carries observed tokens, usage coverage and estimated total USD when
available. No prompts, private records or credentials are exported.

Insert the following before the bibliography in `paper.tex` (it already loads
`booktabs`):

```latex
\input{docs/paper-tables/com-results}
\input{docs/paper-tables/job-results}
```

Regenerate offline after replacing values or adding compatible rows in the JSON:

```sh
node scripts/evals/paper-tables.mjs
# Or supply a snapshot in the same schema:
node scripts/evals/paper-tables.mjs /absolute/path/results.json
```

Refresh from Langfuse using the existing CLI and local tracing credentials:

```sh
node --env-file=.env.local scripts/evals/paper-tables.mjs --refresh
```

Refresh is read-only. It paginates observations and scores, selects only tagged
common `evaluate-baseline` / `evaluate-lookout` roots in environment `benchmark`,
and rejects duplicate roots or scores rather than choosing a favorable value.
It excludes pilot and verification environments. It does not run participants,
grade evidence, publish scores, or replace unknown judgments.

Missing scores render as `--`; false/zero remains a measured failure/zero.
`Reviewed = Yes` does not imply task success. JOB04 has no predefined overall
quality/pass aggregate, so those cells remain unknown even for a reviewed run.
JOB01/JOB02 have no compatible measured rows in this snapshot and are omitted;
historical diagnostic pilots are not substituted. No pending run is invented.

COM1/COM2 in Langfuse correspond to COM01/COM02 in the paper. Their quality
scores retain the grader's eight/thirteen outcome groups. The generator does
not recompute quality from checkpoint scores. Checkpoints describe failure
locations within a trajectory; they are not independent samples. COM3/COM4
are additional workflows, with their own graders. Including their result
tables requires updating the paper's current two-storyline scope and protocol
before claiming they belong to that study. Full attempts, unavailable reviews,
interruptions and harness failures remain visible. Recorded amendments and
comparison limits are described in `docs/communication-eval-series.md` and the
case-specific evaluation reports; the tables alone cannot establish comparability.
