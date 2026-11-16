# Rename Career Toolkit to Prep

- Renamed the visible workspace navigation, dashboard tour, prep workspace headings, breadcrumb, metadata titles, reminders, document feedback, theme preview, and UI checks from Career Toolkit to Prep.
- Preserved the `/career-toolkit/` route and internal toolkit identifiers for compatibility.
- Validation: `node --test tests/dashboard-tour.test.mjs` passed; `npm run validate:data` passed; `npm run build` passed with existing `useSlice` import warnings; `npm test` reached 1,456 passing tests and 3 unrelated baseline failures.
- Limits: full-suite failures remain in vendored executable hash/provider count checks and stale search-document generation; no visual browser recording was run for this text-only rename.
