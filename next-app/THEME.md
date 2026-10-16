# App theme

Discover defines the shared visual language: layered navy surfaces, subtle facets
and sheen, soft white text, and cotton candy pink accents. Keep component layouts
and use color to communicate actions and selection consistently.

The canonical Tailwind v4 theme is `app/theme.css`, imported by `app/globals.css`.
Use `bg-board-panel`, `bg-board-tag`, `text-board-text`, `text-board-muted`,
`text-board-accent`, `border-board-line` and the existing shared UI buttons.
CSS Modules use the corresponding `var(--color-board-*)` values.

- Background: `board-bg`; cards/dialogs: `board-panel`; nested controls: `board-tag`.
- Primary actions and selection: `board-accent`; hover: `board-accent-hover`;
  text on primary actions: `board-ink`; subtle selection: `board-accent-soft`.
- Text: `board-text`; descriptions: `board-muted`; borders: `board-line`.
- Status only: `board-success`, `board-warning`, `board-danger`.
- Shared layered surface: `--board-surface-gradient`.

The default dark accent is #f3b8d7. Light mode uses #96365f on pale surfaces;
the same utilities automatically follow `data-theme`. Do not define per-widget
accent palettes. Company logos, character/clubhouse imagery and user-selected
pack textures are content, not interface color tokens. WebGL materials use a
pink family in `lib/role-display.js`, where numeric color literals are required.

For demo review, compare Discover cards, daily drops and pack controls; Action
Board task/prep widgets; Profile tabs; Applications list and detail stages; and
Circle controls/attachments. Inspect both themes and narrow/wide layouts. Filled
versus outlined stages and the current-stage ring remain visible without relying
on color alone. Demo fixtures inherit the production theme without data changes.
