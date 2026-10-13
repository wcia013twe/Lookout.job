# Changelog

## 2026-10-12 — Supabase backend foundation

- Added relational schema for private profiles, preferences, resume versions, answer library, morning batches, applications, immutable approvals, and deduplicated activity.
- Added shared employer job catalog, private resume Storage bucket, protected opt-in leaderboard metrics, and private agent credential hashes.
- Added ownership RLS, cross-owner foreign keys, server-controlled draft revisions, and checked approval RPC with exact snapshots.
- Added reusable authenticated client adapter and detailed Muse/deployment handoff.
- Validation: disposable PostgreSQL schema/isolation/approval/storage-policy checks pass; existing 20 tests and all 72 roles pass.
- Deployment pending organization/cost confirmation; cloud UI sync, agent gateway, leaderboard score computation, and SMS remain unconnected.

## 2026-10-12 — Ranked starter profiles and JSON lookup

- Added separate Full-time and Internship starter profiles with subjective initial company rankings.
- Set Oracle at C-tier as the full-time baseline.
- Moved company names, tier labels, baseline, branding, and preset placements into `data/tierlist-presets.json`.
- Added a configurable JSON source for white-label reuse and non-destructive starter seeding.
- Preserved saved custom lists and edits; defaults copy into browser state rather than replacing user data.
- Validation: 20 tests and all 72 job records pass. Mobile rendering remains unverified.

## 2026-10-12 — Saved company tier lists

- Added a Profile tier-list builder seeded with 26 tech companies, all initially unranked.
- Added drag handles for mouse/touch and a tap/select/Move alternative for keyboard and iPhone.
- Added creating, duplicating, renaming, and switching between saved list profiles, editable tier labels, custom company tiles, and within-tier ordering.
- Reused local company logos when available and initials otherwise.
- Lists persist through the existing browser store; one profile’s edits do not change another.
- Kept presentation in `styles/` and reused Motion for move feedback.
- Validation: 18 regression tests, saved-profile persistence, and all 72 job records pass. Touch dragging and mobile rendering still need on-device verification.

## 2026-10-12 — Application workflow scaffolding

- Added Needs you, Discover, Applications, and Profile tabs.
- Added a local application queue, editable question/resume review dialog, blockers, versioned approvals, and an activity timeline.
- Added verified factual profile fields and resume references.
- Preserved existing tracking, interview pipeline, referrals, and networking inside Applications.
- Opening a posting records opening, not submission; approval never marks an application submitted.
- Added basic Motion panel transitions; visual CSS and animation definitions remain in `styles/`.
- Automation, question extraction, server sync, and text notifications are not connected. All new state is browser-local.
- Validation: 13 tests, including approval invalidation and persistence migration; all 72 job records and page structure checks pass. Mobile rendering remains unverified.

## 2026-10-12 — Refresh deployed layouts reliably

- Confirmed the compact dashboard is deployed on GitHub Pages.
- Versioned CSS/JS requests and changed service-worker network requests to revalidate HTTP cache entries.
- Service-worker installation reloads assets instead of precaching stale browser responses.
- Added an update notice so the user can reload after a new worker activates without losing in-progress form input unexpectedly.
- Validation: syntax checks and live HTML/CSS checks.

## 2026-10-12 — Mobile dashboard layout

- Replaced the oversized hero with a compact title and scan date.
- Collapsed XP details into a progress disclosure, keeping XP/streak visible.
- Made all four navigation tabs fit on mobile and added arrow-key navigation.
- Put search and employment type on one responsive row.
- Simplified the pack entry and moved tracking instructions into a disclosure below the roles.
- Preserved the role basics, expandable analysis, tracker, and pack interactions.
- Dashboard presentation lives in `styles/dashboard.css`.
- Validation: existing regression suite, data validation, source structure checks. Mobile rendering remains unverified.

## 2026-10-12 — Compact role cards and basic tags

- Replaced oversized role-card artwork with a compact logo, company, and company-tier header.
- Added employment type, title year, location, and compensation tags. Compensation is extracted from existing analysis; base salary is never labelled TC.
- Kept a one-sentence preview visible; full analysis, official titles, and provenance remain expandable.
- Kept the canonical job data and application tracking behavior intact.
- New styles live in `styles/role-cards.css`.
- Validation: compensation-label regressions, existing pack tests, and all 72 job records. Mobile rendering remains unverified.

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
