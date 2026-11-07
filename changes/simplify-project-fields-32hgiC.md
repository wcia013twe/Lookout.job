# Simplify project entries

- Projects show only name, URL and description in view/edit mode. Stored legacy role and date values remain preserved and supported by existing backend/MCP writes.
- Added a distinct folder/code project icon and an accessible, keyboard-operable trash button in each project edit header. Other background sections retain their existing controls.
- Updated fictional Query Lab demo content, documented demo interactions and extended the existing profile browser check with project add/remove/save coverage.
- Validation: frontend typecheck and static production build passed; npm test passed 954 tests (5 skipped); catalog validation passed for 158 roles; Impeccable detector returned no findings. Focused demo checks passed project fields, keyboard removal, save, section switch, empty state and reset without cloud writes. Desktop/mobile screenshots verified no overflow and 44px removal targets.
- Limit: the broader existing profile browser script stops at an unrelated stale navigation assertion (expects 4 buttons, current UI has 3). No live account writes or hosted deployment performed.
