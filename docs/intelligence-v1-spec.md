# Intelligence ingestion: fixtures and account staging

Status: local fixtures and account-backed ingestion both work. The reusable processor, source adapters and owner-scoped staging accept real source records without fixture imports or synthetic vectors. Hosted production ingress, global publication and graph retrieval are not deployed.

## Inspected sources

Before authoring fixtures, inspected the running `supabase_db_lookout-local` Docker database. `private.knowledge_posts`, `public.application_milestones`, `public.career_artifacts`, `public.outreach_contacts`, applications and company workspaces were empty. The fixtures therefore follow actual table/contract shapes; they do not reproduce real candidate experiences. No source rows were inserted or changed.

1. **Circle source:** published root posts joined to their exact published revision in `private.knowledge_revisions`. Preserve distinct `content.insight` and body text; preserve content company, role, stage, experience date, provenance and uncertainty.
2. **Application source:** application milestones plus application-linked logged networking replies. Milestones have kind, phase, label, optional `occurred_at` and private evidence JSON. Communications live in `outreach_contacts.record.notes` using `lookout-conversation-v1`. Existing `contactsForProcess` matches explicit application tags or exact job URLs; company name alone does not establish linkage. Only logged received messages enter this demonstration. Sent introductions, contact notes, thread URLs and milestone evidence excerpts are excluded.

Nine fictional observations: two Circle experiences, two Circle resources, one tagged Circle discussion, two milestones and two received messages in one application-linked conversation. The Circle UI demo also includes a general resource with source and resource attachments. All company names and experiences are fictional. The fixed fixtures remain isolated tests. The account source loader additionally reads actual local source-table rows for a server-selected owner. It loads only that owner’s published Circle revisions with active membership, owned milestones and explicitly linked received communications. Production callers must authenticate and authorize the owner before selecting this loader; private processing does not authorize global publication.

Application message dates mean logged communication dates; milestone dates mean reported event dates. Never substitute record creation, email arrival or ingestion time for a missing event date. Received statements have unknown provenance with explicit uncertainty, not employer verification. Contact revision versions the message-derived observations in this first demonstration; fine-grained immutable message versioning is deferred.

## Minimal data flow

MCP or timer → Node function → source adapters → validation/redaction → unchanged check → embedding provider → atomic upsert.

The reusable service receives a typed source-loader callback and an embedding provider. Fictional source records and synthetic vectors live in `tests/fixtures/intelligence.mts` and are wired only by `backend/intelligence/demo.ts`. Processing/service code has no fixture imports. The internal intelligenceProcessor exposes run/list independently of demo tool names. Storage targets are explicit: demo or owner-scoped private staging. The account entrypoint imports no test fixtures and uses the database-backed loader. Hosted authenticated routing and a global-sharing policy still need integration.

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

Normalize Unicode/whitespace; remove supplied known names literally; redact emails, phone numbers and all HTTP(S) URLs. Whitelisting drops source metadata. Freeform text is not summarized, verified or executed. Unknown names, contextual identifiers and confidential content can remain; therefore public/global publication remains disabled. The local evaluation tools run either fixed fixtures or a selected local test account; they are not public production endpoints.

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

Post-integration verification: the landing integrated the separately completed local backend work. All 595 tests passed on merged commit b55bd03, along with intelligence type checking and 158-role catalog validation. The earlier 567 count describes the pre-integration feature checks.

## Account-backed input and production-data readiness

`intelligenceProcessor(pool, provider, sourceLoader, target)` has no fixture dependency or default fake storage target. Production backend code can provide an authenticated owner, real source loader and real repository/provider. The local evaluation entrypoint deliberately accepts only localhost/Postgres and an existing `@example.test` account; that restriction belongs to the harness, not the reusable processor. Do not expose the local evaluation HTTP server as a production authenticated API.

The account source loader reads real `knowledge_posts`/`knowledge_revisions`, `application_milestones`, application/job context and logged `outreach_contacts` records. Every query filters the selected owner; Circle input additionally requires active membership, source authorship and the published revision. Private drafts and other authors’ contributions are excluded. The Circle feature gate is respected. Contacts are matched using the existing process-link rules. Contact storage revisions are translated from zero-based to one-based observation versions. Unusual/long communication IDs are deterministically hashed into stable report keys. Each input query is capped at 200 records; larger batches fail explicitly until pagination is added.

Migration `20261026193933_intelligence_account_staging.sql` creates `private.intelligence_reports` independently of the demo tables. It stores the same cleaned knowledge/reference fields plus `owner_id`; uniqueness includes owner. Reads, writes and upserts are owner-filtered. All records are constrained to `private_draft`; anonymous/browser roles have no direct access. It cannot publish globally.

Account staging supports nullable `embedding` and `embedding_model`; read responses derive `embedding_status=pending|ready`. Pending mode makes no model call, even if a key exists. A real provider can backfill unchanged pending records later. Removing provider configuration does not erase a valid unchanged embedding; changed text correctly resets it to pending. Known synthetic fixture models are rejected in account storage.

