# Discovery flow: agent search to saved recommendations

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
5. Call `deduplicate_search_discoveries` with the retained owned run listing IDs
   (1–100), before producing reports. The read-only Node service maps stored
   canonical URLs, ATS identities and requisitions into the directly copied
   Career Ops scanner/tracker code. It returns retained and duplicate listing IDs;
   it does not delete or change stored records. Supply `previousListingIds`
   (up to 100 owned IDs) explicitly for already evaluated/reported listings,
   including previous runs. Carry retained IDs into history for later chunks.
   Empty history only deduplicates the provided candidates. Missing/foreign IDs
   or incomplete bounded reads fail rather than weakening history silently.
   Compare source/profile changes separately before deciding to reuse a report.
6. The personal agent reads the shortlisted full descriptions, writes specific
   candidate-evidence analysis and a material gap, generates the four score/reason
   dimensions, and calls publish_batch. New records preserve employer facts;
   private analysis belongs in existing batch recommendations. Include the current
   evaluatedProfileVersion so the UI can identify stale analysis after settings edits.
7. Prepare source-backed answer starters through prepare_draft, preserving existing
   edits and missing personal choices. Read back drafts and batches. The website
   consumes the same saved records; opening it is not required for reading the work
   through Muse. Current authenticated approval requirements remain separate.

A completed source scan does not mean personal screening, analysis, publication or
application submission completed. Report each stage, source coverage and unresolved
facts separately. Never advertise an exhaustive daily scan when a source was bounded
or blocked. No new generic SQL tool, duplicate candidate store or automatic schedule
activation is part of this flow. Local verification does not establish hosted deployment.

Deduplication verification: `npm run test:dedup` runs fictional offline cases,
including same-posting aliases, tracking URLs, distinct requisitions and functional
URL parameters, explicit prior-run history, ownership failures and the real MCP
transport to the copied child. Matching lives in pinned `scan.mjs`, `url-key.mjs`
and `dedup-tracker.mjs`, not a new Lookout fuzzy matcher. This boundary does not
claim the entire upstream scanner loop or automatic historical-report reuse.
The website continues to read the preserved records; this tool is the agent
shortlist boundary, not a destructive cleanup action.
