# Local Node API and approved discovery worker

The TypeScript Node process serves MCP at `http://127.0.0.1:8080/mcp` and bounded
operations at `/v1/operations`. Docker Compose separates the stateless API from
the durable discovery worker. `/healthz` reports process health; it does not prove
that Supabase or the worker is available.

The approved executor is `search_ats`: one leased job collects up to 25 leads per
source, verifies supported employer postings, saves observations, persists current
versioned screening checks, applies copied Career Ops deduplication and stores
shortlist IDs in its existing job result (`pipelineVersion: 1`). Muse reads that
shortlist, writes candidate-specific reports and four ratings, publishes a batch
and prepares drafts. Normal jobs need no separate screening/dedup MCP calls.
Collection supports Greenhouse/Lever; liveness for each link uses the copied
ATS API/browser ladder across upstream-supported sources. Full-description
extraction currently supports Greenhouse. Active unsupported extraction remains
explicit and partial; it does not become a fictional parsed record. Up to ten configured sources and 250 observations are bounded.
The worker never generates LLM reports, messages or applications. Source coverage,
unknown applicant eligibility and pending Muse reporting remain explicit.

The worker uses direct service-only Supabase RPCs fenced by job ID, current
version, short-lived lease token, active owned connection and pinned profile/run.
It does not call Edge Functions for search execution. The Node API owns queue,
authentication and guide operations directly; existing configuration/read and
other domain routes retain their explicitly mapped Edge compatibility path.
`lib/mcp-services.mjs` documents those routing boundaries.

Actual fetching uses the existing `runner/career-tools.mjs executeCareerTask`
sanitized child-process boundary and `runner/career-worker.mjs scanSource` flow.
Only copied Greenhouse and Lever providers are available to this backend path;
the installed catalog of 108 providers is not broadly activated. The verbatim
scanner, tracker deduplication and merge dependency closure is copied by
`scripts/import-career-tools.mjs` from CareerOps VERSION 1.36.0, commit
`c78e14cdfd52f18a92e4a67694efab7ddef59385`. All 249 copied files retain their
SHA-256 manifest and MIT license, including `data-static/aggregator-domains.txt`.
No copied source file was hand-edited.

The existing provider registry, guarded HTTP transport and per-connection socket
scope perform fetching. Copied `scan.mjs` identity functions and the original
`dedup-tracker.mjs` CLI decide duplicates in a disposable mapped tracker inside
the child workspace. The copied `postingUrlRelation` protects distinct functional
URLs; native posting identity and requisition fields are preserved through SQL
resume reads. No second provider parser or URL normalization algorithm lives in
`backend/runtime/ats.ts`; it maps outputs into the existing owned search tables.
The original dedup CLI is deliberately executed, not imported, because it has
top-level file transactions. Its temporary tracker is removed with the child
workspace and never becomes a second user application store.

The child receives no Supabase/agent credentials, has a 384 MiB JavaScript heap,
a 120-second task timeout and 16 MiB output cap. Existing `scanSource` bounds a
source to 20 HTTP requests and the raw scanner to 500 returned jobs; the normal
job requests 25 per source and uses at most ten configured sources. Save transactions are capped at 25 rows and
48,000 encoded UTF-8 bytes. Provider discovery excerpts are not treated as full verified records: the job
verifies supported exact employer URLs and parses the description through copied
`normalizeGreenhouseJob`, bounded at 60,000 characters, before saving observations.
Unknown publication dates remain null; Lever creation times are not promoted to
publication dates. Unsupported sources stay agent research work. Coverage does
not establish fit, eligibility, exhaustive research or full-description archival.

On expired-lease retry, a worker resumes its pinned run and reads bounded identity
pages from that run before fetching pending sources. Only public posting identity, company, title, location and requisition fields
are returned to this internal deduplication path. Already
completed sources remain completed; previously saved observations are retained.
Attempt-specific retry keys prevent a changed fetched snapshot from reusing an
older write key. All subsequent writes still require the current lease. The
existing three-attempt limit closes unresolved runs as partial; a slow source can
exhaust a five-minute lease rather than write with stale authority.

## Run locally

Keep populated `backend/runtime/.env.local` outside Git. It supplies the local
`SUPABASE_URL` (inside Docker: `http://host.docker.internal:54321`) and server-only
`SUPABASE_SERVICE_ROLE_KEY`. Set `LOOKOUT_EXECUTION_ENABLED=true` only for approved
discovery work; the default worker is idle. The Docker image and data are local.

```sh
docker compose -f backend/runtime/compose.yaml build api
docker compose -f backend/runtime/compose.yaml up -d api worker
```

This existing local stack was started with CLI 2.72.7 to match cached Supabase
images. Use `SUPABASE_CLI=/opt/homebrew/bin/supabase` for its local verifiers; a
newer CLI can synthesize different local JWT credentials for this running stack.
Never use `--linked`, a hosted URL or production credentials for these checks.

