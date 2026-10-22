# Circles storage and personal-agent design

The first migration slice adds structured member activity to existing immutable
contribution revisions. Chat, experiences, resources, offers, membership and
invitations already have a backend implementation. Circles remains release-gated;
this document distinguishes local implementation from proposed follow-up work.

## Start with what the page actually contains

| Page element | Durable storage | Current boundary |
| --- | --- | --- |
| Circle name and owner | `private.circles` | Invitation-only; human creates/manages |
| Member alias and sharing policy | `private.circle_members` | Membership checked on every operation |
| Invitations | `private.circle_invites` | Expiring/revocable, secrets human-only |
| Chat and replies | `private.knowledge_posts`, `private.knowledge_revisions` | Discussion posts; replies reference a parent |
| Experiences, job/round context, offer comparisons | Same post/revision tables | Validated typed content; explicit shared snapshots |
| Resources and source links | Same post/revision tables | Source-linked resource posts |
| Highlights, weekly goal, help request | `knowledge_revisions.content.activity` | New structured, member-reported fields |
| Review and publication | `private.knowledge_approvals`, post's `published_revision` | Exact immutable revision and destination |
| Agent-reported use | `private.knowledge_citations` | Private receipts, aggregate count; reading is not use |
| Reports and retry protection | `private.knowledge_reports`, `private.knowledge_requests` | Moderation and idempotency |
| Companion position, selected person, open panel | React state | Decorative/transient; no presence claim |
| File attachments | Local preview only | Persisted upload service is still a separate feature |

The signed-out preview and Admin Demo are fictional, resettable memory. Never
import their people, activity or job examples into real Circle tables. The signed-in
page already uses `knowledge_action`; confirm hosted migration history and the
release gate before assuming those tables or operations are live.

## Keep the schema lightweight

Use relational columns for identity, membership, parent relationships, revisions,
publication and access. Keep small type-specific payloads in validated JSONB on
the immutable revision. A resource, goal or offer does not need its own service
or table until independent querying or lifecycle requirements justify one.

The first slice adds:

```json
{
  "type": "discussion",
  "activity": {
    "highlights": ["Completed a practice interview"],
    "goal": "2 of 3 preparation sessions complete",
    "help": "A partner for my project deep dive"
  },
  "personalDisclosure": true
}
```

This is part of ordinary contribution content, alongside title/body, sources and
provenance. Highlights allow up to three nonblank strings, each at most 300
characters. Goal and help are strings up to 300 characters; all three keys are
required and at least one field must be nonempty. Unknown keys reject. Only
discussions with personal disclosure may carry activity. Existing private-link
validation applies inside activity too.

New website activity drafts store these fields, retaining the formatted text for
older readers. The review surface explicitly shows structured values, including
agent-written updates whose body contains no formatted activity. Cards and editing
prefer structured values; legacy reviewed text remains a fallback. Historical
revisions and approvals are never rewritten. Editing an old post produces a new
revision through the ordinary review flow. Do not bulk reinterpret old prose as
verified application events. Search indexes structured activity as well as text.

## Personal-agent tools

Website and MCP use the same validation, ownership, revision and publication
checks. Tools operate for the connected human; callers never supply an owner ID.

| Agent task | Existing scoped MCP tool |
| --- | --- |
| Find my Circles and understand membership/policy | `list_circles`, `read_circle` |
| Find relevant reports, resources or shared updates | `search_circle_knowledge` |
| Read a particular contribution and replies | `read_circle_thread` |
| Draft an activity update, resource, experience or reply | `propose_circle_contribution` |
| Ask the human to review sharing or manage membership | `request_circle_human_action` |
| Publish an approved exact revision | `publish_circle_contribution` |
| Withdraw or report shared content | `withdraw_circle_contribution`, `report_circle_contribution` |
| Record actual cited use; correct an erroneous receipt | `record_knowledge_citation`, `retract_knowledge_citation` |

