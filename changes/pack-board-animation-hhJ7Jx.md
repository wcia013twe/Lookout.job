# Pack to board animation

- Closing a pack after opening its seal clears Discover filters and deals matching canonical board cards into place, with a bounded stagger, board scroll, repeat support and reduced-motion feedback. Dismissing a sealed pack does not trigger the handoff.
- Matches posting URLs first, then normalized company/title/location. No jobs, applications or submission receipts are created by the animation. Existing scoped pack feed reads remain unchanged; this is presentation of existing data, with no new service action.
- Demo: added fictional full-time and internship pack entries matching resettable board fixtures to exercise both grids. Demo remains in memory with no external actions.
- Validation: TypeScript typecheck, data validation (147 roles), and five card-pack contract tests passed.
- Limits: visual browser verification not run. Only pack jobs already present in the current Discover data animate; unifying all task discoveries is not implemented by this presentation change.
