# Application profile autosave

- Application-profile edits now save after a 600 ms pause, including pending edits on profiles switched away from. Removed the application-profile save/reload bar and manual writing-settings footer.
- Saves remain serialized through the existing versioned profile RPC. Newer edits survive an in-flight save and use its returned version. Failed snapshots retain drafts without a request loop; an error-only retry action is available.
- Website/MCP mapping: existing `save_search_profile` RPC and `save_search_profile` / `preferences.profile.save` tools retain ownership, validation and version checks; no backend or deployed capability change.
- Demo coverage: fictional profile/resume settings, writing edits across sections and profile switches, saved writing values after a page remount, reset, desktop/mobile layout and no demo cloud requests.
- Validation: `npm test` (438 passed, including database and scoped tool scenarios); `npm run validate:data` (147 roles); `npm run build` (passed on retry after existing Next.js advisory); `node scripts/check-profile-ui.mjs` (passed); Impeccable detector (no findings); desktop/mobile screenshots reviewed; `git diff --check`.
- Limits: signed-in live cloud writes and real network/conflict recovery were not exercised. Next.js reported an existing dependency security advisory; dependency upgrades are outside this change. No deployment or publication.
