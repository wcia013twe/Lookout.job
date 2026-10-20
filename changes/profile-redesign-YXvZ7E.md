# Application profile settings redesign

- Added an application-profile switcher with create, duplicate, rename, active/paused searches, per-profile drafts and a common explicit save/reload boundary. Existing profile IDs and canonical documents are retained.
- Reorganized Overview into identity/readiness/account/style summaries; About me separates profile account assignments from shared career background; Application kit separates material selections and employer-answer/outreach writing preferences from shared libraries; Job preferences uses collapsible criteria and disclosed advanced context. My agent's content and controls remain unchanged.
- Uses existing versioned `save_search_profile` RPC/MCP validation and ownership. Account assignments and material selections are agent guidance, not verified connections or changes to execution authorization. Developer context 28 documents the labeled settings; production gateway release remains required.
- Demo coverage: separate fixture decorator adds fictional personal/university accounts and writing styles. Existing admin demo start/reset use it; edits stay in memory. Unit tests cover isolation/reset and narrative round trips; database tests verify website/MCP preservation and stale-version/permission boundaries.
- Validation: npm test (387 passing including all database scenarios), frontend typecheck, static production build, npm run validate:data (76 roles), git diff --check, scoped Impeccable detector (no findings). Browser inspected at desktop and 390px mobile; verified guest save/reload, independent writing settings, new-profile isolation and section/profile switching.
- Limits: authenticated hosted save/upload/MCP and actual agent access to assigned accounts were not exercised. Writing preview displays an instruction brief rather than generating text. Shared submission policy and global PDF default remain authoritative. Account switching remounts drafts by existing owner/demo key; real sign-in switching was not exercised. Nothing pushed or deployed.

## Overview stats and icon refinement

- Added deduplicated account-wide tracked-role, recorded application, active-interview and active-offer totals using the same tracker stage calculation. Saved roles, drafts and uncertain preparation alone do not count as applications; terminal outcomes leave active interview/offer totals. Shared library counts remain in the selected-profile readiness row.
- Refined the account header, flat metric strip, readiness rows and account/style panels with consistent authored SVG icons, wrapping text and a two-column mobile metric layout. My agent remains unchanged.
- Read mapping: stats derive from existing workspace state / `workspace_read`, with no new service, write action, schema or permission. Existing admin demo fixtures cover prepared, submitted, interviewing, offered and uncertain states; reset continues to use the isolated fixture store.
- Validation: 389 tests including database scenarios, focused stats tests, typecheck, production export, data validation, scoped detector (no findings), desktop and 390px browser inspection. No hosted account activity or external services were exercised for this display-only follow-up.

## Preferred names per application profile

- Added optional Preferred first name and Preferred last name in About me → Accounts & identity. They save with the selected application profile and are used in its Overview heading/avatar; existing shared factual name fields remain unchanged. Legal-name questions retain their separate verified-fact/review requirements.
- Existing versioned `save_search_profile` RPC/MCP narrative mapping includes both fields; developer context 29 documents presentation versus factual identity. No schema, permission or submission change. Demo profiles use fictional distinct preferred names and reset through the existing fixture decorator.
- Validation: full unit/database suite, frontend typecheck, production export, data validation, display-name and profile round-trip tests; browser inspected the identity fields. Hosted MCP/account access and legal-form autofill were not exercised. Nothing published.

## Eligibility and prior-employment shortcut

- Added per-profile country-specific work authorization/sponsorship, availability, notice, relocation and enrollment/graduation fields. Unknown stays Ask me; changing country clears old country-specific responses. Existing shared authorization text is preserved.
- Added a compact Company + Yes/No/Ask me shortcut inside the existing answer library. Explicit human confirmation enables exact-question, same-company reuse; unknowns stay unverified/ask. Unique prior company answers update in place; ambiguous duplicates require explicit editing. No separate employer-history manager or inferred No.
- Existing `save_search_profile` and `save_saved_answer` MCP services retain owner/version checks; human reuse authorization uses the existing verify-answer handoff. Developer context 30 documents mappings and exact-match limits; gateway not deployed in this local pass.
- Demo fixtures cover country-specific authorization, unknown future sponsorship, enrollment differences and prior-employment Ask me. Reset stays memory-only.
- Validation: 393 passing unit/database tests, typecheck, production static build, data validation (76 roles), scoped detector (no findings), targeted country-reset/profile round-trip and reviewed-answer matching tests; browser checks of country reset, repeated company saves without duplicates, unknown answers staying always-ask, and the compact mobile editor. Hosted authenticated MCP, account switching and actual employer autofill were not exercised.

## Independent profile rules and recruiting targets

- Added one profile-owned rules field for agent behavior and opportunity evaluation, with no global rules editor or live inheritance. Duplicate copies rules/targets once. Existing legacy shared rules are preserved and can be explicitly copied into a profile without discarding its current rules.
- Added optional target rows for role, timing, owned resume preference and conditions, with add/pause/remove, compact summaries, empty-state simplicity and profile/section draft preservation. Existing goals/tradeoffs and criteria remain per profile. My agent is unchanged.
- Uses existing `save_search_profile` / canonical `save_search_document` owner/version boundaries; target values are narrative guidance, never automatic submission routing or new permissions. Developer context 31, compact briefs and generated search guide v3 consistently require selected-profile rules and treat shared rules as legacy reference only.
- Demo covers distinct fictional full-time/internship rules, active/paused role targets, summer timing and resume selection. Reset remains memory-only. Tests cover profile/target isolation, round trips, malformed target data, draft names, explicit independent legacy copies, and website/MCP database preservation.
- Validation: 397 unit/database tests, frontend typecheck, static production build, data validation (76 roles) and scoped detector (no findings); browser target creation/edit/save/reload, duplicate/edit independence and desktop/mobile layout. Hosted authenticated legacy-copy/MCP round trips and actual agent search/submission routing remain unverified. Nothing pushed or deployed.
