# Simpler Circle entry

- Replaced two oversized parallel forms with one compact join-first form using existing workspace colors and controls. Invite code and display name lead to one full-width action; a secondary switch reveals creation in the same space while retaining the display name.
- Added pending labels and disabled fields during save. Membership still uses the existing scoped circles.join / circles.create actions and shared validation; no backend or MCP behavior changed.
- Updated the fictional Circle preview guidance and added desktop dark/mobile light browser coverage for switching, name retention, joining, creating, overflow, console errors and isolation from account writes.
- Checks: TypeScript typecheck, data validation (147 roles), Impeccable detector (no findings), and browser interaction checks passed. Inspected desktop/mobile screenshots.
- Limits: membership interaction verified in the in-memory fictional preview; no real account membership was changed.
