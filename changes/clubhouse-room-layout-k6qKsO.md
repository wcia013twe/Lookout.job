# Larger clubhouse room

- Give the embedded cottage the full content width; remove the permanent status rail and place selected companion activity beneath the room. Keep the room size stable when selecting people.
- Compact room settings into a responsive toolbar, with accessible previous/next arrow controls and existing 44px targets. Move the opt-in activity switch beneath the scene. Preserve the existing colors, motion, authored sharing and account boundaries.
- Remove the duplicate latest post from the recent-update list. Existing scoped website/MCP draft and publication actions are unchanged; no new backend action.
- Validation: 355 tests, catalog validation (76 roles), frontend TypeScript and production static export passed. Fictional preview checked at desktop and 390px mobile; companion selection, Escape/focus restoration and sharing on/off verified. Existing fictional fixtures cover these states without account writes.
- Mechanical detector flagged the existing goal-track tick separators as an accent-border pattern; those are functional dividers, unchanged by this pass.
- Dependency installation initially failed in the sandbox; restored dependencies from npm to finish verification. No dependency changes included. No external publication or live-account writes.
- Integrated concurrent Circle settings/navigation changes, retaining their mobile grid. Final merged validation: 357 tests, TypeScript and production export passed; desktop preview rechecked.

## Companion activity bubble

- Replace the activity panel beneath the cottage with a warm ivory speech bubble anchored beside the selected companion. Position follows the actor's actual paused location, chooses a side and stays inside the scene; the pointer connects the update to its person. The room keeps its full width.
- Use a fixed bottom sheet on narrow screens. Long updates scroll within the bubble; opening brings it into view. Close, Escape and outside pointer dismissal are supported, with keyboard focus returning to the companion. Existing goal/help details and thread actions are preserved.
- Added explicit preview interaction guidance for short and long fictional updates, dismissal and mobile behavior. Fixtures remain in memory; existing website/MCP thread and publication boundaries are unchanged.
- Validation: TypeScript, all 357 tests, 76-role catalog validation and production static export pass. Desktop and 390px mobile visually checked; Escape, outside click, short/long updates, internal scrolling and Cheer opening the existing thread verified. Reduced-motion CSS disables the entrance animation. Mechanical detector only flags the existing functional goal tick separators.
- No account writes, external messages, push or publication. Live authenticated account flows were not exercised for this presentation-only change.
