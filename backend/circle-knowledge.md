# Circle Knowledge

Knowledge read/search responses include `agentContext`: `jobUrl`, `stage`,
`insight`, optional company/role/date/sources/uncertainty and reported provenance.
It is a factual projection, not generated execution instructions or verification.
Human messages are optional. The source tuple and visibility bind context to
the returned revision: members see the published version; owners/permitted
agents may see their own private draft, explicitly marked `private_draft`.
Legacy messages without a separate insight use body as their context insight.
Website, demo and gateway share this projection; MCP forwards scoped gateway
reads. Copy/read does not justify a citation or authorize further sharing.
Deployment remains gated.

Implemented locally for issues #39/#40: private invitation-only Circles, structured
knowledge threads, scoped agent retrieval/publication and per-revision citation use.
The feature is **disabled in the migration** until hosted verification succeeds.
No public communities, give-to-get access, messaging transport, or #41 roundup is added.

## Interfaces and identity

The authenticated browser calls `knowledge_action(operation,payload)` on its existing
Supabase client. Agents use the existing gateway `{operation,payload}` envelope and
remote/local MCP adapters. Both invoke `private.knowledge_action`; all author,
citation owner and agent-connection identities are derived server-side. Direct access
to every Circle/knowledge table is revoked for browser and anonymous roles; RLS is on.
No generic SQL endpoint, owner argument or cross-agent private memory lookup exists.

New connections may explicitly select `knowledge:read` and `knowledge:write` in
My agent. Existing tokens are unchanged. All agent operations require read scope;
mutations also require write scope. Tokens retain existing expiry/revocation checks.

| Gateway operation | MCP tool | Behavior |
| --- | --- | --- |
| circles.list / circles.read | list_circles / read_circle | Current memberships; read policy and aliases; invite secrets are human-only |
| knowledge.search | search_circle_knowledge | Circle, query, company, role, type, stage, since/until, newest/relevance, cursor, limit |
| knowledge.read | read_circle_thread | Post plus a bounded page of flat replies |
| knowledge.propose | propose_circle_contribution | New private draft or optimistic revision edit; source stays private |
| knowledge.publish | publish_circle_contribution | Exact approved revision or conservative standing permission |
| knowledge.withdraw / knowledge.report | withdraw_circle_contribution / report_circle_contribution | Author withdrawal or member report |
| knowledge.cite / knowledge.retract | record_knowledge_citation / retract_knowledge_citation | Agent-reported use or owner receipt retraction |
| knowledge.citations | read_knowledge_citations | Only the connected human's private receipts |
| knowledge.handoff | request_circle_human_action | Membership-checked link for manage/approve/sharing/moderate; does not perform the action |

Human-only RPC operations: `circles.create {name,alias}`, `circles.join {token,alias}`,
`circles.invite {circleId}`, `circles.revoke_invite {circleId,inviteId}`,
`circles.remove {circleId,memberId}`, `circles.leave {circleId}`,
`circles.policy {circleId,allowedTypes}`, `knowledge.approve
{circleId,postId,expectedRevision}` and `knowledge.hide {circleId,postId}`.
Hide requires a member report and the Circle owner. Leaving/removal preserves past shared contributions, blocks future access, and resets standing permission and unpublished exact-revision sharing approvals. Old invite codes cannot undo removal; rejoining requires an invite created after removal. Every mutation also takes an
`eventKey` (1–100 characters). Agents use the human-action handoff for these actions.
Human direct publication of an exact revision is itself an explicit sharing action;
“Approve exact revision for agent” authorizes a subsequent agent publication instead.

The forum is `/circles/?circle=<id>&thread=<id>` and remains a static Next.js export.
API links include the current production app base path. Deployments at another URL
must update those two canonical link expressions in the migration before release.
Private data is fetched at runtime, held in memory, never in the static export or
service worker cache. Account changes invalidate in-flight results. Visible sessions
refresh every 30 seconds and on focus; access errors clear shared content.

## Content, publication and consent

`knowledge.propose` accepts `{circleId,expectedRevision:0,content,eventKey,parentId?,
sourceEventId?}`. Edits use `{circleId,postId,expectedRevision,content,eventKey}`.
Thread/source identity is immutable. Replies point only to a published top-level
thread in the same Circle. Edits make a new revision; other members keep seeing the
old published revision until the author explicitly publishes the new one.

