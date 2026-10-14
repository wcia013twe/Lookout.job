## 2026-10-14 — Search profiles and scoped MCP product actions

- Added deterministic prompt/pill editing with separate database-backed filters, evaluation priorities and prose instructions; profiles support named searches, pause, version conflicts and reload.
- Added 20 scoped product tools plus search-profile saving while preserving all 32 current interfaces. Added the MCP parity rule and optional connection permissions; human approval, verification and uncertain submission recovery remain explicit handoffs.
- Reused the existing owner-keyed contact table and revision trigger. Preserved profile-setup permissions, newer quiet settings and timelines, and protected scoped search profiles from ordinary browser sync.
- Expanded fictional demo search profiles and isolated editor save/reload/reset from account storage. Local validation: 235 unit tests, database suite, 76 catalog roles, auth bundle and production static export pass.
- Verification limits: hosted storage and full HTTP tool actions await deployment. Published as a draft PR; the broader Supabase deployment remains blocked by automatic approval review pending explicit approval.

## 2026-10-13 — Compact Profile workspace

- Replaced the long Profile page with an overview and four focused sections: About me, Application kit, Job preferences and My agent. Visited sections stay mounted to preserve unsaved edits while switching. Experience, education and projects use expandable summaries; profile Save remains sticky.
- Moved the default resume control into Application kit, retained human verification and existing scoped tool contracts, and moved leaderboard settings to Progress through the header XP menu. Setup remains prominent for incomplete profiles.
- Expanded isolated admin demo facts and saved answers; documented the section/edit/reset walkthrough in docs/profile-workspace.md.
- Validation: catalog (76 roles), JSX bundle, UI detector and demo reset isolation passed. Fictional browser preview verified section switching, unsaved draft retention, save-to-overview updates and 390px overflow. Preview used exported theme CSS; Next.js build did not complete; the local dev server reported an invalid installed dependency package config, so production export and live account behavior remain unverified.



## 2026-10-13 — GitHub feature queue and serialized integration

- Added read-only PR CI with tests, schema checks, catalog validation and production export build; shared it with the existing Pages deployment.
- Added a GitHub-hosted merge-ready queue using trusted-main code, current-main integration and exact-head squash merges. Explicit dispatch handles GITHUB_TOKEN workflow suppression; production failure pauses subsequent merges.
- Serialized Pages releases without canceling active deployments. Backend deployment remains separate.
- Updated agent instructions to use feature worktrees and PRs instead of direct pushes/shared production mutation. Added repository protection configuration and queue operator documentation.
- Validation: queue race/failure/scope tests, full regression suite, database checks, catalog validation and optimized production build; hosted workflow/protection verification is recorded in the PR. No candidate data or employer application was sent.

## Application progress and resume evidence

- Surface active callbacks first, with vertical completed/scheduled/undated milestones.
- Emphasize exact submitted resume versions from immutable attempt evidence.
- Add owned, idempotent timeline services and scoped MCP tools for authorized email updates.
- Move skipped-role explanations to occasional Muse insights and extend isolated demo coverage.
- Validation: 219 tests, owner isolation/idempotency database checks, 76-role validation, production build and desktop/mobile demo interactions with zero backend requests; email ingestion requires Muse’s authorized runtime.

## 2026-10-13 — Rainbow glass onboarding

- Applied the supplied reference’s dark glass surfaces, curved illuminated backdrop, and cyan/mint/lilac/pink edge lighting to onboarding only. Retained static characters, two-step flow, native choices and visible focus.
- Validation: production export and catalog validation; mobile/desktop visual review. No onboarding animations introduced.

## Internal Muse guide library — 2026-10-13

- Added backend-only résumé parsing and cold outreach guides, a lightweight versioned index and scoped read_guide tool. Full instructions load only when relevant.
- Guide reads reuse existing credential/context authorization; no schema or permissions changes. Developer version 10 triggers discovery/context refresh.
- Demo parsed profile stays unverified and existing fictional referral drafts illustrate guide outputs; demo remains isolated.
- Validation: full tests, database/data checks and production build; authorization rejection and unknown-guide behavior tested. No real résumé parsing or external Muse run performed.

