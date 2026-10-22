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

The retired static frontend has been removed. React components own presentation and authentication lives in `lib/workspace.jsx`; shared tracker progress lives in `../lib/tracker-display.mjs`. Production and CI build the same Next.js static export.

## Profile verification and demo checks

Profile panels stay mounted after first use so switching sections preserves unsaved fields; leaving the route still requires saving. The profile fallback resume lives in Job preferences; role/type assignments are managed only in About me / Documents. The existing account-wide submission default (`workflow.searchPreferences.defaultResumeId`) is retained in storage but is not editable on My Agent. Progress and leaderboard settings are reached through the header XP menu.

In admin Demo mode, edit an About me field and use its section checkmark to save. Switch to Job preferences and return to verify the saved field remains; changed facts remain unverified. Application profile edits save automatically after a short pause, including across section switches. Inspect the fictional resume, unverified saved answer and preferences. Open My agent to inspect the six fictional search sources in a compact source list (including long names/URLs, all three source types, and expandable access details). Check a narrow screen, edit/add/remove a source, remove all sources to check the empty state, and inspect agent connection controls; switch sections and return to check draft preservation. Reset demo and confirm the original fixtures return without changing account records. Check Progress through the XP menu.

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

Applications groups tracked roles into Active, Saved jobs and Closed. Saved jobs
contains opened roles and preparation drafts without recorded application progress;
submitted roles move to Active, and rejected or withdrawn roles appear in Closed.
The detail panel has Overview, Documents (resume, submission evidence, resume match
and employer questions), and Interview. Existing scoped services and
approval rules are unchanged; this pass adds navigation over existing data only.

Demo check: Saved jobs includes the fictional NVIDIA opened role and any draft
without later progress. Open it to inspect the empty Interview state. Open a prepared
application to inspect Documents, the compact Interview brief, and recruiting emails
alongside the round timeline. Add round & note opens Round details within Interview. Reset restores
the fixtures without touching account records.

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

## Privacy and sharing

`/privacy/` is a public, static policy page linked from the footer (including
onboarding) and the existing Sharing & privacy destination. It remains readable
before workspace initialization, while account sync is locked, and without
JavaScript. It describes current storage, employer/agent/Circle sharing, external
AI-provider practices, and the lack of self-service account export/deletion or a
fixed deletion/backup-expiry timeline. Set `NEXT_PUBLIC_PRIVACY_EMAIL` locally or
as a GitHub Actions repository variable to show a direct email contact; without
it, requests use the user's existing channel to the person who provided access.
No mailbox, automated privacy-request handler, or deletion service is added.

Existing connection rows disclose their actual permissions; the connection and
revocation notices explain external AI processing and already-received copies.
Resume forms distinguish private uploads from externally hosted links. Circle
review identifies the audience and copying limits. Write an update opens the
existing private-draft composer; it is not an automatic tracker-sharing setting.
All actions keep their existing gateway/MCP boundaries; no new service, scope,
agent instruction, or deployed-parity claim is introduced.

Demo check: in admin Demo mode, open My Profile → My agent, inspect the fictional
connection's resume/Circle-read permissions and revoke it; Reset restores it.
Visit `/circles/preview/`, open a Circle, use Write an update, save a private draft,
review its audience, choose Keep private or share, then withdraw and reset.
Read `/privacy/` as a guest and at mobile width; these interactions never submit
applications or write real account records.

`components/surface-panel.tsx` shares the Sharing & privacy material with Action Board panels, including the fictional admin demo. Use `as="form"` for a native form; otherwise it renders a section. Supply accessible labels and content at the caller. Existing primary/secondary controls inherit its theme tokens; the styling lives in `app/globals.css`. Demo verification covers the expanded application review, disabled approval gate, reset, weekly prep pause/resume, company follow-ups, and desktop/mobile/light presentation. This visual component adds no service or user action; existing MCP mappings remain unchanged.

