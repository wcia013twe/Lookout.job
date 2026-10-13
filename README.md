# Job Signal Board

A job-search workspace with a public catalog, private candidate records, and tools for each user's own Muse agent. GitHub Pages serves the UI; Supabase handles identity, private data, files, and agent access. Theme styling can change the presentation without changing the application workflow.

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
5. **Prepare under your policy.** Muse inspects the live form and selects your configured résumé. Routine matches can proceed using verified facts and permitted saved answers. Important matches, auto-apply-off, unfamiliar answers and missing choices go to **Needs you** for focused exact-version review. Agents never manufacture a human approval.
Unresolved Playwright and agent recovery failures go to **Needs you** with a reason and next action. Uncertain submission outcomes pause for human verification.

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
| Needs you / Applications | Versioned approval, blockers, human progress reports, immutable submitted drafts and server timeline |
| Agent connection | Per-user expiring/revocable credentials; HTTP gateway and custom MCP endpoint |
| Morning batch links | Owned `?batch=<uuid>` routes; latest private batch can load for a signed-in user |
| Form inspection/prefill | Greenhouse public form inspector; adapted Greenhouse/Ashby browser tools, explicit resume rules, reviewed native radios/checkboxes and strict approval checks |
| Progress/leaderboard | Opt-in alias and server-derived aggregate metrics; self-reported submissions remain tracking claims |

## Company logo cache

Company logos are public branding assets in the Supabase `company-logos` Storage
bucket. The website resolves normalized company names through
`data/logo-manifest.json`; agents do not search for or download logos during job
scans. Content-hashed URLs keep browser/CDN caches stable. Existing local images
remain fallbacks, and companies without an asset show initials. This bucket is
separate from private resume storage.

## Run and validate

Node 22+:

```sh
npm ci
npm run build:auth
npm test
npm run test:db
npm run validate:data
python -m http.server 8000
```

Open `http://localhost:8000`. Production Google redirect configuration is documented in [backend/README.md](backend/README.md); localhost OAuth requires an explicitly allowed local redirect. The committed auth bundle lets GitHub Pages serve the app without a build server. Rebuild it after changes to `auth.js`, `cloud.mjs`, `cloud-model.mjs`, or `backend/client.mjs`.

## Code map and invariants for Muse/other agents

| Location | Responsibility |
| --- | --- |
| `index.html`, `app.js`, `components.js` | Basic page framing, public discovery and existing Web Components |
| `store.js` | Guest/per-account browser cache; account switching preserves guest records |
| `workflow-model.js`, `workflow.js` | Local review controls and workflow rules; signed-in approval/stage writes go to backend RPCs |
| `auth.js`, `cloud.mjs`, `cloud-model.mjs`, `backend/client.mjs` | Google auth, serialized autosync, record mapping and owner-checked database requests |
| `saved-answers-*`, `tierlist-*`, `tierlists.js`, `resume-files.js` | Profile features; standalone modules use the shared store |
| `agent-connections.js` | Human credential management; keys shown once, never persisted in browser state |
| `supabase/migrations/` | **Single source of truth for the database schema**; use exact deployed migration versions |
| `supabase/functions/agent-gateway/`, `agent-mcp/` | Scoped server tools; no general SQL/shell tool and no agent-created human approval; guarded submission transitions |
| `runner/`, `scripts/runner-*` | Deterministic form inspection and approved prefill and guarded native Greenhouse submission |
| `styles/` | New CSS, motion definitions and shaders; keep presentation out of state logic |
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

Developer contract version **6** advertises the concrete local MCP adapter. Tell Muse:

> Check my Job Signal Board context versions. Load and retain the updated developer instructions, and reload my personal settings only if changed or missing. Follow my settings and message templates. Check whether inspect_application, fingerprint_resume, try_application and submit_application are available. If missing, report the one-time runner setup needed; never claim it is connected. Inspect and prepare drafts, ask me to review unfamiliar answers, and use submit_application for routine authorized matches or exact approved important matches. Never retry an uncertain submission. Update the local checkout to obtain the new tool. Report unresolved failures to Needs you and text me using my configured template. Prepared is not submitted.

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

Unknown outcomes stay Needs you. The review dialog lets the user record where
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
