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

The optional `hiringcafe` source template returned by `read_search_context` points
to https://hiringcafe.com/ and records the public MCP endpoint
https://hiringcafe.com/api/chatgpt/mcp in its `api` field. It is a discovery
resource; adding the template does not install a connector, enable the copied
provider scanner, or alter anyone's private saved sources. Save an explicitly
chosen source through the existing versioned `save_search_document` portals
operation (website targeting controls share the canonical document validation).
The personal agent must have an MCP client or use browser sourcing. The copied
scanner has no HiringCafe provider and must report unsupported access honestly.

Official connection documentation:
https://hiringcafe.com/documentation/hiringcafe-chatgpt-app

The remote service uses Streamable HTTP JSON-RPC POST requests and no
authentication. Discover its current schema with `tools/list`, then call
`search_hiringcafe_jobs` and `get_hiringcafe_job_details`. Run full-time and
internship searches separately using the selected profile. Search returns a
bounded selection (currently 20, one role per company); never treat that page
as exhaustive catalog coverage. A result's `applyUrl` may be a HiringCafe page,
so follow it to the employer/ATS before submitting canonical employer URLs to
`submit_search_leads`. Preserve provider dates as source evidence until the
employer independently discloses a posting date.

Live smoke check on 2026-10-27: `tools/list`, a US entry-level full-time
`backend engineer` search, and a details call all returned HTTP 200 without
JSON-RPC/tool errors. Search reported 122 matches and supplied 20 rows. Details
for job `51pabf3drml5p70b` returned TikTok's Backend Engineer Graduate (User
Growth) - 2027 Start with a description and a HiringCafe link. This verifies
read access only: employer availability, catalog completeness, rate limits,
production deployment and an end-to-end saved personal search were not tested.
No discovered roles or personal records were imported by this smoke check.

Demo verification uses the existing fictional search-context path: its
`searchResponse('search.context', ...)` exposes the same optional templates
without making external requests or changing fictional saved sources.
