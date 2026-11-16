# Agent acceptance testing

As of November 16, 2026. This is an execution checklist, not evidence that the rows pass. Run one bounded scenario at a time through Muse, then independently inspect persisted state. Record timestamps, operation/event identity, versions, expected/actual results and cleanup. Keep private profile facts, tokens, résumé bytes and signed URLs out of this repository.

## Gates and order

1. Establish connection, onboarding and accurate profile/resume context.
2. Exercise discovery, planning and draft-only application work.
3. Exercise tracking, preparation and ordinary agent maintenance.
4. Exercise failure/recovery and operational isolation using disposable fictional accounts.
5. Retest demonstrated fixes against the original scenario; require separate explicit authorization for employer submissions, outreach or sharing.

Status vocabulary: **not run**, **running**, **passed**, **failed**, **blocked**, **human action required**. A successful tool response does not establish content correctness. Record the save and an independent fresh read. Distinguish an existing record/reused draft from a newly created result.

## Acceptance cases

| ID | Priority | Scenario | Required evidence / pass condition |
| --- | --- | --- | --- |
| ON-01 | P0 | Connect to production MCP | Current tool discovery and authenticated call reach the deterministic Cloud Run origin; owner and scopes match the intended connection. |
| ON-02 | P0 | Bootstrap and guide loading | Agent reads current developer context and indexed guide versions; no reliance on stale host/token/config. |
| ON-03 | P0 | Resume existing onboarding | Read current stage/revision, perform only appropriate authorized transition with stable event key; preserve completed/paused state. |
| ON-04 | P0 | Runtime check-in | Actual browsing capability checked before agent connection_test; issued/copied credentials alone never count as ready. |
| ON-05 | P0 | Profile reconciliation | Compare canonical profile with latest explicit user facts and owned résumé evidence; identify dated evidence and unresolved conflicts. |
| ON-06 | P0 | Profile update/readback | Save only evidence-backed corrections using fresh ownership/version guards; fresh read proves changes and preservation of unrelated fields. |
| ON-07 | P0 | Human profile review | Human completes saved-profile verification; agent cannot forge review. Subsequent saved edits invalidate review. |
| ON-08 | P0 | Eligibility and graduation | Country, authorization, sponsorship and FT/intern graduation framing are explicit and consistent; unknowns remain unknown. |
| ON-09 | P0 | Résumé identity | Resolve selected owned résumé ID, version and content hash; inspect bytes/content, not filename alone; flag stale/missing variants. |
| ON-10 | P1 | Website completion and reload | Human-only website step stays human-only; reload preserves saved state without falsely reporting agent readiness. |
| ON-11 | P1 | Reconnect/scope deficiency | Expired/revoked/insufficient scopes produce the supported human handoff; retry original task after access is actually granted. |
| DS-01 | P0 | One bounded discovery | Explicit search intent; fresh employer/ATS availability and canonical URL; persisted owned shortlist and evidence. |
| DS-02 | P0 | Personal fit | Top roles cite concrete current profile evidence and one material gap; distinguish surfacing a role from accepting it. |
| DS-03 | P0 | Deduplication | URL then normalized company/title/location dedup; rerun preserves statuses and does not duplicate items. |
| DS-04 | P1 | Dates and unavailable sources | Unknown posted date stays null; stale evidence labeled; inaccessible/closed role never advertised as verified live. |
| DS-05 | P1 | FT/intern preferences | Separate types and counts; saved filters, location and upside criteria survive tool and website paths. |
| DS-06 | P0 | First-match onboarding | Owned published job ID and exact canonical URL; fresh browsing evidence; first_match transition uses current revision. |
| DS-07 | P1 | Saved search configuration | Run uses saved profile/source snapshot; later preference edits do not silently alter an in-flight run. |
| AP-01 | P0 | Request pickup | Existing task/feed identity → claim → saved draft → recorded result; independently verify each stage and timing. |
| AP-02 | P0 | Draft factual quality | Actual employer questions, selected résumé and profile agree; unanswered material facts are explicit blockers. |
| AP-03 | P0 | Targeted answer edit | Fresh draft revision and supported answerUpdates change intended answer while preserving human edits and neighbors. |
| AP-04 | P0 | Approval boundary | Preparation and auto-apply request never imply approval; editing invalidates approval for the prior snapshot. |
| AP-05 | P0 | Duplicate/idempotent request | Identical replay has one durable effect; changed payload with same key rejects; reconcile before retry. |
| AP-06 | P0 | Uncertain submission | Preserve uncertain result and evidence; no automatic resubmission or fabricated employer receipt. Use fictional harness. |
| AP-07 | P1 | Blocked/cancelled/reused draft | Honest blocker/cancellation result, no lost prior work; reused draft explicitly labeled. |
| TR-01 | P1 | Open/save/track | Opening employer link creates only expected tracker state; opening is never labeled applying. |
| TR-02 | P1 | User-reported progress | Status and provenance persist; user report remains distinct from validated submission receipt. |
| TR-03 | P1 | Planning and interviews | Plan uses real deadlines/timezones and owned evidence; preparation citations and unknowns remain inspectable. |
| TR-04 | P1 | Feedback and visibility | Like/dislike/clear and hide/unhide affect intended record; latest revision wins and unrelated preferences survive. |
| MT-01 | P0 | Change-feed acknowledgment | Agent handles named event, verifies saved result, then acknowledges; failing handler leaves work pending. |
| MT-02 | P1 | Schedule reconciliation | Enabled assigned routines match real runtime receipts, stable task IDs and timezone; reconnect creates no duplicates. |
| MT-03 | P1 | Manual pickup | Manual/disabled/unassigned work remains unstarted; unrelated runtime automations preserved. |
| MT-04 | P1 | Context refresh | Changed developer/personal/guide versions trigger correct refresh; schedule-only wake stays narrow. |
| PR-01 | P0 | Ownership and private data | Cross-owner reads/writes and expired credentials rejected; private résumé/profile never leaks through public results. Use fixtures. |
| PR-02 | P0 | Revision race | Stale update rejects cleanly; reread and reconcile preserves concurrent human edit. Use fixtures. |
| OP-01 | P0 | Operations/MCP parity | Same fictional discovery via both transports creates equivalent validated SQL job and persisted shortlist. |
| OP-02 | P0 | Missed wake | Skip immediate wake; signed Scheduler invocation recovers finite work and persists outcome. |
| OP-03 | P0 | Checkpoint recovery | Interrupt after checkpoint, expire lease, resume from GCS with no duplicate durable results. |
| OP-04 | P0 | Overlapping leases | Only current lease owner finalizes; no application-submit job claimed by discovery worker. |
| OP-05 | P0 | Webhook retries | Fictional subscription receives real delivery; temporary failure retries and recovers without duplicate acknowledged work. |
| OP-06 | P0 | IAM boundaries | Worker cannot administer Cloud Run; API cannot write staging objects; anonymous/forged maintenance rejected. |
| OP-07 | P1 | Cleanup/observability | Disposable fixtures removed; errors correlated by safe request IDs; time/cost measured without private payload logs. |