About me owns shared resumes; the shared employer-answer bank lives in My Agent. Job preferences owns per-profile fallback resumes, plus the existing matching criteria and priorities. My Agent owns per-profile employer-answer and outreach writing style. The profile selector remains visible in My Agent and its writing changes save automatically. Legacy `section=kit` opens Job preferences. Demo fixtures include backend and ML systems resume variants, typed FT/internship assignments and an unset internship fallback. `scripts/check-profile-ui.mjs` covers revised navigation, saved assignments, writing drafts, profile switching, reset and desktop/mobile layout with intercepted cloud traffic. Existing website/MCP versioned profile-save contracts remain unchanged; developer context 36 needs the normal gateway release before deployed support can be claimed.

My agent includes a simple daily schedule: editable daily tasks with switches and local times,
one time zone and a master pause. It saves through the existing preferences store;
agent runtime setup remains separate. The four Lookout routines are defaults. Add custom tasks with a name, time and
optional instructions, or remove any task (including every default). An empty
saved schedule stays empty. In admin Demo, midday starts off and a fictional
custom practice task is included: add/remove tasks, edit a time, pause one/all
tasks, save, switch sections and return, then reset to
restore the fictional schedule. No demo interaction creates automations or writes
to account storage. The existing save_notification_preferences MCP boundary can
edit preferences.search.schedule with its current preferences timestamp; no new
backend tool or scheduling service is introduced by this UI change.

Application automation selects an application profile and saves its auto-apply
choice and review threshold in that profile’s existing versioned instructions;
the company tier list is its Company priorities selection. The tier-list editor
is directly visible below automation and in the expanded Job preferences company
priorities section. Demo profiles have different toggles/thresholds: switch,
change one, save, switch back, inspect/move a fictional company and reset.
MCP uses save_search_profile, read_application_policy(profileId) and
prepare_draft(draft.searchProfileId); website and execution read the same saved
rules. Unbound drafts require review once explicit profile rules exist. Existing
role-type policies remain a legacy fallback. Gateway/config release and hosted
verification are required before claiming the new execution policy is deployed.

About me / Documents appears before Career background and includes the shared resume library, direct Assign roles/Add role assignment, cover letters. Resume files remain private PDF/DOCX uploads; cover letters/templates accept text or document links and use the versioned artifact service with cover_letter/application_template kinds. Add, read/edit, archive and pagination use existing backend validation. The duplicate assignment section is removed from Job preferences; the existing stored targeting records remain intact. Demo supports metadata-only resume upload and versioned in-memory document editing. `scripts/check-profile-ui.mjs` verifies placement, adding a resume and assignment, cover-letter revision, mobile layout and zero demo cloud writes. Deploy the migration and gateway context 37 via the normal production workflow before claiming live support.

My Agent has one Writing style workspace with Employer answers / Outreach tabs. Controls edit directly on the left and the selected illustrative preview appears on the right, sharing a save footer; mobile stacks them. Tabs preserve unsaved profile drafts and support arrow/Home/End keys. Save writing settings uses the existing versioned profile-save service and saves all pending application-profile changes, as stated in its footer. The shared question bank remains collapsed beneath the workspace. No AI generation service is connected. Demo checks cover direct editing, tab navigation, save/reload, profile switching, templates, highlights and reset.

## Discover match and job preview

Discover cards show four fit dimensions: skills and experience, compensation,
wellbeing and culture, and location and work setting. Real catalog roles remain
unassessed, without an invented percentage. The admin demo adds resettable,
fictional strong, partial and unknown match examples with labeled sample scores.
These are UI fixtures, not Glassdoor or Simplify ratings or a live AI evaluator.

Preview job opens a right-side dialog (full width on mobile) with the available
job description, collected fit notes, verification gaps and a Common-or-above
application preview. Missing descriptions are explicit. The preview uses saved
profile contact fields; edits are temporary and discarded on close. Account,
demo-mode and demo-reset changes invalidate the selection. It does not fetch or
fill an employer form, select a resume, grant approval or submit anything.
Only opening the real employer posting updates Auto Tracker; demo previews never
open an external posting. Existing Queue application behavior is unchanged.

This is a read-only presentation of existing catalog/profile state. Existing MCP
context boundaries (`read_search_context`, `read_search_discoveries`) and
application draft/review tools remain authoritative; this pass adds no backend
service, tool, scoring capability or live form-prefill parity claim.

