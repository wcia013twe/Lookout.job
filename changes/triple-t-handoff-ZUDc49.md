# Scheduled triple t issue handoff

- Removed the issue-triggered Codex CLI workflow, launcher and token-transfer instructions. Muse remains the reporter; triple t investigates and produces the patch through a separately configured supported schedule.
- Added read-only queue inspection restricted to open owner-authored auto-fix issues, with linked-PR checks and reconciliation of old uncertain launch reservations. No issue prose becomes command input.
- Documented serialized cloud consumption, existing reporting/status contracts, and draft-only PR publication without merge-ready, merging or deployment. No UI/demo behavior changed; fictional mocked queue fixtures cover eligible, rejected, linked and uncertain states.
- Validation: npm test passed 567 tests; five queue tests passed separately including the subsequently added pagination case; focused reporting/release/queue run passed 15 tests before that added case. npm run validate:data passed (158 roles); npm run build passed; npm run typecheck --prefix next-app passed; git diff --check passed. No lint script is defined.
- Dependency installation initially failed because the default npm cache was unwritable; root and next-app npm ci succeeded with /tmp/lookout-npm-cache. No lockfiles changed.
- Limits: repository code cannot register or prove a triple t schedule. Parent configures the supported schedule separately. Live pickup/release/retry unverified; no live issues created. No secrets/access changed and no merge/deploy performed.
