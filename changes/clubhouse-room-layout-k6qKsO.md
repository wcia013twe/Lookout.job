# Larger clubhouse room

- Give the embedded cottage the full content width; remove the permanent status rail and place selected companion activity beneath the room. Keep the room size stable when selecting people.
- Compact room settings into a responsive toolbar, with accessible previous/next arrow controls and existing 44px targets. Move the opt-in activity switch beneath the scene. Preserve the existing colors, motion, authored sharing and account boundaries.
- Remove the duplicate latest post from the recent-update list. Existing scoped website/MCP draft and publication actions are unchanged; no new backend action.
- Validation: 355 tests, catalog validation (76 roles), frontend TypeScript and production static export passed. Fictional preview checked at desktop and 390px mobile; companion selection, Escape/focus restoration and sharing on/off verified. Existing fictional fixtures cover these states without account writes.
- Mechanical detector flagged the existing goal-track tick separators as an accent-border pattern; those are functional dividers, unchanged by this pass.
- Dependency installation initially failed in the sandbox; restored dependencies from npm to finish verification. No dependency changes included. No external publication or live-account writes.
- Integrated concurrent Circle settings/navigation changes, retaining their mobile grid. Final merged validation: 357 tests, TypeScript and production export passed; desktop preview rechecked.