## 2026-10-13 — Static onboarding

- Removed character idle motion, step arrival animation, and pause/resume controls. Character selection and the full-screen setup layout remain interactive without animation.
- Validation: production export, catalog validation and source checks confirm setup motion and its controls are removed.

## 2026-10-13 — Muse onboarding handoff

- Removed the About you step and required name/introduction entry. Setup now takes two steps and preserves existing profile facts.
- Finishing with Muse directs the user to talk to Muse and share a resume or Simplify PDF, with a copyable request and profile-review link. Manual profile entry remains available; no external conversation opens automatically.
- Validation: production export, catalog check and browser verification of the two-step completion/handoff passed.

## 2026-10-13 — Daily Discover and pack history

- Default Discover and zero2sudo drops to their latest day. Added date selectors and All history; search and employment filters still narrow Discover. Historical Discover includes previously opened roles; pack XP remains restricted to today.
- Validation: 76-role data validation and UI detector passed. Build and standalone JSX checks stalled without diagnostics; browser verification remains unverified. No existing admin demo fixtures were found for these boards.


## 2026-10-13 — Full-screen cinematic setup

- Start setup now opens a dedicated full-screen onboarding scene, removing dashboard navigation, account controls and progress stats during setup. Exit setup returns to Profile.
- Added a large selected-character stage, compact companion choices, gentle step transitions and focused profile/introduction screens. Preserved native selection, stored profile behavior, pause motion and reduced-motion support.
- Validation: 179 tests, production export and catalog checks passed; desktop/mobile browser checks confirmed selection, motion control, Continue, and Exit restoring the dashboard. Supplied image provenance and GIF limitations remain unchanged.

## 2026-10-13 — Agent character selection

- Added Dot, Grok Bot and Muse character cards to Profile’s onboarding flow, alongside platform suggestions and a custom agent option. Uses user-supplied PNG references with optional idle motion, native radio selection and reduced-motion support.
- Saves the chosen provider/name with the existing profile; selecting a character does not create an external connection. The supplied Grok reference bears Bleap branding and is not verified official artwork; source GIFs were not supplied.
- Validation: 177 tests, catalog validation, production export, mobile/desktop visual checks, selection/pause/continue and setup-save checks passed. Existing Discover theme tokens are preserved.

## 2026-10-13 — Admin demo workspace and company logos

- Added an admin-gated in-memory demo workspace with representative roles, applications, profile, tiers and Robinhood/Stripe outreach. Reset/exit preserve real records; demo client access and real submission recovery are disabled.
- Added company logos to referral groups and selected contacts, including Robinhood’s verified official public icon.
- Saved the requirement to update demo fixtures and interactions after every completed feature in AGENTS.md.
- Validation: 179 tests, database/data checks, production build and UI detector passed; Robinhood/Stripe logo loading verified in the browser. Server-managed demo access enabled only for the requested account.

## 2026-10-13 — Backend-hosted outreach preparation

- Removed user-facing agent prompts and JSON import. Prepare with Muse queues company outreach on the backend; signed-in contacts and finished drafts sync automatically.
- Served the full cold-outreach skill through versioned developer context and added scoped read/save tools. No local skill installation needed; requests wait for Muse’s next connected run.
- Added owner RLS, optimistic contact revisions, tombstones, idempotent request completion and protection of human outreach status.
- Validation: 150 tests, schema/data checks, production export, desktop/390px browser checks, skill validation and transactional live-backend save/retry smoke passed. No outreach-related security advisory. No external outreach was sent; external agent wake-up is not a backend capability.

## 2026-10-13 — Company-based referral outreach

- Replaced generic referral tables/templates with company contact groups and editable, copy-ready messages; added role-type SVG icons, LinkedIn/job links, subject copy, follow-up details and mobile contact-to-message navigation.
- Added manual entry and Muse browser/JSON handoff with atomic validation and duplicate updates that preserve history. Retained existing referral and network records.
- Created and locally installed the cold-outreach skill from Nick Singh’s guidance.
- Validation: 141 tests, schema checks, 76-role validation, production export, skill validation, detector and desktop/390px browser checks. Verified manual entry, import, copy and edit/reload persistence. Contacts remain browser-local; autonomous Muse research and delivery are not connected services.