```sh
SUPABASE_CLI=/opt/homebrew/bin/supabase npm run validate:local-edge
npm run validate:local-db
node --test tests/discovery-runtime.test.mjs tests/backend-jobs.test.mjs
```

`node scripts/check-local-discovery.mjs` requires the empty disposable local
project. It creates fictional accounts, fetches the real Together AI public ATS,
seeds a legitimate official observation under a first lease, expires that lease,
and proves the real Docker worker resumes it while Edge is paused. It verifies
queue replay, scope denial, ownership, dedup, partial unsupported-source coverage,
cancellation, disabled scheduling, revocation and cleanup. It writes only a
sanitized receipt to `backend/local/discovery-proof.json`; no keys, tokens or
candidate data are logged. It unpauses Edge and removes its accounts even when
a check fails. It deliberately refuses the retained presentation workspace.

`node scripts/prepare-local-discovery-review.mjs` creates the separately authorized
**Local alpha review** identity and two completed Together AI source runs for
`systems-ft` and `systems-intern`. It preserves the account and saves its session
only in ignored mode-600 `.review-session.local.json`. Reuse that file; never
print or commit its contents or remove the retained identity without the user's
consent. The profiles contain targeting guidance, no invented resume facts.
A connected agent must select verified relevant roles, supply honest compact
assessment JSON and publish them through the existing batch service before they
appear as Discover cards. Raw search listings alone do not populate Discover.

The prototype receipt `backend/local/discovery-proof.json` predates the user's
literal-reuse correction and is explicitly marked superseded. The current proof
is `node scripts/check-local-careerops-discovery.mjs`: it uses the retained local
review account, submits a new Node MCP job, proves copied provider/scanner/tracker
execution from persisted provenance, reads actual owned Supabase observations,
and preserves the account and published cards. Its sanitized receipt is
`backend/local/careerops-discovery-proof.json`.

API and worker Docker logs rotate at 10 MiB per file, at most three files each.
Repeated worker database failures log at most once a minute and one recovery
event; logs contain no tokens, private request bodies, full descriptions or
resume data. Existing run summaries, source counts and blockers provide the
bounded execution evidence; no trace table was added.

The recorded proof is local only. Hosted users, private files, sessions and data
have not been recovered; no hosted deployment, publication or real application
submission was performed. Real Google OAuth and an externally reachable MCP
endpoint remain outside this local proof.


## Resume parser setup

The API process now owns immediate bounded resume extraction alongside queued ATS
searches. No worker or `LOOKOUT_EXECUTION_ENABLED` change is required for parsing.
Keep existing local Supabase values in `backend/runtime/.env.local` and add:

```dotenv
APILAYER_API_KEY=<server-only APILayer key>
```

