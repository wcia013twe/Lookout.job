# Minimal Muse bug reporting

- Added `report_bug` and `get_bug_status` to the existing MCP/gateway, restricted
  to the configured Muse connection. One GitHub token supports both tools.
- Retained sensitive-content checks, duplicate receipts, conservative retries and
  release verification; receipts contain no report prose or candidate records.
- Reused existing CI, merge queue and Pages. One release-result workflow lets
  Muse check frontend release status on its next run.
- Removed the redundant intake notification workflow, Supabase deployment
  pipeline/config, backend release planner and their unused tests. No new Actions
  secrets or model API key are required. Backend fixes use the existing process.
- Shortened setup and worker documentation. Automatic Codex startup still needs
  a supported cloud scheduler; this scaffold does not register one.
- Validation after cleanup: all 555 tests passed (none skipped), all 158 roles
  validated, and the production build passed (388 offline assets). No live issue,
  release or account write.
