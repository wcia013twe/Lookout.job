# JOB01/JOB02 EVAL-01–03 series

- Root chat directly operates three fresh paired evaluations per case in BL/LB/BL order, serialized after COM01/02. Historical pilots are excluded from this series.
- Freeze JOB01-search-v6 / JOB01-review-v2 and JOB02-controlled-clearing-v4 / JOB02-review-v5. Preserve task prompts, actor facts, rubric, source board and existing participant budgets. The minimal canonical-profile prerequisite repair is verified separately on a new sacrificial owner.
- Pin both participants and independent graders to subscription gpt-5.6-terra with medium reasoning. Reuse scripts/evals/subscription_grader.py, read-only sanitized evidence and a declared 600-second grading budget; no alternate model, account tools or inherited participant context.
- Automatically validate and export each completed pair using existing supported detailed/common routes and per-root receipts/langfuse, then verify readback. Preserve failed attempts/delivery receipts; delivery failure never triggers participant rerun or semantic regrading.
- Initial readiness preparation: root/frontend locked installs completed; no participant, grader or evaluation preflight container has started. Final exact-source checks, fresh owners, per-root freeze/registration and actual no-inference gates remain required at host allocation. No outcome or readiness inferred from source checks.
- No product changes, deployment, unrelated repairs or score-improvement retries. Future operational repairs must preserve original freezes and record effects; invalid results are not silently pooled.

- Initial reporting wiring reuses the shared allowlisted provenance object: JOB01 detailed exports carry grade.provenance; JOB02 already gets summary.provenance through the common builder. Both use existing paginated score readback. No semantic score/participant change or duplicate adapter.

- Validation: 51 focused JOB01/JOB02/shared provenance checks, catalog validation (158 roles) and diff checks passed. Exact-source live preflight and live grading remain separate; no EVAL model call has started.