Create a personal [APILayer account](https://marketplace.apilayer.com/signup),
subscribe to its [Resume Parser API](https://marketplace.apilayer.com/resume_parser-api),
and copy the key to the local Node env. The endpoint is pinned to
`https://api.apilayer.com/resume_parser/upload`, with raw file bytes and the `apikey`
header; there is no caller-controlled provider URL and no public resume link.
The former AFFINDA_API_KEY/AFFINDA_BASE_URL/AFFINDA_ORGANIZATION settings are unused.
APILayer's Resume Parser listing says uploaded files are deleted after 15 seconds
and parsed results are not stored. This is the vendor's claim, not an independently
verified retention guarantee, and does not establish zero retention of account,
billing or technical metadata. Lookout still keeps its private resume and accepted
profile data in Supabase. No browser OCR is added; scanned-resume OCR is unverified.

In `next-app/.env.local`, set the public API origin (never a secret):

```dotenv
NEXT_PUBLIC_LOOKOUT_API_URL=http://127.0.0.1:8080
```

After landing, build the API image from the checkout containing this change and
recreate **only the API** after resolving ownership of the current Compose stack:

```sh
docker compose -f backend/runtime/compose.yaml build api
docker compose -f backend/runtime/compose.yaml up -d --no-deps api
```

Restart the Next.js frontend to pick up its env value. Existing Docker containers
do not receive new env values until recreated; do not restart Supabase or the
worker for this feature. No database migration is required. Missing configuration
returns a useful error while preserving uploaded files.

Authenticated browser `POST /v1/resume-import` accepts only `{resumeId}`. Node MCP
`parse_profile_resume` / `resumes.parse` takes the same payload and requires all of
`workspace:read`, `resumes:read`, `profile:write`. The Node-only tool is absent from
Edge MCP discovery. Both entries derive identity from validated credentials,
look up the owned current private resume, verify its bytes/hash, and call the same
mapper. Reference URLs, user IDs and object paths are never accepted as input.
APILayer failures are sanitized; keys, file contents and raw responses are not logged.

The proposal contains sanitized supported facts, fixed quality warnings, current
owned profile facts and `profileUpdatedAt`. It writes no profile. Website saves use
`update_workspace_fields` (`profile.fields.update`) with the exact timestamp;
Node MCP `update_profile_fields` routes to existing `agent_dispatch` SQL directly,
so both use the same owner/version/schema validator without an Edge dependency.
A missing profile uses the existing versioned `profile.save` creation boundary.
Imported facts remain unverified. The cloud adapter adopts the save receipt into
its serial sync baseline, preventing an old whole-profile autosave from replacing
accepted imports. Background drafts must be saved before importing.

Successful sanitized extractions are coalesced/cached per owner and checksum in
API memory for 15 minutes, at most 20 entries. Auth and ownership are rechecked even
on cache hits. There is no durable billing deduplication across process restarts
or multiple replicas; uncertain retries can consume another credit. No automatic
retry is made. Only documented APILayer name, email, skills, experience and education fields are
mapped. Free-text dates are retained in descriptions and month fields stay absent.
Name parts, degree details, projects and other unsupported fields are not invented.
Malformed responses fail closed. Existing profile fields remain untouched unless
the user selects replacement. OCR support is unverified and the review says so.

Verification:

```sh
node --test tests/resume-import.test.mjs tests/cloud-sync.test.cjs
SUPABASE_CLI=/opt/homebrew/bin/supabase node scripts/check-local-resume-import.mjs
LOOKOUT_PLAYWRIGHT_MODULE=<absolute-playwright-index.mjs> LOOKOUT_UI_URL=http://127.0.0.1:3047 node scripts/check-resume-import-ui.mjs
```

The local verifier refuses hosted Supabase, creates/removes fictional accounts
and a private fixture, and proves human/MCP extraction and versioned saves against
real local Auth/Storage/SQL with the APILayer response stubbed. It creates its own
Node listener on a random port and changes no running containers. Demo browser
verification uses memory-only fictional proposals and no APILayer/network calls.
A real API key and a deliberately chosen test document are still needed for a
live APILayer round trip; mocked/local checks do not establish vendor extraction
accuracy or hosted availability.


### Explicit live parser smoke test

`SUPABASE_CLI=/opt/homebrew/bin/supabase LOOKOUT_RESUME_API_URL=http://127.0.0.1:8081 node scripts/check-live-resume-import.mjs`
uses the running local API and its server-only key. It sends a generated fictional
PDF to APILayer, then verifies the versioned website save and scoped MCP cached
proposal. Only loopback local services are accepted. Test accounts/files are
removed even after a failed assertion. This is an explicit live test and may
consume an API request; it is not part of `npm test`. `--write-fixture` writes only
the fictional PDF to `/private/tmp/lookout-live-resume-fixture.pdf` for inspection.

Live response validation found that `dates` may be string arrays and `name` can be
null. The adapter accepts these forms, leaves missing facts absent, and labels
returned dates as parser output rather than asserting they appeared verbatim in
the source. The fictional fixture missed the name, misidentified employers, and
misread a date range as a phone number (that phone field is not imported). This
proves connectivity and workflow operation, not extraction quality. Manual review
of names/employers/dates remains necessary. Tiny hand-generated PDFs were rejected
as too small; the smoke fixture is a valid, locally text-verified 36 KB document.

## Single-job pipeline and cleanup

`result.shortlist` is the handoff to Muse. Screening uses the same service as
explicit MCP rescreening, with narrow leased SQL operations and current version
checks. A separate dedup MCP wrapper was retired; the job directly invokes the
shared adapter around unchanged copied code. Identity-only resume reads remain
small; an explicit job-bound `purpose: screening` projection includes only the
posting fields and observation needed to filter. No applicant profile/files or
applications are added to discovery pages.

`node --test tests/search-job-pipeline.test.mjs` covers the real SQL lease boundary,
persisted checks/shortlist, partial coverage, recovery and settings conflicts with
fictional provider fixtures and actual copied filtering/dedup children.

The existing liveness stage uses `runner/career-liveness.mjs` as orchestration for
unchanged copied API/browser classifiers. Docker installs system Chromium and
passes only its executable path to the existing credential-free child. Browser
checks stay sequential and retain the upstream URL/route guards. A soft 30-second
fallback budget returns explicit uncertainty for remaining links. Liveness and
extraction outcomes are separate source diagnostics, not a new service or table.


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

## Interview intelligence

`read_interview_intelligence` (`knowledge.interview`) is a read-only Node MCP operation backed by the same database function as the signed-in application Overview. Both `knowledge:read` and `workspace:read` are required for agents. It resolves an owned application or catalog posting, then retrieves current published reports across current Circle memberships by explicit posting association. Empty scopes do not trigger automatic Muse output. See `docs/interview-intelligence-platform.md` for source identity, tests and the undeployed release boundary.
