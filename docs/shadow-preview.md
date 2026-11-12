# Private backend request/response telemetry

## Current scope: observe existing agent interactions

The requested feature records **what an agent asked the backend and what the
backend returned**, not AI-authored advice. No additional agent, model call,
relevance score, sender or delivery-suppression workflow is involved. Normal
agent replies remain unchanged.

The optional Node API recorder captures `knowledge.interview`
(`read_interview_intelligence`) and `knowledge.search`
(`search_circle_knowledge`) through both `/mcp` and `/v1/operations`.
Credential verification, profile/resume reads and writes are excluded. This is
observability of existing scoped tools, not a new product action or MCP tool.
Direct Supabase Edge MCP/gateway calls and other backend operations are **not**
covered by this Node seam.

In the private `lookout-shadow / onboarding-previews` view, use:

```text
logName="projects/job-board-511516/logs/lookout-shadow"
jsonPayload.event="agent.recommendation_exchange"
```

Expand `jsonPayload.request` and `jsonPayload.response`. Each paired record
includes a generated `requestId`, operation, timestamp, status, elapsed backend
time and keyed `connectionKey`. The pseudonym identifies an agent connection,
**not an account**; different connections or secret rotation produce different
keys. Empty/no-evidence responses are recorded as returned. Failed requests log
status only, without request/response bodies or provider diagnostics. Capturing
an entry is not a usefulness assessment.

A verification-only replay of the previously saved fictional MCP retrieval is
visible with `insertId="5bf34c3f-9fb1-4b6d-ba2e-247469770136"`. It is explicitly
marked `verificationFixture=true` and `captureMode="fictional_trace_replay"`;
the actual saved request and returned evidence were used, not newly authored
advice. Readback confirmed it in the private view and absent from `_Default`.
This operator export verifies the payload and destination, **not** automatic
capture, the VM token path or a real-user interaction.

The recorder removes credential/identity fields, masks known server secrets,
credential patterns and emails, and strips URL credentials/query/fragment.
Bodies are bounded to approximately 60 KB, with per-string, depth, collection
and key limits; `truncated` flags omitted content. It does not mutate replies.
Free text may still contain personal information: redaction is **not** complete
anonymization. The restricted seven-day log bucket remains required.

### Activation and limits

The source is opt-in and **not deployed or enabled on the live API yet**.
The running VM was inspected at release
`afc36372aefab33257bbbe37d84c77c8f5d6cf2b`; its API entrypoint and dispatcher
differ from local main. Do not replace that release or dirty shared source just
to enable a logger without reconciling the release boundary. No hosted Edge
deployment or real-account export was performed in this pass.

After an approved committed-main API release, set server-only runtime values:

```text
LOOKOUT_RECOMMENDATION_LOG_ENABLED=true
LOOKOUT_RECOMMENDATION_LOG_PROJECT=job-board-511516
LOOKOUT_RECOMMENDATION_LOG_SECRET=<persistent random secret of at least 32 characters>
```

Keep the secret in `/etc/lookout/runtime.env`, never browser config, Git or
command arguments. The recorder obtains short-lived credentials from the fixed
Compute metadata endpoint, then writes only to the fixed Cloud Logging API and
`lookout-shadow` log. The inspected VM has the cloud-platform OAuth scope and
an existing project-editor service account; no new IAM grant was added. Prefer
least-privilege logging credentials when the existing broad VM role is revised.

Logging runs asynchronously with at most 32 in-flight writes, three-second
network deadlines, cached metadata credentials and a fixed sanitized warning.
Outages, saturation or process shutdown can drop records; this is best-effort
telemetry, not a durable audit ledger. Neither logging failure nor the feature
switch changes authorization or normal responses. Verify actual authorized
Node traffic and private-bucket routing after deployment before claiming live
coverage. No dependency was added.

Tests exercise the existing fictional interview fixture through both Node
transports, its published revision, empty results and authorization failures;
unit checks cover sanitizer bounds, metadata-token caching, saturation and
failure isolation. Existing fictional demo interactions remain the product
fixture; this feature adds no browser behavior or real-account fixture writes.

## Historical advice-preview setup

The sections below document the earlier, superseded advice-authoring
interpretation and fictional setup fixtures. They are not automatic backend
request/response capture and do not require an advice-writing agent for the
current scope.

