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

## Gate 1: real embedding verification

- Retried after API credits became available: the existing account-backed pipeline updated all three local test-account records using text-embedding-3-small, with three real provider calls and zero failures. Database inspection confirmed all three are ready with 1,536-dimensional vectors and the expected model.
- An unchanged second run skipped all three records, made zero provider calls and had zero failures. Gate 1 is cleared for this bounded local evaluation.
- No runtime code changed in this verification pass. Automatic ingestion remains configured as pending; production routing, retrieval quality and the later gates are not claimed.

## Gate 2: source freshness and permission checks

- Account report reads now reload authorized source records and require matching cleaned content/processing fingerprints in SQL before LIMIT. Raw account-store reads without current source fingerprints fail closed. The existing local MCP list operation and HTTP handler share this processor; no new API, table, queue or publication path was added.
- Published edits hide stale reports until successfully reprocessed. Withdrawal, inactive membership, disabled Circle knowledge, deleted milestones and deleted contacts disappear on the next read. Unpublished drafts leave the published revision visible. Provider failure keeps the previous stored metadata/vector intact but does not expose it as current content.
- Added fictional lifecycle coverage for update/retry/failure, withdrawal, permission loss/restoration, source deletion, owner isolation, source-loader failure and filtering before limits. These are backend evaluation states; no admin UI is connected to this local service yet.
- Validation: all 703 tests passed after restoring missing locked root dependencies; intelligence type checking and catalog validation passed. Live local PostgreSQL verification returned three ready reports, then one after test membership removal inside a transaction, then three after rollback. No persistent source edits or extra OpenAI requests were needed.
- Gate 2 is cleared for the local account evaluation service. Source loading and selection remain separate queries rather than one transactional authorization snapshot; hosted authentication, search quality, graph work and global publication are not claimed. Hidden staging rows are retained, not purged.

## Gate 3: useful semantic retrieval

- Added bounded query embedding and exact pgvector cosine ranking, sharing current-source/owner filtering with report reads. Excludes pending and different-model vectors, refreshes source permissions after the provider request, and filters before limiting results. Returns cleaned reports, source references and similarity; weak results below provisional 0.30 are omitted.
- Added search_demo_intelligence to the existing local MCP/HTTP contract with strict query/limit validation. No production gateway capabilities or frontend behavior are advertised; Gate 4 still owns authenticated website/Muse wiring. No reranker, graph, new schema or index was added.
- Added an isolated fictional six-topic search corpus, controlled-vector lifecycle/transport tests, and opt-in intelligence:evaluate-search. Real OpenAI evaluation ranked the expected report first for all seven relevant queries (including paraphrases), and returned no results for two unrelated queries: 9/9. A separate real PostgreSQL query over the existing account embeddings returned the fictional preparation post for “What should I prepare for an interview?” with similarity 0.410.
- Validation: all 704 repository tests, intelligence type checking and 158-role catalog validation passed. MCP-over-HTTP tests verify discovery, search payload parity and argument rejection. No frontend files changed, so no new frontend build was required.
- Gate 3 is cleared for bounded local retrieval. The similarity cutoff is provisional and not a confidence score; the small evaluation does not establish production relevance or complete no-answer detection. No persistent evaluation-source writes or automatic paid scheduler activation occurred.

## Bloomberg candidate-discussion evaluation

- Added an isolated 15-report fictional Bloomberg New Grad corpus and 11 pre-labeled candidate questions, including stage/role/cycle distractors, conflicting reports, an unconfirmed rumor and an unsupported recruiting question. No real candidate data, global-sharing flags or account-storage writes are involved.
- Added opt-in intelligence:evaluate-bloomberg and retained its complete baseline JSON. Uses real text-embedding-3-small requests and the existing search service; records top-one relevance, recall/precision@3, explicit wrong-context matches and per-query timing.
- Results: 4/11 strict cases passed; 6/9 evidence-bearing queries had a relevant top result; mean recall@3 90.7%, precision@3 51.9%. Median latency 376 ms and observed p95 1,243 ms in a single sequential 11-query run, dominated by embedding latency. PGlite timings are not production/load benchmarks.
- Gate 3 remains open for the intended discussion product. Old-cycle, internship and wrong-stage contamination and unsupported-question matches need improvement. The injected reply does not prove real reply ingestion, thread navigation, global permissions, Muse automation or answer synthesis; those remain unimplemented/deferred. No runtime retrieval behavior changed in this benchmark pass.
- Validation: live benchmark completed with all 15 embeddings saved in its ephemeral database and all 11 queries evaluated; all 704 repository tests, 158-role catalog validation and git diff whitespace checks passed.

## Embedding failure investigation

