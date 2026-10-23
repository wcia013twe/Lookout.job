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
