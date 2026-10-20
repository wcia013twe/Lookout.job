# Job Signal Board

A job-search workspace with a public catalog, private candidate records, and tools for each user's own Muse agent. Next.js, React, and Tailwind provide the UI; GitHub Pages serves its static export; Supabase handles identity, private data, files, and agent access. Theme styling can change the presentation without changing the application workflow.

## Copy into Muse

```text
Connect to my Job Signal Board: [website URL]. Follow the agent instructions provided there.

Set up these daily automations:
- Morning: full job scan.
- Noon: Instagram story scan.
- Evening: Instagram story scan.

Text me the updates using the app’s message settings. Ask me which times to use.
```

This is the intended onboarding prompt. Workflow instructions, user preferences,
and themed message templates are maintained on the app side. Muse is the primary
text interface; the website is available for opening packs, detailed review and
tracking. Scheduling and Instagram access depend on the connected agent’s
capabilities; this README entry does not activate automations.

## Agent context updates

Each run checks just `personalVersion` and `developerVersion`. The agent reloads
only changed personal settings or developer instructions. On first connection or
lost memory it loads both. Personal edits increment their version automatically;
developer instructions and message defaults live in
`supabase/functions/agent-gateway/instructions.json`. Agents keep independent
last-seen versions. See [context refresh setup](mcp/README.md#two-version-context-refresh).
This avoids repeated full prompt reads; permanent agent memory depends on its runtime.

## Desired daily interaction

1. **Set up once.** Optionally sign in with Google; save verified profile facts, resume variants, search preferences, and separate Full-time / Internship company rankings. Choose which saved answers may autofill and which must always ask.
2. **Muse prepares the morning batch.** Your connected agent reads your preferences, searches for relevant jobs, verifies employer postings, and publishes a private batch. Personal fit notes stay separate from the shared job catalog.
3. **Open the link.** Muse sends “Your morning jobs are ready” through its own notification channel. The link opens your batch on the shared website. Login identifies the owner; a batch ID alone does not grant access.
4. **Review cards and queue roles.** Cards show company, role, rarity, location and compensation tags, with base versus total compensation labelled accurately. Opening a posting is not applying.
5. **Prepare under your policy.** Muse inspects the live form and selects your configured résumé. Routine matches can proceed using verified facts and permitted saved answers. Important matches, auto-apply-off, unfamiliar answers and missing choices go to the **Action Board** for focused exact-version review. Agents never manufacture a human approval.
Unresolved Playwright and agent recovery failures go to the **Action Board** with a reason and next action. Uncertain submission outcomes pause for human verification.

6. **Apply with evidence.** `submit_application` supports native Greenhouse forms: current server authorization → prefill/validation → atomic claim → one-use click permit → one Submit click → observed employer confirmation. Routine authorization is distinct from human approval. Unsupported forms/CAPTCHA/additional files pause. Uncertain outcomes block retry; verify in the board before allowing a new attempt. Manual submission notes remain user-reported.
7. **Track outcomes.** Applications shows progress and a durable timeline. Muse can add observations; interviews, offers and rejections remain distinguishable from draft preparation. Progress is private by default; leaderboard participation shares only an alias and aggregate metrics.

Card-opening animations and new theme packs are outside this pass. Existing pack effects are optional; public job browsing never requires opening a pack.

## What works

| Feature | Current behavior |
| --- | --- |
| Public Discover | Browse without login; shared static JSON catalog remains available |
| Google account | Optional sign-in, remembered session and sign-out; real user round-trip still needs verification |
| Cloud workspace | Signed-in profile, rankings, answers, resumes and drafts sync automatically; offline changes are retained; conflicting drafts pause for review |
| Company rankings | Editable/drag-and-drop Full-time and Internship profiles; Oracle is the full-time C-tier baseline |
| Saved answers | Reviewed exact-question autofill, company scope and Always ask me; no overwrite of existing draft text |
| Private resumes | PDF/DOCX uploads, immutable file versions, checksums and short-lived private download links |
| Action Board / Applications | Checklist-style handoffs and Muse-organized preparation reminders alongside versioned approval, blockers, human progress reports, immutable submitted drafts and server timeline |
| Agent connection | Per-user expiring/revocable credentials; HTTP gateway and custom MCP endpoint |
| Morning batch links | Owned `?batch=<uuid>` routes; latest private batch can load for a signed-in user |
| Form inspection/prefill | Greenhouse public form inspector; adapted Greenhouse/Ashby browser tools, explicit resume rules, reviewed native radios/checkboxes and strict approval checks |
| Progress/leaderboard | Opt-in alias and server-derived aggregate metrics; self-reported submissions remain tracking claims |

## Company logo cache

Company logos are public branding assets in the Supabase `company-logos` Storage
bucket. The website resolves normalized company names through
`data/logo-manifest.json`; agents do not search for or download logos during job
scans. Content-hashed URLs keep browser/CDN caches stable. Missing or unavailable company logos show initials; no company images are bundled.
Verify stored assets with `node scripts/company-logo-cache.mjs --verify`.
Upload new PNG/JPEG assets from an external directory with
`node scripts/company-logo-cache.mjs --upload /path/to/logos`. This bucket is
separate from private resume storage.

## Repository layout

- `next-app/`: production React/Next.js UI and frontend tooling.
- `lib/`: shared browser state, sync, domain models, and pack shaders.
- `lib/tracker-display.mjs`: shared application progress calculation, consumed by the React tracker.
- `backend/`, `supabase/`, `mcp/`, `runner/`: existing service contracts and execution boundaries.
- `data/`, `tests/`, `scripts/`, `docs/`: catalog, validation, tooling and focused documentation.

Keep installed `node_modules/` for local development. `.next/`, `out/`, generated `next-app/public/` and TypeScript build metadata are disposable and rebuilt by the documented commands. Use a fresh feature checkout for development instead of mixing source changes with the shared cloud-synced directory.

## Run and validate

Node 22+:

```sh
npm ci
npm ci --prefix next-app
npm test
npm run test:db
npm run validate:data
npm run dev
```

`npm test` runs behavior checks and the consolidated database scenarios. The database suite applies migrations once in disposable PGlite; `npm run test:db` runs the same scenarios separately. Hosted checks remain separate.

Open `http://localhost:3000`. Production is built and deployed by `.github/workflows/deploy.yml` from `next-app/out/`. Production Google redirect configuration is documented in [backend/README.md](backend/README.md); localhost OAuth requires an explicitly allowed local redirect. The React export bundles the browser client at build time.

## Code map and invariants for Muse/other agents

| Location | Responsibility |
| --- | --- |
| `next-app/app/`, `next-app/components/` | Production React routes, public discovery and interactive workspace UI |
| `next-app/lib/workspace.jsx` | React store/account adapter, shared domain initialization and cloud status |
| `lib/store.js` | Guest/per-account browser cache; account switching preserves guest records |
| `lib/workflow-model.js`, `next-app/components/draft-review.jsx` | Versioned review/approval rules and React review controls; signed-in transitions use backend RPCs |
| `next-app/lib/workspace.jsx`, `lib/cloud.mjs`, `lib/cloud-model.mjs`, `backend/client.mjs` | Google auth, serialized autosync, record mapping and owner-checked database requests |
| `next-app/components/saved-answers.tsx`, `next-app/components/resumes.tsx`, `lib/tierlist-model.js` | Profile features; standalone modules use the shared store |
| `next-app/components/agent-connections.tsx` | Human credential management; keys shown once, never persisted in browser state |
| `supabase/migrations/` | **Single source of truth for the database schema**; use exact deployed migration versions |
| `supabase/functions/agent-gateway/`, `agent-mcp/` | Scoped server tools; no general SQL/shell tool and no agent-created human approval; guarded submission transitions |
| `runner/`, `scripts/runner-*` | Deterministic form inspection and approved prefill and guarded native Greenhouse submission |
| `next-app/app/globals.css` and Tailwind utilities | Shared Discover theme and responsive presentation |
| `data/jobs.json`, `data/tierlist-presets.json` | Public discovery feed and configurable ranking defaults |

Keep verified personal facts, agent-generated drafts, and employer requirements distinct. Never share service-role keys. Derive ownership from the authenticated user/agent token, not a caller-supplied user ID. A runner must fetch the **current** execution authorization and verify job URL, draft, resume bytes and form fingerprint; adding metadata after approval requires reapproval. A status is not proof of submission.

`data/jobs.json` is the canonical static discovery feed. Preserve known application statuses when updating it, deduplicate canonical URLs, and never invent source dates. Supabase is authoritative for signed-in private application state. Personal recommendations belong in batch items, not employer records. `data/tierlist-presets.json` holds subjective ranking defaults and white-label labels; theme changes must not change workflow semantics.

## Agent and runner setup

Sign in → Profile → Your agent → Create agent connection. Copy the setup into an MCP client that supports bearer headers; keep the key in the agent's secret settings. Connection formats vary by client; Muse's exact custom-MCP/auth support still needs confirmation. A concrete local stdio MCP adapter now provides browser inspection and approved prefill; its one-time installation is documented in runner/README.md. The hosted data endpoint does not launch browsers.

- [MCP setup and tools](mcp/README.md)
- [HTTP gateway contract](backend/agent-contract.md)
- [Runner commands and safeguards](runner/README.md)
- [Extracted open-source code and licenses](runner/THIRD_PARTY.md)
- [Backend deployment and auth configuration](backend/README.md)

The local runner uses deterministic Playwright operations and makes no model calls. Jev and other decision models are excluded for now. The local adapter forwards data tools as well, so one connection suffices. Muse must support local stdio registration; remote-only client support needs a runner host. Native Greenhouse submission is implemented; other ATS submit adapters and embedded agent recovery remain unsupported.

## Remaining work

- Verify a real Google sign-in, private workspace sync, file upload/download and MCP connection on the intended devices/clients.
- Connect Muse's scheduler and notification channel to send actual morning/review links; the backend does not send texts or monitor inboxes.
- Validate prefill against live employer forms, then build a submission adapter with duplicate-attempt protection and employer-confirmed receipts. Workday, CAPTCHA, custom controls and conditional forms still require handoff.
- Add user account export/deletion, stale-file cleanup, operational alerts/rate limits, and leaderboard abuse handling before broader rollout.
- Optional later: sync legacy browser link history/networking, add theme packs, and expand job-source automation. Do not add these ahead of the core apply/review loop.

## Ask Muse to read this update

Developer contract version **17** advertises the current scoped platform and local runner capabilities. Tell Muse:

> Check my Job Signal Board context versions. Load and retain the updated developer instructions, and reload my personal settings only if changed or missing. Follow my settings and message templates. Check whether inspect_application, fingerprint_resume, try_application and submit_application are available. If missing, report the one-time runner setup needed; never claim it is connected. Inspect and prepare drafts, ask me to review unfamiliar answers, and use submit_application for routine authorized matches or exact approved important matches. Never retry an uncertain submission. Update the local checkout to obtain the new tool. Report unresolved failures to the Action Board and text me using my configured template. Prepared is not submitted.

This refreshes instructions on an existing authenticated board connection. It
does not create schedules, send a text, install a runner or submit a job by itself.

Profile → Application automation saves **Auto-apply routine matches** and separate
full-time/internship review policies immediately. Both thresholds default to
**A tier and above**. Choose a company list per role type, or let Muse use the
single matching list. Unknown companies, conflicting placements or ambiguous
list selections require review. Company-tier IDs stay independent of theme labels.

Muse reads `preferences.search.autoSubmitApproved` and
`preferences.search.reviewPolicy.{fullTime,internship}` (`tierListId`, `threshold`).
`read_application_policy({jobId})` checks current owned settings and canonical
employer data; returns `auto-apply`, `review` or `skip`, with the personal version
and honest execution limits. This is a read-only policy decision, not approval or
a submission receipt. No agent can inject its own company tier or owner ID.

Desired interaction: routine matches use verified facts, résumé rules and
permitted saved answers; important matches get fully prepared and Muse texts a
focused review of résumé, written answers and consequential choices. Unfamiliar
questions, missing facts, CAPTCHA, unsupported controls and uncertain outcomes
always pause. Important-match messages use your theme templates. Auto-apply off
requires review for every application. Recheck policy before submission.

**Supported execution:** `submit_application` now submits native Greenhouse forms.
The gateway derives authorization from current owned records; routine answers
require exact verified fact/saved-answer provenance and a configured résumé.
Important matches require exact approval. Claims freeze the draft, prevent a
second worker, and produce a one-use short-lived click permit. The runner checks
filled values, required fields, fingerprint and PDF hash before clicking once.
Only supported confirmation markers appearing afterward record Submitted.
Receipts are labelled **runner-observed employer confirmation**, not a
cryptographically authenticated employer API receipt. Agent credentials are
trusted to report these observations; browser users cannot forge receipt columns.

Unknown outcomes stay on the Action Board. The review dialog lets the user record where
they verified an application was not sent and release the attempt for a fresh
run; started attempts must age five minutes before this recovery. Pending result
reports retry through `report_submission_result` without another click. An
expired pre-click claim can expire; started/uncertain attempts never automatically
expire into retry. No real employer application was submitted during development;
fixture transport/database tests pass, live Muse/employer validation remains.

## Simplify / browser autofill

Profile → Application profile uses native, labelled inputs with stable field IDs
and standard autocomplete tokens for name, email, phone, city, LinkedIn and
portfolio. Simplify Copilot may fill these if it recognizes the site; this is
form compatibility, not a private Simplify API integration or guaranteed site
support. If detection is unavailable, use its Profile tab to copy details and
request site support from the extension. Review imported facts, check the
verification box and save. Changed values clear prior verification, including
silent programmatic autofill. Saving syncs to the account through existing autosync.
Live Simplify extension recognition has not been verified.

## Simplify-shaped profile and React migration

Profile starts with candidate identity and editable personal details, then repeatable Work Experience, Education and Projects & Outside Experience, portfolio links, skills and languages. Stable labelled fields support browser autofill; Simplify Copilot recognition remains unverified. Added or removed records and changed facts clear verification. Profile facts keep the existing guest/account namespaces and signed-in private JSON syncing. No personal details from the reference PDF are bundled in public assets. Resume variants and saved answers remain existing features; Simplify recruiter discovery, premium products and external cover-letter/template services are not implemented.

`next-app/` now contains the production Next.js/React/Tailwind frontend. It preserves the existing browser store and Supabase adapters and is deployed through GitHub Actions. See [frontend instructions](next-app/README.md).

## Applications and referrals layout

Applications shows browser-tracked roles directly, with full-time/internship counts and status updates. Opening a role remains distinct from applying. Agent workspace contains prepared drafts and review actions; the duplicate legacy interview view is removed. Referrals is a separate navigation tab with referral targets, contacts/follow-ups, and a message-type picker showing one template at a time. Existing tracker and networking storage is preserved. Layout rules live in React components and `next-app/app/globals.css`; workspace color variables can change without changing the structural grid.

## Muse can save profile packages

Connected agents with profile setup access can import extracted candidate facts,
propose saved answers, privately upload/reuse a resume and select its default.
Older connections have an **Enable profile setup** button; their existing token
continues to work. Muse should save the package rather than asking for manual
entry, then ask only about missing/conflicting facts. Imports remain unverified
until reviewed; saved-answer autofill suggestions are distinct from permission.
Use **Reload account** to load Muse's changes. HTTP/MCP setup and local-file upload
are documented in the gateway and runner contracts. Resume parsing itself runs
in the user's agent, not in this backend. No real candidate package is imported
as part of development validation.

## Company outreach

Referrals groups contacts by company and shows editable, copy-ready messages and LinkedIn links. Signed-in contacts, drafts and requests are owner-scoped backend records; guest contacts stay in the browser and existing signed-in local contacts migrate on the next visit.

**Prepare with Muse** saves the chosen companies as a queued request. Muse checks `read_outreach_workspace` on each connected run and uses the platform-hosted `cold-outreach` guide loaded through `read_guide` with id `cold-outreach`. `save_outreach_package` writes researched contacts and finished messages directly to the backend; the page refreshes them automatically. Users do not copy agent prompts or import JSON. Requests wait for the next agent run; the backend does not start or wake an external Muse process. Copying/opening links never sends a message.

The skill's authoring source is `skills/cold-outreach/SKILL.md`; its deployed package is `supabase/functions/agent-gateway/skills/cold-outreach.json`. A regression check keeps their instructions identical. Updates increment `developerVersion` and deploy the gateway. No local skill installation is required. Outreach reads use `workspace:read`; draft preparation uses `drafts:write`. Existing contact edits require the current revision, completed requests retry idempotently, and agent changes preserve human outreach status.

## Preparation, quiet mode and application evidence

Applications → Prepare builds a dated checklist from a saved application, exact
questions, resume reference, company/role resource guides and a confirmed process
deadline. Guest plans persist in this browser; signed-in plans are owned database
records with optimistic versions. Muse can supply email deadline evidence through
`update_preparation_plan`, refresh unfinished tasks and record user-reported task
completion. Email access comes from Muse's connected runtime; this app does not
monitor inboxes. Uncertain dates leave tasks unscheduled.

Profile → Quiet mode chooses immediate updates, a daily digest or a weekly pack,
with timezone and urgent deadline controls. `read_delivery_policy` returns pending
activity and due/defer advice; important review decisions interrupt. Muse continues
other authorized work and acknowledges only successfully delivered events. Actual
scheduling and message delivery remain runtime capabilities.

Applications shows active callbacks first and a vertical process timeline with completed,
scheduled and undated stages. Submission records emphasize the immutable resume name,
version and variant used for each attempt, alongside answers and confirmation evidence.
An email update does not prove a submission. Muse can append source-backed email
milestones through `record_application_milestone` when its runtime has authorized
email access; users can also record stages manually. Closed outcomes move below active
applications. Skipped-role explanations remain available to Muse on request or for an
occasional useful preference insight, rather than a permanent Applications section.
Developer contract version **12** advertises these tools.

## Local-first feature integration

Start in a fresh checkout with `npm run feature:start -- <name>`. After committing
and reviewing the feature, run `npm run feature:land` there to integrate current
local `main` and fast-forward the shared local `main` checkout. This routine path
does not push or create a PR, so localhost receives completed work immediately.

When GitHub review, protected-branch CI or production publication is explicitly
needed, use `npm run feature:publish -- --title "<title>" --body-file
<absolute-description-path>` from the feature branch. `npm run feature:status`
shows pending PR work. Read [feature delivery and optional queue controls](.github/INTEGRATION.md).

## Admin demo mode

Accounts with server-managed `app_metadata.demo_preview=true` can toggle Demo mode in the header. Mock jobs, applications, profile, tier lists and Robinhood/Stripe outreach live in a separate in-memory store. Demo mode disconnects the view from the authenticated client, prevents real submissions/uploads and supports Reset demo/Exit demo mode. Real account data remains in its original store. Company logos scaffold referral groups and the selected contact; Robinhood uses its official public icon URL when no cached asset exists.

## Internal Muse guides

Developer context carries only a versioned guide index. The authenticated, read-only `read_guide(id)` tool loads `resume-parse` or `cold-outreach` on demand using existing workspace:read authorization. Guides are deployed backend configuration, never user-editable prompts. Each includes when-to-use guidance, instructions and expected output. Cache by id/version and refresh when the index changes. No new user interface or local skill installation is required. Demo profile and company-grouped referral drafts remain the representative outputs; demo mode makes no guide/backend calls.
## Demo feature coverage

The existing admin Demo mode now includes evidenced and ambiguous deadlines,
completed preparation, quiet settings and notification previews, callback ordering,
vertical email-backed timelines, exact resume versions, and confirmed or uncertain
submission attempts. Its resettable memory services
preserve existing fictional profile and referral scenarios. All new actions remain
isolated from account storage, private files and external applications.

[Feature MCP parity](backend/MUSE_FEATURE_PARITY.md) maps each action to a scoped
tool or an explicit human-only boundary. Developer context version **12** includes
quiet-mode management, reconsideration and owned review links.

### Application tracker layout

Applications uses a single light list with hiring-stage dots and a wide application detail dialog, based on the supplied Simplify reference. Workflow preparation states are labeled separately from hiring progress. Detail navigation contains Overview, Documents, Resume Match, Email, Questions, and Rounds. Existing question review, approval, submission records, preparation and milestone services retain their authorization rules; no resume score or connected inbox is fabricated.

Round notes use the existing owned `record_application_milestone` RPC (`source.note`, up to 2000 characters), and are displayed with their recorded event. The scoped MCP milestone operation continues to require its existing evidence contract; there is no new generic write capability. Experience cards are editable local text drafts created from round labels and notes. Download is an explicit human action and does not publish to a community, transmit notes, or include resume files or email excerpts. Community publishing remains unconnected.

## Agent-first onboarding

The onboarding flow now implements the PR #19 handoff: connection verification →
minimum search intent → one evidenced relevant employer posting → contextual
policy choice. Recommend-only does not need a résumé. Preparation asks for
verified facts and a résumé only after value; automatic-application requests stay
subject to existing human/runner/answer safeguards. The website and agent tools
share backend state, revision checks, idempotent transitions and an owned task
inbox. The admin demo uses explicitly fictional memory-only results.

See [onboarding and task contract](backend/agent-contract.md#agent-first-onboarding-and-task-inbox).
There is no verified inbound Muse hook, hosted Cappy runtime or scheduler/channel
activation service; these report blockers and use polling rather than claiming
immediate execution. Deploy migration `20261014210000_agent_first_onboarding.sql`
and the updated `agent-gateway` / `agent-mcp` functions together after merge.
`developerVersion` is incremented so agents refresh their context and tool list.

### One weekly preparation plan

The Action Board now presents a seven-day calendar and a shared prep plan within
one daily time budget. Equivalent practice covers multiple interviews; each
interview retains its own requirements, source evidence and company reports.
The calendar opens on today, with day selection and Show all week. Longer tasks
can span sessions, completion consumes time once, and tasks that cannot fit are
shown explicitly. See [planner behavior and service contracts](docs/preparation-planner.md).
The backend migration and gateway/MCP release must be deployed with the frontend
before the new signed-in planner services are available. Lookout/Glassdoor feeds
are not connected; only sourced reports saved to an interview are displayed.

## Circle Knowledge (gated)

Private Circles now have structured knowledge threads, agent retrieval and reviewed
publication, and “Agents used this for N people” citation counts per revision. The
dashboard is `/circles/`; admin Demo mode includes fictional interview reports,
an offer, a shared opportunity, a private draft and citation history. The dashboard
separates private review from shared activity, and shows the destination and author
before publishing. Optional metadata stays behind contribution details.

A signed-out-accessible fictional Circle demonstrates the consolidated dashboard.
Conversation scripts remain design documentation rather than dashboard controls.
Scheduled delivery and in-chat human authorization are not connected. See the implementation tasks and
acceptance criteria in [daily experience](docs/circles-daily-design.md) and
[contribution design](docs/circles-contribution-design.md).
The database gate stays disabled pending hosted two-account permission checks.
Freeform/personal sharing requires exact human review; optional standing permission
is limited to a closed public-documentation template. See
[contracts, limits and release checks](backend/circle-knowledge.md).

### Outreach starter templates

Referrals previews five built-in templates (recruiter interview, warm referral, shared background, technical leader, follow-up), including before contacts exist and in the admin demo. Agents read the same canonical library through `read_guide("cold-outreach")`. The Nick Singh-derived cold-outreach skill is the default for tailoring all templates to verified candidate, contact, role and channel details. Templates do not create contacts or send messages. The guide includes required evidence and applicability for each template.

## Career Toolkit

Career Toolkit is a native categorized skill library at `/career-toolkit/` with
37 static usage manuals and copyable agent examples. Categories cover profile
conversations, career search and regional context, documents, interviews,
networking, growth, offers, and recurring-search setup. Each manual explains
inputs, steps, expected output, runtime requirements. Opening a manual or copying a request does not start work or install tools.

Examples can reference an existing saved application by its displayed company and
role; no private file links, tokens or account identifiers are copied. The existing
`read_guide` tool exposes the corresponding `career-*` guide under workspace read
authorization, with source instructions adapted to Lookout's data/permission
boundaries. Older deployed gateways need the normal release update before those
guide IDs resolve; copied requests explain when the Lookout connection needs updating.

Demo mode uses fictional, non-executing requests and does not touch real account
storage or services. See [source and maintenance notes](integrations/career-ops/README.md).
No upstream scanner, renderer, cron worker or external integration is installed by
this library. Actual execution remains a capability of the connected agent.

## Document-backed career context and agent search memory

Personal agents can load career-ops-style targeting, house rules and portal/query configuration, then checkpoint their own sweeps and save discovery/screening evidence. Lookout stores and displays this state; it does not execute searches or activate schedules. Existing targeting controls edit canonical documents. See [the contract](docs/search-context-and-sweeps.md) for tool mapping, migration and release verification. Backend deployment and a live hosted-MCP round trip are required before claiming availability.
