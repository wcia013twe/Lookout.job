# Local Langfuse tracing

## Components

- `backend/runtime/tracing.ts`: optional server-only Langfuse 6.1.1 SDK setup. Node API tool dispatch, human resume parsing and worker execution are traced. Career tasks nest under worker execution. Queue polling and health checks are excluded.
- `scripts/export-codex-langfuse.mjs`: standalone importer for timestamped runtime-v4 Codex logs. It reads terminal `run.json`, `stage-run.json`, `trace.jsonl` and `prompt.txt`; it never launches participants, changes grades or modifies source runs.
- `.langfuse-exports/`: ignored, local ingestion receipts. Supply `--receipt-dir` for a persistent shared receipt location across checkouts. Keep these receipts when moving the active harness.

The existing frozen runtime and completed campaigns remain unchanged. For future orchestrators, invoke the exporter after a condition reaches a terminal state. Export failure is a separate reporting failure, never grounds to rerun or rescue the participant. Capture is local first; Langfuse is a comparison and inspection destination.

## Credentials and activation

Root `.env.local` holds `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` and `LANGFUSE_BASE_URL`. The exporter also accepts the existing `LANGFUSE_SECRET` alias. Never put keys in frontend variables, participant containers or tracked files. The root `.env.example` remains user-owned in this change.

The backend initializes tracing when all three settings exist unless `LOOKOUT_TRACING_ENABLED=false`. A missing configuration disables tracing; invalid configuration logs a generic warning. Backend telemetry failures must not retry a domain action or replace its original result/error. Graceful process exit flushes the SDK; abrupt termination can lose buffered observations.

For a directly launched backend, load the environment before startup:

```sh
node --env-file=.env.local backend/runtime/main.ts
```

Existing backend database configuration is still required. For Docker, use the opt-in overlay from the repository root after confirming ownership of the running stack:

```sh
docker compose --env-file .env.local \
  -f backend/runtime/compose.yaml \
  -f backend/runtime/compose.tracing.yaml up -d --build api worker
```

This rebuilds/restarts backend services. The overlay forwards only Langfuse settings from the root environment; the existing runtime `.env.local` continues supplying backend settings. Installation/landing does not restart an active shared stack automatically. Set `LANGFUSE_TRACING_ENVIRONMENT` explicitly for production; the local default is `development`.

## Benchmark export

```sh
npm run tracing:export-codex -- --run /absolute/path/to/completed-run --dry-run
npm run tracing:export-codex -- --run /absolute/path/to/completed-run
```

One Langfuse session represents a condition/repetition trajectory; each completed or failed wake is a trace. Session/trace metadata records task, condition, repetition, model/reasoning, suite hash, pilot status and Codex thread ID. Tool observations nest under the Codex agent. Interrupted tool calls are marked as missing completion, not fabricated successful calls.

The importer sends OTLP HTTP/JSON directly because historical observations must retain original timestamps, not upload time. Event timing represents orchestrator receipt time. Whole-turn reported usage stays metadata: the logs do not reveal exact model-invocation boundaries, so the exporter does not invent generations, token allocation, hidden reasoning or API billing costs. Backend tools likewise are not model generations. These limits mean Langfuse's generation-cost charts are not a billing source for subscription Codex.

Default export is structural: content bytes/hashes, operations, statuses and timing. Bodies, profiles and resumes are not uploaded. `--include-content` explicitly enables bounded text export after masking known environment secrets, credential patterns and email addresses. This is not complete PII anonymization; names, addresses or sensitive narrative may remain. Review data before enabling it. Native state snapshots and binary resumes are never imported.

Uploads use stable IDs, per-project receipts, a single-import lock and bounded batches. HTTP rejection or partial ingestion stops loudly. Receipts distinguish acknowledgement from read-back verification. An ambiguous network failure may have been accepted remotely; retry uses the same IDs but cannot promise exactly-once transport. A stale lock requires checking that no importer is active before removing it. Do not modify source evidence during import.

## Updating the harness

Keep exporter code in Git with the application. Adapt log parsing in this one script when the harness format changes; bump `VERSION` when the exported schema/meaning changes. IDs include exporter version, capture mode and stage evidence digest. Preserve raw logs and older receipts. Grading and Langfuse dataset/experiment registration are independent follow-ups; this integration uploads observations, not experiment scores or datasets.

## Fictional example and current limits

`examples/tracing-demo/` contains a wholly fictional terminal run with one tool operation and a response. Inspect it offline:

```sh
npm run tracing:export-codex -- --run examples/tracing-demo --dry-run
```

This is separate from the detached product UI demo, which never initializes backend tracing or loads real credentials. There is no new product action, MCP tool, schema, approval or agent contract change. Hosted Edge endpoints and the separate intelligence embedding service are not instrumented by this Node-runtime pass. External Muse inference remains outside backend visibility.

Source checks: backend TypeScript and exporter syntax. An offline preview of one existing N01 run produced four traces / 56 observations; no historical data was uploaded (the user chose to skip stale runs). Live ingestion/read-back and backend restart remain unverified. No test suite or participant run was executed.

## N01 notification-stream experiments

The prospective N01 stream redesign now has a separate orchestrator, independent local grader, and experiment/score exporter. See [N01 setup, stream table and grading](n01-notification-redesign.md). One whole trajectory maps to one item trace with stage children; semantic results remain pending until reviewed. The existing historical importer and old campaigns are unchanged. Dataset registration is metadata-only; full private source context remains local. Synthetic verification is explicitly excluded from measured results.

## Common evaluation dashboard

See [reusable evaluation setup](langfuse-evals.md) for the versioned final-result contract, `npm run evals:langfuse`, score definitions and Eval Overview dashboard. This adds summary experiment items independently of the existing trace-only exporter.
