# JOB benchmark review repairs

- Fix JOB01 post-turn capture failures dropping executed checkpoint duration and interactions. Persist metrics first and retain separate capture diagnostics.
- Fix JOB02 frozen-form enforcement for inspection/fill/upload. Only reviewed conditional fingerprints are allowed; unreviewed drift creates a sticky host receipt and stops the pair before another condition or comparable grade.
- Fix JOB03 adapter/interpreter/dependency byte binding at preflight/launch and coordinator/cost source binding at prepare. A missing after-state with a recorded capture failure now yields an unverifiable partial grade while retaining time, effort and available cost.
- Archive the previous active scenarios; prospective versions are JOB01-search-v4, JOB02-batch-v2 and JOB03-tracking-v2/JOB03-grade-v2. Existing private freezes/pilot/grades remain unchanged.
- Validation: 75 focused benchmark/cost tests; local fictional Playwright rehearsal with frozen-form guards; data validation (158 roles); JS/Python syntax and diff checks. Root/frontend locked dependencies installed. All 119 historical JOB01 participant artifacts still match their recorded hashes. Rehearsal receipt: /Volumes/External SSD/Lookout/tmp/job-bench-fixes-rehearsal-20261109-1/rehearsal.json.
- Limits: no participant inference, real employer interactions, account mutation, schedules, external telemetry, push or publication. Live readiness blockers remain documented. Product suite/build/demo changes are not applicable to evaluation-only changes; detached fixtures and browser rehearsal cover representative states.

## JOB01 controlled comparison follow-up

- Prospective JOB01-search-v5 / JOB01-review-v2 matches task intent/evidence and prescribed initiation counts, preserves native startup/default/on-demand discovery and audit instructions, and adds needed profile/search/audit/change-feed permissions within the isolated owner. No eager schema injection.
- Baseline initial context includes all saved candidate facts/preferences. Startup/discovery timing/bytes and container/wall time remain distinct; real Lookout work counts as product cost. Durable work is a separate semantic criterion from returned-list recall.
- Validation: 17 focused JOB01 tests, Python syntax, data validation (158 roles), diff whitespace. New account/preflight/pilot and Langfuse registration/export remain pending; no inference or account mutation in this follow-up yet. Historical evidence unchanged.
