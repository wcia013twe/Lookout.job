# Muse bug reporting and cloud-worker scaffold

- Added an owner-connection-restricted `report_bug(title, description)` MCP tool
  using the existing gateway, safe-report validation and GitHub Issues.
- Added private deduplication receipts, conservative timeout handling and a small
  report limit; no candidate records or report prose are stored in receipts.
- Added a least-privilege GitHub issue trigger that acknowledges reports and
  mentions the owner, plus a cloud-worker prompt and deployment/activation runbook.
- The trigger does not launch Codex. This session cannot register a recurring
  cloud automation; activation and real end-to-end verification remain required.
- Automated synthetic coverage uses fictional data only. No UI/demo features,
  production account writes, automatic merge or deployment were introduced.
- Validation: 6 focused reporting tests and all 550 full-suite tests passed; all
  158 catalog roles validated; production build passed (388 offline assets).
  No tests skipped. Follow-up focused tests also exercised concurrent reports.
