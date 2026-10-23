# referrals-left-align

- Referrals’ empty outreach flow now begins on the same left edge as the page header, and its embedded outreach-template browser has been removed.
- Validation: `npm run validate:data`, production frontend build, and Impeccable detector passed.
- Limits: the full `npm test` suite is currently blocked in the database tests by an aborted PGlite transaction (`25P02`); this UI-only change was otherwise type-checked by the production build.
