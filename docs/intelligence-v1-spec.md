# Local global intelligence ingestion

Status: local demo only. Two sources, one deterministic cleaner, one vector table, two local MCP tools. No production ingestion or graph retrieval.

## Inspected sources

Before authoring fixtures, inspected the running `supabase_db_lookout-local` Docker database. `private.knowledge_posts`, `public.application_milestones`, `public.career_artifacts`, `public.outreach_contacts`, applications and company workspaces were empty. The fixtures therefore follow actual table/contract shapes; they do not reproduce real candidate experiences. No source rows were inserted or changed.

1. **Circle source:** published root posts joined to their exact published revision in `private.knowledge_revisions`. Preserve distinct `content.insight` and body text; preserve content company, role, stage, experience date, provenance and uncertainty.
2. **Application source:** application milestones plus application-linked logged networking replies. Milestones have kind, phase, label, optional `occurred_at` and private evidence JSON. Communications live in `outreach_contacts.record.notes` using `lookout-conversation-v1`. Existing `contactsForProcess` matches explicit application tags or exact job URLs; company name alone does not establish linkage. Only logged received messages enter this demonstration. Sent introductions, contact notes, thread URLs and milestone evidence excerpts are excluded.

Nine fictional observations: two Circle experiences, two Circle resources, one tagged Circle discussion, two milestones and two received messages in one application-linked conversation. The Circle UI demo also includes a general resource with source and resource attachments. All company names and experiences are fictional. These adapters are used on fixed fixtures, not live account records. A future real-data adapter must enforce ownership and processing/sharing permission before invoking them.

Application message dates mean logged communication dates; milestone dates mean reported event dates. Never substitute record creation, email arrival or ingestion time for a missing event date. Received statements have unknown provenance with explicit uncertainty, not employer verification. Contact revision versions the message-derived observations in this first demonstration; fine-grained immutable message versioning is deferred.

## Minimal data flow

MCP or timer → Node function → source adapters → validation/redaction → unchanged check → embedding provider → atomic upsert.

The reusable service receives a typed source-loader callback and an embedding provider. Fictional source records and synthetic vectors live in `tests/fixtures/intelligence.mts` and are wired only by `backend/intelligence/demo.ts`. Processing/service code has no fixture imports. Real source loaders can provide the same observations through this boundary without rewriting cleaning or embedding; ownership, sharing permission and a real-data storage boundary still need integration before using live accounts.

The Node API is separately runnable and can later be imported into the user's Dockerized backend. Existing Node API/worker and hosted MCP are unchanged. The local demo adapter forwards requests to this Node HTTP API; it never accesses PostgreSQL directly. MCP owns protocol framing and discovery; HTTP owns request parsing. Both use the same operation contract, with the service enforcing allowed arguments and limits. Malformed HTTP JSON returns INVALID_REQUEST (400), not a backend outage.

## Database schema

Migrations: `supabase/migrations/20261026174035_intelligence_demo_store.sql`, then `supabase/migrations/20261026184924_intelligence_resource_metadata.sql`, then `supabase/migrations/20261026191243_intelligence_post_references.sql`. One table: `intelligence_demo.intelligence_reports` in the separate local database `lookout_intelligence_demo`. No duplicate schema dump.

| Column | SQL type | Meaning |
| --- | --- | --- |
| id | uuid PK | Stable report identity |
| source_type | text | circle_post or application_update |
| source_id | text | Fictional source identity; contact/message pair for replies |
| source_revision | integer > 0 | Source revision; append-only milestones start at 1 |
| content_kind | text | observation or resource |
| title | nullable text | Cleaned title; required for resources |
| resource_links | jsonb array | Up to 16 deduplicated public HTTPS references with cleaned labels |
| contexts | jsonb array | Up to six reviewed application context snapshots; no referral identity or private notes |
| post_references | jsonb array | Up to 32 authored post pointers with label and nullable revision; target contents are not resolved |
| company | nullable text | Optional for Circle contributions; required for application updates |
| role | nullable text | Reported role |
| stage | nullable text | Reported stage or milestone kind; unknown for unclassified replies |
| insight | text | Cleaned observation, maximum 16,000 characters for combined Circle insight/body, 4,000 for application updates |
| experience_date | nullable date | Source-supplied event or communication date |
| provenance | text | employer_verified, user_confirmed, agent_observed, agent_inferred or unknown |
| uncertainty | nullable text | Source limitations |
| sharing_status | text | Constrained to demo_only; cannot publish globally |
| content_hash | text | SHA-256 of normalized observation, including source revision |
| processing_version | text | Cleaning implementation version |
| embedding_text | text | Exact cleaned text sent for vector generation |
| embedding | extensions.vector(1536) | Complete stored vector |
| embedding_model | text | text-embedding-3-small or explicit fixture-vector-v1 |
| created_at | timestamptz | First successful save |
| updated_at | timestamptz | Last successful update |

