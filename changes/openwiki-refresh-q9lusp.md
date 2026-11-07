# OpenWiki refresh and session startup

- Added a source-grounded current-state supplement for changes since the generated wiki refresh and linked it from the startup guide.
- Require new repository sessions to read the quickstart and current-state supplement; preserve that instruction when the scheduled OpenWiki updater runs.
- Validation: Markdown links and referenced paths checked; catalog validation and diff checks run.
- Limits: this is a targeted manual refresh, not a complete OpenWiki regeneration or verification of hosted deployments. Session startup relies on agents following repository instructions; it is not a technical access gate.

- Follow-up: regenerated the repository wiki with OpenWiki 0.7.2 using the configured API key. Preserved the session-start reading rule and verified regenerated entry points and Markdown links.
- Validation: OpenWiki completed its 13-page init; local Markdown link check, data validation and git diff check passed.
- Limits: LangSmith was not configured; one page awaits OpenWiki frontmatter enrichment. Verify generated descriptions against authoritative source.

- Follow-up: clarified that sessions read the wiki before repository work and maintain affected pages during the same feature pass; source and tests remain authoritative.
- Validation: required entry points exist; data validation and git diff check passed.
