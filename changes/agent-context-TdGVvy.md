# Personal context for Discover fit analysis

- Replaced separate Career goals & tradeoffs and Profile rules cards with What your agent knows: four optional notes matching the canonical Discover assessment dimensions.
- Added concrete prompts for personal evidence, motivations, constraints, tradeoffs and verification gaps. Previous notes remain editable in a disclosure; no inferred migration or data deletion. Preserved shared-rule import.
- Connected the profile to Discover with a demo-aware link. Updated the canonical search guide to read the same private profile notes, ground each dimension in candidate/employer evidence, preserve unknowns, record evaluated profile versions and retain explicit must-have conflicts.
- Uses existing website autosave and scoped MCP save_search_profile ownership/version boundaries. Updated guide/catalog/change-feed versions and regenerated toolkit and Edge document bundles.
- Demo: four fictional context notes plus context-aware role explanations; isolated desktop/mobile integration check covers reading, edits, autosave/reopen, missing notes, legacy editing, navigation and no account writes. Light desktop and dark mobile screenshots reviewed.
- Validation: npm test (947 passed, 5 skipped); focused profile/guide tests (48 passed); frontend typecheck; production static build; npm run validate:data (158 roles); git diff --check; Impeccable detector (no findings); node scripts/check-agent-context-ui.mjs passed.
- Limits: no hosted deployment, authenticated production round trip or live agent execution. Guide behavior is an instruction contract, not a semantic classifier of freeform notes. No real personal notes were changed.

- Local-main integration: preserved the concurrent clearance, company-size and session-restoration changes. Regenerated the merged Edge codec; 51 focused tests, the combined production build and desktop/mobile context flow passed after resolving overlaps.
