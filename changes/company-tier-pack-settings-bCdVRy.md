# Company ranking in pack settings

- Added a collapsed Company ranking editor to My Agent → Card packs, reusing shared FT/internship tier lists, company moves, creation and duplication. Copy distinguishes the account active list from explicit profile selection, separate ranking saves and already-published cards.
- New pack task instructions use the active profile’s company list as a baseline alongside team, technical scope and personal fit; unranked companies need investigation. Existing tasks remain unchanged.
- Reused existing preference sync and scoped MCP tools (`save_company_tiers`, `save_search_profile`, task/theme saves); no schema or backend contract change. README documents the mapping and agent-reasoned ranking limits.
- Demo coverage: fictional task instructions updated; browser check adds a fictional company, moves it to S, duplicates a list, creates/edits/removes a pack, verifies demo reset/isolation, desktop/mobile/light layouts and intercepted account/error states. Existing broad assertions were scoped to the pack panel.
- Validation: `npm run validate:data` (147 roles); production `npm run build`; Impeccable detector (no findings); browser check. `npm test`: 527 passing cases, one suite-level failure in PGlite WASM cleanup (`null function or function signature mismatch`); isolated database run reproduces the cleanup failure with all 29 database scenarios passing. Complete output: `/private/tmp/company-tier-tests.log`, `/private/tmp/company-tier-db.log`.
- Verification limits: no authenticated production write or live MCP/deployment verification; ranking remains agent reasoning, not deterministic server sorting. Existing Next.js dependency security advisory reported during build; dependencies unchanged. Independent visual review accepted incumbent design with selection-copy clarification, applied here.

## Follow-up: remove pack preview

- Removed the right-side pack preview from creation/settings; the controls and company ranking editor now use the full available width. Updated the existing demo interaction check to assert that the preview is absent.
- Validation: frontend typecheck and demo browser check at localhost:3000 (desktop/mobile/light, ranking edits, pack save/edit/remove, reset/isolation and account errors). No backend or service behavior changed.