Local commands, from the task checkout:

```sh
# Apply reviewed pending migrations to the local stack only.
supabase migration up --local --include-all
# Supply the UUID of your existing local test account.
INTELLIGENCE_ACCOUNT_ID=YOUR_LOCAL_TEST_ACCOUNT node tests/fixtures/seed-intelligence-account.mts --enable-local-circles
INTELLIGENCE_ACCOUNT_ID=YOUR_LOCAL_TEST_ACCOUNT npm run intelligence:account -- --once
# Set the ignored .env.local from the root .env.example before Docker use.
docker compose --env-file .env.local -f backend/intelligence/compose.yaml up --build -d
```

The idempotent seed creates a clearly fictional `[DEMO] Intelligence ingestion` Circle with two posts and one labeled milestone attached to an existing application. It verifies application IDs/statuses/revisions are unchanged within its transaction. It does not alter agent scopes, mint credentials or write approval records. Optional local Circle enablement changes availability only; ownership and normal publication checks remain enforced for subsequent UI/MCP actions. Withdraw the generated Circle posts through normal owner controls when finished; the seed will not overwrite withdrawn/edited posts. The labeled milestone remains part of the test account’s history. No reset of unrelated account records is performed.

This session selected the existing local `@example.test` account and verified actual MCP -> Node -> source database -> private staging: three records saved, three pending embeddings, zero failures; repeat skipped all three. No synthetic vectors were used. The isolated nine-record fixture database remains separate. Evidence: `/private/tmp/intelligence-account-proof.json`. The ignored local configuration stays in the retained task checkout.

These are real persistence/source-code paths exercised with intentionally fictional contributions in a local account. Actual OpenAI responses, hosted production authorization, deletion/withdrawal propagation into derived drafts, global-sharing policy and semantic/graph retrieval remain separate gates.

Final account-path verification: 598 repository tests and 18 focused intelligence tests passed, along with TypeScript checking and 158-role catalog validation. Actual MCP -> rebuilt Docker -> account tables -> private staging returned three private records with embeddings pending, zero failures and idempotent repeat behavior.

### Gate 2: current account results

Account processor reads reload the existing owner-scoped source loader and match cleaned content hashes and processing versions in SQL before applying the result limit. Published edits hide old reports until ingestion succeeds; unshared drafts do not replace the published revision. Withdrawn posts, inactive membership, disabled Circle knowledge, deleted milestones and deleted/unlinked communications no longer appear on the next read, without waiting for the ingestion timer. Source-loading failures fail the read closed.

Provider failure preserves the previous metadata/vector atomically in private staging, but stale content is excluded from results. Staging retention is not deletion or global publication. This recheck applies to the existing local list_demo_intelligence_reports MCP/HTTP operation through the shared processor; authenticated hosted routing and semantic search remain later gates. Source loading and report selection are separate queries, not a single transactional authorization snapshot.

### Gate 3: bounded semantic retrieval

`search_demo_intelligence({query, limit?})` is the local MCP/HTTP search operation. Queries must contain non-whitespace text, at most 1,000 characters; limits default to 5 and range from 1 to 20. The configured provider embeds the query with the same model used by stored reports. The account source loader is refreshed after embedding, and PostgreSQL filters owner, current content/processing fingerprints, ready vectors and exact model identity before sorting by cosine similarity and applying LIMIT. Source pointers/revisions, cleaned text and references accompany results; embedding arrays and embedding text are not returned.

A provisional cosine floor of 0.30 suppresses weak matches. Similarity is not confidence or proof that a report answers the question. Empty results are valid; missing/failed providers return errors instead of fabricated results. This is exact vector retrieval over the small local dataset, with no reranker, graph traversal, generated answer, vector index or global sharing. Search sends the submitted query to the configured embedding provider. The local transport still rejects browser Origin headers and does not provide hosted user authentication; website/Muse integration belongs to Gate 4.

Use `INTELLIGENCE_VECTOR_MODE=openai npm run intelligence:account` to explicitly start a local account server with real query embeddings. This does not start the scheduled entrypoint. The shared env file remains pending by default. Never expose this local evaluation server as an authenticated production API.

`npm run intelligence:evaluate-search` is an opt-in paid API check using six clearly fictional reports and nine labeled queries in an ephemeral test database. It uses the real provider and production search processor, measures seven expected top-one matches and two unrelated empty results, then disposes of its database. It never writes the evaluation corpus into account storage. Initial evaluation passed 9/9; this small corpus is not a production relevance benchmark. Automated regression tests use controlled vectors for ranking/filtering/error and MCP-over-HTTP checks, not as semantic-quality evidence.

### Bloomberg candidate-discussion baseline (supersedes the initial Gate 3 clearance)

