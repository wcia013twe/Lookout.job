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

## Typed post attachments

- Adopted the existing Circle composer as the intake model: preserve authored post references, reviewed application context and resource links on all Circle contribution types. The local read service derives one typed references list without duplicating application/resource storage.
- Added post_references metadata with unknown target revisions explicitly null. Post pointers are unresolved; they do not fetch/copy target bodies, prove target availability, widen permissions or index linked documents. Raw Circle/thread query parameters are removed from searchable text. General Circle posts can omit a company, and distinct body/insight text is preserved within existing field limits. Cleaning advances to clean-v3.
- Validation: 567 repository tests, 15 focused tests, backend type checking and 158-role catalog validation passed. Actual MCP -> Docker -> Postgres saved a three-reference example; first run inserted one/refreshed eight, repeat skipped all nine. Snapshot: /private/tmp/intelligence-tagged-post.json. Existing fictional Circle chat @mentions are included in adapter coverage.
- Limits: local fictional data and synthetic vectors only. Live source reads, scoped target resolution, global sharing and persisted document attachments are not connected.

Post-integration verification: the landing integrated the separately completed local backend work. All 595 tests passed on merged commit b55bd03, along with intelligence type checking and 158-role catalog validation. The earlier 567 count describes the pre-integration feature checks.

## Account-backed ingestion without fake-data dependency

- Removed the database target default; reusable processing has explicit source/provider/storage injection and no fixture imports. Added server-owner-filtered source loading from actual Circle, application milestone and logged communication tables, including published-revision/membership checks. Production-style communication IDs and zero-based contact revisions are supported.
- Added independent owner-scoped private staging, constrained to private_draft. Cleaning persists with null/pending embeddings; real providers can backfill later. Known synthetic vectors are rejected for account records, and pending mode never calls a provider even if a key exists. Existing unchanged embeddings survive temporary provider removal.
- Added an account-backed local entrypoint and idempotent test-account seed. Seeded two clearly fictional Circle posts and one fictional milestone under the existing local test account; verified existing application states remain unchanged. Enabled only local Circle availability; no agent scopes/credentials/approval records changed.
- Local evaluation containers now use the account-backed source, with ignored .env.local retained in this checkout. The original fixture database remains separate. Actual MCP ingestion/read staged three private records with embeddings pending and repeated idempotently. Evidence: /private/tmp/intelligence-account-proof.json.
- Limits: local evaluation only; hosted authenticated routing, sharing-policy approval, source withdrawal propagation and semantic/graph retrieval are not deployed. Live OpenAI embedding calls remain unverified. Final validation: 598 repository tests and 18 focused intelligence tests passed, with intelligence TypeScript checking and 158-role catalog validation. The rebuilt Docker/MCP account path returned three private pending records, zero failures, and skipped all three on repeat.

## Consolidated local configuration

- Root `.env.local` is the shared frontend/intelligence configuration; intelligence npm commands load it automatically and Docker instructions use it explicitly. Next.js imports only NEXT_PUBLIC_ settings, preserving shell overrides. No product UI or demo behavior changes.
- Validation: all 647 repository tests, 18 focused intelligence tests, intelligence type checking, 158-role catalog validation and production frontend build passed. A configuration smoke check verified public settings load, shell overrides win and OPENAI_API_KEY is excluded from the frontend loader.
- Consolidated the existing local files into ignored root .env.local and corrected OPENAI_KEY to OPENAI_API_KEY. Live OpenAI requests returned HTTP 429 / credit_balance_exhausted (insufficient_quota); all three staged records remain pending without vectors. Gate 1 is not cleared; API credits are required. Automatic ingestion remains in pending mode.
