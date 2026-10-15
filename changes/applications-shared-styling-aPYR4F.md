# Applications use the shared workspace styling

- Removed the Simplify reference, tracker-only light/dark palettes, flat toolbar overrides, and 1800px page width. Applications inherit the shared workspace theme, heading scale, and container.
- Matched tracker actions to shared primary/secondary button styling, removed nested page padding and conflicting type overrides, and aligned inputs and detail spacing. Tracking layout, status history, and actions remain available.
- Existing fictional application/demo fixtures exercise these same components; demo isolation tests pass. No new data or service action was introduced; existing MCP mappings remain unchanged.
- Validation: frontend typecheck and static production build passed; 30 theme, timeline, and demo tests passed; data validation passed (76 roles); CSS detector returned no findings; git diff --check passed.
- Limits: no browser visual inspection. npm ci for the frontend failed; verification used a copy of the shared checkout’s installed frontend dependencies.