Verification: `scripts/check-discover-ui.mjs` uses a fictional authenticated
admin and intercepts backend traffic. Set `LOOKOUT_UI_URL` to a locally served
static export, `LOOKOUT_PLAYWRIGHT_MODULE` to an installed Playwright module and
`LOOKOUT_UI_ARTIFACTS` for captures. It covers the panel, contact prefill, ephemeral
edits, Escape/focus restoration, no preview service calls, no demo external links,
unknown scores, and desktop-dark/mobile-light layouts. No real account is used.

Resume rows support dropping one PDF/DOCX on the name or choosing a replacement file through the accessible picker. Saved names/role assignments survive, versions advance and old versions are hidden from new selections while retained for application history. Source changes use the scoped resume-source RPC and need saved profile drafts first. The demo stores replacement metadata only, remaps its own preferences, and rejects invalid files without changing the source. Profile UI verification covers both replacement paths, preserved name/roles, v2/v3 progression, hidden prior rows and invalid-file rejection. Hosted schema/gateway release remains pending.

Discover refinement: icon-led facts on cards and in the panel expose pay,
location, work setting, focus, sponsorship and source recency without inventing
unknown values. Soft semantic surfaces distinguish fit evidence and uncertainty;
About the job is expandable. Application review surfaces missing contact facts
and recorded, unreviewed employer questions. Existing populated contact details
start collapsed, with an unverified warning when appropriate. The review count
includes a single saved-contact confirmation group, not four redundant fields.
Reviewed draft questions are hidden; no new review authorization is minted.
The form is still UI-only: edits are discarded, and an unloaded employer form
can introduce further questions. Fictional demo questions illustrate one- and
two-question handoffs; no live employer form or saved-answer reuse policy changes.

Outreach previews embed into the shared workspace gradient. The sandboxed iframe highlights sentence purpose using the existing six-tag message key; Highlights toggles both marks and the compact key; selecting a key label shows its description. The iframe allows same-origin parent measurement for automatic height and keeps scripts disabled. The iframe renders escaped local templates, runs no scripts, makes no external requests and respects reduced motion. This is presentation-only; scoped backend/MCP actions are unchanged.

## Application Overview

Application details open to a scoped Overview: a recorded stage/preparation
snapshot, icon-led job facts, an amber attention area for recorded blockers,
uncertain attempts or incomplete draft preparation, green fit/context research
notes and an expandable employer description. Unknown facts stay explicit.
Saved application fields remain useful when the role is absent from the current
catalog. Completed preparation states do not show stale question/resume prompts.
The Documents handoff only switches the existing tab. Other tabs, sidebar,
status updates, approvals and submission behavior are unchanged.

The admin demo adds fictional interview facts and exposes its already-existing
uncertain attempt in the application's UI snapshot. `scripts/check-application-overview-ui.mjs`
uses intercepted account traffic to check interview, submitted, uncertain and
saved-without-draft states, Documents navigation, desktop dark/mobile light,
Escape, overflow and zero Overview cloud calls. Use LOOKOUT_UI_URL,
LOOKOUT_PLAYWRIGHT_MODULE and LOOKOUT_UI_ARTIFACTS like the Discover check.
This is read-only presentation of existing application/job/context fields;
existing scoped MCP application/context tools and backend validation are unchanged.
No new AI assessment, scoring, approval or service is introduced.


## Application Documents preview

Documents now opens a readable application form with every recorded answer,
filled/missing counts, recorded resume metadata and a source selector when saved
attempts exist. Historical application states default to the latest captured
attempt, preserving confirmed/uncertain labels from the shared submission-record
model. A captured view never fills missing historical fields from the current
profile. The draft view includes current profile/contact/background reference
and marks it as separate from employer-form evidence. Missing fields and absent
form coverage stay explicit; no live employer form is fetched or reconstructed.

Documents automatically loads its existing owner-scoped submission record, with
loading, error/retry and no-snapshot states. The full Submission record remains
available. A recorded resume with a private object path uses the existing
owner-checked download handler. Edit draft & review contains the original editor,
Save draft, reviewed-question checkbox and exact-version approval controls;
viewing a preview creates no approval or submission. The duplicate resume-match
placeholder is replaced by the form; collected fit context remains in Overview.

