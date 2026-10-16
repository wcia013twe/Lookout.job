# Calmer Action Board and clearer next steps

- Removed workspace gradients, glowing panel edges and glass blur in favor of neutral, opaque surfaces in both themes. Onboarding keeps its existing styling.
- Renamed the handoff widget to “Your next actions,” added section icons, and replaced empty disclosure squares with named action buttons. The demo opens its first review immediately and preserves review/approval safeguards.
- Replaced the day picker with a weekly agenda: dates, tasks, durations and interviews are visible together. Task explanations and plan settings are optional disclosures; only today’s tasks show Done controls. Violet action and teal prep widgets use matching surfaces, text and controls in dark and light modes.
- Validation: frontend typecheck; all 342 repository tests (including demo and preparation); catalog validation (76 roles); isolated browser preview verified task expansion, completion/reset and practice progress. Desktop visual inspection and 390px layout check (no horizontal overflow). Mechanical detector reported only the existing Inter font warning.
- Limits: full static production build failed because the machine ran out of disk space. Preview used production components and isolated demo services with navigation/review modal stubs. No backend actions or MCP contracts changed; existing scoped planner and application actions are reused.

- Follow-up validation: 28 focused demo/planner tests, frontend typecheck and catalog validation passed; browser verified optional task details, completion updates and a 390px layout without overflow. Light and dark themes inspected. Existing full-build disk-space limitation remains.
