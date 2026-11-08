---
type: operational status
title: Current implementation state and operational limits
description: Evidence-qualified snapshot of implemented Job Signal Board surfaces, release boundaries, local-only execution paths, and the verification needed before release-readiness claims.
tags: [operations, implementation-status, deployment, verification, limits]
verified:
  - by: openwiki/0.7.2
    at: 2026-11-07T02:52:01.830Z
sources:
  - id: openwiki-source-164e2da859b5277df81c7d94
    resource: repo://.github/workflows/ci.yml
  - id: openwiki-source-36e1e613b7e50302276c9f59
    resource: repo://.github/workflows/deploy-backend.yml
  - id: openwiki-source-6766b7a0c14857435d2077c9
    resource: repo://.github/workflows/deploy.yml
  - id: openwiki-source-9025181f12900b1c2ae4adf5
    resource: repo://backend/README.md
  - id: openwiki-source-f43f73a4f92761bf128d8680
    resource: repo://backend/runtime/.env.example
  - id: openwiki-source-bed7755e9721f2cc07f835ee
    resource: repo://backend/runtime/main.ts
  - id: openwiki-source-ee1b3e21718542a757d4d790
    resource: repo://backend/runtime/README.md
  - id: openwiki-source-57291caf28bfcf2ec46b220f
    resource: repo://docs/schema.md
  - id: openwiki-source-012f2c78e3b1446dfc35803f
    resource: repo://Makefile
  - id: openwiki-source-70a16c09a9eb6e620cf00513
    resource: repo://mcp/README.md
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-d1a22cc381bbd73a73205d18
    resource: repo://runner/README.md
  - id: openwiki-source-5e0e032552d77cb40052782b
    resource: repo://supabase/functions/agent-gateway/instructions.json
  - id: openwiki-source-3cae6e3f5eeea02db512314f
    resource: repo://supabase/functions/agent-mcp/index.ts
generated: { by: "openwiki/0.7.2", at: "2026-11-07T02:52:01.830Z" }
---

# Current implementation state and operational limits

This page separates **code present in this repository**, **behavior that a local operator can enable**, and **behavior evidenced as deployed**. It is not a promise that an agent host, external service, or employer system has completed an action. In particular, the product persists records and enforces scoped workflows; it does not itself supply a model runtime, recurring scheduler, SMS/notification transport, inbox monitor, remote browser, or general database/shell access.

## Status vocabulary

| Label | Meaning in this page |
| --- | --- |
| **Implemented** | Source and focused tests describe the behavior; it still may need a configured environment or an end-to-end check. |
| **Feature-gated** | The code path exists but is disabled until a named runtime flag, deployment, permission, or human action permits it. |
| **Locally runnable** | A developer can run it with the documented local services and credentials. It is not evidence of hosted availability. |
| **Deployment recorded** | Repository documentation records a particular hosted rollout. It is not a claim that the checked-out code has reached that environment or that every client integration works. |
| **Unverified** | No end-to-end evidence should be inferred. It remains a release blocker for claims that depend on it. |

## What is implemented

Application automation honors the strict account-wide `autoSubmitApproved` guard even for explicit profile modes. Profile controls show the account block and remain disabled while it is off or missing; profile saves cannot grant global consent. Policy reads and runner authorization explain the block and direct the user to exact-draft approval in Applications. This is locally verified behavior; hosted availability requires the frontend and gateway release.

### Product and persistence surfaces

The production UI is a static Next.js export, while Supabase owns identity, private records, storage, and server-side authorization. The public catalog remains static data; signed-in private state—including profile facts, preferences, resumes, batches, applications, approvals, attempts, search records, and operational records—is modeled by migrations and protected by owner-aware services. A detached `?demo=1` workspace uses fictional in-memory fixtures, deliberately avoids the account store, auth client, cloud sync, and production MCP, and resets on refresh.

The schema/reference documents a prepared hosted rollout (54 application tables and 49 recorded migrations as of 2026-10-23), but also calls out a separately developed workspace-reset migration as local-only. Treat migrations as the executable schema source, not the documentation or an older UI proposal.

