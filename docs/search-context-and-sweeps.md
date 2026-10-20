# Personal-agent search context and portal sweeps

Lookout is a career context harness. Any connected personal agent supplies search,
browsing, screening, reasoning and execution. Lookout stores versioned instructions,
search evidence and progress. No hosted scanner, fixed agent vendor, local Career Ops
installation, required runner or automatic schedule is introduced.

## Canonical context

Search profiles are Markdown with YAML frontmatter: id, name, active, filters and
priorities; the Markdown body owns narrative exceptions/goals and company-list
references. Rules belong to the selected profile under `Profile evaluation / Rules`. The legacy shared house-rules document is retained for reference and explicit one-time copying, never as a live global override or candidate evidence.
Shared portals YAML owns tracked_companies, search_queries, title_filter and
location_filter. Sources use id/name/kind/careers_url/enabled with optional provider,
api and keywords. No arbitrary executable/parser configuration is accepted.

YAML input is normalized into JSON-compatible YAML (JSON is valid YAML). Comments
in structured source configuration are normalized away; Markdown prose is retained.
The database independently parses the canonical representation, validates fields,
and updates the document revision and existing settings projections atomically.
It never trusts a caller-supplied projection. Existing profile/target controls route
through that same writer; their versions remain compatible. Generic autosync cannot
overwrite these projections. The scoped document APIs retain exportable content and revision history; the profile UI uses its rules field and Advanced instructions instead of global configuration editors.

Candidate facts, verified answers, company tier lists, resumes, applications,
approvals and submission attempts remain their existing canonical records.
Sources/queries are distinct from desirability. New users get explicit gaps, not
someone else's targets. Source templates are optional suggestions, not activation.

## Agent protocol

1. Check context versions; reload both contexts on first connection or lost memory.
2. Load `read_guide({id:"career-find-jobs"})` and `read_search_context(profileId)`.
   The response includes only selected/shared documents and a lightweight profile index.
   Run lists return summaries; read an individual run for its pinned snapshot.
3. Read active runs and resume or `start_search_run`. Fresh defaults to 3 days,
   backlog to 30; choose an explicit supported window when asked.
4. Use your own browsing/search. Process pinned enabled portals and broad queries.
   Save private listings and archived JDs through `save_search_discoveries` in bounded
   chunks. Observations include liveness/evidence, checkedAt, employerPostedAt and
   sourceListAgeDays. Missing values remain null. Source age never establishes a date.
5. `record_search_progress` checkpoints every source with counts, blocker and coverage
   (unknown/exhaustive/truncated/inaccessible). Interrupted runs remain active.
6. Read discoveries with offset/limit pagination. Canonical URL/ATS identity dedup
   preserves separate requisitions and flags company/title/location similarities.
7. Read each discovery’s screeningVersion for the next expectedVersion; displayed
   decisions and observations belong to the requested run. `save_search_screening`
   pins runId/listingId and records experience, graduation, availability, location,
   authorization, prior-application and company-limits evidence. Eligible requires a
   fresh active observation, actual location, archived JD and resolved checks.
   Unknowns require review. This validates the evidence shape, not agent truthfulness.
8. Publish selected verified roles with existing `publish_batch`. Put
   searchListingId/searchRunId in the private recommendation to retain provenance.
   Canonical URLs also link discoveries to published jobs and prior applications.
9. `finish_search_run` completes exhaustive work or records partial/cancelled results.
   Queuing, discovery, screening and publication never count as application submission.

All writes use stable eventKey retries; identical retries return their original
response even after subsequent edits. Changed requests need a new key. Expected
versions prevent stale document, source, run and screening writes. Run snapshots
preserve context revisions; changed context is flagged on read, not rewritten.
Screenings retain revisions and should be explicitly reconsidered after context changes.

The UI's Request sweep uses `request_search_sweep` to queue an existing discovery
task. The personal agent polls/claims it, reads target.searchProfileId/mode and
starts/resumes work. Reclaim before the five-minute lease expires to renew a current
search task. Report completed with result.searchRunId and summary only after an owned
run finishes completed/partial, including legitimate zero-result sweeps. This does not
weaken legacy onboarding tasks' evidence requirements or non-search task boundaries.

## Website and MCP parity

Both use the same owned search boundary. Hosted tools expose context/document
writes, run start/read/finish, source progress, discoveries read/write, screening,
revision history and sweep requests. Browser `search_action` only permits context
configuration, reads and queued requests; it cannot fabricate agent execution.
Scope checks follow existing workspace:read/preferences:write/drafts:write grants.
Tables are owner-readable under RLS and not directly client-writable. No SQL tool.
Optional local provider configuration uses the existing source_config write to save
canonical portals and its retry receipt in one transaction. Historical source_config
outputs are not a second configuration authority.

## Migration and release

The migration converts existing Lookout profiles, custom prose, target IDs and latest
provider hints. Existing scan blobs remain historical; no synthetic observations or
personal career-ops import is performed. Current applications and permissions remain.

Release the migration, gateway (including search document bundle and developer
version), hosted MCP registry, and static UI together using normal reviewed production
release procedures after local landing. Local landing/build does not deploy backend
functions. Rebuild bundles with `node scripts/build-search-documents.mjs` and
`node scripts/build-career-toolkit.mjs`; tests check reproducibility.

Before advertising deployed availability, use a dedicated test account with only a
hosted MCP connection and the agent's browsing tools. Configure context, run a small
sweep, interrupt after a checkpoint, reconnect without conversation memory, resume,
verify employer evidence, and publish a private batch. Compare UI and MCP records;
check a blocked source, unknown dates, a duplicate and zero-result completion. No
application should be submitted. Record live source failures and runtime limitations.

Local verification includes transactional migration/security scenarios, exact retry
and version conflicts, account isolation, guide loading, generated-code checks,
fictional demos, frontend typecheck/build and desktop/mobile visual inspection.
Those checks alone do not establish hosted availability or live agent integration.
