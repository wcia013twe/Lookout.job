# application-pickup-preference

- Add a shared, account-synced application pickup preference to connection setup and My Agent; manual is the default.
- Add an onboarding link for returning users in My Agent and restore the Community navigation tab.
- Reconcile the choice through existing personal context and the owned change feed, with the existing human-only settings handoff. Keep background installation consent and submission approval separate.
- Exercise preference persistence, owner-isolated feed delivery, and isolated demo changes/reset; the demo starts with a fictional periodic preference.
- Validation: focused preference and migrated feed tests, `npm run validate:data`, frontend build and TypeScript typecheck pass. Full `npm test` reported 56 failures: one stale version assertion corrected afterward, and unrelated Career Ops vendor and stale search-document bundle failures.
- Limits: no signed-in live agent or scheduler was verified; a saved choice does not prove monitoring is running. No visual recording was produced. The frontend build succeeds with existing `useSlice` export warnings in `next-app/lib/network.jsx` and `next-app/lib/outreach.jsx`.