Discover batch items can be removed through the scoped `remove_discover_job` action. Removal hides the owned item in Discover while retaining its batch history, shared catalog entry and applications. Availability depends on deployment of the migration and gateway; see `changes/discover-remove-7PMSxi.md`.

### Agent data plane, not an agent runtime

Remote MCP is a stateless Streamable HTTP transport: every request forwards an opaque bearer credential to `agent-gateway`, which is the authority for connection scope, ownership, expiry/revocation, validations, and revision checks. MCP discovery is scope-filtered. The transport has no server-initiated SSE, browser tooling, shell, SQL tool, connection management, or submission endpoint of its own. Developer instructions require context-version checking, scoped-tool discovery, read-back after writes, and preservation of human approval/verification boundaries.

The system also has persisted task, change-feed, lease, and delivery concepts. They let a compatible personal-agent host resume authorized work and acknowledge durable outcomes; they do **not** install a host, execute a model, wake an external agent, or create a schedule. The optional `mcp/change-worker.mjs` is an adapter a host must supply with its own authorized call, handling, and verification functions.

```mermaid
sequenceDiagram
    participant Client as MCP client or agent host
    participant MCP as agent-mcp function
    participant Gateway as agent-gateway
    participant Store as Supabase records
    Client->>MCP: Bearer token and MCP request
    MCP->>Gateway: Operation and payload
    Gateway->>Gateway: Validate token scope and ownership
    Gateway->>Store: Read or revision-checked write
    Store-->>Gateway: Authorized result
    Gateway-->>MCP: Result or error
    MCP-->>Client: JSON response
```

This shows the hosted MCP authorization path; it does not depict an autonomous agent execution loop.

### Search and discovery execution

The current direct-search implementation uses pipeline version 2: immutable temporary
snapshots on a named Docker worker volume, metadata gates before official verification,
full configured gates and historical dedup before permanent shortlist saves. SQL stores
leases, fenced snapshot references, aggregate progress and bounded diagnostics while
collection runs. The agent receives a terminal shortlist receipt and pages the run for
all results; its first 100 IDs are a preview. Automatic hosted-board collection and
publication are disabled for this path. Personal eligibility remains agent review.
Applications are untouched. See the current [workflow](../workflows/job-discovery.md)
and `backend/runtime/README.md`; earlier execution descriptions below are historical.

The local Node API and worker are separate Docker services. The worker only claims already-queued jobs; it contains no recurring-search scheduler. When explicitly enabled, one `search_ats` job is bounded to configured sources and observations, uses service-only RPCs with job/version/lease/connection/profile fences, and fetches through a constrained child-process boundary. It collects and verifies supported leads, persists observations and screening inputs, and returns shortlist IDs. It does not generate model reports, messages, or applications. Unsupported extraction remains partial rather than becoming a fabricated parsed record.

The source is deliberately conservative: configured execution is off by default (`LOOKOUT_EXECUTION_ENABLED=false`), the worker is idle otherwise, and retry/lease behavior can finish a run as partial. The repository’s local proof documentation explicitly says it does not establish a hosted deployment, externally reachable MCP endpoint, real Google OAuth, or real employer submission.

### Application execution

A local stdio runner implements deterministic inspection, resume fingerprinting, prefill, and guarded submit tools for listed ATS types. Submission requires current server authorization, exact owned resume bytes and form fingerprint, a single atomic claim, a short-lived one-use click permit, and an observed confirmation. One active/uncertain/confirmed attempt is enforced per application; a started or uncertain attempt never becomes retryable automatically. An uncertain result requires human verification before a new attempt.

This is an **implemented but operationally gated local execution path**, not a blanket employer-submission claim. The runtime API exposes submission behavior only when `LOOKOUT_SUBMISSION_ENABLED=true`; the runner still needs a graphical/local browser host and a compatible MCP client. CAPTCHA, Workday, custom widgets, extra documents, unsupported confirmation pages, embedded recovery, and a real Muse/employer round trip remain unsupported or unverified. The repository states that no real employer application was submitted during development.