## First live run

Started through `muse-cli` on November 16, 2026: ON-01 through ON-09, beginning with read-only reconciliation. Clear existing user facts may be saved and read back. No discovery, schedule changes, employer actions or sharing is part of this first run. Human profile verification remains the user's action.

Observed results (private facts and record IDs retained outside Git):

- **ON-01 failed for the intended transport:** Muse reported its active production connection still targets the Supabase Edge MCP endpoint, not Cloud Run. Successful legacy calls do not prove the new transport works for this agent.
- **ON-05 partial:** Muse inspected the profile and compared existing facts; résumé/profile graduation framing still needs reconciliation before declaring the profile current.
- **ON-06 passed for one correction:** Muse saved one previously explicit user fact; an independent owner-scoped database read confirmed the saved value and that human verification remains unset.
- **ON-09 partial:** independently downloaded all seven owned résumé objects and verified their bytes against SHA-256. All seven are identical. A default is unset; identical bytes do not establish that this is the user's current intended résumé.
- **ON-03/ON-04 pending:** Muse reported stale onboarding connection state; requested a bounded current-runtime connection test without starting search or changing schedules.
- **Audit logging blocked:** Muse reported append_agent_audit_events returning “the operation was not replayed.” Exact payload/error reconciliation is pending; this is not yet a diagnosed backend defect.
- **CLI delivery limitation observed:** sends with --wait 0 returned accepted but were absent from subsequent transcript reads. A send with --wait 45 appeared and received a reply. Use explicit session IDs and verify transcript receipt before interpreting silence or resending.

All remaining checklist cases are **not run in this pass**. Historical deployment checks are separate evidence, not substitutes for these agent acceptance cases.

## Source references

- `docs/onboarding.md`
- `supabase/functions/agent-gateway/instructions.json`
- `supabase/functions/agent-gateway/skills/connection-schedules.json`
- `supabase/functions/agent-gateway/skills/application-workspace.json`
- `supabase/functions/agent-gateway/skills/change-resumption.json`
- `infra/cloud-run/README.md` (Required smoke and cutover evidence)
- `.agents/skills/muse-live-testing/SKILL.md`
