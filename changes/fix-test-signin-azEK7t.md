# Restore local test-account sign-in activation

The localhost preview lacked its ignored next-app/.env.local. Restored the existing local Supabase URL, browser key and explicit test-account auto-sign-in settings from the retained local review configuration. No account was created and no credentials are tracked.

Validation: a fresh headless browser on http://localhost:3000 authenticated the retained test account and the sign-in gate disappeared. validate:data passed. This was a local environment repair; no product, backend, MCP or demo behavior changed. Hosted sign-in was not changed or verified.
