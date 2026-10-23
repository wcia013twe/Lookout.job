# Remove Muse updates settings

- Removed the Muse updates panel, notification settings hook subscription, and fictional preview from normal and demo preferences. Deleted the unused preview component and updated the demo walkthrough documentation.
- Existing stored preferences, notification policy services, and scoped MCP tools remain available without changes to validation or ownership.
- Validation: data validation (147 roles); production static build and TypeScript; 26 demo/quiet-mode tests; Impeccable detector (no findings).
- Limits: no live account or browser verification. Build initially stopped for an existing Next.js security advisory, then succeeded on retry; dependency upgrades are outside this change.

## Follow-up: keep task timing visible

- Moved Run timing and Requested time out of the collapsed task details so schedules remain discoverable. Preserved existing save validation, version checks and MCP mapping (`preferences.notifications.save`).
- Extended the demo UI walkthrough to edit timing with task details collapsed.
- Validation: data validation (147 roles), production static build/TypeScript, 22 schedule/demo tests, UI script syntax, and Impeccable detector passed. Browser walkthrough updated but not executed because Playwright is absent from this checkout. Existing Next.js advisory again required a build retry.
