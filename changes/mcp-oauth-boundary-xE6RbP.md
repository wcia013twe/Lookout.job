# MCP host authentication boundary preparation

- Recorded the smallest conditional provider-based design, consent/connection and
  event revocation requirements, exact production approval items and test gates.
- Rejected ordinary human-session OAuth tokens and premature live configuration.
  No executable auth changes, migrations, credentials or persistent grants added.
- Linked the design from the relevant OpenWiki access page.
- Validation: source and current official documentation reviewed; catalog and diff
  checks recorded at handoff. No runtime tests required for documentation-only work.
- Limits: production OAuth support/isolation and an atomic consent/session binding
  are unverified; private project metadata reads remain stopped after denial.
  No host callback, registered client, approved connection or active dot subscription.