### Resume import

The Node API can parse an owned private resume using a server-only APILayer key. Browser and Node MCP inputs accept only `resumeId`, derive ownership from validated credentials, verify current private bytes/hash, and return a proposal rather than writing profile facts. Accepted imports require the normal revision-checked save flow, and imported facts remain unverified. This API integration is locally configurable; mocked/local checks do not establish vendor extraction accuracy or hosted availability, and OCR for scanned resumes is unverified.

## Hosted and local release boundary

The November 7 hosted-readiness reconciliation uses the observed Lookout project
history in `tests/fixtures/hosted-lookout-20261107.json`: 80 applied versions,
including audit migrations, with six older feature migrations still absent at
inspection. The regression replays that precise history and then the pending
migrations, comparing the resulting columns, constraints, indexes, policies,
RLS, grants, triggers, views and functions with a fresh migration replay. It also
checks preservation of fictional owned data and the imported-tracker, Discover
removal, connection, profile and search paths. Historical statement hash differences
in four migrations were statement-separator formatting, not conflicting SQL.

The production migration push explicitly selects the linked project, includes
reviewed older pending migrations, and skips local Vault configuration. A forward
migration revokes direct browser execution of the optional hosted
`public.rls_auto_enable()` event-trigger helper while preserving its DDL behavior.
This release prepares schema/backend compatibility only: local personal accounts,
private files and sessions are not imported. Hosted readiness still requires the
main-branch backend workflow and live source/schema/permission checks; local test
success alone is not a release receipt. Existing detached demo fixtures remain
unchanged and are covered by the ordinary isolation tests.

Live comparison also identified platform default privileges that a bare test
database did not model. Hosted readiness now replays the observed public-schema
defaults for table, function and sequence grants. A forward migration removes
all direct browser grants on `career_toolkit_results` and restores only the
existing owner-scoped SELECT access; fixed backend writers keep service-role
access. In particular, signed-in users must not retain TRUNCATE, which RLS does
not protect. Schema comparison normalizes only pgvector's optional schema prefix,
retaining its dimension/type checks. Service-role defaults are compared in the
same platform context rather than mistaken for browser permissions.

Verified hosted receipt, November 7: main-branch **Deploy Supabase backend** run
`42409833561` succeeded from `34a3c50b59b78503b883340603022459e15c3308`.
All 89 migration versions and 2,960 source-derived schema/permission entries
matched the live project after accounting for observed platform defaults and
pgvector qualification. The optional RLS helper retained its enabled event hook
and passed a rolled-back DDL probe, with direct anon/authenticated execution
revoked. No application table exposed browser TRUNCATE/REFERENCES/TRIGGER grants.
Live MCP reported that exact source commit and developer contract 112. Disposable
checks passed gateway/MCP unauthenticated denial, executable tool discovery,
owned imported-record writes/read-back/retry, foreign-owner/read-only denial,
and authenticated browser RPC/profile isolation. Test accounts, connections and
imported records were removed; hosted ended with zero accounts, profiles, files,
imports or connections. The six shared companies, knowledge configuration and
Storage bucket settings were preserved. Local personal data was not imported.
Security advisors report no anonymous definer-execution warning; authenticated
owner-scoped definer entry points and private-table RLS notices remain expected.
Google OAuth and GCP worker/browser execution were not exercised. The separate
Pages release `42408607455` timed out after its successful backend step; this
receipt establishes database/backend readiness, not successful website publication.

Final reconciliation also includes the subsequently committed worker-conflict
guards `20261107200723` and `20261107201211`. Official backend run `42411416297`
succeeded from protected main `4a1c1f635e7a0e535f0c429b9f4d99a55e8f1fe2`.
All **91** migration versions and **2,960** schema/permission entries match the
source replay. The real hosted worker queue/ownership/cancelled-expired-lease
conflict scenarios passed in one rolled-back transaction using fictional users
and actual Auth claim settings. Final counts are zero accounts, profiles, files,
connections, imported records, backend jobs and backend requests; shared records
and bucket settings are unchanged. All 56 deployed MCP and 87 gateway source
files match that reviewed commit, including the stamped runtime version. Their
executable sources are otherwise byte-identical to the earlier live smoke-tested
contract-112 handlers; the added SQL guards only change stale worker conflicts
to non-retryable `PT409`. No personal data was transferred and no execution was
enabled. The separate website publication limit above still applies.

