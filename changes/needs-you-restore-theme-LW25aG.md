# needs-you-restore-theme

- Restored the pre-experiment Needs You panel and compact divided-row treatment in both the real workspace and the isolated admin demo, with the setup action stacking cleanly on narrow screens.
- Removed the always-dark numbered color-card grid while retaining its exact navy, plum, oxblood, and indigo colorways as an inactive palette in `DESIGN.md`.
- Validation: `npm run validate:data` equivalent (76 roles), Next.js typecheck, static production export, focused color-mode/demo tests (22/22), and isolated delivery tests (8/8 outside the sandbox). The full sandboxed suite passed 282/284; one failure was the sandbox-blocked delivery integration that passed outside it, and the other is the existing Windows CRLF/LF outreach-guide comparison.
- Verification: local browser inspection confirmed the restored desktop setup panel and a hydrated 390px mobile layout.
