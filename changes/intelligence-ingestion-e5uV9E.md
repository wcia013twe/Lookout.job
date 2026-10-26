# Local intelligence ingestion

- Inspected the actual local Docker source tables before creating fixtures; Circle posts, milestones, applications, artifacts and contacts were empty. Fixtures follow real published-revision, milestone and logged-contact conversation shapes.
- Added one local-only pgvector table, two source adapters, deterministic cleaning, OpenAI/synthetic vector providers, idempotent atomic writes, session-lock overlap protection, a Node API and four-hour UTC scheduler.
- Application input includes explicitly process-linked received networking messages. Raw evidence excerpts, sent introductions, thread URLs and known identities are excluded/redacted. No real-account ingestion or global publication is enabled.
- Added a separate Docker demo and local stdio MCP ingest/inspect tools. Existing Node API, worker, hosted MCP and production permissions are unchanged. Demo fixtures cover unknown dates, linked correspondence and privacy redactions.
- Validation: 559 repository tests passed; focused ingestion tests, backend TypeScript check and catalog validation (158 roles) passed. Actual stdio MCP -> Docker Node -> PostgreSQL inserted six rows (two Circle, four application observations), a retry skipped all six, and independent SQL confirmed 1,536 dimensions. Real Docker advisory locking and an actual short timer invocation passed.
- Limits: local Docker runs explicitly labeled fixture-vector-v1 synthetic vectors. No OpenAI key was available, so real semantic embeddings remain unverified. Default four-hour timer is running, but a four-hour wait was not performed. No external Muse handshake, semantic search, real-data authorization or production deployment is claimed. Basic deterministic redaction is not full anonymization.

## Source-injection and validation cleanup

- Moved fictional records and synthetic-vector generation into test fixtures. The demo entrypoint injects them into a typed source-loader/provider boundary; reusable pipeline/service modules no longer load demo records themselves. Real account adapters can use this boundary once ownership/sharing/storage integration is added.
- Centralized operation names, discovery schemas and argument validation. MCP only frames/forwards calls; the backend service enforces the shared contract. Tightened source/dependency types and corrected malformed HTTP JSON to a client error.
- Verification: 560 repository tests passed; backend type checking and catalog validation (158 roles) passed. The new test processes an independently injected source without loading built-in records. Actual stdio MCP calls against rebuilt Docker skipped all six existing rows, listed six cleaned reports, and rejected an invalid limit through the shared backend validator.

## Circle Resources metadata

- Extended the existing Circle adapter to retain cleaned titles, source/resource links and application context. General resources can omit company. Distinct insight/body text is preserved up to the combined Circle field limits; metadata edits participate in source revision checks.
- Added an additive local-only migration for content kind, title, resource links, matching contexts and nullable resource company. No grants, real-account source loaders or global publication behavior changed. Cleaning version advances to clean-v2 to refresh existing rows.
- Reused the Circle public-URL validator with additional credential/local-address rejection, stripped tracking parameters and deduplicated references. Personal text is still redacted; structured public references survive for citation. No linked pages or local file previews are fetched/indexed.
- Demo coverage includes generic and process-specific resource fixtures and a general resource in the existing Circle Resources UI demo.
- Validation: 564 full-suite tests, 12 focused tests, backend type checking and 158-role catalog validation passed. Actual stdio MCP -> Docker Node -> PostgreSQL inserted two resources, refreshed six old rows and had zero failures; repeat skipped all eight. Input/output example is /private/tmp/intelligence-resource-cleaning.json.
- Limits: synthetic vectors only; deterministic redaction does not guarantee anonymity. Source authorization, global-sharing policy, actual Circle polling, external page extraction and graph relationships remain unconnected.
