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

Public GETs permit only closed HTTPS ATS endpoint templates, reject redirects,
bound each response to 8 MiB and retry transient failures once. Greenhouse is
bounded to 500 observations per source; Lever to three 100-row pages; a job uses
at most ten configured sources. Save transactions are capped at 25 rows and
48,000 encoded UTF-8 bytes. Archived job descriptions are excerpts of at most
4,500 characters; consumers needing a full modal/job description must retrieve
the live employer posting or complete ATS response. Publication dates are null
unless actually supplied; updated timestamps never become publication dates.
Coverage describes source enumeration, not candidate fit or full-description
archival. Partial/malformed/unsupported sources remain explicit.

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

The recorded proof is local only. Hosted users, private files, sessions and data
have not been recovered; no hosted deployment, publication or real application
submission was performed. Real Google OAuth and an externally reachable MCP
endpoint remain outside this local proof.
