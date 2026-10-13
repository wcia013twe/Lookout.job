# Job Signal Board

A job-search workspace with a public catalog, private candidate records, and tools for each user's own Muse agent. GitHub Pages serves the UI; Supabase handles identity, private data, files, and agent access. Theme styling can change the presentation without changing the application workflow.

## Desired daily interaction

1. **Set up once.** Optionally sign in with Google; save verified profile facts, resume variants, search preferences, and separate Full-time / Internship company rankings. Choose which saved answers may autofill and which must always ask.
2. **Muse prepares the morning batch.** Your connected agent reads your preferences, searches for relevant jobs, verifies employer postings, and publishes a private batch. Personal fit notes stay separate from the shared job catalog.
3. **Open the link.** Muse sends “Your morning jobs are ready” through its own notification channel. The link opens your batch on the shared website. Login identifies the owner; a batch ID alone does not grant access.
4. **Review cards and queue roles.** Cards show company, role, rarity, location and compensation tags, with base versus total compensation labelled accurately. Opening a posting is not applying.
5. **Prepare and review.** Muse inspects supported forms, selects the right resume, drafts answers, and sends blockers or ready drafts to **Needs you**. Agents do not mark a human review complete. You check the complete employer question list and approve the exact version.
6. **Apply with evidence.** The intended final runner submits only a current approved version and records employer confirmation. **Current runner support stops at inspection and approved prefill/manual handoff.** You can record a manual submission with a note; this is labelled user-reported and never fabricates a receipt.
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
| Form inspection/prefill | Greenhouse public form inspector; authored Greenhouse/Ashby browser adapter with strict approval checks and manual blockers |
| Progress/leaderboard | Opt-in alias and server-derived aggregate metrics; self-reported submissions remain tracking claims |

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
| `supabase/functions/agent-gateway/`, `agent-mcp/` | Scoped server tools; no general SQL/shell tool and no agent approval/submission endpoint |
| `runner/`, `scripts/runner-*` | Deterministic form inspection and approved prefill; no automatic submit |
| `styles/` | New CSS, motion definitions and shaders; keep presentation out of state logic |
| `data/jobs.json`, `data/tierlist-presets.json` | Public discovery feed and configurable ranking defaults |

Keep verified personal facts, agent-generated drafts, and employer requirements distinct. Never share service-role keys. Derive ownership from the authenticated user/agent token, not a caller-supplied user ID. A runner must fetch the **current** approval and verify job URL, draft, resume bytes and form fingerprint; adding metadata after approval requires reapproval. A status is not proof of submission.

`data/jobs.json` is the canonical static discovery feed. Preserve known application statuses when updating it, deduplicate canonical URLs, and never invent source dates. Supabase is authoritative for signed-in private application state. Personal recommendations belong in batch items, not employer records. `data/tierlist-presets.json` holds subjective ranking defaults and white-label labels; theme changes must not change workflow semantics.

## Agent and runner setup

Sign in → Profile → Your agent → Create agent connection. Copy the setup into an MCP client that supports bearer headers; keep the key in the agent's secret settings. Connection formats vary by client; Muse's exact custom-MCP/auth support still needs confirmation. Browser tools come from the agent's own runtime, not from the job-board MCP server.

- [MCP setup and tools](mcp/README.md)
- [HTTP gateway contract](backend/agent-contract.md)
- [Runner commands and safeguards](runner/README.md)
- [Backend deployment and auth configuration](backend/README.md)

## Remaining work

- Verify a real Google sign-in, private workspace sync, file upload/download and MCP connection on the intended devices/clients.
- Connect Muse's scheduler and notification channel to send actual morning/review links; the backend does not send texts or monitor inboxes.
- Validate prefill against live employer forms, then build a submission adapter with duplicate-attempt protection and employer-confirmed receipts. Workday, CAPTCHA, custom controls and conditional forms still require handoff.
- Add user account export/deletion, stale-file cleanup, operational alerts/rate limits, and leaderboard abuse handling before broader rollout.
- Optional later: sync legacy browser link history/networking, add theme packs, and expand job-source automation. Do not add these ahead of the core apply/review loop.
