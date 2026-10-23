# Simplify tracker CSV import

- Replaced the agent-copy handoff with direct Simplify CSV upload, bounded parsing, full preview, explicit import, duplicate decisions and recoverable errors. No AI or parser service is needed.
- Added owner-isolated private import history, nullable job URLs, original source reports, dates, notes and archive state. Applied is user-reported; no approvals, receipts, attempts or public jobs are created. Existing application/import statuses remain unchanged.
- Added shared browser RPC and scoped MCP preview/save/list operations with version checks, exact-retry replay, credential checks and workspace-reset coverage. Incremented developerVersion to 48.
- Tracker shows imported saved/applied/archived history with filters, separate type counts and expandable source reports. Imported history remains separate from canonical preparation/submission workflows.
- Demo coverage: fictional Simplify export and memory-only service cover repeated rows, missing URLs, saved/applied/archived states, reimport and reset. Real file uploads are disabled in demo.
- Validation: all 508 tests passed, including database ownership, status preservation, input validation, replay/stale versions and website/MCP parity; frontend typecheck; data validation (147 roles); production build; desktop/mobile browser flow with no overflow or account traffic; UI detector returned no findings.
- Private-file verification: the supplied export parsed all 165 rows; an isolated in-memory backend preview produced 137 jobs and 28 repeated rows. No user records or file contents were committed or written to an account.
- Limits: production backend deployment and real authenticated hosted import remain unverified. Initial statuses are SAVED/APPLIED and types FT/Internship; unsupported rows fail before saving. Build first stopped for the existing Next.js security advisory and passed on retry; dependency upgrades are outside this feature.
