# Private company workspace

Network retains `/referrals/` so existing links keep working. Its company grid
combines saved private companies with unsaved company-name matches from existing
contacts and tracked applications. A research-only company needs neither a
contact nor an application. No shared company profile is created.

A company owns personal interest, priority, target teams, concerns, research,
HTTPS source links with observation dates, a next action and optional follow-up
date. Public observations and personal judgments have separate fields. Saved
priorities are organization metadata; they do not overwrite company tier lists,
application statuses or the interview-preparation budget.

Overview shows research and next action. People & outreach reuses the existing
contact/message editor and backend. Applications opens the existing application
dialog with documents, preparation and timeline. Exact normalized company names
match automatically; explicit contact/application links support company aliases
and people helping several processes. Explicitly linked aliases do not generate
duplicate unsaved company cards. Name matching is a convenience, not proof of a
contact's relationship to a particular job. Recruiter thread synchronization and
shared intelligence feeds remain unconnected.

## Storage and transport

`network_companies` is owner-scoped with RLS and no direct client mutation grants.
Browser `network_action(operation,payload,p_expected_owner)` derives ownership
from `auth.uid()` and rejects stale account identity. The trusted
`agent_network_dispatch` verifies credential expiry/revocation and scopes, then
calls the same private action and validation as the browser. Authenticated clients
cannot call that trusted dispatcher or the private helper directly.

| Website action | Scoped MCP tool | Scope |
| --- | --- | --- |
| Read company grid and due actions | `read_network_companies` | `workspace:read` |
| Add/edit company, research/sources, links, follow-up, archive/unarchive | `save_network_company` | `network:write` plus `workspace:read` |
| Read/edit contacts and drafts | Existing `list_contacts`, `save_contact`, `delete_contact`, outreach package tools | Existing contact/outreach scopes |
| Open application workspace | Existing workspace, preparation, timeline and submission-record tools | Existing application scopes; approvals stay human-only |
| Copy research request | `read_guide("career-research-company")` plus company read/save | Copy is a human handoff, not execution |

`read_network_companies` accepts offset and limit (1–100) and returns companies
plus total. The frontend walks pages. Each result has `id`, `record`, `revision`
and `updated_at`. Create with UUID id and expectedRevision 0. Updates require the
current revision; exact retries of the preceding save replay without incrementing
again. Changed stale writes reject. Normalized company names are unique per
owner, including archived companies. Links must refer to existing owned contacts
and applications; unavailable links can be removed in the editor. Agent writes
must preserve human priorities and archive only when requested.

Guests use browser storage. Signed-in records are read/saved through the owned
RPC and poll every 15 seconds and on focus. Errors keep the editor draft for
retry; stale conflicts require reviewing the newly saved record. Guest records
stay in their guest namespace; automatic guest-to-account migration is not added.
Demo companies use the isolated resettable memory store and make no company RPCs.

## Research and organization

Copy research request gives the agent an explicit instruction to load the Career
Toolkit company-research guide, retrieve saved findings before browsing, verify
missing/stale facts and save private research with real source dates. It does not
queue research, wake an agent, install tools or send messages. Gateway developer
version 30 documents this workflow. Older connections need network:write enabled
by the human before company maintenance is available.

Due and overdue dated company actions appear on the Action Board in the account's
quiet-mode timezone (UTC fallback). Opening takes the user back to that company.
Clearing/changing the date or archiving the company updates reminders; no action
is auto-completed and no notification schedule is activated. These reminders are
separate from the shared interview-practice time allocator.

## Verification and release

Unit tests cover validation, aliases, reminders, tool discovery and resettable demo
fixtures. Database scenarios exercise shared browser/agent revisions, exact retry,
RLS, account changes, scopes/revocation, sources, duplicates and foreign links.
`scripts/check-network-ui.mjs` intercepts account traffic with fictional fixtures
and checks signed-in company saves, contact retry recovery, desktop/mobile grid
and detail, sourced research edits, application opening, outreach, follow-ups,
archive and demo reset/isolation. It is an optional browser check, outside npm test.

Release the new migration, gateway/config, remote MCP and static frontend through
the normal production workflow after local integration. Local tests and intercepted
browser fixtures do not establish live account or deployed MCP parity. No external
company enrichment service, shared database or background researcher is installed.