The Pages workflow runs on `main`, calls the backend deployment workflow first, runs the repository test suite and data validation, builds the static export, then deploys the Pages artifact. Backend deployment runs only from `main`, requires the production environment and `SUPABASE_ACCESS_TOKEN`, and invokes `npm run deploy:backend`. This wiring means a frontend-only build should not be represented as publishing gateway/MCP or migration changes.

Repository documentation records a prior prepared schema rollout and gateway/MCP release, including unauthenticated denial checks. It simultaneously says authenticated MCP discovery/read/write, client support, real Google sign-in, and intended-device round trips need verification. Therefore describe those releases as **recorded deployment evidence with explicit verification gaps**, not as blanket proof that all current functionality is live.

For local development, `make services` starts local Supabase; `make frontend` starts the frontend; `make dev` sequences services, the optional ngrok tunnel, and frontend. The API/worker Compose stack is distinct and needs server-only `SUPABASE_URL` and service-role credentials. The tunnel is opt-in, exposes only `/mcp`, and preserves bearer authentication. Local Supabase uses separate data from the hosted project; do not use `--linked`, hosted URLs, or production credentials for local checks.

## Configuration and security boundaries

- Keep browser settings limited to `NEXT_PUBLIC_*` values. `NEXT_PUBLIC_LOOKOUT_API_URL` and `NEXT_PUBLIC_AGENT_MCP_URL` are origins, not secrets; `SUPABASE_SERVICE_ROLE_KEY`, APILayer credentials, and agent tokens are server/secret-store only.
- Agent connections are hashed, scoped, expiring, and revocable. An agent token is not a human session and does not mint approval, verification, consent, or employer-submission evidence.
- The Edge functions intentionally use platform `verify_jwt=false` because they perform custom session/opaque-token verification. This is safe only with the fixed gateway checks; do not add a general SQL or service-role browser tool.
- Version and expected-revision checks protect writes. Read current owned state before writing; read back saved state before reporting success; treat timeouts as uncertain and reconcile before retrying.
- Private resume links are short-lived and must not appear in logs, committed configuration, or routine agent replies. The Node child worker receives neither agent credentials nor signed URLs.

## Release-readiness checklist

A change author should make a claim no broader than the checks actually completed.

1. **Run baseline checks:** `npm test` (includes database scenarios), `npm run validate:data`, `npm --prefix next-app run typecheck`, and `npm run build`. CI currently runs the tests, catalog validation, and production static export; database checks and local-edge checks should be run when the change affects their boundary.
2. **Run focused checks for the changed path.** Examples include `node --test tests/mcp-protocol.test.mjs` for MCP framing/scope behavior; the documented local runtime checks for discovery; and runner/database tests for claim, permit, uncertainty, and recovery semantics. Passing fixtures or PGlite scenarios proves those contracts, not a hosted external integration.
3. **Validate the correct deployment unit.** Schema and Edge/MCP changes require the backend deployment path and post-deploy authenticated checks. A Pages deployment only establishes the static frontend artifact. Keep migration/function release versions together when the contract changes.
4. **Verify the intended environment with isolated data.** Local verification must reject hosted endpoints and use disposable/fictional accounts where the supplied scripts do so. A local Docker/Compose proof does not validate production Auth, Storage, OAuth, agent connectivity, or notification delivery.
5. **Exercise a real integration before claiming it.** Verify the target Google OAuth device/client, authenticated MCP client with custom bearer headers, external agent host scheduling/wake/delivery, and—if relevant—the exact supported employer flow. Do not call a scheduled search, text, email, external browsing session, or employer application “live” merely because repository tools, records, or prompts exist.
6. **Preserve safety semantics.** Confirm that scope/owner boundaries, current authorization, revision fencing, human review, and uncertain-submission blocking remain intact. Never convert prepared, queued, running, saved, published, user-reported, or runner-observed states into one another.

