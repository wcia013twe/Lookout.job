# Job Signal Board

A job-search workspace with a public catalog, private candidate records, and tools for each user's own Muse agent. Next.js, React, and Tailwind provide the UI; GitHub Pages serves its static export; Supabase handles identity, private data, files, and agent access. Theme styling can change the presentation without changing the application workflow.

## Personal agents: start here

Read the compact [agent quickstart](mcp/README.md#agent-quickstart) for connection,
onboarding, data imports, verified writes and approval boundaries. Connected agents
receive the same startup sequence automatically from MCP `initialize` and can refresh
it through `read_developer_context`; full workflow guides are loaded only when needed.
`AGENTS.md` is for repository maintenance, not personal career-agent onboarding.

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

## Standalone mock workspace

Open any workspace page with `?demo=1`, or choose **Demo mode** from the profile
menu. No sign-in, admin flag or Supabase account is required. The demo starts in a
separate runtime that does not load the persistent account store, auth client or
cloud sync. Its profile, jobs, documents, tasks and Circle interactions are fictional
and use disposable memory stores. No demo capability calls the production MCP.

A tab-scoped `lookout:detached-demo` session-storage flag preserves the mode across
navigation/reloads; it contains no records or account identifiers. Mock edits are
not persisted and refresh restores fixtures. **Reset demo data** rebuilds only the
fictional workspace. **Exit demo mode** performs a full navigation to `?demo=0`,
where normal account startup resumes. It does not sign out or delete an existing
account. Sign-in/out controls are absent inside the demo. If session storage is
blocked, use an explicit `?demo=1` URL to reopen the preview.

The in-memory factory is `next-app/lib/demo-runtime.mjs`; demo and account startup
are separate modules. Keep new demo interactions behind fictional services. Never
import the production store or backend client into the demo runtime. Appearance
preferences remain ordinary browser UI settings; they are not candidate records.

## Agent context updates

Each run checks just `personalVersion` and `developerVersion`. The agent reloads
only changed personal settings or developer instructions. On first connection or
lost memory it loads both. Personal edits increment their version automatically;
developer instructions and message defaults live in
`supabase/functions/agent-gateway/instructions.json`. Agents keep independent
last-seen versions. See [context refresh setup](mcp/README.md#two-version-context-refresh).
This avoids repeated full prompt reads; permanent agent memory depends on its runtime.

On actual work runs, Muse can read a compact per-connection change feed for
confirmed answers, job preferences/search profiles and finished backend jobs. It
fetches only affected records and explicitly acknowledges handled events; unfinished
changes remain pending. Events contain IDs and versions, not answer/document bodies.
The feed does not wake Muse, create a schedule or authorize submissions.

## Desired daily interaction

1. **Set up once.** Optionally sign in with Google; save verified profile facts, resume variants, search preferences, and separate Full-time / Internship company rankings. Choose which saved answers may autofill and which must always ask.
2. **Muse prepares the morning batch.** Your connected agent reads your preferences, searches for relevant jobs, verifies employer postings, and publishes a private batch. Personal fit notes stay separate from the shared job catalog.
3. **Open the link.** Muse sends “Your morning jobs are ready” through its own notification channel. The link opens your batch on the shared website. Login identifies the owner; a batch ID alone does not grant access.
4. **Review cards and queue roles.** Cards show company, role, rarity, location and compensation tags, with base versus total compensation labelled accurately. Open Application only opens the employer posting. AI Apply queues a durable application job and stays visible as Queued; the posting leaves the latest Discover view only after recorded applied progress.
5. **Prepare under your policy.** Muse inspects the live form and selects your configured résumé. Routine matches can proceed using verified facts and permitted saved answers. Important matches, auto-apply-off, unfamiliar answers and missing choices go to the **Action Board** for focused exact-version review. Agents never manufacture a human approval.
Unresolved Playwright and agent recovery failures go to the **Action Board** with a reason and next action. Uncertain submission outcomes pause for human verification.

6. **Apply with evidence.** `submit_application` supports native Greenhouse forms: current server authorization → prefill/validation → atomic claim → one-use click permit → one Submit click → observed employer confirmation. Routine authorization is distinct from human approval. Unsupported forms/CAPTCHA/additional files pause. Uncertain outcomes block retry; verify in the board before allowing a new attempt. Manual submission notes remain user-reported.
7. **Track outcomes.** Applications shows progress and a durable timeline. Muse can add observations; interviews, offers and rejections remain distinguishable from draft preparation. Progress is private by default; leaderboard participation shares only an alias and aggregate metrics.

Card-opening animations and new theme packs are outside this pass. Existing pack effects are optional; public job browsing never requires opening a pack.

## What works

| Feature | Current behavior |
| --- | --- |
| Discover | Sign-in required for the workspace; starts with owned agent batches. Signed-in users can explicitly explore the shared catalog. |
| Google account | Optional sign-in, remembered session and sign-out; real user round-trip still needs verification |
| Cloud workspace | Signed-in profile, rankings, answers, resumes and drafts sync automatically; offline changes are retained; conflicting drafts pause for review |
| Company rankings | Editable/drag-and-drop Full-time and Internship lists, available in card pack settings under Company ranking; Oracle is the full-time C-tier baseline |
| Saved answers | Reviewed exact-question autofill, company scope and Always ask me; no overwrite of existing draft text |
| Private resumes | PDF/DOCX uploads, immutable file versions, checksums and short-lived private download links |
| Action Board / Applications | Checklist-style handoffs and Muse-organized preparation reminders alongside versioned approval, blockers, human progress reports, immutable submitted drafts and server timeline |
| Agent connection | Per-user expiring/revocable credentials; HTTP gateway and custom MCP endpoint |
| Morning batch links | Owned `?batch=<uuid>` routes; latest private batch can load for a signed-in user |
| Form inspection/prefill | Greenhouse public form inspector; adapted Greenhouse/Ashby browser tools, explicit resume rules, reviewed native radios/checkboxes and strict approval checks |
| Progress/leaderboard | Opt-in alias and server-derived aggregate metrics; self-reported submissions remain tracking claims |

## Company logos

The shared company mark uses Logo.dev when `NEXT_PUBLIC_LOGO_DEV_TOKEN` is set.
Locally, set a publishable `pk_` key in `.env.local`. For GitHub Pages,
set the repository Actions variable `NEXT_PUBLIC_LOGO_DEV_TOKEN` and rebuild.
The token is embedded at build time; never supply a secret `sk_` key.
Known aliases use `data/company-domains.json`; others use provider name lookup.
Failed requests fall back to cached logos, then initials. Fictional `(demo)`
companies skip Logo.dev. Demo roles and tier lists cover real and fictional names.
This is display enrichment: existing scoped job/company tools return company names;
there is no new write action, backend contract or permission.
Provider reference: https://github.com/logo-dev/logo-api

### Legacy cache fallback

Company logos are public branding assets in the Supabase `company-logos` Storage
bucket. The website resolves normalized company names through
`data/logo-manifest.json`; agents do not search for or download logos during job
scans. Content-hashed URLs keep browser/CDN caches stable. Missing or unavailable company logos show initials; no company images are bundled.
Verify stored assets with `node scripts/company-logo-cache.mjs --verify`.
Upload new PNG/JPEG assets from an external directory with
`node scripts/company-logo-cache.mjs --upload /path/to/logos`. This bucket is
separate from private resume storage.

## Data model

See [the schema, fields and relationships](docs/schema.md) for the implemented design and the distinction between local migrations and deployed features.

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

For the local Docker-backed stack, install the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), start Docker Desktop (or another Docker engine), then run:

```sh
# One-time dependency setup; keep installs/caches on the external SSD.
npm_config_cache="/Volumes/External SSD/Lookout/npm-cache" make install
make dev
```

`make dev` (also `make up`, or just `make`) starts local Supabase containers,
applies `supabase/migrations/` on first startup, and runs Next.js at
`http://localhost:3000` with the local API URL and anonymous key. The frontend
runs on the host; Supabase runs in Docker. The local stack uses separate data
from the hosted project. Studio is at `http://localhost:54323`, email preview
at `http://localhost:54324`, and the API at `http://127.0.0.1:54321`.

Ctrl-C stops the frontend; `make down` stops this project's containers and
preserves data. Use `make services`, `make frontend`, and `make status` separately
as needed. Port 3000 must be free; Next.js will fail instead of choosing another
port. The first services startup may download Docker images; keep Docker's disk
image on the external SSD. Local Google OAuth requires separate provider secrets
and callback setup; hosted Google configuration is not copied. Local agent
endpoints require a runtime that can reach your localhost. `npm run dev` retains
the hosted backend default for the existing workflow. Demo fixtures remain
fictional and isolated; this startup tooling does not change product actions or
MCP contracts.

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

My Profile → My agent → Application automation selects an application profile,
with its own auto-apply choice, company tier list and review threshold. Save profile
rules uses the existing versioned profile boundary; company tier lists are directly
editable below it and in Job preferences → Company priorities. Unknown companies,
conflicting placements, missing lists or ambiguous profile selection require review.

Profile instructions store Application automation / Auto-apply routine matches
(Yes/No) and Review threshold (S/A/B/C/D/all), alongside Company priorities / Tier
list ID. `read_application_policy({jobId,profileId})` reads current owned settings
and canonical employer data. Drafts carry `searchProfileId` so submission rechecks
the selected active profile. Unbound drafts require review once profile rules
exist. Existing `autoSubmitApproved` and fullTime/internship policies remain a
compatibility fallback. These local changes require the updated gateway/MCP/config
release and hosted verification before claiming profile-based execution is live.
Policy advice is not approval, execution authorization or a submission receipt.

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
Account changes refresh automatically every 15 seconds and when you return to the app. Local edits sync automatically; failed connections retry without a reload button. HTTP/MCP setup and local-file upload
are documented in the gateway and runner contracts. When configured, the Node API can extract an uploaded resume through APILayer and return a reviewable profile proposal. The website tutorial and resume library share the import review; connected agents can use the scoped Node-only `parse_profile_resume` tool. Personal-agent extraction remains a fallback. No real candidate package is imported
as part of development validation.

## Company outreach

Network → People & outreach separates **Proposed outreach** from **Ongoing conversations**. Draft copying and external links never mark a message sent. **Log sent message** and **Log reply** save user-reported text or summaries, dates, channels and an optional HTTPS conversation link. Ongoing conversations include unanswered outreach, a chronological history, whose turn it is and an editable next follow-up date. Legacy progressed statuses appear without invented history. The demo includes an unsent Example Systems draft and a fictional Example Compute exchange with a follow-up. No email/LinkedIn inbox synchronization or sending service is connected.

Assisted logging reuses `list_contacts` / `save_contact` (`workspace:read` / `network:write`); website saves retain `save_outreach_contact` ownership and revision checks. Conversation presentation uses a `lookout-conversation-v1` JSON envelope in existing private contact notes, preserving legacy notes; `lib/outreach-conversation.mjs` defines the format. See [the conversation contract](docs/schema.md#companies-and-network). Hosted MCP verification and the production gateway workflow are still required before advertising the updated agent instructions as deployed.

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
does not push or create a PR. For the everyday local app, run `make live` once:
it serves an isolated SSD preview that follows committed shared `main` every second.
Landing a feature updates that preview and Next.js refreshes connected browsers.
Dependency changes reinstall locked dependencies and restart the frontend.
`make frontend` / `make dev` on shared `main` use this stable preview too. In a
feature checkout, they still preview that task; those servers cannot hot reload
changes landed into a different checkout. Keep unfinished task
checkouts intact. `make live` never switches, resets or edits them and never restarts
the backend. Stop the previous frontend before using its port 3000.

The live preview owns a clone under `/Volumes/External SSD/Lookout/live-main/`.
It refuses dirty preview files or non-fast-forward history instead of discarding
work. An interrupted process can leave a `running` lock; verify no preview is
running before removing that empty directory. `LOOKOUT_LIVE_ROOT` may override
the storage directory when internal storage is explicitly authorized. Browser/API
configuration still comes from the existing local frontend launcher; no private
account records or task `.env` files are copied. Developer-only `--hosted` mode
uses the existing hosted default without starting local services.

When GitHub review, protected-branch CI or production publication is explicitly
needed, use `npm run feature:publish -- --title "<title>" --body-file
<absolute-description-path>` from the feature branch. `npm run feature:status`
shows pending PR work. Read [feature delivery and optional queue controls](.github/INTEGRATION.md).

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
inbox. The detached demo uses explicitly fictional memory-only results.

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
shown explicitly. See [planner behavior and service contracts](docs/schema.md#preparation).
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

Referrals previews five built-in templates (recruiter interview, warm referral, shared background, technical leader, follow-up), including before contacts exist and in the detached demo. Agents read the same canonical library through `read_guide("cold-outreach")`. The Nick Singh-derived cold-outreach skill is the default for tailoring all templates to verified candidate, contact, role and channel details. Templates do not create contacts or send messages. The guide includes required evidence and applicability for each template.

## Career Toolkit

Career Toolkit opens on a private artifact workspace at `/career-toolkit/`.
Connected agents can prepare and save documents, company research and interactive
HTML while planning the week. Upcoming dated prep appears under Prepared for you; reusable and past work stays
in Saved materials. Agents can assemble ordered saved revisions into an interview
collection that reads as one scrollable pack. Materials link directly from preparation tasks;
learning goals share the interview planner’s daily budget even without upcoming
interviews. Text remains the request/revision interface, and the workspace renders
the results. Generation runs through the connected agent, not a website scheduler.
See [artifact behavior, tool mapping and release limits](docs/schema.md#documents-and-ai-text).

The **Tools & skills** tab retains the native categorized skill library with
39 static usage manuals and copyable agent examples. The interview category includes STAR Answer Writer and Interview Answer Builder for evidence-backed drafts, company adaptations and saved Toolkit materials. Categories cover profile
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

Personal agents can load career-ops-style targeting, house rules and portal/query configuration, then checkpoint their own sweeps and save discovery/screening evidence. Lookout stores and displays this state. A configured Node worker executes one bounded collect → verify → screen → deduplicate job using the copied Career Ops layer and persists shortlist IDs in the existing job result. Scoped manual research/rescreening tools remain available. The personal agent supplies web search, narrative analysis and four card ratings. Saving preferences does not activate a schedule. The optional HiringCafe resource includes a tested public MCP endpoint; see [its connection and verification limits](backend/discovery-flow.md#hiringcafe-resource-and-connection). See [the discovery flow](backend/discovery-flow.md) for the tested local sequence and explicit source limits. Existing targeting controls edit canonical documents. See [the contract](docs/schema.md#search) for tool mapping, migration and release verification. Backend deployment and a live hosted-MCP round trip are required before claiming availability.

## Private company Network

Network (`/referrals/`) separates Targets from Active processes. Targets shows
companies, teams/roles, research and relevant people in a compact list. Active
processes groups targeted outreach by application and distinguishes role-specific
drafts from other company contacts. Existing company sections retain private
research, priorities, dated sources, contacts and linked applications. Due company follow-ups appear on the Action Board. This is a UI
extension over existing private outreach storage and scoped contact tools; no new
tables, gateway operations or company service are required. See the
[Network UI and storage mapping](docs/schema.md#companies-and-network).

## Application profiles and writing styles

My Profile switches application profiles with a compact button-styled dropdown
beside the page heading, above Overview, About me, Job preferences and My Agent. A plus icon
opens the inline create form; the copy icon duplicates the selected profile. Existing named search profiles remain the same records and
IDs; no account migration or duplicate profile store is introduced. New, duplicate,
rename, active/paused, identity, material selection, writing and targeting edits use
one explicit Save application profile action. Drafts survive switching profiles and
sections until leaving the route. Account/demo changes remount the editor and clear
drafts. Reload saved explicitly discards the selected draft.

About me presents Personal Info, eligibility and shared career background.
The Accounts & identity box is not shown; existing per-profile identity metadata
is preserved. About me presents every section
as an expanded, read-only box, including complete experience/education/project
details and skills. A section’s pen enables only its own fields; its checkmark saves
through the existing background or application-profile path before returning to
reading mode. Failed saves keep the section open. Changed background facts remain
unverified; saving never implies human review. About me has no bottom save footer. Personal Info is the first About me box: first/last
name, preferred name/suffix, email/phone, birthday/location, address lines and postal
code. Desktop follows a two-column reading order; mobile stacks the same fields.

About me presents Documents immediately above Career background. Documents owns the shared resume library (private PDF/DOCX uploads or references) and cover letters. The reusable Templates library is not displayed in My Agent; existing template records remain stored. Assign roles in the Resumes box creates or updates a title/type-to-resume assignment in the selected profile, through the same existing profile narrative and version checks as Job preferences. This explicit action saves the profile, including other profile drafts. Assigned titles/types appear beneath each resume. Uploading or adding a reference opens the inline role form in the same Resumes box; role assignments are managed only in Documents. Existing timing/conditions remain stored and can be inspected in Advanced instructions. Preview opens an uploaded file through its short-lived private URL, or follows the saved reference URL (use a direct PDF URL for PDF preview). Demo fixtures without bytes have disabled Preview actions. Resumes, Cover letters and Templates use the shared document icon. Dropping one PDF/DOCX onto a resume name or using its replacement picker uploads a new immutable file and calls the owned/versioned source-replacement transaction. The display name and role assignments are retained, saved profile/default/rule references move to the new ID, and superseded rows stay out of the current library/selectors. Prior files and existing applications/approvals retain their original IDs and bytes. Save profile drafts before replacement; source changes cannot silently discard them. File validation remains PDF/DOCX, one nonempty file up to 10 MB. If upload succeeds but the source switch is uncertain, the file stays saved and the UI asks for a reload before retry. Replacement requires the resume-source migration and normal gateway release.

Cover letters and templates accept pasted text or document links; this pass does not add binary uploads for them. They use the existing versioned artifact service with kinds `cover_letter` and `application_template`, listed separately with Add, Open/edit and Archive actions. Editing retains document metadata, sources and task links. Current versions are required; conflicts keep the editor draft. Documents are private and shared across application profiles; agent-proposed content does not become verified facts, answer-reuse permission or submission approval. Signed-in saves require the application-document migration and normal gateway release; neither is deployed by local landing. Shared library operations save independently from the application-profile footer. Demo uploads retain fictional metadata only, never file bytes; cover letters/templates use resettable memory services.

About me also owns the shared employer-answer library, plus per-profile saved-answer selections below Career background. Job preferences owns the fallback resume, alongside roles, specializations, employment, seniority, locations, work arrangement, company size, industries, desired/avoided skills, compensation, clearance, values and exclusions. Each criterion retains Required / Preferred / Flexible priority. Search status uses the existing active/paused profile switch.

Resume assignments extend the existing Recruiting targets / Targets narrative: each target may include `employment` (Full-time, Internship, Part-time, Contract, Temporary, or blank). Legacy targets without that field inherit profile job types. Each assignment holds one or more role titles, a preferred resume, timing and conditions; blank resume uses the profile fallback. Conflicting applicable resumes require user selection. These are personal-agent preparation guidance, not new automatic submission routing or approval. Unknown or deleted resume references remain visible for repair.

My Agent owns separate employer-answer and outreach writing styles (Tone, Length, Guidance), scoped by the visible application-profile selector. The account-wide submission-resume control is not displayed; its existing stored default remains unchanged. The tabbed writing workspace saves through Save writing settings using the same application-profile save contract as resume assignments and preferences. Its example previews are illustrative; no live AI generation runs. About me background and shared-library saves retain their existing independent behavior. Old `section=kit` links open Job preferences. The Personalization tab is removed. Job preferences uses the same expanded read-only sections, two-column detail layout and section-level pencil/checkmark editing as About me, including matching criteria, values, company priorities, career goals. Resume assignments appear only in About me / Documents. Checkmarks finish section editing; Save application profile persists the draft. Advanced instructions is an explicit editable section. My Agent sits directly after Job preferences in the left-aligned tab row.

Website RPC `save_search_profile` and MCP `save_search_profile` /
`preferences.profile.save` retain the same owner/version/schema checks. The following
labeled sections are preserved in the existing `instructions` narrative:

- `Application identity`: Preferred first name, Preferred last name, Application email, Email account, Document account, Outreach identity.
- `Application materials`: Default resume ID, Saved answer IDs (comma-separated owned IDs).
- `Employer answer writing` and `Outreach writing`: Tone, Length, Guidance.

`workspace_read`, personal context and canonical profile documents expose the same
saved records. Developer context version 37 explains their meaning; release the
gateway through the normal production workflow before claiming deployed agent
support. No migration or new permission is needed. Hosted round trips and actual
agent account access remain unverified.

Demo check: switch between fictional full-time and internship profiles to see
separate application emails, account assignments and employer-answer tone. Edit tone,
switch profiles/tabs and return; save/reload, duplicate/rename and pause searches.
Edit shared background and verify the independent review/save boundary. Add/edit an
employer answer and inspect retained reuse restrictions. Preview the style brief,
visit My Agent, then reset Demo to restore fixtures. Fixtures and changes
remain in memory and never write real account records or fetch private files.

Profile Overview shows a compact identity row, three account-wide totals
(applications, active interviews and offers), and shortcuts to About me, Job preferences and My Agent. Readiness text appears only for missing/incomplete items
or a paused search. Writing-style details live in My Agent; Accounts &
identity is not displayed. Totals use existing tracker stages and span all application
profiles; identity and settings remain scoped to the selected profile. Counts include user/agent-reported progress
and do not independently establish employer-confirmed submission. Demo uses its
existing fictional application stages and resettable memory store. `workspace_read`
exposes the underlying records; this read-only summary adds no service or permission.

Application identity also includes optional Preferred first name and Preferred last
name per application profile. Overview uses those names for presentation, falling
back to existing shared name details. Shared factual names remain unchanged;
preferred-name guidance never substitutes for a legal-name response or human
verification. The existing versioned `save_search_profile` website/MCP boundary
preserves these two labeled instructions. Developer context 30 documents this
distinction and requires normal gateway release before claiming hosted support.

## Eligibility and simple prior-employment answers

About me includes per-application-profile Eligibility & availability: work
authorization country, authorization, sponsorship now/future, earliest start date,
notice period, relocation, enrollment, graduation month and optional notes. Blank
choices mean Ask me. Changing country clears the three country-specific answers,
so one country's eligibility does not silently carry to another. Existing shared
authorization text remains preserved as Shared authorization notes.

About me → Shared employer-answer library → Worked here before? opens only
Company and Yes / No / Ask me. A separate explicit confirmation permits reuse of
a Yes/No answer. Ask me always stays unverified and always-ask. Saving again for
the same normalized company updates the unique existing canonical question record;
ambiguous duplicates require editing the existing records. No employer history is
inferred from an incomplete resume. Generic answers remain available.

Eligibility uses the existing versioned save_search_profile website RPC/MCP
narrative section `Eligibility & availability`. Prior employment uses the existing
answer-library website service and `save_saved_answer` / `answers.save` MCP proposal
service, with `request_human_action` / `verify-answer` for human-only reuse review.
Agents cannot grant verification or autofill permission. Automatic reuse remains
exact-question, same-company and unique-match only; equivalent wording needs review
under the existing backend checks. Settings are preparation guidance, not verified
facts or a submission authorization. Developer context 30 requires normal gateway
release; hosted behavior has not been verified here.

Demo coverage: fictional country authorization, differing enrollment status, unknown
future sponsorship and an Ask me prior-employment answer. Change country, save,
switch profiles, inspect the simple company answer, and reset to restore fixtures.
All demo edits stay isolated in memory.

## Independent profile rules and recruiting targets

Job preferences starts with one Profile rules field for the selected application
profile: how the agent works and how it evaluates opportunities. It is stored as
`Profile evaluation / Rules`; existing Career goals & tradeoffs remain below it.
There is no global rules editor or live global override. Duplicate profile copies
rules and targets once; subsequent edits remain independent. Legacy shared rules
are preserved as reference. Authenticated/demo users can expand Copy previous rules
and explicitly copy the text into the current profile without replacing its rules.
Later source edits do not change that copy. No automatic migration is attempted.

Recruiting targets are optional profile rows: name, active/paused, roles, opportunity
timing, preferred resume and conditions. Empty profiles retain their existing
criteria. Multiple targets can use the same owned resume; a blank selection uses
the profile preference. Criteria apply to all targets within that profile; conflicts
require review. Timing describes opportunities, not scheduled execution.

Profile rules and targets save through the existing versioned `save_search_profile`
website RPC/MCP boundary and canonical profile documents. Targets are serialized in
`Recruiting targets / Targets` as JSON objects with
`{id,name,active,roles,timeline,resumeId,conditions}`, up to 30 per profile. Invalid
imported text stays available in Advanced instructions instead of being discarded.
The legacy document API remains for backward compatibility; its shared rules no
longer act as configurable defaults under developer context 32 and search guide v3.
Normal gateway release and hosted verification remain required. No scanner,
scheduler, connection or submission router is activated by these preferences.

Demo covers distinct full-time/internship rules, Backend SWE and paused ML-systems
targets, a summer systems target and resume references. Check add/pause/remove,
save/reload, switching profiles/sections, legacy copy and reset. Demo state remains
fictional, resettable and isolated from real accounts and services. My agent stays
unchanged.

## Selective PC branch integration

Current main retains its UI, Clubhouse layout, profile features, artifact tools,
logo cache and GitHub Pages deployment. The PC branch contributes a preview-only
[theme marketplace](docs/theme-picker.md), [durable company workspaces and scoped
Circle intelligence](docs/schema.md#companies-and-network), structured Circle activity and a
agent publication feed, automatic Career Toolkit discovery, and preparation refresh fixes.
The marketplace is available from Profile → Browse Marketplace. Network keeps the
current editors and adds Circle source conversations below the company overview.
Backend additions remain local until the migrations and gateway/MCP are deployed
through the production workflow and hosted access is verified; existing Circle
release gates remain unchanged. No Sites or Logo.dev migration is included.

## Organize a real account with Muse

Copy this into an already authenticated Muse connection:

```text
Refresh my Lookout developer instructions and personal context. Organize my existing
information into my account using the scoped tools: profile and proposed answers,
resumes, application profiles and search documents, verified job batches, reusable
career writing, and company/contact context. Read existing records first, preserve
my edits and statuses, and use real facts and sourced observations only. Do not add
sample data. Read back each saved record and report its destination and ID.
If a tool fails, show the operation, safe error code/status, what was saved versus
unconfirmed, and the concrete next repair. Continue independent work. This request
does not authorize submissions, messages, sharing or enabling automation.
```

Developer version 45 adds these organization and read-back instructions. The prompt
can be used immediately; automatic context refresh needs the updated gateway config
to be deployed. A successful empty read is an empty account; missing RPC/table errors
are deployment/schema problems and cannot be repaired by populating account data.

The current backend is Supabase Auth, Postgres RPCs, private Storage and the
`agent-gateway` / `agent-mcp` Edge Functions. The static Next.js export does not
serve Next.js API routes. The Edge Functions are sufficient for current scoped
account operations when the migrations, functions and credentials are deployed.
The connected agent supplies search/reasoning; browser execution and local document
tools require an available runner. Scheduling, text delivery and external account
access require actual connected services. A persistent worker is a separate future
hosting need for unattended browser/long-running work, not a prerequisite for
saving profiles, batches or artifacts. Repository implementation does not establish
that the connected production project has the same deployment.

## Workspace reset

The local reset flow is described in [workspace reset](docs/workspace-reset.md). It includes a human-only preview and confirmation screen, private Storage deletion, retryable finalization, and an MCP human handoff. Hosted deployment and disposable-account verification remain pending; existing accounts are not reset by adding this feature.

## Simplify tracker CSV import

Applications → **Import from Simplify** accepts the tracked-jobs export directly.
Parsing happens in the browser; it requires no model, Muse process or parsing API.
Review every proposed job before saving. The initial format supports `SAVED` and
`APPLIED`, Full-time and Internship, ISO dates, archive flags and multiline notes;
unsupported statuses or malformed rows stop the import with an actionable error.
Files are limited to 200 KB / 500 source rows, with 5,000 private imported jobs per account.

Imports are owned private history in `imported_jobs`, including records without
URLs. They do not enter `data/jobs.json` or the shared canonical jobs table.
Tracking parameters are removed without dropping role identifiers. Duplicate URLs,
then normalized company/title/location matches, combine original source reports;
an explicit applied report takes precedence over saved. Notes are combined and
original dates/reports remain available in the expanded tracker row. Already owned
applications and prior imports retain their existing status and content. Archived
imports appear under Closed. Imported records currently have an expandable history
view, not the preparation/submission workflow of a verified canonical application.

The website RPC `simplify_import(action,payload)` and scoped MCP tools
The default **Prepare jobs and applications** connection includes `tracking:write`
for importing application history and recording user-reported progress. Read-only
and career-context connections do not include it. Existing tokens retain their
granted scopes unless explicitly updated.

`preview_simplify_import`, `import_simplify_jobs` (`tracking:write`) and
`list_imported_jobs` (`workspace:read`) share the same backend implementation.
Previews return a version; saves require that version and an exact-retry event key.
CSV applied reports never create a receipt, approval, submission attempt or public
contribution. Workspace reset removes import history and retry metadata too.

Release migration `20261023160738_simplify_tracker_import.sql`, `agent-gateway`
(including developerVersion 49) and `agent-mcp` together through the production
release process after landing. Hosted availability and real-account round trips
remain unverified until that release; the UI explains a missing backend API.
The detached demo uses a fictional CSV and memory-only service, covers missing
links, archived/applied/saved jobs, duplicate reports and reimport, and resets on
reload or Reset demo data. It never opens a real file or accesses account storage.

Profile access: the profile-menu link and `/profile/` editor require a signed-in, non-anonymous account. Signed-out direct visits return to Discover after auth initialization; the editor and profile providers do not mount during that check. Detached fictional demo mode retains its resettable in-memory profile. This is a frontend navigation gate; existing owned backend/MCP validation remains the data-access boundary.

My Agent schedule defaults: when no schedule has been saved, Set the search opens with Morning sweep (08:00), Midday check-in (12:00), Afternoon focus (15:00), and Evening networking (20:00) in the browser’s time zone. Defaults are an unsaved draft until Save tasks. An intentionally empty saved schedule stays empty and offers Use default schedule as an explicit draft action. Existing timings, paused tasks and assignments remain intact. General discovery/task/source/update explanations are available from info buttons; open with click or keyboard, dismiss with Escape or outside click. Saving preferences requests timing and does not activate an agent scheduler.

### Company ranking in pack settings

My Agent → Card packs → Company ranking opens the existing shared tier-list editor,
including list creation, duplication, company moves and an Unranked row. These edits
save through the existing preference sync independently of the pack form; cancelling
a pack does not undo ranking edits. Application/search profiles continue to select
the relevant list. Choosing a list in the editor changes the account’s active list,
not an existing profile’s explicit list selection.

New pack tasks ask the agent to read the active profile’s selected list, use company
tiers as a baseline alongside role/team scope and personal fit, and investigate
unranked companies. Existing task instructions and published cards are preserved.
Ranking is agent reasoning, not a new deterministic server scoring engine. The demo
uses the same editor with disposable in-memory preferences and fictional task text.

MCP mapping reuses `read_personal_context` and `save_company_tiers`
(`preferences.tiers.save`, `preferences:write`, with `expectedUpdatedAt`), plus
`save_search_profile` for explicit profile list selection. New task text travels
through `save_notification_preferences`; pack metadata still uses
`save_theme_preferences`. No new service, schema or deployed capability is introduced.

Company ranking uses a contiguous logo-tile board. The visual palette maps S to
Mythic, A to Legendary, B to Epic, C to Rare, and D to Common; Unranked remains
neutral. Colors do not change saved rankings or the separate opportunity-card
rarity calculation. Logos reuse the existing cached manifest with initials when
missing; Logo.dev is not connected by this change.

## Branch convergence (2026-10-23)

All outstanding branch histories are reconciled into current main. Newer profile,
timeline, Network, Circle, toolkit, agent and deployment decisions take precedence
over superseded PC implementations; historical change notes describe their own
passes. The optional `npm run build:sites` target and existing Sites project
identity are retained (see [Sites hosting](docs/sites-hosting.md)), alongside the
GitHub Pages production workflow and logo-cache fallback. The gateway allowlist
contains the exact existing Sites origin; this source merge is not a backend or
Sites deployment, and live auth/MCP parity still requires release verification.
The public catalog combines the morning/midday discoveries with canonical URL
deduplication and preserved application statuses.

## Website onboarding completion

Real onboarding starts with Google sign-up/sign-in and has no fictional demo mode. The LinkedIn entry is disabled until its connector is implemented. Signed-in users without `onboarding.get_state.data.websiteCompletedAt` are sent to `/onboarding/`; completed users visiting that route return to the workspace. Privacy, public toolkit guides and account-reset routes are exempt from completion routing. Read failures show a retry instead of assuming completion.

The final **Open my workspace** action submits `onboarding.submit_step` with `event: website_complete`, the current revision, a stable event key and empty data. The database writes its own timestamp in the owning user's onboarding session. This is separate from the agent's `step: ready`, verified facts, runtime check-in and all application approvals. Reloads and other devices read the same server marker; account switches cannot inherit it. No historical sessions are automatically marked complete.

MCP mapping: `read_onboarding_state` reads the marker; `update_onboarding_step` documents the human-only `website_complete` boundary and the database rejects agent attempts. Agents should request that the user finish setup in the signed-in website. Existing fictional demo onboarding fixtures are retained for backend isolation tests, but the onboarding route never mounts demo mode. Released on 2026-10-23 from merged main `b85aafb`: all 52 hosted migration versions match the repository; gateway version 26 serves developer contract 50 and MCP version 22 exposes the completion boundary. Live disposable-account checks verified human completion, persistent reads/replay, MCP read parity, account isolation, rejection of agent completion, fresh-token authentication, import reads and reset preview. Test accounts were removed. Browser Google OAuth and destructive reset were not exercised in this release.
## Signed-out workspace

Workspace routes show a sign-in prompt until authentication resolves to a
non-anonymous account. Signed-out sessions do not mount the board, account
pages, counters or dashboard tour, and the account provider exposes no catalog
or batch roles until sign-in. Accounts without a private batch start empty;
shared catalog browsing is an explicit signed-in choice. Guest browser caches
remain preserved in their existing namespace, without appearing on the board.
Privacy and individual Career Toolkit guides remain public; onboarding retains
its explicit sign-in/setup flow. Explicit `?demo=1` still opens only fictional,
resettable memory data and remains separate from account authentication.
This is a frontend visibility change; public static catalog files remain public
and backend authorization and scoped MCP tools are unchanged.

Agent connection handoff copies credential-free instructions by default, in onboarding and connection settings. **Copy instructions for chat** never includes a token or bearer configuration; **Copy token for secure entry** is the separate explicit secret-copy action. Onboarding also provides a current-token revoke/start-over action through the existing human-only connections API. No chat-generated secure link is invented by Lookout; use the agent’s actual secure credential form or plugin/MCP settings.

## Lightweight connection and automation setup

Connect/reconnect is not a job-search run. The agent reads onboarding state and submits `connection_test` through `update_onboarding_step` with current revision, stable event key and empty data. The server records a credential-backed connection check and returns only the owning account’s saved `automationSetup.schedule` plus connection ID. This neither attests browsing nor advances agent/website completion, changes intent, creates tasks or enables submission. The website polls read-only and stops with retry feedback after twelve checks rather than queueing discovery.

The setup request instructs the runtime to add/update enabled scheduled tasks assigned to this connection in its own automation settings, preserve saved time/timezone, deduplicate by Lookout task ID and leave unrelated automations intact. Disabled/manual/unassigned tasks are not run. Actual scheduler receipts are required before reporting success; missing settings/capabilities are a blocker, not a reason to launch work or install infrastructure. The agent then gives a short report and stops. Searches/imports execute only under a separate work request or actual scheduled invocation. Lookout stores definitions; it does not supply Muse’s scheduler.

MCP mapping: `read_onboarding_state` → `update_onboarding_step(event=connection_test)`; the browser observes `data.connectionTest`. Existing runtime browsing attestation remains separate. Developer contract 52 defines this bounded setup sequence. Muse’s actual automation-settings support must still be verified in that runtime.

## Local Supabase recovery workspace

For an independent Docker-backed database, Auth, Storage and agent-gateway/MCP setup, see [the local setup and validation guide](backend/local/README.md). Local startup does not require Supabase CLI login and does not recover or switch the hosted account.


## Resume autofill with APILayer (local integration)

Tutorial resume upload or selection automatically extracts and saves supported
facts inline, then shows a green check and **Data saved**. **Continue** advances to preferences. Omitted fields stay unchanged;
extraction or save errors remain visible without advancing. My Profile →
About me → Documents offers **Autofill with APILayer**. New uploads and successful source replacements open
that offer; existing private uploaded resumes have **Autofill profile**. A link
reference, cover letter or template is not sent to the resume parser. Upload alone
never sends a document to APILayer. The tutorial Continue hint and profile extraction button disclose the transfer.
The API key remains in the server-only Node env; no browser OCR is added.

The optional My Profile review shows saved and extracted values side by side. Missing fields default
selected; existing fields and whole history sections default unchecked. Selecting
a history section replaces all entries in that section. Discard leaves the profile
unchanged; saving preserves unrelated fields and clears verification. Unsaved
background edits block import, and account changes or stale profile versions stop
saving. Neither extraction nor saving grants autofill permission or submission
approval. APILayer returns free-text dates, which are retained in descriptions rather than
inventing start/end months. Scanned-resume OCR support is unverified; use text-based
PDF/DOCX documents and review all extracted values. Unknown/unsupported schemas fail closed.

Configure `APILAYER_API_KEY` in `backend/runtime/.env.local`,
then `NEXT_PUBLIC_LOOKOUT_API_URL` in `.env.local`. See
[local parser setup](backend/runtime/README.md#resume-parser-setup). No schema
migration is needed. This is committed integration code and local verification,
not a hosted deployment or proof of a live APILayer request.

### Local test-account auto sign-in

For a loopback preview backed by local Docker Supabase, set these in ignored
`next-app/.env.local`, then rebuild the static preview or restart Next.js:

```
NEXT_PUBLIC_LOCAL_TEST_AUTO_SIGNIN=1
NEXT_PUBLIC_LOCAL_TEST_EMAIL=<existing local test account email>
NEXT_PUBLIC_LOCAL_TEST_PASSWORD=<existing local test account password>
```

Use the existing private `backend/runtime/.review-session.local.json` account when
available; do not create a replacement or copy a hosted account. These values are
included in the local browser build, so keep this export local. Both the website
and Supabase must use HTTP loopback origins for this mode to activate. Existing
sessions are preserved. An empty session signs in through local Supabase password
auth; the Sign in action retries that same account. Sign out remains effective
until reload. With this mode disabled, normal Google sign-in is unchanged.
Detached fictional demo mode remains separate and does not load account auth.
This is a development bootstrap using existing Auth, with no new product/MCP action.


## Durable application handoffs

The Action Board reads `public.action_inbox`, an owner-private log maintained in
the same transaction as application and submission-attempt transitions. Approval
requests, blockers and uncertain submissions have at most one pending entry per
application. Repeated reports retain the same entry; changed conditions retain
the old entry as superseded. Existing pending applications are backfilled.
Resolved entries remain visible in Action history. There is no dismiss/clear API:
the existing exact-version approval, draft/blocker edit and human submission
resolution boundaries remain authoritative. A progress status cannot dismiss an
unresolved submission attempt or grant retry authority.

The browser reads through RLS; MCP `read_action_inbox` maps to
`applications.inbox.read` with `workspace:read`, using the same bounded reader as
browser `read_action_inbox`. Optional `state` is pending/resolved/all and `offset`
paginates 100 records. Pending entries include future `available_at` times for
five-minute stalled-attempt checks. Agents can read and request the existing human
handoff, but cannot mark these entries resolved directly.

Workspace sync no longer polls every 15 seconds. An owner-scoped Supabase Realtime
subscription observes a minimal `workspace_changes` version record, coalesces
notifications, then retrieves current records through existing owned reads.
Connection/reconnection, tab focus and network recovery reconcile missed updates.
Failed reads/writes retain error retries; successful idle sync schedules no network
poll. A one-time local timer reveals delayed submission checks without a network
request. Live connection errors are disclosed; persisted actions survive them.

Release requires the durable-inbox migration (including the Realtime publication),
gateway/MCP developer contract 72 and frontend together. Local SQL, HTTP and client
tests do not verify hosted Realtime delivery or activate a submission worker.
No runner is automatically awakened when an action resolves.

When the signed-in human records Submitted with a verification note, a pending
submission check resolves as `user_reported_submitted`. Its attempt remains
uncertain and retry stays blocked; no employer-observed receipt is fabricated.
Agent progress reports cannot close that handoff. Interview/learning preparation
tables also emit owner invalidations so weekly preparation retains live refresh.


## Programmatic application submission

The configured Node API can expose `submit_application` and
`submit_application_batch` when `LOOKOUT_SUBMISSION_ENABLED=true`. Its default is
off; discovery is filtered by workspace:read, drafts:write, approvals:read and
resumes:read. These tools reuse the local runner implementation; no parallel
submission engine or search-cron execution path exists. Browser contexts and
credentials are isolated per request, with at most two executions per API process.

A batch accepts `{eventKey, applications:[{applicationId,expectedRevision}]}`
(1–10 unique owned references). It executes sequentially while the request runs,
recording durable checkpoints in Edge/Supabase after each application. There is
no background submission scheduler. Node owns browser work; Edge owns validation
and saves; Muse owns reasoning and content. Every child independently obtains
current authorization, validates the exact form/resume and claims a single click.

Use `read_application_batches({batchId})` to reconcile after a lost response.
An active execution lease returns busy; an expired lease allows the identical
batch to resume unfinished entries with stable child attempt IDs. Terminal
results replay without running again. Checkpoint outcomes derive from saved
application/attempt records, not caller-supplied success. A partial batch retains
independent successes and Action Board blockers. Repair supported pre-click
issues from verified facts or request human input, then submit a new eventKey
with current revisions. An agent cannot resolve uncertain submission or invent
approval. Known submitted or uncertain attempts never authorize another click.

The browser `readApplicationBatches` adapter and MCP read use the same private,
owner-scoped reader. Fictional demo services expose completed, partial/uncertain
and running examples without execution. The optional E2E command
`npm run test:submission:e2e` uses real Chromium, controlled employer routes,
local Node HTTP/shared Edge handlers, private fixture downloads and migrated SQL.
It sends no real employer application and calls no model. Use
`LOOKOUT_CHROMIUM_EXECUTABLE` to select an installed browser for this check.

Release requires the submission-batch migration, gateway contract 75/application
guide v4 and configured Node API image. Hosted deployment, Muse client execution
and real employer behavior remain unverified until separately exercised.


## Profile-aware resume selection

Preparation and automatic submission now share `selectResume`: active role
assignments in the selected application profile match normalized title phrases
and job type; unmatched roles use that profile’s fallback. Blank assignment job
type inherits the profile types. Blank assignment resume uses the same fallback.
Conflicting matching files, malformed assignments, unchecked conditions/timelines
and unavailable/superseded/private-file gaps require review. Legacy account-wide
rules/defaults remain only for clients without profile resume configuration.

`prepare_draft` exposes `handoff.resumeSelection` and pins an automatically chosen
owned file/hash. It preserves existing explicit draft selections and reports
differences from current rules. Submission rereads the owned canonical profile in
its existing authorization context, including atomic claim/start comparisons.
Routine execution rejects a stale/mismatched file; exact human approval can
intentionally override the mapping. The runner downloads the draft’s pinned file,
never a newly guessed alternative. Deploy the profile-resume-selection migration
with the gateway update before claiming the new authorization behavior is live.

### Discover posting dates and availability

Discover's Posted filter offers the last 24 hours, 3 days, week, 2 weeks, month,
any time, and posting date unknown. It filters the selected board by employer
publication time, independently of the existing Discover day and profile filters.
Any time is the default; unknown dates are excluded only when a dated window is
selected. Publication time uses the latest owned posting observation when present,
including an explicit unknown date, otherwise the catalog publication date.

Cards and previews show Live, Closed, or Unverified from the last recorded employer
check. Live means active at that check, not a new check on page refresh. The preview
shows Posted and Availability checked separately using readable dates. Filtering
and formatting are local presentation actions over existing owned batch reads;
the scoped `batches.read` gateway/MCP path already exposes the same posting evidence.
No new backend write or MCP capability is introduced. Detached demo fixtures cover
recent, older and unknown dates plus all three availability states.

Job facts use concise display categories: work setting is Remote, Hybrid, On-site
or Not disclosed; sponsorship is Available, Not available or Not disclosed.
Only explicit source statements produce a known category. Work authorization alone
does not establish sponsorship policy, and a city does not establish office attendance.
Undisclosed compensation uses the same Not disclosed label. No expansion is required;
saved source evidence and existing backend/MCP responses retain their original text.

Discover application queue behavior, scopes and worker setup: [application jobs](docs/discover-application-jobs.md).

## Country and city autocomplete

Onboarding location entry supports multiple removable countries/cities and Remote.
Open to anywhere is exclusive. Selected labels use semicolon-separated text in the
existing search profile. It searches countries and cities with Geoapify, debounces
typing and cancels stale queries. Remote, Open to anywhere and manual text remain
available. Set `GEOIFY_API` in the root `.env.local` (or supply
`NEXT_PUBLIC_GEOAPIFY_API_KEY` to the frontend). This is a browser-visible Geoapify
key; configure allowed origins in Geoapify. No private server credentials are copied.
Live-main reads it from the shared source checkout; restart the preview after changing it.
The demo uses fictional suggestions without vendor requests.

MCP mapping: suggestions are an optional input aid; selected location text uses the
existing search-profile prompt save and its ownership/version validation, also
available to agents through scoped search-profile editing. No new write boundary.

Onboarding role preferences also support multiple removable roles. Suggested roles
toggle independently; custom roles can be added with Enter or Add role. Selected
roles use semicolon-separated text in the existing search-profile prompt.

Website onboarding saves preferences before AI connection. Once a real runtime
connection is confirmed, an optional first-role catalog preview is offered with
Skip for now. Skipping connection bypasses the preview. Connection checks do not
start searches; the preview does not queue an agent task, approve, or apply.
The flow reuses the existing scoped onboarding read/check and search-profile save
boundaries; only the order and optional presentation changed.

Agent picker artwork is served locally from `next-app/assets/agents/`; official
source URLs and retrieval date are recorded in `sources.json` there. Dots keeps
its existing `dot` provider ID; Claude Duet has its own `claude-duet` choice.
Hermes is available directly in the picker. Selection remains profile setup
metadata through the existing profile writer; artwork does not establish a live
connection. The shared picker also supplies demo imagery.

## Hosted Lookout release

Production Supabase is `osyrlausutnqzlegxmnd` (Lookout). The static frontend and trusted runner default to that project; local `make dev` continues to use its isolated Docker database. Existing public logo-cache URLs remain public assets on the original project and do not carry account credentials. This release does not transfer existing accounts, private files, tokens or application history from the original backend.

The main-branch **Deploy React board** workflow deploys the backend first through **Deploy Supabase backend**, then builds and publishes the static website. The backend workflow can also be dispatched alone from main. It uses the encrypted repository `SUPABASE_ACCESS_TOKEN`, links only the fixed production project, previews/applies committed migrations, and deploys `agent-gateway`, `agent-mcp` and `workspace-reset` with their committed authentication configuration. The retired logo bootstrap is not deployed.

`scripts/deploy-supabase.mjs` requires an exact, clean main-branch Actions source commit and verifies source bytes with the existing runtime stamping helper before packaging. Gateway and MCP report the same reviewed commit. This is deployment provenance, not proof of application behavior. Do not deploy a feature branch or override local Auth settings onto production. Hosted Auth redirect/provider configuration and external-service secrets are managed separately.

The new Google OAuth callback is `https://osyrlausutnqzlegxmnd.supabase.co/auth/v1/callback`; it must be allowed by the Google OAuth client. Supabase alone does not host the optional Node API, parser, worker or submission browser. Those capabilities remain unavailable until a separate runtime and required secrets are configured and verified.
