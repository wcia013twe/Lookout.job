# Cloud Run runtime and independent deployment root

## Focused production release — November 16, 2026

- Rebased only the Cloud Run migration and pinned user-agent repair onto published main; unrelated local UI commits are excluded.
- Add `/health` for hosted probes because Google's frontend returns HTML 404 for `/healthz`; retain the local legacy route. The VM's APILayer key is empty, so there is no existing resume-parser secret to migrate; parsing remains an explicit pre-existing verification limit.
- Current release checks: 30 focused runtime/discovery/staging tests pass; runtime and frontend typechecks, production static build, catalog validation (158 roles), Terraform format/validation and diff checks pass. Terraform initialization initially timed out contacting the registry; using the already verified local provider completed validation.
- Full `npm test`: 1,436 tests, 1,432 pass, four failures: existing vendor manifest mismatch, 106/108 provider imports, stale generated search bundle, and an unchanged outreach test file failure under parallel load. The isolated outreach retry passes 2/2. These failures remain visible and may block protected CI; no checks or branch protections are bypassed.
- Initial infrastructure is deployed with maintenance paused, existing scoped MCP authentication verified, and production VM traffic unchanged. Hosted queue recovery still requires the main-only migration release. Full hosted execution, recovery and cutover remain unverified at this point.

- Reuse the Node image for a request-billed API and finite discovery Job. Enqueue wakes are awaited best-effort for both scoped submission tools/operations; browser SQL enqueues recover through authenticated Scheduler maintenance. Submission stays disabled, leases stay authoritative, and local polling remains unchanged.
- Replace shared disk staging with private immutable GCS snapshots when configured. Separate API/worker permissions, generation-fenced cleanup and seven-day lifecycle protect the temporary pool. Existing owned reads and SQL checkpoints remain the domain boundary.
- Request mode drains one finite MCP-event outbox batch before responding and starts no permanent Realtime listener. Google-signed exact-identity maintenance is an operator boundary, not a new agent action. Both maintenance branches settle before error responses.
- Add independent Terraform, least-privilege identities, pinned-image/secret references, paused-by-default Scheduler, a clean-landed-main image builder, and a cutover/OAuth/VM-disk rollback runbook. No new dependency or domain abstraction; cloud adapters are replaceable transport seams.
- Fictional demo recovery now explicitly describes finite-worker interruption and shared immutable snapshots; the existing isolated staging/shortlist interaction test covers it. No real account writes or external submissions.

## Verification — November 13, 2026

- `npm test`: 1,435 tests, 1,380 passed, 55 failed. All 55 failing test names reproduce on an untouched archive of committed baseline `9aa9f275` (98 targeted baseline tests: 43 passed, 55 failed); no migration-only failures. The pinned Career Ops import fails with `The requested module './_http.mjs' does not provide an export named 'MACOS_BROWSER_LIKE_USER_AGENT'`, causing filter/provider and search-pipeline failures. This existing execution failure is a release blocker, not repaired in this migration.
- `node --test tests/cloud-run-runtime.test.mjs tests/search-staging.test.mjs`: 12 passed after final demo/wake-parity changes. Existing discovery-runtime/staging focused run: 21 passed. Full suite includes the service-only pending predicate, live duplicate-claim exclusion, expiry recovery and stale-finish SQL assertions.
- Runtime `tsc -p backend/runtime/tsconfig.json`, Next `typecheck`, production `npm run build`, `npm run validate:data` (158 roles), `node --check scripts/build-cloud-run.mjs`, Terraform fmt/validate (Google provider 7.46.2), and `git diff --check` passed.
- Built the production Dockerfile as `lookout-cloud-run:smoke`. Against an isolated migrated Supabase/PostgreSQL stack: finite worker exited an empty queue; request-mode API health/auth passed; real operations and MCP enqueue replay produced one durable job despite an unavailable Google wake. A real database row lock held execution while SIGTERM interrupted the container; the live lease excluded a duplicate, the unfinished lease became recoverable after expiry, a new claim incremented attempts, and the stale finish was rejected. Shared local stacks were not stopped or rebound.

## Release limits

- No cloud resources, hosted migration, image push, endpoint/OAuth switch, GitHub publication or VM shutdown occurred. Cloud Run API was disabled in the project during inspection. Terraform was validated locally, not applied/planned against real resources. The main-only image-push path has not been executed.
- Repair the existing Career Ops baseline first, then verify real Google IAM/OIDC, GCS cross-instance staging, Scheduler/outbox recovery and one bounded full search alongside the VM. Scheduler remains paused by default. Account for the OAuth issuer, client reconnect and human consent before cutover. Keep the VM disk for rollback; do not claim production parity or migration completion from source/container support alone.
- This is a focused manual OpenWiki update; broader generated coverage retains its documented revision. Current client usage and a complete cost estimate remain unverified.

## Follow-up — Career Ops import repair, November 13, 2026

- Restore `MACOS_BROWSER_LIKE_USER_AGENT` in the HTTP helper's export list. The repaired file exactly matches its existing pinned SHA-256; no upstream upgrade, checksum rewrite, dependency, filtering change or consent change.
- Add a direct export/provider-import regression test. Existing fictional search/demo coverage remains applicable; no new user-facing state or demo fixture is needed.
- Focused execution/filter/wiring tests: 53 passed, two existing vendor-integrity/provider-count failures. Full `npm test`: 1,440 tests, 1,437 passed, three failed. Remaining failures also appear in the earlier baseline logs: vendor checksum mismatch, 106 rather than 108 loadable network providers, and stale generated search-document codec. Workday and We Work Remotely lack valid provider export shapes. Those separate defects are not changed here.
- Runtime and Next TypeScript checks, `npm run validate:data` (158 roles), Docker image build and real in-container discovery configuration validation passed. The container also verifies the pinned HTTP checksum and Feishu import. No Google credentials, hosted writes, live source fetch, image push or deployment occurred.
- The missing-export blocker is repaired, but the remaining failures and bounded live-search verification still gate discovery release. The earlier migration validation above is a historical record, not the current test outcome.