Existing scoped MCP `read_application_record` and draft/approval boundaries remain
unchanged. No new service, database schema, gateway capability or generic edit
tool is introduced. `scripts/check-application-documents-ui.mjs` verifies filled
attempt fields, current-profile separation, source switching, missing answers,
uncertain/no-draft cases, collapsed editing, disabled demo actions, navigation,
Escape and desktop-dark/mobile-light layout using fictional intercepted accounts.
Demo fixtures include a captured fictional name/email distinct from the current
profile plus an unanswered scheduling question. No real private file download,
form fill or submission was performed during verification.


## Interview brief

The former Prep tab is now Interview: a focused, read-only round brief with the
next recorded round, up to three outstanding non-resource priorities from its
saved preparation plan and up to three saved relevant materials. Long priority
detail and provenance live under Sources & context. The dialog and sidebar retain the same dimensions across tabs. Round details and History & emails are expanded beneath the brief by default, with optional collapse controls. Round entry starts collapsed behind + Add round, then shows grouped fields, full-width private notes and Save/Close actions. Closing preserves the draft; the sidebar Add round & note shortcut opens the editor. emails show subject, recorded date and readable excerpts, followed by application activity.

Actual scheduled round timestamps are distinct from preparation deadlines.
Unconfirmed or missing dates remain unconfirmed, past deadlines and mismatched
round dates are flagged, and date-only records never acquire an invented time.
No interview or saved plan yields a small empty state without a setup form.
Round details expands and focuses the existing round editor; Open Action Board opens shared practice.
The app does not generate fresh priorities or an AI assessment on view.

The old per-application date form, plan builder, task checkboxes and minutes are
removed from this tab. Existing plans, task progress, backend validation and
scoped preparation read/save tools remain intact. Planning and completion stay
in the existing Action Board/agent workflow; round metadata stays in Interview’s Round details. The application loader now only uses the existing owner-scoped read and
retains loading/error retry, account-change and demo isolation guards.

Demo coverage includes a dated technical round, a useful but unconfirmed phone
screen and a saved role with no interview. `scripts/check-interview-brief-ui.mjs`
checks content caps, no form/checklist, collapsed provenance, uncertainty, empty
state, stable dialog geometry and expanded round/email sections, navigation, Escape and desktop-dark/mobile-light
layout with fictional intercepted accounts and no demo cloud calls.

Interview debriefs appear beneath the round timeline. Basic Add/Update controls
save private versioned notes through existing artifact tools; personal agents
can save the same representation through MCP. Share to Circle prefills a
reviewable Round insight forum draft, with no automatic publication. There is
no scheduler handoff or embedded agent chat. See [the debrief mapping](../docs/interview-debriefs.md)
for the note retrieval convention, tool boundaries and verification limits.

My Agent no longer displays the reusable Templates library or Account-wide submission resume control. This is a page-only removal: stored documents and existing submission defaults are retained, and scoped backend/MCP contracts are unchanged. The shared question bank, writing workspace and outreach template previews remain. Demo profile verification asserts both removed controls are absent.

Network reuses the same compact contact/conversation editor in Outreach and Active
Processes. The process view omits repeated company/role context and single-person
tabs; multiple contacts use a selector. Logged message history stays visible.
Follow-up date editing, contact status/removal and secondary process actions sit
behind explicit controls. Logging still records user/agent-reported history,
never sends a message, and preserves the existing contact/MCP envelope.
`scripts/check-network-compact-ui.mjs` covers fictional process isolation, compact
defaults, logging and shared-history presentation on desktop/mobile.

Company target Overview now uses the existing About Me `ProfileSection` pencil/checkmark
pattern for company details, interests, teams, questions, research, next action and
sources. This does not change About Me or that shared component. The global Edit
company button is removed; inline saves retain company revision checks. Unsaved
company edits survive company tab switches, and a save footer can save/discard all
pending edits. Linked records/archive remain in a disclosure. Company People &
outreach uses the shared compact contact editor without another enclosing card.

The Network admin demo is focused on Robinhood and Stripe only: two targets, two
active process views and one developed fictional contact conversation for each.
Robinhood's six-message recruiter exchange is waiting for a reply; Stripe's
eight-message referral exchange spans LinkedIn/email and needs the user's next
reply. Demo opens on ongoing conversations. Company names are illustrative;
messages, referrals, people and outcomes are fictional. Other product demos retain
their feature scenarios; real account data is unchanged.