- Added an opt-in reproducible diagnostic script and retained exact synthetic embedded texts, rankings, representation comparisons and paraphrase results. No runtime retrieval behavior or real account data changed.
- Verified 15/15 exact self-matches and 11/11 SQL-versus-independent-cosine comparisons; one repeated query embedding was identical. Across 15 evidence-bearing paraphrases: baseline top-one 9/15, removing boilerplate 9/15, explicit dates 11/15, hand-selected same-context candidates 13/15. All three unanswerable paraphrases returned non-answering reports in every condition.
- Identified missing explicit dates in current embedded text, context contamination, paraphrase/negation sensitivity, and score overlap between useful and unsupported questions. Also documented label ambiguity and the trivial recall advantage of very small manual subsets. These checks do not justify production-readiness or a blanket claim that filters fix the issue.
- Live synthetic diagnostic completed using 75 embedding calls; all 723 repository tests, 158-role catalog validation and whitespace checks passed. No automatic scheduler, global permission or production deployment changes.

## Optional hybrid search and controlled Bloomberg comparison

- Added mode=hybrid to the shared local search/MCP contract. PostgreSQL English full-text OR matching and existing semantic retrieval feed equal-weight RRF (k=60, top20 each). Owner, current-source, ready-vector and model boundaries apply to both branches. Vector remains the default. No schema, index, frontend, graph, reranker or production capability change.
- Added keyword-only recovery, malformed/stopword queries, pending/model/owner/source exclusions and hybrid MCP-over-HTTP parity tests. Existing fictional fixtures cover both branches; no new admin interaction is claimed for the still-local evaluation service.
- Real OpenAI comparison used identical cached embeddings across 35 queries, including six new questions. Top-one relevance improved 18/29 to 20/29, but recall@3 fell 88.5% to 82.2% and precision@3 fell 48.3% to 44.8%. On the five new evidence-bearing questions, top-one fell 3/5 to 2/5. Hybrid is not promoted; full results retained in docs/evaluations/bloomberg-hybrid-comparison.json.
- Validation: all 731 repository tests and intelligence type checking passed. Catalog validation passed for 158 roles. No frontend change requiring a build. Tests and benchmark used ephemeral databases; global permissions and automatic paid ingestion remain deferred.

## Library-backed BM25/vector/hybrid experiment in Node

- Added a small evaluation adapter under backend/intelligence using pinned Orama and its English stopword package. BM25, cosine and hybrid scoring are library-provided; only validation/index setup/projection are local code. Both dependencies are dev-only until any separately validated product integration. No frontend, Edge Function, live HTTP/MCP contract, permissions or production search behavior changed.
- Added the reproducible intelligence:compare-library command and retained the corrected 35-question comparison on the existing fictional corpus. Fixed exact-query configuration and the library stopword list's omitted “a” before accepting results; regression tests cover conversational matching, unrelated queries, independent modes and payload/input boundaries.
- Corrected result: BM25 top-one 16/29 and recall@3 61.5%; vector 18/29 and 88.5%; built-in hybrid 18/29 and 82.2%. This is Orama's BM25 variant and fusion, not Elasticsearch/Lucene; no engine-wide superiority claim is made. Vector remains the current baseline, and Gate 3 remains open.
- Verification: all 733 repository tests, backend type checking, focused adapter tests, 158-role catalog validation and whitespace checks passed. Existing fictional reports are the demo input, with no real account/global writes or automated paid scheduling.

## Exact company/role filtering experiment

- Added library enum company/role filters to the Node evaluation adapter and --company-role to the existing library comparison command. The same full index and real vectors serve both conditions; no custom scoring or domain rank tuning, and no live service change.
- On the fictional corpus, 15 reports reduce to 11 Bloomberg New Grad reports. Relevant-first results rise from 16 to 18/29 for BM25, 18 to 20/29 for vector, and 18 to 19/29 for hybrid. Filtered recall@3 is 66.7%, 88.5%, and 83.9%, respectively. Remaining wrong-stage/cycle and intent mismatches show why company/role alone does not produce 100% relevance.
- Saved full paired results in docs/evaluations/bloomberg-company-role-comparison.json. Verified exact filter exclusion in all three library modes, including empty scopes. Type checking, focused tests, all 744 repository tests and 158-role catalog validation passed. No real-account/global storage writes or production deployment.

## Basic posting-scoped metadata search

- Added search_demo_intelligence_metadata through the shared local Node/MCP contract: exact canonical jobId or company+role, optional stage and reported-date bounds, and recent-first results. Current source/owner checks run before filtering and limit; pending records require no embedding model or API calls. Context fields must match one attachment, with report-level stage fallback when the attachment omits it.
- Preserved canonical posting IDs on application-source reports and protected opaque job IDs from personal-text redaction (clean-v4). Added server-only source Circle identity to candidates for verified graph-reference resolution. Existing staging requires re-ingestion under clean-v4; global sharing/authenticated production routing are not activated.
- Extended fictional fixtures with posting/Circle identities. Focused validation passed: 19 ingestion/account tests, metadata tests for limits/ordering/context isolation/dates/freshness/owner isolation/no-embedding calls, HTTP/MCP parity and canonical-ID preservation; backend type checking passed. Final combined validation follows the graph integration.

