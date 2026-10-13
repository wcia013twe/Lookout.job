# Changelog

## 2026-10-12 — Reliable tapping and Motion tear

- Replaced the snap-scrolling reveal row with one active card and explicit Previous/Next navigation.
- Focus restoration now uses `preventScroll`; unrevealed cards own the touch gesture.
- A single tap begins revealing; removed the rapid-tap timing requirement.
- Added Motion’s vanilla JavaScript mini engine for two interlocking ragged wrapper halves.
- Reference: Framer Marketplace Page Tear Transition; independently implemented, no marketplace code copied.
- Presentation keyframes stay in `styles/`; CSS tearing remains available when Motion cannot load.
- Added best-effort native-switch haptic ticks on iPhone reveal taps and claims, with Vibration API feedback on supported other browsers. iPhone feedback requires on-device verification.
- Validation: seven interaction regression tests and all 72 job records. Device rendering remains unverified.

## 2026-10-12 — Interactive pack opening

- Added a tear-open wrapper: slide the seal or tap; keyboard opening also works.
- Added a Three.js holographic foil shader that responds to touch and pointer movement.
- Added rarity-scaled particle bursts during card upgrades and the company reveal.
- Kept the new CSS and GPU shaders in `styles/`, separate from markup and interaction logic.
- Bundled Three.js locally; effects load only while opening a pack.
- Added reduced-motion and WebGL fallback behavior, capped render resolution, and cleanup on close.
- Validation: five interaction regression tests, syntax checks, and all 72 job records.
- Verification limit: no mobile browser or device rendering test in this environment.

## 2026-10-12 — Mobile card spotlight

- One focused card per mobile screen, swipe navigation, and Previous/Next controls.
- Hidden company identity until final reveal; larger logo and reveal animation.
- Compact header and safe-area spacing.

## 2026-10-12 — Pack review controls

- Reveal all and progress counter.
- Fixed duplicate XP rewards on replay, keyboard splitting, and modal focus handling.
- Normalized one internship employment type.