## Live Google Cloud destination

Open <https://console.cloud.google.com/logs/query?project=job-board-511516>.
Select storage **lookout-shadow / onboarding-previews**, then use:

```text
logName="projects/job-board-511516/logs/lookout-shadow"
jsonPayload.event="recommendation.shadow_preview"
```

Expand `jsonPayload.recommendation` to read the proposed advice. Filter by
`jsonPayload.subjectKey` or `jsonPayload.runId` to isolate a case. Unknown cost,
tokens and timings remain null, not fabricated zeroes. `mode="fictional"`
identifies setup fixtures; these are not real onboarding results or independent
quality grades.

On November 12, 2026 the operator configured project `job-board-511516` with:

- Global bucket `lookout-shadow`, seven-day retention.
- Sink `lookout-shadow`, matching only this log name, targeting that bucket.
- View `onboarding-previews`, filtering `LOG_ID("lookout-shadow")`.
- `_Default` sink exclusion `lookout-shadow-private`, matching this log name.
- View-level `roles/logging.viewAccessor` for the existing operator account.
  No public grants or additional account access were added. Existing project
  owners and other privileged IAM principals can still access logs.

Routing changes propagate asynchronously. The first entirely fictional test
entry landed in `_Default` during setup; a subsequent synthetic routing probe
was retrieved from the custom view and absent from `_Default`. No real account
content was exported. Test routing again with fictional content after any
sink/IAM change and before authorizing live output. Seven-day retention applies
to the custom bucket, not the earlier `_Default` fixture.

## Export the existing bounded fixture

From a checkout with operator `gcloud` credentials:

```sh
node scripts/export-shadow-preview.mjs \
  --project job-board-511516 \
  --subject subject-0123456789abcdef \
  --trace /absolute/path/to/bounded-interview-trace.json
```

This importer accepts only the explicitly fictional bounded-run trace format.
It obtains an access token from `gcloud`; no token is printed or stored in the
entry. Do not put credentials into arguments or browser configuration. The
exporter has no email, notification, user-card or agent-delivery call. Errors
do not fall back to application logs or a user message.

`backend/runtime/shadow-preview.mjs` is a server/operator-only adapter with no
new dependency. `writeShadowPreview(projectId, preview, accessToken)` validates
and exports one allowlisted record. The project/log ID is the replaceable
infrastructure seam, not a new domain model. Its concrete risks are routing
propagation accidentally copying private prose, privileged IAM access, and an
agent bypassing shadow capture by delivering elsewhere; logging alone cannot
prevent these.

Before a host uses the adapter for real users, explicitly authorize which
recommendation content may leave the account boundary and who may review it.
Use an opaque stored or keyed pseudonymous subject identifier, never an email
or a plain hash of an email. Do not export profiles, resumes, full retrieval
packets or raw user prompts. Allowlisted text is bounded; existing secret/email
masking and URL credential/query/fragment removal are defense in depth, not
complete anonymization. Names and other sensitive prose can remain. Retention
and access controls are still required. Never grant agents general log-read
access as a substitute for account ownership checks.

## Activation boundary

**Automatic onboarding recommendation generation and capture are not connected.**
The existing backend retrieves permitted evidence; external agents author the
advice. No onboarding model invocation, background worker, model dependency,
hosted runtime deployment or real-user event listener was added in this pass.
The adapter is not imported by the deployed runtime, and has no product-facing
API, browser action or advertised MCP capability. Existing scoped retrieval
tools remain unchanged. Operator fixture export is infrastructure validation,
not a way for an agent to inspect other users.

Connecting Muse or another authoring host requires a separate source-grounded
integration: preserve the user's consent/scope boundary, invoke capture at the
actual authoring boundary, and suppress every downstream delivery action in
shadow mode. A saved log with `delivery.enabled=false` describes only this
exporter; it does not prove that an external agent never sent a separate message.
Keep the host disabled for real users until that path is verified end to end.

Demo verification uses the saved fictional report and suggestion plus a clearly
synthetic routing probe. No UI changed, so no browser recording or new admin demo
fixtures were needed. Contract coverage is `tests/shadow-preview.test.mjs`;
live routing/readback is a separate operator check, not simulated by those tests.
