# App theme

Discover retains its original navy/glass surfaces, rainbow edge highlights and
rarity colors. The cotton candy palette has been withdrawn.

The extracted base Tailwind v4 palette remains in `app/theme.css`, imported at
the original theme declaration position in `app/globals.css`. Workspace, light-mode,
setup and action-widget overrides remain exactly as before the pink pass, in
`globals.css`. This preserves their original cascade and appearance.

Use the shared `bg-board-*`, `text-board-*`, `border-board-*` utilities and UI
buttons. CSS Modules use their matching `var(--color-board-*)` values. A future
palette change can build on this structure without starting over.

The tracker retains the preceding high-contrast amber reached stages, blue
upcoming outlines and current-stage ring. More recent Clubhouse layout and
ivory-bubble changes are preserved independently of this palette rollback.

The `/themes/` marketplace previews six bundled palette concepts for Dashboard and Circles using scoped CSS custom properties. Preview palettes do not override the app theme. Its sample content is fictional in both regular and demo modes; favorites last only for the mounted page. See `docs/theme-picker.md` for the human action boundary and demo walkthrough.
