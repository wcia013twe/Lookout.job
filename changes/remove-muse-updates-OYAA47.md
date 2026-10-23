# Remove Muse updates settings

- Removed the Muse updates panel, notification settings hook subscription, and fictional preview from normal and demo preferences. Deleted the unused preview component and updated the demo walkthrough documentation.
- Existing stored preferences, notification policy services, and scoped MCP tools remain available without changes to validation or ownership.
- Validation: data validation (147 roles); production static build and TypeScript; 26 demo/quiet-mode tests; Impeccable detector (no findings).
- Limits: no live account or browser verification. Build initially stopped for an existing Next.js security advisory, then succeeded on retry; dependency upgrades are outside this change.