## Metadata search and explicit graph integration

- Integrated the subagent's bounded evidence graph with the local Node service and MCP discovery. Seeds and linked posts must match fresh permitted source fingerprints; linked posts additionally match the server-loaded Circle identity and optional pinned revision. Metadata search remains independently usable without vectorization.
- Added fictional service coverage for same-Circle resolution, wrong-Circle/owner exclusions, withdrawn targets, revision changes, attached resources and HTTP/MCP parity. Existing demo source fixtures carry canonical posting and Circle identities. These are local backend demo interactions; no new frontend capability is advertised.
- Combined verification: all 762 repository tests passed, including isolated database scenarios and actual localhost HTTP/MCP calls; intelligence type checking, 158-role catalog validation and whitespace checks passed. No model/API calls, live-account data mutation, frontend build or production deployment was needed.
- Limits: existing staged records need re-ingestion for clean-v4. Global sharing, aggregate counts, discussion groups and Muse answer generation remain deferred. Exact company/role matching does not resolve title aliases; canonical posting IDs distinguish otherwise similar roles.

## Muse usefulness and silence gate

- Added read_demo_muse_intelligence to the local Node HTTP/MCP contract and initialization instructions. Metadata scope selects current permitted discussion posts before limits, excludes private application progress, and returns compact cited evidence with verified Circle navigation paths. Explicit graph expansion remains optional and off by default.
- Added a small model-independent host adapter. Application metadata controls scope; empty results bypass interpretation. Automatic empty/insufficient results return no message or citations. Useful results require exact source excerpts and current packet citation identities; generated narrative claims and fabricated quotes are not delivered. No model SDK, retrieval dependency, production gateway change or schema migration was added.
- Extended fictional Bloomberg demo fixtures for posting/location/cycle separation and added HTTP/MCP, optional-link, stale-source, application-only, error, citation and silence tests. Added an opt-in model evaluation command. The final eight cases passed using six interpreter calls and zero embeddings; empty scopes made no model calls. Earlier failed/freeform prototypes are retained, including one whose automatic checks passed but manual review found overbroad claims. Final excerpts were manually checked against sources.
- Verification: backend type checking and 158-role catalog validation passed. All 775 repository tests passed again with the final excerpt constraint; whitespace checks passed. No frontend build was required.
- Limits: controlled local model surrogate, not an installed/live Muse session. Raw MCP clients receive evidence/instructions; deterministic suppression and excerpt checks require the host adapter. Global sharing, counts, groups, automatic scheduling and notification delivery remain deferred. Existing staging needs clean-v4 re-ingestion. Nothing is published by this pass.

## Platform interview-intelligence exposure

- Added the read_interview_intelligence / knowledge.interview operation to existing Node MCP and the signed-in knowledge RPC. A single scoped SQL function resolves owned application/catalog identity, reads current published Circle reports across active memberships, and filters explicit posting association before limit. Agents require both knowledge:read and workspace:read; private application milestones are never shared evidence.
- Added the application Overview report section with source links, dates and uncertainty. Automatic empty results stay quiet; explicit checks explain emptiness. Added account/posting response guards, error handling and an isolated fictional Cedar demo association. Catalog-backed applications are supported; imported-only records remain outside this scope.
- Incremented developer instructions while preserving the connection-setup rule's priority. Node ownership is explicit; no additional HTTP service, ranking algorithm, dependency, model call, count or global sharing was introduced. Platform reads bypass evaluation staging and use published revisions directly.
- Focused tests passed for authenticated browser/Node MCP parity, posting identity, stages/dates/limits, private-function denial, owner/scopes, pending edits, withdrawals, membership changes and token revocation. Production build and backend typechecks passed. Desktop/mobile demo verification passed with source navigation, refresh, silent automatic emptiness, explicit empty feedback, no overflow and zero cloud requests. Final suite/catalog results follow below.
- Release boundary: no hosted deployment, stack restart or shared database mutation. Port 3000 belongs to another task checkout; this pass uses isolated preview port 3069. The migration, Node/gateway instructions and frontend must be released together before hosted availability is claimed.

- Final platform verification before landing: all 794 tests passed, including the scope audit and actual Node HTTP/MCP integration; runtime/intelligence typechecks, 158-role catalog validation, final production frontend build and desktop/mobile visual checks passed. An earlier scope-audit failure correctly caught the missing additional workspace:read declaration, which was fixed before this successful run.
