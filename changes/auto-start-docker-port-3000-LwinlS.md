# Automatic local startup recovery

`make dev` now opens Docker Desktop on macOS when its daemon is down and waits up to three minutes for readiness. It stops listeners on the selected frontend port before proceeding, then verifies or starts local Supabase as before. Startup still preserves local database containers and data.

- Validation: `node --test tests/local-startup.test.mjs` (11 passed), `npm run validate:data` (158 roles), and `npx tsc -p next-app/tsconfig.json --noEmit` passed.
- Verification limits: `npm test` remains blocked by existing failures, including portal loading (`_http.mjs` lacks `MACOS_BROWSER_LIKE_USER_AGENT`) and Career Ops filter/search assertions. Live Docker Desktop auto-launch and terminating a real process on port 3000 were not exercised.
