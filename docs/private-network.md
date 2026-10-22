# Durable company Network

Network keeps `/referrals/`, Targets → company detail → Overview, People & outreach,
Applications, and Circle intelligence. Active processes stays application-scoped.
Company research is private; opening a suggestion or reading intelligence writes no
company, workspace, contact or application record. Opening application links is not applying.

## Authoritative records

`public.companies` is the maintained identity registry: UUID, canonical name,
optional domain, explicit aliases. Only maintainers/service role can write it;
website and agent tools cannot. The initial registry includes Databricks, NVIDIA,
Together AI, Oracle, Stripe and Snowflake. Add other companies through reviewed
migrations. Parents, subsidiaries and brands are separate unless explicitly aliased.
Ambiguous names remain unresolved, even when a domain might narrow them.

`public.company_workspaces` owns a person's target: owner + existing **text** target
ID, optional registry ID, typed research/priority/team/concern/action/follow-up/archive
columns, dated source objects, bounded explicit contact/application IDs and revision.
One linked workspace per owner/company is enforced. Unknown companies are valid
private targets. Duplicate legacy targets remain separate, unresolved, review-marked
records. The list keys saved rows by workspace ID, so neither duplicate disappears.
Private name/website edits re-resolve identity and never change the registry.

Contacts, applications, shared postings and Circle revisions retain their own
records and permission boundaries. Posting `company_id` and contact `company_id`
are derived from the registry at write time. Explicit links associate already-owned
records; they cannot fetch another person's private data. Matching uses explicit
links and known identities, with normalized names for unresolved legacy records.
A process contact still requires an explicit application tag or exact posting URL;
company/role similarity does not prove process involvement. Requisition `jobId` in
Circle context is an employer ID, never the internal posting or application ID.
Canonical URLs retain requisition query parameters.

## Website and MCP boundary

Browser `company_action` and scoped agent dispatch call `private.company_actions`:

| MCP tool | Operation | Scope / arguments |
| --- | --- | --- |
| `list_companies` | `companies.list` | `workspace:read`; optional exact name/alias `query`, `limit` 1–100, nonnegative `offset` |
| `list_company_workspaces` | `company_workspaces.list` | `workspace:read`; optional `limit` 1–1000 and `offset` |
| `save_company_workspace` | `company_workspaces.save` | `network:write`; `id`, complete `record`, current `expectedRevision`; optional matching `companyId` |

A new target uses expectedRevision 0. Complete record fields remain
`name, website, priority, interest, targetTeams, concerns, research, nextAction,
followUpDate, sources, contactIds, applicationIds, archived`.
Sources are `{title,url,observedAt,summary}`; dates are actual observations, not
invented employer dates. Archive is a revision-checked save. Follow-ups retain
existing Action Board navigation, timezone and due-action behavior.

Legacy `list_contacts` exposes company-shaped compatibility projections, including
current revisions. `save_contact` with `collection: companies` routes into the
workspace service; `delete_contact` archives that workspace. Neither writes an
active company contact. Obsolete direct company-contact saves fail with a
reload-required response. People and company browser caches are separate.

## Migration and browser sync

The additive migration imports all company-contact targets transactionally,
preserving IDs, owners, available timestamps, revisions, archive flags, fields,
links and URLs. Original notes stay verbatim in `legacy_notes`; retired outreach
rows remain recovery evidence and cannot be resurrected. Malformed notes remain
verbatim research with a review marker and any valid legacy follow-up date.
The old contact schema has only `updated_at`, so it supplies the imported initial
timestamp; an unavailable earlier creation timestamp is not invented.

`importLegacyCompanies` moves guest and owner-local legacy company records out of
people storage idempotently. Sign-in imports guest targets by ID into the owner
namespace while retaining the guest copy. Account switching never copies one
owner's targets into another account. Dirty local revisions survive hydration,
offline writes and retries. Conflicts preserve local research and pause writes;
**Discard draft & reload saved company** explicitly resolves them. Lost successful
responses reconcile against the saved content/revision without another write.

## Circle intelligence

The tab calls `search_circle_knowledge` / `knowledge.search` with
`scope: current_memberships` and either `companyId` or unresolved `company` text.
`circleId` remains supported for a single Circle; its company filter uses the same
resolver/search. Scope and circleId are mutually exclusive; company ID and text
are mutually exclusive. Optional `authorId` uses server-derived IDs. Aliases are
presentation only, including member activity grouping.

Cross-Circle retrieval selects permitted **published revisions**, including for
one's own posts with newer private drafts. Primary company, application/referral
contexts and individual offers are searched. Combined company/role/stage filters
must match one entry. Membership, visibility, author and context filters run before
cursor pagination. Each root post appears once; replies remain in the source
thread, and distinct people's reports are retained. Results include Circle labels,
experience dates (or unknown), context and source-thread navigation.

Company identity backfill is derived metadata (`companyContexts`), never a rewrite
of approved revision JSON. New optional company references must match registry
names. Attached references do not grant private-record access or bypass existing
exact-revision publication review. The existing Circle release flag remains intact.

## Validation and rollout

`tests/company-hub.test.mjs` covers transactional imports, malformed notes,
duplicates, unknown companies, aliases, canonical URLs, revision conflicts,
compatibility projections, offline/lost-response recovery and owner isolation.
The Circle suite covers both browser RPC and MCP paths, consent, unpublished edits,
visibility, membership removal and pagination. The resettable fictional admin demo
covers research-only targets, an archived malformed duplicate and company
intelligence. `scripts/check-network-ui.mjs` intercepts fictional account traffic
for Network desktop/mobile, persistence, retry, research, process isolation,
intelligence and follow-ups; it never writes a real account.

Local implementation is not a hosted release. Release additive backend support
from reviewed main through the production backend release process first; inspect
migration history and dependencies, run migration verification and two-account
hosted permission checks, deploy gateway/MCP plus developerVersion, and only then
publish the dependent frontend to the connected Site. Keep Circle release gates
closed until their existing hosted verification passes. Do not deploy feature
branches to the shared backend.

At implementation time the connected backend's migration history lacks the Circle
foundation and several local contract migrations, and this repository has no
backend deploy workflow. Reconcile those prerequisites through the production
release process before applying this migration. Do not blindly replay all local
migrations over a divergent hosted history. Until that is done, hosted Network
workspace persistence and intelligence parity are unverified and the dependent
Sites frontend must not be released. Existing hosted frontend stays available.
