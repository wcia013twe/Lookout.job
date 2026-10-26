# Minimal Muse bug reporting

- Added `report_bug` and `get_bug_status` to the existing MCP/gateway, restricted
  to the configured Muse connection. One GitHub token supports both tools.
- Retained sensitive-content checks, duplicate receipts, conservative retries and
  release verification; receipts contain no report prose or candidate records.
- Reused existing CI, merge queue and Pages. One release-result workflow lets
  Muse check frontend release status on its next run.
- Removed the redundant intake notification workflow, Supabase deployment
  pipeline/config, backend release planner and their unused tests. No Supabase deployment
  secrets or model API key are required. Backend fixes use the existing process.
- Added an owner-only issue trigger using official experimental `codex cloud
  exec`, with a pinned CLI, access-token login, issue-specific prompt and duplicate
  launch reservations. It needs one Codex Actions secret and one environment-ID
  variable; authentication expiry requires renewal. No refresh service was added.
- Updated the worker/setup documentation. Live cloud submission still requires
  account configuration and verification; local tests mock it.
- Validation: all 568 tests passed (none skipped), all 158 roles validated, and
  the production build passed (388 offline assets). Launcher YAML and the pinned
  CLI version were checked. Five launcher tests cover authorization, duplicates,
  missing/expired auth and ambiguous submission. No live cloud task was created.