The intended product value is recent user-reported interview intelligence and accessible discussions for candidates actively in process, rather than generic interview advice. Muse should eventually ask with the user's role/stage context and surface relevant experiences or discussions; automatic triggers, answer generation, thread navigation and permissioned global sharing are still deferred.

`npm run intelligence:evaluate-bloomberg` uses 15 entirely fictional reports and 11 pre-labeled questions. It includes conflicting OA/technical experiences, waiting threads, a reply, a next-round update, a rumor, an older recruiting cycle, an internship, a senior role, another employer and generic advice. The corpus is injected as pre-authorized reports into an ephemeral database; it does not enable global access or test the real source loader. In particular, the real loader currently excludes replies. These are not assertions about Bloomberg's hiring process.

Baseline: 4/11 strict cases passed; relevant top-one result on 6/9 evidence-bearing questions; mean recall@3 90.7%, mean precision@3 51.9%. Strict pass requires all labeled evidence in the top three and no explicitly excluded results; unanswered questions require no results. Other related results can still appear on a passing case. The rumor case tests retrieval of the explicitly unconfirmed report, not factual verification or an answer claiming hiring is paused.

The 2024 waiting thread outranked current reports despite queries mentioning October 2026. Internship content mixed with New Grad OA reports; technical results appeared for recruiter-screen queries. An unsupported Tokyo offer-deadline question returned related but non-answering reports. The 0.30 similarity floor cannot establish answerability. Gate 3 remains open for the intended experience.

Single sequential run: median query latency 376 ms, observed p95 1,243 ms over 11 queries. Embedding requests dominated; ephemeral PGlite selection took about 3–5 ms. This is not production PostgreSQL or load-test evidence. The run made 26 real embedding requests: 15 documents plus 11 queries. Full query/result records are in `docs/evaluations/bloomberg-intelligence-baseline.json`.

Next evidence-driven improvements: pass explicit role/stage/date context rather than relying on query embeddings to enforce those distinctions; retain useful general resources separately where appropriate; distinguish related reports from evidence answering the question; and resolve permitted discussion roots/replies when that source path is built. Do not assume a reranker or graph database is required to address these failures. Keep this baseline unchanged for comparison, and add held-out cases before claiming broad relevance gains.

### Diagnostic investigation: representation versus ranking

`npm run intelligence:diagnose-bloomberg` runs diagnostic comparisons only; it does not change production search. It embeds the 15 fictional reports in three forms (current text, without shared uncertainty boilerplate, and with explicit experience dates), tests 18 questions across six intents, and compares full-corpus ranking with manually selected same-context subsets. Results and exact embedded text are retained in `docs/evaluations/bloomberg-search-diagnostics.json`. This run made 75 real embedding calls.

Correctness checks: exact report-text self-retrieval passed 15/15; production processor/pgvector rankings and scores agreed with independently calculated JavaScript cosine results for all 11 original queries (score tolerance 1e-5). One repeated query embedding was identical coordinate-for-coordinate. This rules out the checked SQL/order/dimension/repeatability issues, not every possible implementation error or future provider drift.

Across 15 evidence-bearing paraphrases, current text ranked a labeled relevant report first 9/15 times. Removing the shared fictional uncertainty sentence remained 9/15. Prepending experience dates improved this to 11/15, including both explicit-current-cycle waiting queries that previously ranked the 2024 post first. Manual company/role/stage/cycle eligibility subsets reached 13/15. These experiments are not held-out evaluations: subsets are hand-selected and tiny (some have only two or three records), so their 100% recall@3 is partly trivial and must not be treated as proof of robust retrieval.

Residual failures within the correct context: “no reply after the coding test” ranked a just-completed OA post above the explicit eight-day waiting report; “next step ... rather than people still waiting” ranked a waiting discussion above the next-round invitation. The former is partly a labeling/priority issue: the just-completed OA post itself asks whether anyone has heard back, so it is related but less directly useful. The latter demonstrates sensitivity to negation and competing topic wording. Paraphrases are not perfectly equivalent: some omit New Grad or exact stage language; those should carry structured context in a real Muse call rather than assuming semantic equivalence preserves constraints.

All three unsupported Tokyo offer-deadline paraphrases returned reports under every representation and under the selected context subset. Their scores (roughly 0.49–0.51 at the top in the baseline) overlap useful results (e.g. a relevant OA format report at about 0.48 in a constrained comparison). A single higher similarity threshold therefore cannot cleanly separate answerable from unsupported questions on these examples. These are related-candidate retrieval scores, not evidence sufficiency judgments.

Conclusion: no checked vector calculation bug; both representation/context omissions and semantic discrimination/answerability weaknesses exist. Filters are a justified part of honoring explicit constraints but do not fully solve the slice. Before promoting it, use larger same-context hard-negative sets with preserved query context, review graded relevance labels, and evaluate any ranking/answerability change against held-out paraphrases. No model switch, filter, reranker or graph was added in this pass.
