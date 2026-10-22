# Profile skills and language pills

- Skills, preferred skills and languages now render removable pills, including existing comma/newline text and imported arrays. Add with Enter, comma, semicolon, Add, blur or a pasted list; trim blanks and ignore case-insensitive duplicates. Save includes unfinished input and edits clear human verification.
- Storage remains newline-delimited profile facts using the existing profile save/cloud path. MCP mapping remains `save_profile_package` for importing these same facts; this presentation change introduces no service or permission changes. Human verification remains human-only.
- Added fictional preferred-skill and language demo values plus `scripts/check-profile-ui.mjs` to exercise additions, removal, duplicate handling, paste, save/revisit, mobile layout, and demo cloud isolation.
- Validation: production static build (including TypeScript), `npm test` (380 passed initially; 385 passed after integrating latest local main, including database scenarios), `npm run validate:data` (76 roles), Impeccable detector (no findings), and headless Chrome desktop/mobile interaction and screenshot checks passed.
- Limits: authenticated cloud persistence and live MCP round trips were not reverified; demo edits remain in memory. Browser check requires Playwright (default runner installation or LOOKOUT_PLAYWRIGHT_MODULE), Chrome, and a local export server (LOOKOUT_UI_URL, default port 3034).

- The original landing blocker was resolved during `codex/converge-main-cU4865`: skill pills were integrated into the current profile layout and the demo tracker changes were preserved. See the convergence note for current validation.
