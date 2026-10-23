# Next.js 16.4.0 → 16.4.3 security update

<!-- next-upgrade: security; path="next-app" -->

- Pin Next.js to 16.4.3 and refresh its npm lockfile, including matching Next.js environment/compiler packages. Preserve unrelated dependencies and configuration.
- Set supported `experimental.agentUpgrade` to `security` for future security upgrade reminders.
- Duplicate checks: working tree, local/remote branches and commits (after fetch), and GitHub open PR lookup found no equivalent work. No PR was published.
- Validation: root and app `npm ci`; app `npm exec -- next --version` (16.4.3); app `npm audit --omit=dev` (zero vulnerabilities); root `npm test` (531 passed, including database/demo isolation scenarios); `npm run validate:data` (147 roles); app `npm run typecheck`; production static export (55 pages, 388 offline assets); `git diff --check`.
- Build environment: the initial build stopped because inherited `TURBOPACK=auto` conflicted with the existing `--webpack` script. Rerun succeeded with `env -u TURBOPACK NODE_ENV=production`; no application workaround was needed.
- Demo coverage: existing fictional demo fixtures and isolation tests remain applicable; this dependency/configuration patch adds no product behavior or MCP action.
- Limits: no browser interaction, live authentication, or external submission verification; no production deployment. The root install separately reports one existing moderate advisory, outside the app dependency update.
