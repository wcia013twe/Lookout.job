# Restore Circles service

- Restore Community routes/navigation, Circle onboarding and profile settings, landing preview, application interview intelligence, scoped Circle/knowledge MCP tools and Circle guide discovery. Other paused extras remain paused.
- Enable the existing backend availability gate with migration `20261111190200_restore_circle_service.sql`; retain membership, ownership, scopes and exact sharing consent. Increment developer contract to 160.
- Reenable five Circle/company integration suites. Verify restored Node MCP evidence, discovery counts, backend gate defaults, scope authorization and onboarding resumption. Update the OpenWiki behavior and verification limits.
- Demo: retain existing isolated/resettable Circle fixtures and extend controlled admin MCP discovery/list interaction plus detached Community route checks.
- Validation: `npm test` passed all 1,357 tests, none skipped; `npm run validate:data` passed 158 roles; `npm --prefix next-app run typecheck`, `npm run build` and `git diff --check` passed. Focused Circle/MCP/demo checks also passed.
- Delivery limit: shared main contains overlapping active work confirmed by the user, including UI deletions and onboarding edits. Preserve it; keep this restoration committed in the isolated task checkout pending integration. No local-main landing, push, PR or hosted deployment. Hosted migration/frontend/gateway/MCP activation is unverified.
