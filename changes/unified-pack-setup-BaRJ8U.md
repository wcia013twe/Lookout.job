# Unified discovery and card-pack setup

- Consolidated connections, sources, tasks and pack management in My Profile → My Agent, with expandable sections that retain edits and immediate choices between steps.
- Discover has a compact setup entry point, including first-arrival and guest states. Pack feeds remain in Discover.
- Added a live-name, fictional card preview with local-only reveal state and no account/progress writes.
- Preserved scoped backend/MCP actions and configuration-version checks. Refreshed timestamps let sequential setup saves coexist with unrelated preference updates.
- Unified the demo publishing connection with task fixtures and made newly issued fictional IDs valid task assignments.
- Validation: 515 repository tests (including database and existing scoped MCP paths), data validation (147 roles), TypeScript and production static build; desktop/mobile browser workflow with fictional intercepted account responses, empty/error states, demo reset and no account traffic. Impeccable detector reported no findings.
- Verification limits: no live account writes or deployment. Existing Next.js dependency advisory appeared during build; retry completed. Preview illustrates sample drop rows rather than running the production pack-opening/reward animation.

## Compact UI follow-up

- Replaced the stacked setup accordions with a compact section navigation. Packs opens first; Search, Sources, Connections and Other settings show one editor at a time without discarding drafts.
- Removed repeated descriptions and headings. Moved enable/disable and removal into pack editing; pack rows retain Edit and Copy request. Kept scheduling limitations and connection permissions visible where they matter.
- Condensed the fictional preview and Discover suggestion. Desktop keeps editing and preview side by side; mobile stacks them.
- Updated demo browser coverage for section switching, draft retention and disabling/removing packs. Existing backend/MCP mappings are unchanged; no new service capabilities.
- Follow-up validation: 517 tests, catalog validation (147 roles), production build/typecheck, desktop/mobile browser workflow and visual review; detector clean. Existing dependency advisory remains.
- Integrated concurrent default-schedule/help-popover work; retained default restoration and updated its browser check for the Search tab.
- Final integrated verification: 520 tests, data validation, production build/typecheck and both pack/schedule browser suites passed, including missing/empty/custom schedules, keyboard help, retained drafts and desktop/mobile screenshots.

## Automatic task setup follow-up

- Add card pack now drafts a dedicated scheduled task with editable, prewritten discovery instructions and a 09:00 requested time. No separate task creation or selection is required for a new pack.
- Prefills bounded existing sources and active publishing connections; users can complete missing assignments in Search. Preserves existing schedule pauses, time zone, tasks and theme preferences.
- Composes the existing notification/theme save actions with stable IDs, version checks and partial-save reconciliation. Task/pack writes are not atomic; retry and conflicting-task cases remain explicit. No scheduler, new permission or backend/MCP capability is introduced.
- Search reflects the saved task without discarding user-edited drafts. Demo follows the same composed save flow and remains memory-only.
- Verification: 527 tests (including new retry/lost-response/conflict/default-task and scoped MCP composition checks), 147-role data validation, production build/typecheck, and both browser suites passed. Reviewed desktop/mobile screenshots; detector clean. No live account writes or deployment. Integrated the concurrent accessible-tab/mobile-control polish.