## Explicit non-claims and current gaps

- A README onboarding prompt mentioning daily scans, Instagram, or text updates does not activate those automations. Scheduler, Instagram access, notification transport, inbox monitoring, and agent wake-up depend on the external personal-agent runtime and are not validated here.
- MCP client compatibility is not established merely by exposing the endpoint. A client must support Streamable HTTP plus a custom `Authorization` header; named personal-agent clients and human confirmation in chat remain end-to-end unverified.
- Remote MCP is not remote browser automation and does not bypass CAPTCHAs. Local runner support is narrower than its ATS inspection list, and no real employer submission has been exercised.
- Google is configured according to backend documentation, but a complete real-user sign-in and iPhone/private-file round trip are still verification work.
- Wider rollout still needs account export/deletion, orphan-file cleanup, operational monitoring/rate limits, and abuse handling.

See [local and release runtime](local-and-release-runtime.md), [verification strategy](../testing/verification-strategy.md), [the system overview](../architecture/system-overview.md), [agent/MCP setup](../../mcp/README.md), and [the schema reference](../../docs/schema.md) for adjacent operational detail.

## Smaller agent tool catalog (local contract 110)

MCP startup now lists common actions, logs and bugs directly. Hosted maximum:
47 exposed / 73 gated; configured Node API: 50 / 73; local runner: 50 / 83.
`discover_tools` returns scope-filtered executable schemas by workflow or exact
name, and `call_discovered_tool` shares the original direct-call validation path.
`discover_toolkit` still discovers guides. Existing names remain callable;
paused operations remain unavailable. See `mcp/README.md` for access and release
limits. Hosted/client behavior is not verified by local catalog tests.

### Local audit runtime verification

The local API was rebuilt from `6c44441`; the mounted Edge runtime now reports
developer contract 110. The two existing audit migrations (`20261107002624` and
`20261107005745`) were applied to the local database without applying other
pending migrations. The existing MCP connection successfully loaded agent-audit
v3, discovered all three audit tools, and started/appended/read a labeled repair
verification audit. Clients with cached tool catalogs need a refresh/reconnect.
No job search was queued and no batch was published during verification. The
worker and separate résumé API were preserved; hosted deployment and full worker
execution remain outside this check. See the feature change note for details.

## Local startup reliability

