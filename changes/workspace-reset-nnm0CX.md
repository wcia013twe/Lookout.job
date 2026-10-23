# Workspace reset

- Added a human-only Edge Function and reset preview/typed confirmation screen. Deletes owned private files through the Storage API, revokes agent connections, verifies personal record deletion, and preserves Auth and Circle content.
- Added retryable pending state, completed replay protection, write guards, stale-cache reconciliation, and a narrowly scoped MCP human handoff; developer contract version 47.
- Demo reset uses fictional memory only and restores through Reset demo data.
- Validation: full `npm test` (495 passing), `npm run validate:data` (147 roles), production `npm run build`, and `node scripts/check-workspace-reset-ui.mjs` (desktop/mobile confirmation, empty state, fixture restoration, no account calls, no overflow or page errors).
- Existing dependency advisory: Next.js build reported a known security vulnerability; the repeat build completed. Dependency upgrade remains separate.
- Limits: no production deployment or real-account reset; hosted file deletion and re-onboarding require a disposable-account release check. The existing wcia013twe account was not modified during this feature pass.
