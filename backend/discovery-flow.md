# Discovery flow: one backend job, then Muse reports

For a normal configured scan, Muse calls `submit_backend_job` once with
`{kind:"search_ats",input:{profileId},eventKey}` and polls `read_backend_jobs`.
The worker collects bounded sources, verifies supported employer postings, saves
observations, screens against current settings, deduplicates with copied Career
Ops code, and persists `result.shortlist` in the same leased backend job.

A terminal result with `pipelineVersion: 1` contains `shortlist.retainedListingIds`,
`duplicateListingIds`, `screenedCount`, `excludedCount`, `evaluatedProfileVersion`
and `personalVersion`. Muse reads those owned discoveries, checks existing report
freshness, creates role-specific analysis and four score/reasoning ratings,
publishes the batch and prepares drafts. No separate screening/dedup calls are
needed to complete the job. Legacy job receipts without a shortlist do not prove
this pipeline ran. Failed jobs do not return a completed shortlist.

The shortlist is deduplicated within this run, up to 250 observed discoveries
(ten sources × up to 25 collected leads each). Source totals are availability,
not counts actually verified. Liveness checks use the copied API/browser ladder for every supplied link.
Unsupported extraction (currently full-description parsing outside Greenhouse),
uncertain links, blocked sources or truncated pages keep the job partial; a partial
job may still return a useful shortlist. These bounds do not establish a complete
daily source sweep or a 50-report quota. Automatic historical-report reuse and
full applicant eligibility remain separate gaps.

Screenings retain version checks and replay keys under the job's ownership and
lease. Settings changes prevent a mixed-version successful result. Recovery after
run completion reconstructs the shortlist without refetching sources or creating
duplicate screenings. No extra queue or shortlist table is introduced. Observations
and screenings remain visible on the website; no application is submitted.

## Manual research and explicit rescreening

The tools below remain available for agent web-search supplements, unsupported
sources and intentional preference-change rescreening. They are not required
choreography for a normal backend job.

The upstream search implementation is copied, pinned and hash-verified under
runner/vendor/career-ops; see integrations/career-ops/README.md. Lookout supplies
owned profile/source configuration, scoped persistence and the website view.

1. Read current search context and applicant context, including the selected
   profile, relevant résumé, existing applications and source configuration.
2. Use configured aggregate lead sources (Simplify New Grad and Summer 2027) or
   copied Career Ops providers. The agent's own runtime can execute web search;
   Lookout does not silently substitute an unconfigured search engine.
3. Start an owned search run. Submit 1–25 discovered employer URLs through
   submit_search_leads on the Node MCP endpoint. The service authorizes the
   run/source, verifies supported canonical ATS records, parses full descriptions,
   and atomically saves observations and explicit per-lead diagnostics. Exact
   retries replay the saved result. Unsupported/inaccessible/closed leads remain
   visible failures; aggregate dates never become invented employer dates.
4. Call screen_search_discoveries for saved listing IDs. The service reads the
   current owned profile and applicant context, maps preferences to original
   Career Ops filters, retains factual unknowns, and records versioned requirement
   checks. Rescreening the same fetched list after a preference edit is supported;
   settings changing during evaluation must reject the stale commit.
5. The personal agent reads the shortlisted full descriptions, writes specific
   candidate-evidence analysis and a material gap, generates the four score/reason
   dimensions, and calls publish_batch. New records preserve employer facts;
   private analysis belongs in existing batch recommendations. Include the current
   evaluatedProfileVersion so the UI can identify stale analysis after settings edits.
6. Prepare source-backed answer starters through prepare_draft, preserving existing
   edits and missing personal choices. Read back drafts and batches. The website
   consumes the same saved records; opening it is not required for reading the work
   through Muse. Current authenticated approval requirements remain separate.

A completed source scan does not mean personal screening, analysis, publication or
application submission completed. Report each stage, source coverage and unresolved
facts separately. Never advertise an exhaustive daily scan when a source was bounded
or blocked. No new generic SQL tool, duplicate candidate store or automatic schedule
activation is part of this flow. Local verification does not establish hosted deployment.

Deduplication reuses pinned `scan.mjs`, `url-key.mjs` and `dedup-tracker.mjs` through
one shared identity adapter. `npm run test:dedup` verifies the original files and
matching decisions. `node --test tests/search-job-pipeline.test.mjs` tests the
single leased job against actual migrated SQL plus copied filter/dedup children.
There is no separate dedup MCP endpoint or destructive cleanup operation.