The local startup helper bounds Docker/CLI checks, can reuse verified running local
APIs with saved public loopback configuration, treats the configured MCP tunnel
as optional, and recognizes an existing Lookout frontend. Main preview locks
track process ownership and recover stopped owners; unknown owners are preserved.
See [local runtime details](local-and-release-runtime.md#focused-startup-reliability-update)
and the startup feature change note for checks and live-verification limits.

The warm local startup path was verified after recovering an unresponsive Docker
Desktop engine: Auth/REST health passed, the port-3000 frontend was gracefully
restarted with a process-owned preview lock, and the page returned HTTP 200.
Repeated startup commands reuse the running setup. No database reset or container
removal was performed; cold startup and remote tunnel connectivity remain unverified.

## Application tracker outcomes (contract 111 source update)

The import writer and website editor support explicit hiring outcomes and the
existing employment types from settings, including Part-time, Contract and
Temporary. `update_imported_job` is a gated applications tool requiring
tracking:write; reads require workspace:read. It shares browser ownership, row
validation, version locks and replay checks. Original source rows and existing
imported records are preserved. No automatic repair of statuses encoded in
notes is performed. See the application-submission workflow for field boundaries.
Local checks and demo coverage establish source behavior only; a running contract
110 endpoint does not expose this update until its migration/functions are released.

The UI-first follow-up routes imported rows through the original application
detail dialog and progress display. The separate metadata row editor has been
removed. Original source notes and subsequent tracker notes remain visible in
history; notes do not become linked emails. Native application actions remain
visible but imported records have no native application ID: timeline writes
show the existing sync error and workflow writes report an unsaved update.
This intentional backend mismatch must remain explicit until a later integration.

Application rows show a separate **Needs action** flag for due, unresolved
handoffs from the existing durable action inbox (review, blocker or submission
check). The recorded reason opens the existing application detail dialog. Flags
clear when the underlying inbox action resolves and appear when a deferred action
becomes due; hiring stages and Active date ordering stay independent. This is the
same read surface as Action Board and MCP `read_action_inbox`; it does not add a
manual task flag or infer recruiter requests from notes or interview stages.
The resettable fictional demo includes a review handoff; demo approval remains
disabled. Source verification does not establish production deployment.
## Weekly Career Toolkit (contract 113 source update)

The existing Toolkit cards and reader now support explicit weekly filtering and
an All materials library. Agent preparation follows the pinned Career Ops loop,
curating external resources and reusing stories rather than generating every
possible document. Scheduled mocks save visible logistics separately from
agent-only interviewer preparation, with versioned resume/completion and a linked
debrief. The user calls their agent externally; no scheduler or call transport is
provided. Source tests and detached demo coverage do not establish hosted release
or an external-agent call. See the Career Toolkit concept page and feature note.

The hosted reconciliation subsequently released the contract-113 backend through
official main-branch run `42412623024`, source
`0d3eac234ca4982e37a690d7de6ea78a7c04132e`. All **92** migration versions and
**2,994** schema/permission entries match source replay. All 57 MCP and 88 gateway
files match that release. Fresh hosted MCP and browser checks passed owned writes,
read-back/retry, foreign-owner/read-only denial and private mock-profile separation.
Weekly toolkit scenarios passed in a rolled-back hosted transaction, excluding
the fixture-only role alteration and destructive cascade assertion. Fictional
accounts were removed; accounts, profiles, files, connections, artifacts, private
mock profiles and backend jobs all ended at zero. Shared data and bucket settings
are unchanged. Personal local data was not transferred. This establishes database
and backend readiness for that release; real Google login, personal-data cutover,
GCP worker execution and separate Pages publication remain unverified. Later local
guide contract 114 is not included in this deployed receipt.

## Test harness consolidation (focused source update)

The full Node suite uses a disposable migrated PGlite snapshot for independent
ordinary database fixtures, with four concurrent test files. Migration/upgrade
fixtures retain full replay and custom hooks. The snapshot lives only for one
run and is cleaned up; focused direct Node tests need no snapshot. Demo reset
isolation is checked over whole fixture graphs instead of repeated exact sample
contents. That check found shared nested preparation resource data; the two
workspace fixture factories now clone their returned graphs. See the verification
strategy for scope and the feature change note for actual validation results.

Application rows additionally display optional next-action dates from current
scheduled rounds or confirmed unfinished preparation deadlines, with no guessed
dates or second manual date store. Active offers an explicit Next action date
sort (earliest first; undated last), while progress/date stays the default.
Completed/superseded rounds and terminal records are excluded. Website and MCP
continue using the existing owned timeline/preparation writers and readers; see
the application-submission workflow for mappings and lifecycle details.

## Structured imported action progress (contract 116 source update)

Imported application records now support nextAction/actionDate/needsAction and
explicit completedStages through the existing owner/version/replay-checked update
writer and MCP tool. Overview Tracking details exposes the same fields. Screen
completion is separate from current stage; recorded dates feed optional sorting.
No source notes are parsed or rewritten, and no native records or submission
receipts are synthesized. Source tests establish behavior; runtime and hosted
release verification remain separate and are recorded in the feature note.

Dev verification for the imported-progress update: the connected local MCP reports
contract 116, advertises all four fields on update_imported_job and serves
application-workspace guide 15. Migration 20261107211643 is recorded locally and
the API is healthy. This did not migrate personal records or notes. It does not
establish hosted/production availability; see the feature note for validation.


### Jobright public lists

The Jobright new-grad and internship GitHub lists are enabled default lead sources. A thin collection provider parses every published README row, carries forward continuation-row companies, removes Jobright tracking parameters, and resolves eligible titles with up to six concurrent public detail requests. Only explicit, identity-matched public `applyLink`/`originalUrl` fields can enter the existing employer verification, temporary staging, full filtering and final account-history deduplication pipeline. No Jobright summaries are saved as verified employer postings. Website and MCP source configuration use the existing versioned portals document and search-job tools.

Coverage always remains partial: Jobright documents a subset of jobs from the last seven days, and public detail pages may omit employer application URLs. Live checks on 2026-11-07 found those fields absent on ten sampled listings; these entries are reported unresolved and are not saved. No authenticated Jobright API or paid service is used. Fixture success does not establish live employer-link availability. Default updates do not overwrite customized account portals or modify already-running source snapshots.

## Agent workspace material formats (contract 117, locally verified)

`toolkit-materials` v1 is advertised in the primary index and through
`discover_toolkit.materialGuide`. It exposes optional material recipes, the neutral
static HTML starter and matching career skill IDs through existing authorized
`read_guide`. Company/interview skills route to it; existing scoped artifact/mock
tools retain execution, ownership and versions. No new writer, Calendar or scheduler
integration is added. Full source validation passed (1,030 tests, five skipped),
including detached discovery/guide/save/read-back and read-only denial.

The landed source was built into the local API image and the mounted local Edge
runtime reloaded. Connected MCP checks report contract 117, all 39 career skills,
the six recipes, HTML starter and interview-research v6 routing. The worker and
database stayed running. Live verification read only; no account artifacts or
external events were created. Hosted release is separate and was not performed.


### Simplify feed limit

The direct background worker verifies at most the 100 newest title/seniority-matching leads from each Simplify feed per run (new-grad, summer and off-season independently). It reads active visible feed metadata newest-first, applies the existing metadata prefilter, then selects the first 100 before existing deduplication and 25-link employer verification. Full screening, temporary staging, lease fencing and final shortlist persistence remain unchanged. Older omitted matching leads produce explicit partial coverage and an omitted count; no durable cursor or automatic continuation is retained. Repeated scans select the newest matching leads again, so older jobs may never be verified. This is an intentional Simplify-only limit; Jobright, HiringCafe and employer-source behavior are unchanged. Website/MCP backend searches use the same provider; explicit manual Simplify lead paging remains available separately.

## Mock save readiness correction (contract 118, locally verified)

The contract-117 check established guide discovery, not mock persistence. A real
Node MCP save exposed two missing prerequisites: the local database lacked weekly
Toolkit migration `20261107201448`, and Node's service registry lacked the `mock`
prefix. The source migration alone was applied locally, after checking later
artifact-function overlap, without changing existing user/artifact counts. The
Node route now retains the existing checked Edge/SQL boundary, and safe error
forwarding explains a missing migration instead of a generic content rejection.

After the local API/gateway refresh, connected context reports 118. The local-only
mock check passed save, idempotent retry, private read and ordinary-read profile
separation through the actual running API, then removed its disposable fixtures.
The rolled-back lifecycle/ownership SQL checks passed with real Supabase auth
settings. Full source checks passed (1,036 tests, five skipped), typecheck/build
and data validation passed. No real candidate session, Calendar event, worker or
database restart, push or hosted deployment occurred. Muse must retry its original
session save; source/tool discovery alone must not be called persistence-ready.

## Shared application round counts (contract 121 source update)

Native milestone round metadata and imported record.rounds feed one shared
projector used by Applications Stats and the workspace:read MCP
read_application_round_stats tool. Counts distinguish rounds from applications,
Screen from Interview, and pending/scheduled/completed/cancelled. Existing scoped
writers retain owner, version, evidence and retry/correction checks. No private
application data is automatically backfilled from notes. Runtime activation and
production release are separate; consult the feature note for actual receipts.


### Agent-reviewed private Discover handoff

A completed or partial direct scan supplies the private shortlist; it does not itself populate Discover. The connected personal agent now finishes an authorized search by reading all shortlist pages and current candidate/profile evidence, selecting personally suitable live opportunities, writing the four assessment dimensions and role-specific narrative, then publishing through the existing scoped `publish_batch` service. It reads each returned private batch back before claiming Discover is populated. Stable run/profile/chunk event keys prevent duplicate batches on completion-event replay. No new model runtime, scheduler, worker publication, automatic applications or shared hosted-board collection is added. Raw filter matches remain outside Discover until agent review. Empty Discover keeps the existing search-history/request control visible while waiting.

## Connected Action Board (contract 120 source update)

The source preserves desktop Action Board framing and existing review dialogs,
adding deterministic human questions and Accept/Reject controls with mobile swipe
parity. Exact application/message review is versioned; application rejection
keeps the job saved and fences agent work until a version-checked human Resume.
Outreach acceptance only marks the message ready for the user to send.
Canonical round IDs, typed practice categories, confirmation and cancellation now
drive the existing Weekly Prep/session ledger without duplicate deadline labels.

The website and read-only `read_action_board` MCP operation share owned SQL
projection and validation; human decisions remain authenticated website actions.
Disposable database, upgrade, domain and detached browser checks establish local
source behavior. The integrated production export and desktop/mobile connected
flow were verified. Migration plus gateway/MCP release and an authenticated
hosted check are still required; no hosted parity or real submission/message
execution is claimed. See the connected-action-board feature note and the
application-submission and Career Toolkit concept pages for the contract.

### Broad review with fit-based effort

Search guide16 surfaces relevant plausible jobs after personal analysis instead of selecting only exceptional fits. Fit strength guides priority and tailoring depth; weaker fit, unknown pay, unclear team scope and unconfirmed clearance/citizenship are not automatic rejections. User-requested clearance roles stay visible with active-at-application/start versus obtainable-after-hire requirements called out explicitly. Confirmed non-exempt mandatory conflicts and clearly unrelated work can still be excluded. Conditional graduation scenarios remain targeting, never changes to actual education facts or employer-form answers.

Application guide17 supports routine accurate preparation volume during already authorized application work, with deeper effort for the best matches. Notifications guide2 distinguishes actual prepared, tailored, blocked, ready-for-review and submitted counts. Instructions do not execute work, activate schedules, send messages or grant submission consent. Match strength reuses the existing recommendation priority (Apply Now, Strong Consider, Skip Unless Team Fit) and four fit scores, with no separate tag, column or UI. Lower priority does not stop otherwise authorized preparation. Current Discover batches and applications are not reassessed or republished by this pass.

## Mock schema diagnostics (contract 123, locally verified)

The mock tool schema now excludes document-only preparedFor/materials/resourceUrl,
requires its scheduling fields and advertises an explicit-offset RFC 3339
scheduledAt pattern. Material-format guide v2 explains these requirements. The
local API/gateway refresh was verified through connected discovery and disposable
Node MCP -> Edge -> SQL tests: each invalid field gets a specific rejection, while
the corrected mock saves, replays and reads with its profile kept private. Server
mock-rejection logs retain generated diagnostic IDs, stages, allowlisted reasons
and field types only. Historical failures without this logging cannot be recovered.
No real user session or external event was created. Forty-nine relevant integrated
checks passed; a full-suite search-pipeline failure passed on isolated rerun.
Hosted publication was not performed.


### Employer compensation on private Discover cards

`publish_batch` accepts optional `recommendation.jobFacts.compensation` for an existing catalog job, using the same source URL/check timestamp as its other observed facts. It is bounded employer pay text preserving currency, range, original pay period (hour/week/month/year) and base/bonus/equity distinctions. No automatic annualization or benchmark substitution occurs. The browser and card-pack projection prefer this private observed value over older catalog compensation; explicit Not disclosed can override an outdated value. Omission retains the catalog fallback. Cards no longer extract a salary from personal fit prose, which can contain comparison benchmarks. This extends the existing private JSON observation; it does not rewrite catalog facts, assessments, applications or historical batches and introduces no database column/migration.

Search guide17, application guide19 and developer contract124 advertise the scoped publication path. Fictional Discover previews cover hourly/monthly and undisclosed pay; validation covers annual pay too. Local code/database tests and a frontend export establish source behavior only; hosted release remains separate.