## 2026-10-13 — Muse profile package writes and private resume setup

- Added owner-scoped profile:write setup permission, human-only enable/disable on existing connections (same token), and explicit setup access on new full connections. No existing key gains access automatically.
- Added HTTP/MCP save_profile_package for merged facts, proposed saved answers and owned default-PDF selection; personal-version conflicts and stable retry receipts prevent stale overwrites and duplicates. Facts/changed answers remain unverified; requested autofill permission is a proposal, not human review.
- Added begin/complete private resume uploads with measured byte count, PDF/DOCX signature checks, SHA-256 verification, immutable paths and owned variant/hash reuse. Local upload_profile_resume handles bounded user-provided files without launching a browser. Upload bookkeeping does not block owner resume deletion.
- Deployed migration chain and gateway/MCP developer version 7. Preserved concurrent Applications/Referrals and backend-logo changes. Profile shows imported proposals and setup-access controls; cache v35. Reload account loads agent imports.
- Validation: full test suite, schema/ownership checks, data validation, rebuilt auth bundle; hosted disposable upload → eight-answer import → default selection → readback → exact retry → identical-resume reuse and discovery passed, with fixture user/file cleanup confirmed. No real profile package or employer application was sent. Muse host discovery/restart remains user-side; general preference writes and agent-created human approvals remain unavailable. Security advisors retain only intentional private RLS/no-policy notices and the pre-existing leaked-password setting warning; [Supabase remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## 2026-10-13 — Backend-only company logos

- Removed 66 bundled company images and local fallback paths; unavailable backend logos show initials.
- Logo maintenance verifies the backend manifest and accepts upload sources from an external directory.
- Validation: 133 tests, database checks and 76-role validation passed.

## 2026-10-13 — Simplify-shaped profile and gradual React migration

- Put the candidate profile first with identity, job-search status, repeatable work experience, education and projects, GitHub/other links, skills, preferred skills and languages. Keep resume variants and existing application preferences available.
- Added a shared profile field schema, stable labelled native controls and structured private JSON facts. Edits, removed/added entries and silent nested autofill invalidate prior verification. Preserve unknown profile metadata and existing guest/account storage namespaces.
- Started an isolated Next.js 16 / React 19 / Tailwind 4 static-export preview in `next-app/`, sharing the production schema with a server-rendered shell and client-only interaction. No production framework cutover or preview persistence yet; account/auth/approval parity gates future migration.
- Validation: 133 tests, database ownership/schema checks, 76-role validation, rebuilt auth bundle, optimized Next build, browser add/save/reload/edit checks and 390px layout without horizontal overflow. Cache v31. Existing global design-detector warnings remain outside this pass. Live Simplify Copilot recognition and signed-in cloud round-trip remain unverified; no personal reference-PDF values were published.

## 2026-10-13 — Autofill-compatible application profile

- Added stable standard field IDs, explicit labels, native input types/autocomplete and LinkedIn/portfolio fields for Simplify/browser form recognition.
- Imported or edited values clear verification, including silent autofill; extension-generated checkbox events cannot mark facts human-reviewed.
- Preserved account autosync and server ownership; no Simplify SDK/API, automatic approval or fake compatibility claim. Cache v30.
- Validation: verification/autofill/account-reset checks and existing suite. Live Simplify recognition remains unverified and may require their site-support request.

## 2026-10-13 — Guarded Greenhouse auto-submission

- Added submit_application to the local MCP runner: current authorization, native prefill/validation, atomic claim, one-use short-lived permit, one Submit click, and supported employer confirmation detection.
- Routine matches use verified facts, explicit résumé rules/defaults and permitted exact saved answers without forging human approvals; important matches require exact approval. Uploaded PDF bytes and live form fingerprint must match.
- Added scoped database attempts, in-flight draft freezing, duplicate protection, revoked/stale-context checks, idempotent result reporting and human-only negative verification for uncertain outcomes. Explicitly removed Supabase's default client write grants.
- Added default PDF selector, verified first/last-name fields and uncertain-attempt recovery in review; rebuilt auth bundle and cache v29. Developer contract v6 documents actual submission tools and limits.
- Validation: 127 tests, migration-chain checks, hosted rollback authorization/claim/receipt/recovery checks and 75 public roles pass. No real employer application submitted. Live Muse/employer verification remains; Ashby/Workday, CAPTCHA, custom controls, extra documents and unsupported confirmation pages remain manual. Confirmation is labelled runner-observed evidence, distinct from user-reported progress.

## 2026-10-13 — Importance-based application review policy

- Added separate full-time/internship company-list choices and review thresholds, default A and above; changes autosync through existing personal-version flags.
- Added deterministic, account-scoped read_application_policy tool using canonical employer facts; excluded roles skip, important/unknown/ambiguous ranks review, routine ranks select the auto-apply policy.
- Developer contract v5 tells Muse to prepare important matches fully and text a focused review; unfamiliar questions/blockers always pause. Theme labels do not alter tier semantics.
- Policy does not bypass the existing approval boundary: automatic runner authorization, duplicate-safe submission and receipts remain unfinished. No employer submission performed.
- Validation: 112 tests, database migration/ownership checks and 75 job records pass; frontend cache v28.

## 2026-10-13 — Muse auto-submit preference

- Added a default-off Profile switch that saves immediately and uses existing account autosync/personal-version updates.
- Developer contract v4 maps the setting to Muse: off stops before submission, on prefers a supported submit tool for the exact approved draft. Approval and confirmation requirements remain enforced; bundled runner still prefills only.
- Validation: preference persistence/hydration/account switching and existing tests; no live employer submission performed. Frontend cache v27.

## 2026-10-13 — Copy raw agent token for Muse

- Added a separate Copy token button for secure secret fields; retained Copy MCP setup for full client configuration.
- Clarified the two formats and disabled token-field autocapitalization/spellcheck. Bumped frontend cache to v26.
- Validation: JavaScript syntax, existing test suite and data validation pass. User’s private credential and Muse host authentication remain unverified.

## 2026-10-13 — Runnable local application MCP and Muse developer version 3

- Added a local stdio MCP adapter with a dedicated lazy Playwright browser; forwards hosted data tools and exposes inspection, private résumé fingerprinting and approved prefill.
- Implemented a fixed-endpoint gateway loader for current approval, public canonical job and bounded private Storage downloads; no caller-provided authorization records or custom loader required.
- Prefill navigates to the approved job and rechecks approval before filling; missing browser/recovery routes to Needs you through the deployed failure tool.
- Updated versioned Muse instructions, one-time client configuration and README refresh prompt. No model dependency, Submit tool, or embedded agent recovery.
- Validation: 100 tests, database migration/ownership checks and 75 job records pass. Live Muse registration and live employer forms remain unverified; local stdio needs a compatible agent host.

# Changelog

## 2026-10-13 — Bounded runner recovery and Needs you reporting

- Added Playwright-first prefill with one optional agent recovery and independent deterministic validation.
- Added revision-checked, deduplicated failure reporting that preserves answers and records a reason/next action in Needs you.
- Uncertain submission outcomes pause without retry; failed reporting remains pending rather than claiming website success.
- Updated developer instructions/version to 2. Browser-runtime/recovery hooks, notifications and actual submission still need client integration.
- Validation: 94 tests, complete migration checks and 75 jobs pass. Hosted failure checks cover scope/ownership, stale writes, idempotency and final-state protection.

## 2026-10-13 — Public company logo cache

- Cached and hash-verified 66 existing public branding images in Supabase Storage; company-name lookup uses immutable URLs with local/initials fallbacks.
- Retired the one-time privileged bootstrap; browser writes are denied. Added maintenance verification and cache version 25.

## 2026-10-13 — Two-version agent context checks

- Added scoped context-version, personal-settings and developer-instruction tools to HTTP/MCP.
- Personal profile/preferences/resume/answer changes advance a private per-user counter; unchanged saves and application history do not.
- Added a versioned developer JSON contract with personal settings mappings, themed message defaults and current capabilities.
- Added per-connection cache helper: refresh changed sections, bootstrap on lost context, acknowledge only after successful reads; no Jev/model calls.
- Documented client memory responsibilities; the server does not create permanent Muse/Dot/Grok memory.
- Validation: 82 tests, migration-chain checks and 75 job records pass; hosted rollback checks cover version changes, ownership, scopes and revocation. Gateway/MCP deployed.

## 2026-10-13 — Minimal Muse onboarding prompt

- Documented the copy-and-paste prompt: morning full scan, noon/evening Instagram story scans, and text updates.
- Clarified that app-side instructions own workflow and themed messaging; scheduling is not activated by this documentation update.
- Documentation-only change; reviewed the saved prompt.

## 2026-10-13 — Adapt licensed browser primitives without Jev

- Extracted MIT-licensed visibility/label primitives from jev-browser and ATS entry selectors from job-application-agent; pinned source commits and retained full notices.
- Added local Muse tool wrappers for form inspection, current-approval prefill and explicit owned-resume selection. No decision model or new dependency tree.
- Added reviewed native radio/checkbox handling, complete required multi-field checks, all-binding preflight and conditional-form checks after each fill.
- Stopped ambiguous entry controls, cross-job navigation, overlapping resume rules and duplicate approved answers.
- Validation: all 75 tests pass, including 16 runner tests; complete migration-chain checks and all 75 public job records pass. Browser runtime registration, live employer execution and automatic submission remain unconnected.

## 2026-10-13 — Connected agent and application workflow

- Deployed scoped, expiring/revocable Muse credentials, an HTTP gateway and a custom MCP endpoint; agents cannot approve or submit applications.
- Added private PDF/DOCX resume uploads, immutable versions and short-lived downloads; added search preferences and optional leaderboard controls to Profile.
- Connected versioned draft preparation, human approval, manual progress reporting and a durable server timeline. Submitted drafts retain their evidence.
- Hardened serialized autosync, account switching, canonical job hydration and private batch fallback. Public browsing opens directly; packs are optional.
- Added Greenhouse inspection and strict approved browser prefill scaffolding with honest handoffs; no automatic employer submission is enabled.
- Consolidated schema ownership into migrations and documented the intended daily interaction, module boundaries and remaining integration work.
- Validation: 67 tests, complete migration-chain checks and 75 public job records pass. Hosted owner/scope/revision checks pass. Real Google sign-in, iPhone interactions and live employer prefill remain unverified.
- Remaining operational review: password leaked-credential protection is disabled in hosted Auth; account export/deletion, file cleanup, rate limits and abuse controls are pending.

## 2026-10-13 — Account auto-sync and private batch links

- Connected signed-in profile, tier lists, saved answers, resume references and applications to owner-scoped Supabase records.
- Added debounced background sync, locally retained pending edits, reconnect retry, and explicit conflict reload. No separate save-to-account step.
- Routed owned morning batch links into Discover while keeping public browsing and guest data local.
- Switched signed-in approvals to the backend RPC and restricted client status writes; stale application revisions are rejected.
- Validation: 28 tests, 75 job records, hosted approval/stale-write/batch isolation checks, and clean security advisors. Full OAuth/mobile UI verification remains pending.
- Agent gateway, full server timeline, legacy tracking/XP/networking sync, and resume-file UI remain unconnected.

## 2026-10-13 — Google provider enabled

- Verified Google is enabled through hosted Auth settings after owner setup.
- Verified the deployed app references the Google auth bundle.
- Login remains optional for public browsing and local tools; cloud sync and agent access remain unconnected.
- Full user OAuth round-trip verification remains pending.

## 2026-10-13 — Google account scaffolding

- Added locally bundled Supabase Google OAuth client, PKCE callbacks, remembered sessions, sign-out, and provider readiness checks.
- Opened public Discover by default and preserved the existing local workspace.
- Isolated local state per account and cleared draft/form/drag state on account changes. Google sign-in does not silently import guest records.
- Pinned dependencies and added a reproducible auth bundle build. Excluded OAuth callbacks from service-worker caching.
- Validation: 25 tests and all 75 job records pass. Project settings confirm Google is disabled; full OAuth and mobile rendering remain unverified.
- Activation needs Google OAuth credentials and redirect configuration in Supabase; cloud sync and Muse access are still unconnected.

## 2026-10-13 — Saved answer controls

- Added Profile saved answers with editing, deletion/Undo, reuse permissions, review check, and optional company scope.
- Blank draft answers autofill only from a single reviewed exact-question match; other matches offer explicit Use saved answer. Existing text is preserved.
- Added saved-answer ID/version provenance; changing question content requires fresh question-list review. Saved answer edits never rewrite existing drafts.
- Added owner-scoped Supabase control fields, verification constraint, and client save/delete methods. Browser UI remains local until login/sync is connected.
- Validation: 23 regression tests and hosted verification-constraint check pass. Mobile rendering remains unverified.

## 2026-10-13 — Hosted Supabase deployment

- Deployed the backend to job-board in personal-projects, US East.
- Seeded 75 shared employer job records without personal fit reasoning or application statuses.
- Verified all 11 public tables have RLS and the resume bucket is private.
- Added missing job foreign-key indexes and explicit client denial for agent credentials.
- Hosted ownership/approval/revision checks pass; disposable fixtures rolled back. Security advisors report no findings.
- Recorded exact hosted migration versions and project metadata for Muse. Browser cloud sync and agent gateway remain unconnected.


## 2026-10-12 — Supabase backend foundation

- Added relational schema for private profiles, preferences, resume versions, answer library, morning batches, applications, immutable approvals, and deduplicated activity.
- Added shared employer job catalog, private resume Storage bucket, protected opt-in leaderboard metrics, and private agent credential hashes.
- Added ownership RLS, cross-owner foreign keys, server-controlled draft revisions, and checked approval RPC with exact snapshots.
- Added reusable authenticated client adapter and detailed Muse/deployment handoff.
- Validation: disposable PostgreSQL schema/isolation/approval/storage-policy checks pass; existing 20 tests and all 75 roles pass.
- Deployment pending organization/cost confirmation; cloud UI sync, agent gateway, leaderboard score computation, and SMS remain unconnected.

## 2026-10-12 — Ranked starter profiles and JSON lookup

- Added separate Full-time and Internship starter profiles with subjective initial company rankings.
- Set Oracle at C-tier as the full-time baseline.
- Moved company names, tier labels, baseline, branding, and preset placements into `data/tierlist-presets.json`.
- Added a configurable JSON source for white-label reuse and non-destructive starter seeding.
- Preserved saved custom lists and edits; defaults copy into browser state rather than replacing user data.
- Validation: 20 tests and all 75 job records pass. Mobile rendering remains unverified.

## 2026-10-12 — Saved company tier lists

- Added a Profile tier-list builder seeded with 26 tech companies, all initially unranked.
- Added drag handles for mouse/touch and a tap/select/Move alternative for keyboard and iPhone.
- Added creating, duplicating, renaming, and switching between saved list profiles, editable tier labels, custom company tiles, and within-tier ordering.
- Reused local company logos when available and initials otherwise.
- Lists persist through the existing browser store; one profile’s edits do not change another.
- Kept presentation in `styles/` and reused Motion for move feedback.
- Validation: 18 regression tests, saved-profile persistence, and all 75 job records pass. Touch dragging and mobile rendering still need on-device verification.

## 2026-10-12 — Application workflow scaffolding

- Added Needs you, Discover, Applications, and Profile tabs.
- Added a local application queue, editable question/resume review dialog, blockers, versioned approvals, and an activity timeline.
- Added verified factual profile fields and resume references.
- Preserved existing tracking, interview pipeline, referrals, and networking inside Applications.
- Opening a posting records opening, not submission; approval never marks an application submitted.
- Added basic Motion panel transitions; visual CSS and animation definitions remain in `styles/`.
- Automation, question extraction, server sync, and text notifications are not connected. All new state is browser-local.
- Validation: 13 tests, including approval invalidation and persistence migration; all 75 job records and page structure checks pass. Mobile rendering remains unverified.

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
- Validation: compensation-label regressions, existing pack tests, and all 75 job records. Mobile rendering remains unverified.

## 2026-10-12 — Reliable tapping and Motion tear

- Replaced the snap-scrolling reveal row with one active card and explicit Previous/Next navigation.
- Focus restoration now uses `preventScroll`; unrevealed cards own the touch gesture.
- A single tap begins revealing; removed the rapid-tap timing requirement.
- Added Motion’s vanilla JavaScript mini engine for two interlocking ragged wrapper halves.
- Reference: Framer Marketplace Page Tear Transition; independently implemented, no marketplace code copied.
- Presentation keyframes stay in `styles/`; CSS tearing remains available when Motion cannot load.
- Added best-effort native-switch haptic ticks on iPhone reveal taps and claims, with Vibration API feedback on supported other browsers. iPhone feedback requires on-device verification.
- Validation: seven interaction regression tests and all 75 job records. Device rendering remains unverified.

## 2026-10-12 — Interactive pack opening

- Added a tear-open wrapper: slide the seal or tap; keyboard opening also works.
- Added a Three.js holographic foil shader that responds to touch and pointer movement.
- Added rarity-scaled particle bursts during card upgrades and the company reveal.
- Kept the new CSS and GPU shaders in `styles/`, separate from markup and interaction logic.
- Bundled Three.js locally; effects load only while opening a pack.
- Added reduced-motion and WebGL fallback behavior, capped render resolution, and cleanup on close.
- Validation: five interaction regression tests, syntax checks, and all 75 job records.
- Verification limit: no mobile browser or device rendering test in this environment.

## 2026-10-12 — Mobile card spotlight

- One focused card per mobile screen, swipe navigation, and Previous/Next controls.
- Hidden company identity until final reveal; larger logo and reveal animation.
- Compact header and safe-area spacing.

## 2026-10-12 — Pack review controls

- Reveal all and progress counter.
- Fixed duplicate XP rewards on replay, keyboard splitting, and modal focus handling.
- Normalized one internship employment type.

## Mobile onboarding (Next.js)
- Added `/onboarding/`: choose an agent, select Simplify/Jobright or manual profile setup, and add a short introduction.
- Setup saves locally; external profile imports and agent connections are not connected.
- Mobile-first controls, progress, required-name validation, back navigation, and storage-error handling.
- Validation: design detector reported no findings. Next.js build blocked by pre-existing invalid `@swc/helpers/package.json`; browser verification unavailable.

## Profile setup entry point
- Added a mobile-friendly Start setup button on the Next.js profile page linking to the interactive onboarding flow.
- Verified route and component wiring; build remains blocked by the previously reported dependency configuration issue.

## Muse profile setup guidance
- Replaced Simplify/Jobright autofill choices with Muse-assisted resume or Simplify profile PDF setup and manual entry.
- Added a copyable Muse request requiring unverified extracted facts, blank missing facts, and human review before application use.
- The Next.js preview does not perform PDF extraction or save extracted facts to the board; this is an explicit handoff to Muse.

## 2026-10-13 — Make onboarding visible on the live Profile tab
- Added a prominent Start setup button and expandable setup form to the deployed static board, alongside the existing Next.js preview.
- Added agent preferences, Muse PDF handoff with copyable request, and introduction saving through the existing profile store. Saving clears verification and preserves existing profile facts.
- Replaced Simplify autofill guidance and bumped asset/service-worker cache to v32.
- Validation: JavaScript syntax, setup interaction/store checks, data validation (76 roles), and diff whitespace checks passed. No live browser capture performed.

## 2026-10-13 — Applications redesign and separate Referrals page
- Made tracked roles visible immediately with compact counts, status controls, and an actionable Discover empty state. Removed the duplicate legacy interview view.
- Moved referrals and networking into their own tab; replaced ten expanded template cards with one message picker. Kept existing browser data and agent draft/review flow.
- Added responsive row layouts, mobile navigation showing every tab, scoped theme color variables, accessible form labels, and honest clipboard failure feedback. Cache v33.
- Validation: browser navigation, Browse roles action, template switching, 356px/1280px overflow checks, workflow tests, design detector and whitespace checks. Finish reviewer: ship; populated rows inspected in source, not visually captured.
- Full test suite: 133 passed. Scoped design documentation review confirmed incumbent system preservation; alternate themes and populated rows remain visually unverified.

## 2026-10-13 — Full Next.js / React / Tailwind frontend migration
- Replaced the production frontend with React routes for Discover, Applications, Needs you, Referrals, Profile and onboarding; migrated all profile tools and application review controls.
- Reused the existing guest/account store, serialized private sync controller and versioned workflow models. Added a React UI bridge, isolated resume helpers, shared outreach content, and browser progress/reward parity.
- Adopted Discover surfaces, lavender controls and shared Tailwind theme tokens while keeping the simple responsive workspace layout.
- Added GitHub Pages build/deploy workflow, base-path support, generated public assets, and a versioned offline worker. Legacy static UI remains source-only rollback/reference.
- Validation: 137 tests, schema/ownership/approval checks, 76-role validation, optimized Next.js export; browser profile save/reload/review, reference save, queue/approve/edit invalidation, tracking and referral/template/saved-answer checks. Live signed-in OAuth, private files, credential issuance and employer submission are not end-to-end verified.
- Finish review: ship within tested scope. Documented shared React/Tailwind system in DESIGN.md and .impeccable/design.json; inherited Inter detector warning retained to match Discover.
- Rebased onto concurrent Muse-import and backend-logo updates; ported profile-setup permission toggles and unverified imported-answer notices into React, keeping profile scalars compatible with the shared schema.
- After integrating concurrent backend changes, all 144 tests and database checks pass; production assets now omit bundled logos.

## 2026-10-13 — Preparation and trust features

- Added owned, versioned preparation plans with email source evidence, relevant
  company/role resource guides, deadline scheduling and preserved completed tasks.
- Added quiet-mode preferences and scoped delivery advice/acknowledgments;
  important application decisions interrupt while routine activity waits.
- Added private skip explanations and explicit reconsideration requests.
- Added inspectable immutable application attempts and secure resume downloads.
- Validation: unit/contract and disposable PostgreSQL ownership/version/credential
  tests (including the rebased outreach contract), hosted rollback-only SQL checks, catalog validation,
  auth bundle and Next.js static build. Browser fixture
  checks cover guest preparation and settings. Live inbox/message/Muse runtime
  and real employer submissions are not exercised.

## 2026-10-13 — Demo coverage and scoped MCP parity

- Added an isolated, resettable demo workspace with fictional preparation plans,
  source-email excerpts, quiet settings, skipped roles and immutable attempt records.
- Demo edits stay in memory; private downloads, external submissions and approval
  transitions are disabled. Existing browser/account data remains separate.
- Added shared owned/versioned RPCs and narrow MCP tools for quiet settings and
  reconsideration, plus human-only review/recovery links. General preferences
  saves preserve quiet settings under the same database lock.
- Validation covers demo reset/storage isolation, service versions/ownership and
  credential scopes. All 192 unit/contract tests, disposable database checks,
  hosted rollback-only RPC checks, data validation, auth rebuild and static export
  pass. Desktop/mobile browser checks confirm demo reset and zero backend writes
  or real-storage changes. Live Muse inbox/notification delivery remains unverified.

### 2026-10-14 — Personal search targets

- Profile → Search targets separates source selection from opportunity fit. Add,
  edit, and remove job boards, company careers pages, and social accounts.
- Private versioned list uses one owned website/MCP write boundary; autosync
  preserves independent target changes. No scanner or sharing is implied.
- Social sources require forwarded content; public sources show scanning support
  needs verification. Fictional demo targets cover all three kinds.
- Validation: 221 Node tests, production static build, catalog validation,
  local and hosted database scope/conflict/autosync checks, isolated desktop/mobile
  add/edit/remove checks. Database migration and gateway/MCP deployed.
  Integrated signed-in browser flow remains unverified.