## Per-link liveness and extraction

The existing verification stage now calls copied `liveness-api.mjs` first and
`liveness-browser.mjs`/`liveness-core.mjs` when API results are inconclusive. No
classifier is rewritten. API checks use the upstream concurrency of ten;
browser checks are sequential. Browser runtime is installed in the Node image.

Each submitted URL returns `status: active | expired | uncertain`, `code`, `reason`,
`checkedAt`, `method` and a separate `extraction` outcome (`parsed`, `unsupported`,
`failed`, `not-attempted`). An active link with unsupported extraction remains
active; no fictional job record is created. The current Greenhouse extractor is
unchanged. Only confirmed-active, parsed records proceed to screening/analysis.
Diagnostics are returned by manual intake and saved in existing source checkpoints
by the single backend job, including expired/uncertain links. No new log table.

Guard failures, unavailable browsers and bot walls remain uncertain. Browser work
has a 30-second soft batch budget within the existing isolated task/job limits;
remaining fallback checks return `browser_budget_exhausted`, never an invented
live/dead verdict. An in-flight copied check may complete beyond the soft budget.
The API preserves provider-specific exceptions, including Lever's non-authoritative
API 404. `npm run test:liveness` exercises the copied classifiers and adapter.

## HiringCafe resource and connection

The optional `hiringcafe` template uses https://hiringcafe.com/ and records the
public ChatGPT MCP endpoint. Save an enabled HiringCafe board source through
`save_search_document` (portals), or the website's Search targets controls.
Then the normal `submit_backend_job` call
`{kind:"search_ats",input:{profileId},eventKey}` collects it automatically; no
separate API call or newly scoped tool is required. Both website and Node MCP
job submission retain existing ownership, version, credential and lease checks.
Merely adding the optional template does not change private saved sources.

`backend/runtime/hiringcafe.ts` is a first-party aggregate adapter, like Simplify;
the copied CareerOps source remains unchanged. It uses the fixed official
https://hiringcafe.com/api/chatgpt/mcp endpoint with `search_hiringcafe_jobs` and
`get_hiringcafe_job_details`. It does not forward credentials, resumes or profile
narrative. The selected profile contributes structured location, employment and
entry-level choices; required work arrangements become provider filters, while
preferred work arrangements stay broad. Source keywords override the Roles
field; absent keywords/roles means newest matches using structured filters.
Full-time and internship tracks are separate calls. Fresh/backlog run windows
become `posted_within_days`; the provider rounds freshness and dates are not
independent employer publication evidence. Freeform compensation, team fit and
other narrative preferences remain downstream screening/research work.

Each source permits four query combinations, 25 unique inspected leads, a
75-second deadline and 2 MB per response; exceeding query, row or time budgets
keeps coverage partial. Provider match counts are sums across executed queries
and may overlap. The API returns one role per company, so coverage is always
`truncated`, including empty results; it never establishes an exhaustive sweep.
Rate limits, malformed responses and failed sources become explicit blockers.

An API-provided external application URL enters the existing copied employer
verifier. When details return only a HiringCafe job page, the adapter attempts
one bounded public-page read and accepts only a unique external Apply link.
Blocked, ambiguous or missing links remain uncertain source diagnostics and
never become employer-verified observations. No challenge bypass is attempted.
The same copied deduplication, official full-description extraction (currently
Greenhouse), versioned screening and shortlist pipeline runs on resolved URLs.
An aggregate description alone never supplies a verified employer record.

Official docs: https://hiringcafe.com/documentation/hiringcafe-chatgpt-app

Run `node scripts/check-hiringcafe-batch.mjs /private/tmp/hiringcafe-proof.json`
for a read-only live smoke check through `executeSearch`. Its persistence is
fictional memory: no personal account, queue, catalog, submission or publication
is modified. Tests additionally exercise a resolved employer fixture through
collection, verification, observation saves, screening and shortlist dedup;
blocked links, rate limits, changed schemas and duplicate leads are covered.
Demo fixtures show a fictional aggregate source with an unresolved employer
link and a partial backend result without external requests.

Local worker rebuild/restart is necessary to activate runtime changes. Hosted
Node deployment and gateway/config release remain separate; local landing does
not deploy production or add HiringCafe to a user's private Sources list.
