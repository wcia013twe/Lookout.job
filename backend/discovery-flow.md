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
not counts actually verified. Unsupported verification (currently non-Greenhouse
lead parsing), blocked sources or truncated pages keep the job partial; a partial
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