Unique `(source_type, source_id)`; one latest successful row per source observation. RLS enabled, no anonymous/browser grants. This demo has no real-user IDs, historical-revision service, publication workflow or claim that redaction guarantees anonymity. Source lineage stays local; a future global projection must hide internal lineage.

## Cleaning and repeat behavior

The resource adapter recognizes published `content.type=resource` posts. It preserves title, source links and resource-context links; combines distinct insight and body text without truncation; and retains reviewed application context without private referral details. One attached application can supply a missing company/role/stage tuple. Multiple applications stay separate and do not produce a guessed primary company.

The cleaner uses version `clean-v3`, so old successful rows are reprocessed once. Public link metadata is validated with the existing Circle URL helper plus decoded credential-query and local-address checks. Tracking parameters are stripped and references are deduplicated. Labels and titles undergo the same redaction as descriptions. URLs themselves stay out of embedding text; structured links remain available for citations. No external page is fetched or attested as publicly accessible. Local file previews are not indexed.

Normalize Unicode/whitespace; remove supplied known names literally; redact emails, phone numbers and all HTTP(S) URLs. Whitelisting drops source metadata. Freeform text is not summarized, verified or executed. Unknown names, contextual identifiers and confidential content can remain; therefore only fictional fixtures are accepted by the exposed tools.

Same source revision with a different cleaned hash is a conflict. Older versions skip. Unchanged observations with the same processing/model version skip without a provider call. Higher source revisions or changed processing/model versions regenerate. Saving fields and vector is one SQL statement; provider failure leaves the previous good row intact. Each record's failure is independent and returns only its fixture index and bounded code.

A session advisory lock serializes ingestion across API and scheduler. Process death releases it. The next scheduled/manual invocation safely retries; no job queue or run-history table is added.

## Run locally

Requires the existing local Supabase Docker database on port 54322 and Node 24. Dependencies are root npm-managed.

```sh
npm ci
npm ci --prefix next-app
docker exec supabase_db_lookout-local createdb -U postgres lookout_intelligence_demo
docker exec -i supabase_db_lookout-local psql -U postgres -d lookout_intelligence_demo -v ON_ERROR_STOP=1 < supabase/migrations/20261026174035_intelligence_demo_store.sql
docker exec -i supabase_db_lookout-local psql -U postgres -d lookout_intelligence_demo -v ON_ERROR_STOP=1 < supabase/migrations/20261026184924_intelligence_resource_metadata.sql
docker exec -i supabase_db_lookout-local psql -U postgres -d lookout_intelligence_demo -v ON_ERROR_STOP=1 < supabase/migrations/20261026191243_intelligence_post_references.sql
docker compose -f backend/intelligence/compose.yaml up --build -d
```

Create/apply once; do not rerun initialization against an existing database. The backend refuses database URLs outside explicit local hosts or a database name other than `lookout_intelligence_demo`. It never applies migrations automatically.

Compose defaults explicitly to `INTELLIGENCE_VECTOR_MODE=fixture`. Synthetic deterministic vectors prove cleaning and storage, **not semantic meaning or search quality**. The model name is returned in ingestion results and stored on every row.

To use real embeddings, provide a server-only `OPENAI_API_KEY`, set `INTELLIGENCE_VECTOR_MODE=openai`, and recreate the demo containers. The next ingestion regenerates vectors because the model changed. No key was found/configured during this pass; the live-provider gate is pending. Never place the key in MCP arguments or tracked files.

API: loopback port 8091, `POST /demo/intelligence` with `{operation,arguments}`. It rejects browser-origin requests and arbitrary operations. Bind localhost when running outside Docker; Docker exposes only host loopback. These demo-only routes do not authenticate real users and are not for public hosting.

```sh
npm run intelligence:mcp
```

Register that command with a local stdio MCP client, working directory at the checkout. Optional `INTELLIGENCE_BACKEND_URL` accepts only localhost HTTP. Tools:

- `ingest_demo_intelligence({})`: load both fixed datasets. Returns embeddingModel, inserted/updated/skipped/failed counts, and bounded errors. An overlapping run returns already_running.
- `list_demo_intelligence_reports({limit?:1..50})`: default 20; returns cleaned rows and vector dimensions, excluding vectors and embedding text. It does not search.

Manual server: `npm run intelligence:demo`; one ingestion: `npm run intelligence:once -- --fixture-vectors`. `INTELLIGENCE_DATABASE_URL` supplies local connection settings. A missing real key returns OPENAI_KEY_MISSING per record, never false success.

