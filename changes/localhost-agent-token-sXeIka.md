# localhost-agent-token

- Allow the production website and exact localhost:3000 / 127.0.0.1:3000 browser origins to manage account-scoped agent connections. Preserve the gateway's existing authentication and origin-less MCP behavior; reject other browser origins.
- Document the additional Supabase Auth redirect URLs needed for local sign-in.
- Validation: all 374 tests passed, including five CORS regression cases; 76 catalog records validated; production Next.js build passed.
- Release scope: apply only the CORS wrapper to the previously deployed gateway package after local landing. Unreleased search tools and database migrations are outside this patch.
- Limits: live CORS checks and a real account sign-in/token/MCP round trip remain to be verified. Supabase Auth redirect settings require dashboard access.
