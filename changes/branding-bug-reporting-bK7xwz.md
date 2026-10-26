# Branding and bug reporting

- Merge the remote Lookout Buddy branding and owner-scoped bug reporting milestone, including the repair queue contract and database migrations.
- Preserve local backend tools and their scope checks while combining agent instructions and MCP discovery.
- Validation: `npm run validate:data`, `npm test`, and `npm run build`.
- Limits: existing local Docker services and database were not restarted or migrated; the reporting gateway, credentials, and external issue workflow were not deployed or verified live. Later remote backend release readiness improvements remain outside this merge.
