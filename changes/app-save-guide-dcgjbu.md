# Clearer save-as-app guidance

- Replaced the quiet text prompt on “Make your next move” with a distinct panel, app-saving icon, numbered instructions and recognizable Share/menu icons. Browser detection and standalone hiding remain intact; installation is optional.
- The existing fictional onboarding uses this same component. Added its review interactions and the browser-owned action boundary to docs/onboarding.md; no backend/MCP behavior changed.
- Validation: production build; validate:data (158 roles); five website-onboarding/progress tests; Impeccable detector (no findings); headless desktop and iPhone screenshots with no horizontal overflow; standalone-state guide hiding.
- Limits: visual checks used the real component and stylesheet in a focused final-screen harness. Native browser installation and every browser version's menu were not exercised.

## Discover cleanup follow-up

- Removed the setup prompt and card-pack setup link from the shared homepage/Discover public-role view, including fictional demo states. Empty card-pack sections stay hidden. My Agent retains configuration.
- Updated the demo UI verification route and documentation to open My Agent directly and check the removed link is absent. No backend or MCP service behavior changed.
- Follow-up validation: production build; validate:data (158 roles); mechanical detector (no findings); full card-pack UI script passed demo setup/reset/isolation, desktop/mobile layouts, mocked empty account and API failures. Its account fixture now explicitly completes onboarding. Native real-account writes were not exercised.
