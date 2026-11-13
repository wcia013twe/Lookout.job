# Cloud Run release and rollback

This is an independent Terraform root. Never move, import or destroy the VM's
`infra/gcp` state. The VM stays running with its disk retained until cutover is
verified. Source availability is not evidence of a hosted migration.

November 13 source verification: the Docker runtime, isolated real database
enqueue/lease recovery, types, frontend build and Terraform validation passed.
The missing `MACOS_BROWSER_LIKE_USER_AGENT` export has been restored to its pinned
checksum. Docker configuration validation now succeeds. Separate vendor-integrity
and provider-count failures remain: Workday and We Work Remotely are skipped by
the provider registry. Discovery release readiness still requires resolving those
failures and a bounded live search. No Cloud Run/GCS/Scheduler deployment has been
verified.

## Runtime and limits

- One immutable Node image: request-billed public API (minimum 0, maximum 2
  instances), finite discovery Job (one task, 1 CPU, 2 GiB, 30 minutes, no
  platform retries). Database leases and fenced writes remain authoritative;
  overlapping executions do not confer ownership. Submission remains disabled.
- Only approved searches run. The API awaits a best-effort Job invocation after
  both `submit_backend_job` and `submit_portal_search`. A failed invocation does
  not change the successful durable enqueue response. Browser SQL enqueues and
  missed wakes are recovered by maintenance; opening application links still
  does not submit an application.
- Authenticated Scheduler POSTs `/internal/maintenance` every minute. The API
  verifies Google's RS256 signature, issuer, audience, expiry and exact verified
  Scheduler email. Product credentials and browser origins cannot invoke it.
  The API's public IAM is necessary for its own bearer/OAuth authentication;
  it is not permission to use maintenance. The operator-only maintenance route
  is not an agent/user action and has no MCP tool or arbitrary RPC interface.
- One existing finite MCP-event outbox batch is drained per maintenance request.
  Both branches settle before responding, even if wakeup fails. No Realtime
  listener or post-response wake timer runs in request mode. Existing outbox
  leases/retries and revocation checks are preserved. The 20-minute request
  budget bounds a batch of 20 sequential deliveries and their RPC deadlines;
  this is recovery, not a strict one-minute notification SLA.
- GCS snapshots are private and immutable (`ifGenerationMatch=0`), scoped by
  the existing job/run hash. Checkpoint references are still written behind the
  SQL lease fence. API identity can read, worker identity can write/delete;
  cleanup uses generation preconditions and bucket lifecycle removes leftovers
  after seven days. Lifecycle deletion is asynchronous. Local polling and local
  staging remain the default outside this root.

Concrete failure risks: an OAuth issuer/client mismatch breaks existing host
connections; missing IAM or API enablement delays wakes until recovery; a
checkpoint older than retention cannot recover its deleted snapshot. Keep
rollback and verify real transports before retiring the VM. Cloud APIs are
replaceable transport adapters, not a change to the domain data model.

## Prepare and build from landed main

1. Run `npm test`, `npm run validate:data` and the runtime typecheck. Commit and
   land with `npm run feature:land`. Use the clean shared `main` for releases.
2. Create an Artifact Registry Docker repository (for example `lookout` in
   `us-east1`) and authenticate Docker with `gcloud auth configure-docker
   us-east1-docker.pkg.dev`. The release principal needs repository push and
   Terraform resource-management permissions; runtime identities do not.
3. Build and push with:

   ```sh
   TMPDIR="/Volumes/External SSD/Lookout/tmp" node scripts/build-cloud-run.mjs us-east1-docker.pkg.dev/job-board-511516/lookout/runtime
   ```

   The script rejects dirty/non-main sources, archives only committed runtime
   inputs, writes source revision provenance, builds linux/amd64, and prints
   the immutable image digest. No credential files or Terraform state enter
   the image. It does not deploy or change an endpoint.
4. Create private Secret Manager secrets containing only the Supabase service
   role key and, if needed, the existing approved OAuth JSON configuration.
   Supply values over stdin/file, never shell arguments, Terraform variables
   or source control. Pin secret versions. Do not copy local account tokens
   into fixtures or images. Runtime secret environment values are server-only.
5. Copy `terraform.tfvars.example` to ignored `terraform.tfvars`; replace every
   placeholder and set the built image digest. Leave maintenance paused for
   parallel smoke testing. Keep Terraform state private (it contains resource
   metadata, not secret payloads); back it up before changing resources.
6. From landed main, run `terraform -chdir=infra/cloud-run init`,
   `terraform -chdir=infra/cloud-run plan -out=release.plan`, review it, then
   `terraform -chdir=infra/cloud-run apply release.plan`. Keep plan files
   outside tracked source or remove them afterward. This enables Cloud Run,
   Scheduler, Storage, IAM and Secret Manager APIs and creates only the new
   root's resources. If the public IAM binding is organization-policy-blocked,
   stop: do not weaken policy or pretend product OAuth replaces Cloud IAM.
7. Deploy the new SQL migration through the existing main-only backend release
   workflow before maintenance is enabled. Never deploy Edge Functions or
   migrations directly from a feature branch.

## Required smoke and cutover evidence

- Confirm Terraform's deterministic `api_url` is accepted by Cloud Run and
  `/healthz`; the generated hashed URI is not in the Host allowlist. Verify
  anonymous/forged maintenance requests fail and a real Scheduler OIDC request
  succeeds. Scheduler is initially paused; use an explicit single run for smoke.
- With disposable fictional account/profile/connection fixtures, submit via
  MCP and `/v1/operations`; verify the same saved SQL job, a real finite Job
  execution and persisted shortlist. Test a missed immediate wake, then a
  Scheduler recovery. Do not queue real-user work as a deployment probe.
- Kill an execution after a persisted checkpoint, let its lease expire, and
  verify a new execution resumes from GCS without duplicate durable results.
  Start overlapping executions and verify only the lease owner can finish.
  Verify worker credentials cannot change Cloud Run and API credentials cannot
  write staging objects. Confirm no application-submit job is claimed.
- Create a fictional event subscription; verify actual webhook delivery and
  retry recovery with no Realtime process. Check failed maintenance returns
  only after in-flight delivery finishes. Remove all disposable fixtures.
- Existing OAuth uses one exact issuer/resource and database policy. A new
  run.app origin is not interchangeable with the VM issuer: preserve the old
  hostname through an explicitly tested mapping/Host configuration, or migrate
  the approved issuer, client endpoints and user consent/reconnection together.
  This root defaults to the run.app host and does not implement DNS/domain
  cutover. Do not claim existing host connections survive an issuer change.
- Only after these checks, update the website's public MCP endpoint and host
  connections through the normal main release, verify authentication and
  consent, set `maintenance_paused=false`, and verify scheduled pickup. Review
  Cloud Run/Scheduler/GCS bills and errors before stopping the VM. Retain its
  disk and prior deployment secrets; do not delete either Terraform root.

Rollback: pause Scheduler first; restore the old client endpoint/issuer policy
and reconnect as required, start the retained VM if stopped, and verify its API.
Keep discovery on only one intended path; shared leases protect overlaps but
do not make mismatched OAuth policies safe. GCS and VM staging are not shared:
drain or explicitly resolve in-flight GCS checkpoints before reverting workers.

Local tests cover signed identity checks, finite draining, wake failures,
transport parity, immutable staging, generation cleanup, and SQL lease recovery.
They do not prove hosted IAM, lifecycle timing, OAuth reconnection, real
Scheduler token forwarding or interruption recovery on Cloud Run.