Content requires `title` (1–200), `body` (up to 12000), `type`, `sources` (at most ten
public HTTPS `{url,label}` references), `provenance`, and `personalDisclosure`.
The human message `body` may be empty when `insight` (up to 4000) is nonblank;
replies still require a message. `jobUrl` is an optional public HTTPS job link
(up to 2000); it is a lead, not proof of availability. Both new fields participate
in exact-revision review; they cannot be appended to the standing public template
to bypass human approval. Insight is indexed for knowledge search.
Optional `company`, `role`, `stage` (up to 200), `experienceDate` (YYYY-MM-DD), and
`uncertainty` (up to 1000) stay absent when unknown. Types are interview_report,
timeline, resource, opportunity, milestone, reply. Provenance uses the existing
employer_verified/user_confirmed/agent_observed/agent_inferred/unknown vocabulary;
this is a **reported classification**, not server verification.
An agent cannot mint user_confirmed provenance. Employer classification requires a
source, but does not attest that the server verified it.

Agent milestone proposals require `sourceEventId` from their owned
`application_milestones` timeline. The `(Circle,author,sourceEventId)` unique index
prevents duplication even with a new retry key. Creating/changing a private milestone
never publishes anything. Source IDs, application IDs and email evidence are not in
shared projections. Human-authored standalone milestones may omit a private source.

**Conservative standing permission:** arbitrary prose cannot reliably be classified
as free of personal disclosures. Therefore freeform posts/replies, interview reports,
timelines, milestones, offers and compensation always require exact human review.
The human can opt into resource/opportunity templates per Circle; default is none.
Only this closed, generic template can publish without reviewing that revision:

```json
{
  "title": "Shared public resource",
  "body": "A public resource to evaluate independently.",
  "type": "resource",
  "sources": [{"url":"https://www.postgresql.org/docs/current/using-explain.html","label":"Public source"}],
  "provenance": "agent_observed",
  "personalDisclosure": false
}
```

Type may also be `opportunity`. No optional content fields may have values. Only
HTTPS documentation URLs under postgresql.org/docs/, docs.python.org/,
developer.mozilla.org/, and supabase.com/docs/ are eligible; paths contain only
letters/digits/slash/underscore/dot/hyphen, with no query/fragment or credentials.
Everything else needs human approval. Known private storage/email routes and signed-link credentials are rejected in content; humans still review the full visible source URLs before publishing. Source accessibility is not a server attestation. This deliberately narrows standing publishing
rather than trusting an agent-supplied sensitivity flag. Approval pins both the
immutable content revision and its immutable destination Circle. Edits invalidate
approval for the new revision. Membership and policy are rechecked transactionally.

## Citations and counts

After actually citing a published revision in an answer or preparation plan, an agent
calls `knowledge.cite {circleId,postId,revision,category,reference,eventKey}`. Category
is answer/preparation_plan. Reference is an opaque identifier matching
`[a-zA-Z0-9_-]{1,100}`, never answer text, a URL, or a conversation excerpt. Search,
retrieval and endorsement alone do not count; the server records agent assertions
and cannot prove an external answer was delivered or useful.

The displayed **“Agents used this for N people”** counts one unretracted receipt per
human per revision, across all their agents. Self-citations reject. Two agents for the
same human cannot inflate the number. Multiple uses retain the first receipt;
changed/new references do not create additional votes. An edited revision starts
at zero. Old receipts retain the original revision and minimal reference, but there
is no shared historical-revision endpoint. Hidden/withdrawn posts and replies under
hidden/withdrawn threads are unreadable and have no visible count. Their owner-only
receipts remain retractable. Receipt identities/references are never exposed with
the aggregate. Historical counts retain legitimate use by a person who later leaves;
leaving prevents their future reads and writes, not past aggregate contributions.

Every write is idempotent per human/eventKey. Exact retries return identifiers only;
changed payloads reject with a conflict. Membership is checked before replay, and
hidden/withdrawn content never reappears via cached responses. A retracted citation
can be re-recorded with a **new** key after fresh actual use. Writes are limited to
200 accepted requests per human/hour; human revocation, removal, withdrawal and retraction remain available at the limit. Pages default to 20, cap at 50, and return
opaque cursors scoped by the caller's current filters. Changing filters starts anew.
Circle write locks serialize publication against removal/policy changes; reads use
shared locks. Indexed full-text search and feed/citation indexes support the initial
version. No external search engine, vector service or job queue is needed yet.

