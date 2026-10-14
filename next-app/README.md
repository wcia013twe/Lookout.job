# React application

The production frontend is Next.js App Router, React, and Tailwind. All workspace surfaces live here: Discover, Applications, Needs you, Referrals, Profile, onboarding, application review, resumes, rankings, saved answers, automation preferences, agent connections, and leaderboard.

```sh
npm ci
npm run dev
npm run build
```

From the repository root, `npm run dev` and `npm run build` delegate here. `.github/workflows/deploy.yml` builds and deploys `out/` to GitHub Pages with the configured project base path. It runs the domain tests, database checks, and catalog validation first. `public/` is generated from public catalog/branding assets; do not put candidate documents or credentials there.

`lib/workspace.jsx` connects React to the existing `store.js` namespaces and the serialized `cloud.mjs` controller. The controller accepts a React UI adapter rather than writing into the old static DOM. Guest and signed-in data remain separate. Backend ownership checks, revision checks, approval rules, immutable submission records, and exact saved-answer matching remain in the shared domain modules. Google OAuth continues to return to the board root, preserving owned batch locators.

`components/` contains reusable React views; `app/` contains the routes. UI styling uses Tailwind and `app/globals.css` tokens derived from Discover. `lib/progress.mjs` preserves browser XP/reward keys. `resume-model.mjs` at the repository root owns upload validation, hashes, and owner checks without mounting legacy UI.

The build emits a versioned service worker for public offline assets. No private Supabase responses or private resume links are cached by that worker. Browser edits persist in the same existing store; they remain available while account sync is paused.

The old root `index.html`, Web Components, and DOM controllers are retained as a historical rollback/reference. They are not included in the deployed React export. New UI work belongs here.

Validation: static production build, 144 domain/unit tests, database checks, browser profile save/reload, profile verification, queue/review/approval invalidation, tracker updates, referral persistence, template selection, and mobile/desktop rendering. Real authenticated Google sign-in, private file round trips, credential issuance, and employer submission remain live verification limits; no employer application was submitted during migration.