Structured activity uses existing `knowledge:read` / `knowledge:write` scopes and
appears in `agentContext.activity`, copied from the permitted revision. It does not
add a tracker lookup or automatic sharing permission. Agent-authored personal
updates require human exact-revision review. These capabilities are locally
implemented; production parity awaits deployment and hosted verification.

## Proposed next slice: a feed an agent can read

Assumption for the first feed: updates intentionally shared by Circle members.
External news can later be source-linked resource/opportunity contributions with
observed time and uncertainty, independently verified when used for job advice.
An external-news ingestion service is not implemented in this slice.

Add one table, `private.circle_events`, containing event ID, Circle ID, source
post ID, immutable revision, event kind and server timestamp. Do not duplicate
post bodies, private application IDs, email evidence or agent memory. Initial
kinds: published, revision published, withdrawn, hidden. A unique publication
constraint prevents retries from making duplicate events.

Create events transactionally with successful publication or visibility changes.
Drafts and private tracker changes emit no shared event. First release can start
with future publications; older knowledge stays searchable. An optional historical
baseline must use real published revisions and mark its unknown publication time,
rather than fabricate event dates from post creation times.

Proposed tool: `read_circle_feed({circleId, after?, limit})`, read-only with
`knowledge:read`, exposed through the same browser RPC and MCP dispatch. Return
bounded ascending events, stable IDs, published source revisions, source links,
and a continuation cursor. A withdrawn/hidden source yields a minimal invalidation
record for eligible prior readers, never its body. Recheck current membership and
source visibility on every page. Never return an author's newer private draft in
place of the published revision.

The cursor needs a committed, per-Circle order: serialize event allocation with
the existing Circle transaction lock, then read a fixed upper boundary for each
scan. A bare global sequence can skip a slow transaction that commits after a
later sequence value; wall-clock time alone also fails. Bind cursors to Circle,
filters and scan boundary. Reading must not change the cursor or mark delivery.
An agent stores its last successfully processed position; a lost cursor permits
safe replay using event IDs. Shared published content remains untrusted evidence.

Example: a friend publishes a query-planning experience. Your agent reads its event,
compares it with your private upcoming preparation, then suggests a useful exercise
with the source link. It records a citation only after actual use. The contributor
never sees your private plan. Reading does not send a text or publish a reply.

## Delivery is a later, separate capability

Do not add a delivery queue just to read updates. When multi-agent digests and
notifications are needed, add owner-only `circle_delivery_preferences` and
`circle_deliveries`: cadence/timezone/quiet hours/mutes, then recipient, source
revision, channel, idempotency key and delivery state. Reading a feed, processing
an event, citing it and actually delivering a message are separate facts.

Proposed tools at that stage: read/update social preferences, preview/claim a
digest and report its delivery result. Human preferences use version checks;
claims expire, but uncertain provider outcomes require reconciliation before
resending. Deduplicate per recipient/event across all their agents. Revalidate
membership, visibility and preferences immediately before dispatch. The app needs
a connected runtime to send messages; database rows alone do not send them.

## Migration and release order

1. Apply and test the structured-activity migration locally. Exercise browser RPCs,
   actual MCP dispatch, private drafts, old published revisions during edits,
   exact approval, invalid/private fields, removal and fictional demo reset.
2. Land the source into local main. Deploy migrations and gateway instructions
   through the existing production workflow from main; never a feature branch.
3. In isolated hosted staging, verify grants/RLS with real accounts and scoped
   agents, revocation races, expired credentials and account switching. Keep the
   existing production gate until its documented checks pass.
4. Implement the event feed and website consumer together, with MCP tests for
   pagination, concurrent publication, invalidation, repeated scans and removal.
5. Add opt-in digest preferences and a delivery ledger only when a verified
   runtime can deliver. External news ingestion and persistent files remain
   explicit follow-up decisions.

Private tables retain revoked direct grants and RLS, with checked RPCs as the API.
See the [Supabase access-control guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)
and the existing [Circle backend contract](../backend/circle-knowledge.md).
