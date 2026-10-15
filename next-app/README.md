# React application

[`../product.md`](../product.md) records the product vision and roadmap; it is preserved unchanged. The root README describes current implementation. [`AGENTS.md`](AGENTS.md) records React/Next.js implementation rules. The root README owns operating contracts; `DESIGN.md` owns visual decisions; `CHANGELOG.md` owns change history. Keep one canonical copy of each document.

The production frontend is Next.js App Router, React, and Tailwind. All workspace surfaces live here: Discover, Applications, Action Board, Referrals, Profile, onboarding, application review, resumes, rankings, saved answers, automation preferences, agent connections, and leaderboard.

```sh
npm ci
npm run dev
npm run build
```

From the repository root, `npm run dev` and `npm run build` delegate here. `.github/workflows/deploy.yml` builds and deploys `out/` to GitHub Pages with the configured project base path. It runs the domain tests, database checks, and catalog validation first. `public/` is generated from public catalog/branding assets; do not put candidate documents or credentials there.

`lib/workspace.jsx` connects React to the repository-level `../lib/store.js` namespaces and the serialized `../lib/cloud.mjs` controller. The controller accepts a React UI adapter rather than writing into the old static DOM. Guest and signed-in data remain separate. Backend ownership checks, revision checks, approval rules, immutable submission records, and exact saved-answer matching remain in the shared domain modules. Google OAuth continues to return to the board root, preserving owned batch locators.

`components/` contains reusable React views; `app/` contains the routes. UI styling uses Tailwind and `app/globals.css` tokens derived from Discover. `lib/progress.mjs` preserves browser XP/reward keys. `lib/resume-model.mjs` at the repository root owns upload validation, hashes, and owner checks without mounting legacy UI.

The build emits a versioned service worker for public offline assets. No private Supabase responses or private resume links are cached by that worker. Browser edits persist in the same existing store; they remain available while account sync is paused.

The static frontend in `../legacy/` is retained for regression/reference and is excluded from the production export. New UI work belongs here. `npm run build:auth` from the repository root rebuilds its reference auth bundle; serve the repository root when inspecting `legacy/index.html` so shared modules and catalog URLs resolve.

## Profile verification and demo checks

Profile panels stay mounted after first use so switching sections preserves unsaved fields; leaving the route still requires saving. Default resume selection belongs to Application kit and uses `workflow.searchPreferences.defaultResumeId`. Progress and leaderboard settings are reached through the header XP menu.

In admin Demo mode, edit an About me field, switch to Application kit and return to verify the unsaved edit remains. Save and check fact verification. Inspect the fictional resume, unverified saved answer and preferences. Open My agent to edit the fictional search targets and inspect agent connection controls; switch sections and return to check draft preservation. Reset demo and confirm the original fixtures return without changing account records. Check Progress through the XP menu.

Search targets live inside My Profile → My agent and describe where Muse looks, separately from fit profiles. They use `preferences.search.targets` and `targetsVersion`; website/MCP `save_search_targets` share owner/version checks. Autosync preserves targets, and guest changes remain local. Saving a target does not create a scanner, schedule or social connection; social content requires runtime access or a user handoff.

## Character asset provenance

The three PNGs in `assets/agents/` were supplied by the user on October 13, 2026. They are intact character references rather than source GIFs. The Grok Bot reference bears Bleap branding and its official identity remains unverified; replace it when a confirmed asset is supplied. Selecting a character does not establish an agent connection.

## Scaffold and migration status

The production presentation has migrated to React. State and shared domain integration still depend on the shared `../lib/` modules and `window.JB` bridge; a complete module migration has not yet happened. Shared models, `lib/store.js`, `lib/cloud.mjs`, and `backend/client.mjs` are active dependencies, not automatically disposable legacy files.

Keep the existing `next-app/` application boundary. Adding `src/` or renaming the application is optional and does not itself reduce JavaScript or duplication. Use these boundaries as code is consolidated:

