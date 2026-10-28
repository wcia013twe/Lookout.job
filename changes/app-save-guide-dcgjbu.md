# Clearer save-as-app guidance

- Replaced the quiet text prompt on “Make your next move” with a distinct panel, app-saving icon, numbered instructions and recognizable Share/menu icons. Browser detection and standalone hiding remain intact; installation is optional.
- The existing fictional onboarding uses this same component. Added its review interactions and the browser-owned action boundary to docs/onboarding.md; no backend/MCP behavior changed.
- Validation: production build; validate:data (158 roles); five website-onboarding/progress tests; Impeccable detector (no findings); headless desktop and iPhone screenshots with no horizontal overflow; standalone-state guide hiding.
- Limits: visual checks used the real component and stylesheet in a focused final-screen harness. Native browser installation and every browser version's menu were not exercised.
