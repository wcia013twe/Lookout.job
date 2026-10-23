# Remove onboarding preview button

- Removed the demo-only Preview onboarding link from the workspace header. Normal onboarding and direct onboarding routes remain available.
- Demo coverage: the demo header now uses the same utilities layout as the regular workspace; no fixtures or backend/MCP actions changed.
- Validation: TypeScript typecheck and data validation; source search confirms the Preview onboarding button is gone.
- Limits: no browser visual check for this single-link removal.
