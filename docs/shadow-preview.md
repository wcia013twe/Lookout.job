# Private recommendation previews

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
