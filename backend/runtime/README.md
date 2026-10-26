# Local Node API and approved discovery worker

The TypeScript Node process serves MCP at `http://127.0.0.1:8080/mcp` and bounded
operations at `/v1/operations`. Docker Compose separates the stateless API from
the durable discovery worker. `/healthz` reports process health; it does not prove
that Supabase or the worker is available.

The approved discovery executor is `search_ats`. A connected agent owns intent,
source/profile configuration, unsupported-source research, eligibility checks,
fit reasoning and any card assessment JSON. The worker deterministically fetches
supported public Greenhouse/Lever boards, saves official observations, deduplicates
canonical URLs and normalized company/title/location identities, and records
checkpoints and honest exhaustive/truncated/inaccessible coverage. It never
scores candidates, publishes a batch, drafts answers, grants approval, sends
messages or submits applications. Discovered rows remain unscored/review-needed.

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
`c78e14cdfd52f18a92e4a67694efab7ddef59385`. All 225 copied files retain their
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
source to 20 HTTP requests and this integration to 500 returned jobs; the worker
uses at most ten configured sources. Save transactions are capped at 25 rows and
48,000 encoded UTF-8 bytes. Description excerpts follow the copied provider's
limits (normally 4,000 characters for Greenhouse); the full card/modal uses the
copied uncapped `browser-extract.mjs jdHtmlToText` path when explicitly fetched.
Unknown publication dates remain null; Lever creation times are not promoted to
publication dates. Unsupported sources stay agent research work. Coverage does
not establish fit, eligibility, exhaustive research or full-description archival.

On expired-lease retry, a worker resumes its pinned run and reads bounded identity
pages from that run before fetching pending sources. Only canonical URL, company,
title and location are returned to this internal deduplication path. Already
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