- `app/`: routes, layout and global theme styles; route-only components/hooks may live in `_components/` and `_lib/` beside their page.
- `components/`: UI shared across routes, including the shell and common controls.
- `lib/`: explicit browser state, account/sync adapters, shared hooks and frontend utilities. Convert the global bridge to modules incrementally, preserving guest/account data and backend semantics.
- `public/`: public assets only. It is currently generated by `scripts/prepare-public.mjs`; changing this ownership requires updating the build and offline worker together.
- Root `data/`, `lib/`, backend contracts, tests, and `supabase/`: shared inputs and behavior. Keep models used by multiple runtimes shared; do not copy them into each UI or runner.
- Root `runner/`: separate Playwright/MCP runtime and dependencies; browser automation must not enter the frontend bundle.

Do not introduce a second feature hierarchy alongside route colocation. Create shared components or abstractions when actual reuse warrants them. Next.js accepts both route colocation and external component folders; `src/` is optional.

The static export has build-time Server Components and browser-loaded private account data. Keep interactive client boundaries narrow where practical, but do not propose request-time Server Actions or session rendering while deployment remains GitHub Pages. Keep optional GPU effects lazy-loaded and public offline behavior intact.

Consolidation proceeds by reconciling numbered copies, tracing live imports before removing old presentation, replacing the global store/service bridge, and reducing broad subscriptions. Preserve every product feature throughout. This document records the direction; it does not claim those refactors are complete.

References: [Next.js project organization](https://nextjs.org/docs/app/getting-started/project-structure), [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components), [static exports](https://nextjs.org/docs/app/guides/static-exports), [React Effects](https://react.dev/learn/you-might-not-need-an-effect), and [external store subscriptions](https://react.dev/reference/react/useSyncExternalStore).

Validation: static production build, 144 domain/unit tests, database checks, browser profile save/reload, profile verification, queue/review/approval invalidation, tracker updates, referral persistence, template selection, and mobile/desktop rendering. Real authenticated Google sign-in, private file round trips, credential issuance, and employer submission remain live verification limits; no employer application was submitted during migration.

## Profile navigation

The top-left profile avatar opens My Profile, Sharing & privacy, and sign-in/sign-out. My Agent stays inside My Profile. Sharing & privacy opens the existing Progress page and its opt-in leaderboard controls. Main navigation focuses on Action Board, Discover, Applications and Referrals. The Action Board combines human handoffs with deadline-driven preparation reminders; completing a preparation task clears it from the active checklist through the same owned preparation service exposed to Muse.

Demo check: open the avatar, visit My Profile and My Agent, return to Sharing & privacy, and reset the fictional profile. Check Escape, outside click and keyboard tab dismissal. The dropdown reads existing demo state and uses existing authentication actions; no new backend or MCP action is introduced.

## Job preference profiles

Job preferences groups roles/experience, locations/working style, companies/industries,
skills/compensation, exclusions and values. Each criterion has an optional Required,
Preferred or Flexible priority. Each named search profile independently maintains
career goals, tradeoffs and an associated tier-list ID. Profile facts and employment
answers stay shared. Multiple active profiles are supported; paused profiles remain
editable. Unsaved drafts survive switching profiles and Profile sections, and reset
when the account or demo epoch changes.

The editor uses the existing versioned `save_search_profile` RPC and
`save_search_profile` MCP tool (`preferences.profile.save`, preferences:write).
The six established filters and seven evaluation priorities retain their existing
structured fields. Additional criteria, flexibility, goals and tier-list references
are labeled text in `instructions`, available in existing personal context. This
is agent guidance, not a new deterministic filtering engine. Preserve these labeled
lines during agent edits; tier-list ID is authoritative, with current list data in
the workspace. Company priority does not override role/team evidence. Deleting a
referenced list shows an unavailable selection until a replacement is chosen.

Tier-list edits save through the established shared list boundary; changes affect
all profiles referencing that list. Associating a list requires Save profile and
does not alter automatic-submission review policy. Notification cadence, automation,
and review thresholds now live in My agent. Existing values and permissions remain.

Demo has fictional full-time and paused internship profiles with separate goals
and company lists. Verify edit/save/reload, switch profiles with unsaved text, pause
and resume, maintain/associate a tier list, and reset to restore demo defaults.

Work-life balance and Employer benefits are editable criteria with individual flexibility settings, saved as labeled instructions. They support descriptive preferences about hours, on-call, boundaries, leave, insurance, retirement match and learning budgets; unknown listing details remain questions for verification.
