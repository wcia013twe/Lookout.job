# Solid Needs You cards and unified light actions

- Replaced the plain Needs You rows with responsive solid navy, plum, oxblood and indigo attention cards for both real and fictional demo tasks. Expanded tasks span the grid and retain accessible, dark form controls in either color mode.
- Centralized workspace primary and secondary action colors, then aligned the light application tracker and pack dialog controls to the same navy action system while preserving their distinct content surfaces.
- Demo coverage: the existing seven fictional human-handoff tasks exercise every card tone, inline forms, disabled actions, role metadata and the reset path. This is presentation-only and does not change backend or MCP behavior.
- Validation: `validate:data` (76 roles), Next.js typecheck, static production export, focused color-mode/demo tests (22/22), isolated delivery tests (8/8), `git diff --check`, and local Chrome visual QA in light/dark desktop, light mobile and expanded-card states.
- Limits: after integrating current main, the full test run passed 282/283 locally. The remaining unrelated outreach-guide test is a Windows CRLF/LF strict-comparison failure. A signed-in real application review was not mutated during visual QA.
