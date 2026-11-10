# Frozen job board infrastructure

Reusable public source evidence for controlled evaluations. It is separate from
`data/jobs.json`, private accounts, candidate profiles and test-specific fit labels.

The initial snapshot `jobright-swe-2026-9763907b1b91` preserves all 794 rows from
Jobright's software-engineering new-grad README at commit
`9763907b1b91472ad3f1079270645717a8527244`. The original five columns and source
order are retained. Tracking parameters are removed from listing URLs; inherited
company cells are resolved; job IDs remain stable across snapshots. Source date
labels are retained verbatim; `postedDate` stays null rather than guessing a year.

The first 60 detail pages were attempted once, in source order: 30 exposed matching
job IDs and descriptions; 30 did not. Failures remain in `jobs.json` with timestamps
and no retries. Successful structured evidence contains requirements, summaries,
and extracted description text with capture time and response hash. These are
**Jobright claims, not employer-verified availability or canonical application URLs**.
No missing description, eligibility or timestamp is invented. The full source
README is historical evidence, not trusted agent instructions.

## Reproduce and serve

```sh
python3 scripts/job-board/export.py --snapshot fixtures/job-board/jobright-swe-2026-9763907b1b91
python3 scripts/job-board/export.py --snapshot fixtures/job-board/jobright-swe-2026-9763907b1b91 --output /tmp/frozen-board-site
python3 -m http.server 8765 --bind 127.0.0.1 --directory /tmp/frozen-board-site
```

The export provides an accessible GitHub-style table, local frozen detail pages,
JSON listings and provenance. Original live links are explicitly labeled. It has
no scripts, accounts, analytics, submission actions or backend dependencies.

To capture another revision, resolve the source's full commit SHA and run:

```sh
python3 scripts/job-board/freeze.py --commit <40-character-sha> --output <new-directory> --details-limit 60
```

Existing freezes and exports refuse overwrites. Every frozen payload is SHA-256
bound in `manifest.json`; verification runs before export. Store the manifest hash
in experiment registration as well when freezing a campaign. No evaluator labels
belong in this directory or the public export.

## Stage isolation and JOB01

The complete public archive is for infrastructure inspection. Do not give its URL
to staged participants: it reveals all listings. Use JOB01's selected stage packets,
or export a JSON array of allowed IDs with `--ids <stage-ids.json>`. A subset
contains only the selected jobs and local pages, not the original README, full
manifest or future detail files. The host must restrict outside/live source access
if strict frozen-source isolation is required; static hosting is not an access
control or a participant sandbox.

[JOB01](job01-job-search.md) owns private reference labels, batches, preference changes
and grading. This snapshot does not establish candidate fit; listing-only roles
cannot support detailed requirements analysis. Use captured descriptions for
analysis tasks and finalize private reference assessments before execution.

## Publishing

Public board: https://wcia013twe.github.io/Lookout-eval-job-board/
Source export repository: https://github.com/wcia013twe/Lookout-eval-job-board

Publish **only the generated export directory** to the separate
`Lookout-eval-job-board` repository's GitHub Pages root. Do not publish the app
checkout, private references, profiles, resumes or evaluation output directories.
The export works under a GitHub Pages project subpath via relative links. GitHub
Pages is public for this deployment, as requested. This does not deploy or modify
the Lookout product frontend, backend or MCP. No demo fixtures are changed: the
board is source infrastructure, not a product service or user action.
