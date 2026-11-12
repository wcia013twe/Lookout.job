# Langfuse evaluation dashboard recovery

- Restored the Git-tracked `Eval Case & Run` dashboard in the live Langfuse project with seven widget placements and the default COM1/run 1 tag filters. Setup read-back verified all placements; it created no evaluation runs or scores.
- Corrected `docs/langfuse-evals.md` to name the active dashboard, its ID, restore command and current widget contract instead of the retired overview instructions.
- Verified the user-linked `Evaluation — All Runs` dashboard in the browser. Its default one-day range excludes the November 10 runs; `?dateRange=7d` renders 92 execution-status scores. Documented that working URL and the distinction between this live-only layout and the Git-tracked `Eval Case & Run` dashboard.
- Validation: live setup read-back; read-only snapshot returned 52 measured benchmark trajectories across COM1–4 and JOB03–04. `npm test` passed (1,426 tests); `npm run validate:data` passed (158 roles); `npm run intelligence:typecheck` passed.
- Limits: Langfuse's unstable dashboard API may change; live dashboard edits are preserved by setup and can drift from the tracked definition. The 52 rows are measured attempts, not a claim that all campaigns are final or comparable. `Evaluation — All Runs` uses Langfuse's default time range when opened without `dateRange=7d`.
