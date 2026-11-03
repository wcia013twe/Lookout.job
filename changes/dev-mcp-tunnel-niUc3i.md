# dev-mcp-tunnel

- `make dev`, `make up`, and the default Make target now start the configured ngrok MCP tunnel after Supabase and before the frontend. Standalone service and frontend targets remain available.
- Updated startup documentation with tunnel configuration and the existing Node API prerequisite.
- Validation: Make dry runs for dev, up, and default startup; data validation; whitespace checks.
- Limits: did not restart the already-running backend or frontend. The existing tunnel was verified live earlier in this session. No product actions or MCP tool contracts changed.
