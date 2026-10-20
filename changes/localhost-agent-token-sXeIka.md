# localhost-agent-token

- Allow the production website and exact localhost:3000 / 127.0.0.1:3000 browser origins to manage account-scoped agent connections. Preserve the gateway's existing authentication and origin-less MCP behavior; reject other browser origins.
- Document the additional Supabase Auth redirect URLs needed for local sign-in.
- Validation: all 374 tests passed, including five CORS regression cases; 76 catalog records validated; production Next.js build passed.
- Released gateway v19 after local landing: only the CORS wrapper and entrypoint wiring changed from live v18; all 18 other deployed files were preserved. Unreleased search tools and database migrations remain undeployed.
- Live verification: both local origins returned 204 preflights; localhost POST without credentials remained 401; an unapproved origin returned 403; origin-less requests without credentials remained 401.
- Limits: a real account sign-in/token/MCP round trip remains to be verified. Supabase Auth redirect settings require dashboard access; the dashboard is currently at sign-in.
