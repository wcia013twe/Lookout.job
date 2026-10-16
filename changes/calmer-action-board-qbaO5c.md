# Calmer Action Board and clearer next steps

- Removed workspace gradients, glowing panel edges and glass blur in favor of neutral, opaque surfaces in both themes. Onboarding keeps its existing styling.
- Renamed the handoff widget to “Your next actions,” added section icons, and replaced empty disclosure squares with named action buttons. The demo opens its first review immediately and preserves review/approval safeguards.
- Replaced tall calendar tiles with a compact week strip and clearer selected/today states; moved daily budget controls below sessions and added labeled practice completion buttons.
- Validation: frontend typecheck; all 342 repository tests (including demo and preparation); catalog validation (76 roles); isolated browser preview verified task expansion, completion/reset and practice progress. Desktop visual inspection and 390px layout check (no horizontal overflow). Mechanical detector reported only the existing Inter font warning.
- Limits: full static production build failed because the machine ran out of disk space. Preview used production components and isolated demo services with navigation/review modal stubs. No backend actions or MCP contracts changed; existing scoped planner and application actions are reused.
