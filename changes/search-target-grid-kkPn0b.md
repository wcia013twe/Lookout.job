# Search target source grid

- My Profile → My agent now displays search sources in a responsive card grid, with a source count, readable full names and addresses, and aligned Edit/Remove controls. Access-status details expand on demand.
- Expanded the isolated, resettable admin demo to six fictional sources covering all source types and long names/URLs; documented the grid, narrow-screen, editing, empty-state, and reset walkthrough.
- Uses the existing `save_search_targets` website/MCP boundary and owner/version validation; no service contract or backend behavior changed.
- Validation: `npm test` (423 passing, including website/shared validation and MCP search-target contract coverage); `npm run validate:data` (147 roles); `npm run build`; `npm --prefix next-app run typecheck`; `git diff --check`; Impeccable detector (no findings).
- Visual verification: rendered the actual SearchTargets component with six fictional demo fixtures and production CSS at desktop (880px, two columns) and phone (375px, one column), across dark/light themes; no phone card overflow, full long addresses, and working native access-details disclosure.
- Limits: the visual fixture preview does not hydrate account writes; live account saves and the full admin demo reset/edit walkthrough were not exercised. Initial build attempts hit dependency/network setup and disk-space errors; the final integrated build and checks passed after clearing this task’s temporary caches.

## Follow-up: compact source list

- Replaced the card grid with one divided list: source name/type and full address lead each row, access details remain expandable, and Edit/Remove align on the right on desktop and wrap below on phones. Kept the six-source demo fixtures and updated the demo walkthrough for the list.
- Validation: `npm test` (423 passing), `npm run validate:data` (147 roles), `npm --prefix next-app run typecheck`, `npm run build`, `git diff --check`, Impeccable detector (no findings). Visual fixture check at 880px dark and 375px light confirmed six list rows and no phone overflow, including long names/URLs.
- Shared website/MCP save validation and version checks remain unchanged. Scheduling was discussed only; no schedule or backend action was added. Live account writes were not exercised by the rendered fixture preview.

## Follow-up: simple daily schedule UI

- Added four compact daily routine rows above Search targets in My agent, with local times, individual switches, one time zone, a master switch, and Save schedule. Workflow/setup prompts stay out of the settings page.
- Uses the existing preferences store/autosync and `preferences.search.schedule`, already covered by the scoped `save_notification_preferences` MCP boundary. No backend service, migration, scheduler, activation receipt or developer-contract change is included.
- Added a resettable fictional demo schedule with midday off and documented edit/pause/save/reset interactions. Guest changes stay local and demo writes remain memory-only.
- Validation: production build, TypeScript, data validation (147 roles), full existing test suite, and `git diff --check`. Desktop dark and phone light fixture inspection found no overflow; exercised time editing, individual/master toggles, invalid timezone recovery and saving in demo.
- Limits: actual external automations were not created; agent runtime setup remains separate. Live account autosync and a hosted MCP round trip were not exercised for this UI pass.

## Follow-up: add and remove scheduled tasks

- The four Lookout routines are editable defaults. Add a task with a name, local time and optional agent instructions; remove any default or custom task, including all tasks. Rows display in time order.
- Saved empty/partial schedules remain as chosen. Older saved default IDs retain their times and enabled flags while receiving display labels. Uses the existing preferences store and notification-preference MCP boundary; no backend or automation setup changes.
- Demo includes a fictional custom practice task alongside the defaults; the documented walkthrough covers adding/removing, saving an empty list, and resetting to fixtures.
- Validation: 425 existing tests passed, production build, TypeScript, data validation (147 roles), diff check and UI detector. Targeted checks covered legacy records, custom tasks and empty schedules. Desktop/phone demo interactions verified adding a task, removing a default, saving, removing all tasks and saving the empty state; no phone row overflow.
- Limits: real account sync and external runtime scheduling were not exercised; the change remains in the settings UI and existing persistence path.

## Follow-up: profile-specific automation and visible tier-list editor

- Replaced the fixed full-time/internship controls with an application-profile selector and independent auto-apply/list/review rules saved through existing versioned search profiles. The tier-list widget is directly visible below these rules and in the expanded Job preferences company-priorities section.
- The existing scoped save_search_profile and save_company_tiers tools remain the write boundaries. read_application_policy accepts profileId; prepare_draft preserves searchProfileId, and automatic authorization rechecks that saved profile. Unknown/paused/conflicting profiles and unbound drafts with explicit profile rules require review; existing legacy rules remain a compatibility fallback. Developer contract version increments for the new binding.
- Demo profiles have distinct automation flags and thresholds, with visible fictional tier lists; switching/editing/saving/reset are covered in the demo walkthrough.
- Validation: full test suite (432 tests), TypeScript, data validation (147 roles), production build (cache disabled to fit limited disk), diff check and UI detector. Desktop dark/phone light rendered demo verified profile selection, independent saved thresholds/toggles, and the directly visible tier-list widget.
- Limits: hosted RPC/MCP and real employer/runtime checks remain unverified. This local landing does not deploy the updated gateway/config; use the production workflow after merge.
