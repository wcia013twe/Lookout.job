# Unified discovery and card-pack setup

- Consolidated connections, sources, tasks and pack management in My Profile → My Agent, with expandable sections that retain edits and immediate choices between steps.
- Discover has a compact setup entry point, including first-arrival and guest states. Pack feeds remain in Discover.
- Added a live-name, fictional card preview with local-only reveal state and no account/progress writes.
- Preserved scoped backend/MCP actions and configuration-version checks. Refreshed timestamps let sequential setup saves coexist with unrelated preference updates.
- Unified the demo publishing connection with task fixtures and made newly issued fictional IDs valid task assignments.
- Validation: 515 repository tests (including database and existing scoped MCP paths), data validation (147 roles), TypeScript and production static build; desktop/mobile browser workflow with fictional intercepted account responses, empty/error states, demo reset and no account traffic. Impeccable detector reported no findings.
- Verification limits: no live account writes or deployment. Existing Next.js dependency advisory appeared during build; retry completed. Preview illustrates sample drop rows rather than running the production pack-opening/reward animation.