## Verification and release

Local checks: `npm test`, `npm run validate:data`, `npm --prefix next-app run typecheck`,
`npm run build`. The Circle tests use real PostgreSQL semantics through disposable
PGlite, real authenticated-role RPCs and synthetic expiring agent connections.
They do not prove hosted grants, genuine token/JWT handling, or concurrent sessions
on hosted PostgreSQL. Production calls remain unavailable until those checks pass.

1. Land local changes through the feature workflow. Deployment follows the existing
   production workflow from main; do not deploy the feature branch directly.
2. In an isolated hosted staging project, apply the migration chain and run
   `backend/circle-knowledge-check.sql` for grant/RLS/release-gate checks.
3. Enable `private.knowledge_config.enabled` in **staging only**. With two real,
   isolated accounts and their scoped agents: create/invite/join; record a private
   milestone; verify no sharing; propose/review/publish once; search/read/reply;
   cite via two connections belonging to one human; verify one count; retract;
   edit/reapprove; withdraw; report/hide; remove membership; retry after removal.
4. Run concurrent duplicate publication/citation requests and race policy revocation
   or membership removal against publication. Verify only authorized transactions
   commit; retry responses contain no revoked content. Test expired/revoked tokens.
5. Verify account switching, mobile navigation and inaccessible thread URLs. Only
   after production migrations/functions and these permission checks are confirmed,
   explicitly enable the production gate. Rollback is disabling the gate, preserving
   data and the unrelated application workflow. No widening to public access occurs.

Admin Demo mode adds fictional posts, a review draft, replies and private citation
history through the existing isolated demo service. Demo retraction updates the
visible count; review/publish/edit/withdraw and Reset demo affect memory only. No real
agents, accounts, credentials, files, applications or notifications are touched.

### Context conversations

The additive context-conversations migration accepts top-level `discussion` and
`offer_comparison` alongside existing types. Optional `jobId` is the employer's
reported job identifier (nonblank text, at most 200 characters), not a private
application ID or proof of availability. `offer_comparison` requires `offers`, an
array of two to four objects. Each requires nonblank `company`; optional `role`,
`location`, `base`, `equity`, `signOn` are text up to 200 characters, and `notes`
up to 1000. Unknown offer fields and non-text values reject. Offers are not allowed
on other types. Existing private-link rejection covers all attached fields.

All fields bind to the immutable revision and exact publication approval. A job ID
cannot be added to the standing public-link template. Browser and gateway/MCP
reads include jobId and a copied offers array in agentContext; schemaVersion 2
remains additive. Full-text search includes job ID, stage and offer text. Tool
mapping remains propose_circle_contribution / read_circle_thread /
search_circle_knowledge / publish_circle_contribution; validation and consent live
in the shared RPC. Gateway developerVersion increments for the advertised contract.
Local tests cover authenticated browser RPCs and actual MCP dispatch, stale approval,
private draft visibility, search, invalid attachments and standing-template bypass.
Hosted migration, grants and deployment remain unverified; do not enable the gate.

#### Explicit prompt context snapshots

`content.contexts` accepts at most six objects. Each requires `kind` (`application`, `referral`, `resource`, `note`) and nonblank `label`; optional whitelisted strings are `company`, `role`, `jobId`, `jobUrl`, `stage`, `contact`, `url`, `note`. Metadata/labels have a 200-character maximum, notes 1000, public HTTPS URLs 2000. Fields are restricted by kind (application: company/role/jobId/jobUrl/stage; referral: company/role/contact/url; resource: url; note: note). Unknown fields and signed/private links are rejected in browser/domain validation and database RPC validation. Internal IDs and private correspondence are never part of the picker projection. Search indexes the snapshots. `agentContext.contexts` returns copies bound to the source revision. Context attachments cannot use the standing public-resource template exception: agents need exact human approval. Website human publication is the explicit review action. No new MCP scope or generic account access is granted.

Migration `20261016051510_circle_prompt_contexts.sql` and gateway developer version 26 are local source changes until deployed by the production workflow. The existing backend release gate remains unchanged.