## Four-hour schedule

The scheduler container calls the identical ingestion function at UTC 00:00, 04:00, 08:00, 12:00, 16:00 and 20:00. It uses a small Node timer, not an OS cron installation. It rereads the fixed source set and skips unchanged observations. It logs actual counts, holds no durable work in memory and does not notify or wake Muse. Restarting recomputes the next UTC boundary; missed runs are not backfilled. Stop with `docker compose -f backend/intelligence/compose.yaml stop`.

## Gates and evidence

| Gate | Evidence | Status |
| --- | --- | --- |
| 1. Input and cleaning | Real source schema inspection; fixture/adapters, invalid inputs, exact process linkage and redaction tests | Passed |
| 2. Local vector writes | PGlite vector tests and Docker Postgres independently report nine rows and 1,536 dimensions; repeat skips nine; failed writes preserve prior row | Passed with synthetic vectors |
| 2b. Real embeddings | Actual OpenAI response produces vectors from sanitized text | Pending: no API key configured; mocked API contract tests are not live proof |
| 3. MCP and timer | Actual stdio MCP → Docker HTTP API → Postgres; real session-lock exclusion; actual short timer invocation in Docker | Passed |

The default four-hour scheduler is running; a four-hour interval has not elapsed during verification. No real Muse client handshake, live-source processing, production deployment or semantic retrieval is claimed.

Automated checks: `node --test tests/intelligence-ingestion.test.mjs`, `npm run intelligence:typecheck`, `npm test`, `npm run validate:data`. Full suite output for this session is preserved separately; release note records final results. No frontend files changed, so no frontend build is required for this slice.

Stop here for inspection of stored records. Next work requires an explicit decision: real-source authorization/adapter integration, live embedding validation, then retrieval.

## Cleanup follow-up

Moved fixtures out of reusable backend modules; added explicit source record types and injected source loading. A database-backed test supplies a non-demo-dataset source through the service and proves it alone is processed. The demo table remains demo-only; this is a reusable processing boundary, not authorization to ingest real account data. MCP/HTTP validation now has one operation authority in `contract.ts`; transport tests exercise it through actual HTTP.

## Resource ingestion validation

Twelve focused tests and all 564 repository tests passed, plus backend type checking and catalog validation (158 roles). Resource-specific checks cover a missing company, title redaction, source and context links, URL deduplication, credential/private URL rejection, link-only posts, full descriptions, multiple application contexts, revision conflicts and reuse of the existing Circle UI demo content.

Actual stdio MCP -> Docker API -> PostgreSQL: two new resources inserted, six old observations refreshed under clean-v2, zero failures; repeat skipped all eight. The general resource retained two public references with null company and date. The process resource retained company/role/stage and employer requisition context. The source and output comparison was saved for review at `/private/tmp/intelligence-resource-cleaning.json`. Synthetic fixture-vector-v1 remains explicit. Global sharing, live Circle polling, external page fetching and graph traversal remain deferred.

## Typed attachments and references

The Circle composer remains the intake interface. The backend does not create a second attachment system. Existing `contexts` supply reviewed application snapshots and resource links; existing forum-mention syntax supplies authored post pointers. These attachments are preserved on all Circle contribution types, not only resource posts. General Circle discussions can omit a company.

The local read service derives a common `references` list from stored metadata:

- `application_context`: reviewed company/role/stage/employer requisition snapshot. It is not a private application ID or permission to inspect application history.
- `resource`: cleaned label and validated public URL. It does not attest to a fetched page or its contents.
- `post`: circleId, postId, authored label, nullable revision and `resolved:false`. Existing mentions do not include a target version, so the adapter stores null. A pointer is not evidence of target availability, current membership or target content.

Raw forum-link query parameters are removed from text before embedding; the visible authored label remains. No recursive dereferencing, graph traversal, target body copying or expanded permissions is introduced. Labels may be stale or inaccurate user-authored text. A future resolver must use existing scoped reads, recheck target availability/membership at read time, and return a permitted exact published revision without treating this pointer as sharing approval. Internal target IDs must not be copied into a future public/global projection.

Circle file attachments remain local previews and are not persisted/indexed. Real document IDs and version references require the upload/storage boundary before they can join this model. Live source polling and global-sharing policy remain deferred.

Validation: 15 focused tests and all 567 repository tests passed, plus backend type checking and 158-role catalog validation. Tests cover existing UI chat mentions, metadata validation, unknown target revisions, no target body copying, general discussions and a unified three-kind projection. Actual stdio MCP -> Docker -> PostgreSQL inserted the tagged example, refreshed eight rows for clean-v3 and then skipped all nine on repeat. Reviewable input/output: `/private/tmp/intelligence-tagged-post.json`.
