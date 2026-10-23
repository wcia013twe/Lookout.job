# Muse bug reporting and cloud-worker scaffold

- Added an owner-connection-restricted `report_bug(title, description)` MCP tool
  using the existing gateway, safe-report validation and GitHub Issues.
- Added private deduplication receipts, conservative timeout handling and a small
  report limit; no candidate records or report prose are stored in receipts.
- Added a least-privilege GitHub issue trigger that acknowledges reports and
  mentions the owner, plus a cloud-worker prompt and deployment/activation runbook.
- The owner's follow-up authorizes automatic release. Validated fix PRs now use
  the existing `merge-ready` queue; changed Supabase code/schema releases before
  Pages. Missing credentials or additional GitHub protections remain blockers.
- Added bot-authored release receipts and `get_bug_status(issueNumber)` so Muse
  can retry once per verified successful release on its next run. Failed releases,
  issue closure, unmerged PRs and unrelated CI runs cannot authorize retry.
- The trigger does not launch Codex. This session cannot register a recurring
  cloud automation; activation and real end-to-end verification remain required.
- Automated synthetic coverage uses fictional data only. No UI/demo features or
  production account writes occurred; automatic release is scaffolded, not live.
- Validation: focused reporting/release tests and all 556 full-suite tests passed; all
  158 catalog roles validated; production build passed (388 offline assets).
  No tests skipped. Follow-up focused tests also exercised concurrent reports,
  successful/failed release receipts, reopening, workflow provenance and retries.
  The pinned Supabase CLI help/initialization was checked without production
  access; live migrations, function deployment and automatic release are unrun.
