# Durable company Network

Network keeps `/referrals/`, Targets → company detail → Overview, People & outreach,
and Applications. Circle experiences appear in the Overview, with source conversations and optional search disclosed below. Active processes stays application-scoped.
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

The Overview’s Circle section calls `search_circle_knowledge` / `knowledge.search` with
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
The Circle suite exercises browser RPC and MCP paths, consent, unpublished edits,
visibility, membership removal and pagination. Database tests use disposable
PGlite instances, not the hosted project.

Local implementation is not a hosted release. Release additive backend support
from reviewed main through the production backend release process first. Inspect
migration history and dependencies, verify hosted two-account permissions, and
deploy gateway/MCP plus developerVersion before publishing the dependent frontend.
Keep Circle release gates closed until hosted verification passes. No hosted
migration history was inspected or changed during this integration. Do not blindly
replay local migrations over a divergent hosted history.

## Integration with current main

Network retains Outreach, Active Processes and Targets. The current company
Overview, pencil-controlled editors and Robinhood/Stripe demo scenarios remain in
place. Circle source conversations appear below the Overview, rather than in a
replacement layout or separate primary tab. Copy research request uses
list_company_workspaces/save_company_workspace. Revision conflicts expose an
explicit discard-local-draft/load-saved recovery action.

The isolated demo keeps its two current company targets, contacts and application
examples, using dedicated company rows. Shared fictional conversations exercise
company intelligence; database fixtures separately cover malformed legacy records,
permissions and conflict handling. Demo reset restores memory without account
writes, external submissions or messages.

Current logo caching and GitHub Pages hosting remain unchanged. No Sites migration,
hosted backend deployment or production parity claim is included.
