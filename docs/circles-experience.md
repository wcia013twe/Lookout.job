# Circles: conversations first

Circles helps friends make progress through their existing agent conversations.
The dashboard is a place to review a private draft, inspect a source, or manage
membership. Visiting it is not a requirement for participating.

## Design review

The incumbent navy surfaces, restrained accents, readable typography and shared
44px controls already fit a focused career tool. Preserve that visual system.
The main problem was information hierarchy, rather than decoration:

- A knowledge search and contribution editor made the experience resemble a
  forum. Lead with people and a brief view of what they deliberately shared.
- Private draft revisions appeared beside shared contributions. Separate review
  from shared activity and state the destination and posting identity explicitly.
- Provenance and source syntax dominated writing. Put the useful message first,
  then reveal optional structured context and public sources.
- Citation counts can be mistaken for gratitude or success. Describe them as
  agent-reported use; show no ranking, popularity score or empty impact count.

The scoped Impeccable scan returned no deterministic findings. That scan cannot
establish contrast, keyboard usability or the usefulness of a conversation.

## Implemented surface

### Three connected views

The recovered Impeccable comps now define a single Circle surface with
Overview, People and Moments views. A shared identity header, mountain emblem,
member portraits, lavender actions and locally hosted Caveat handwriting keep
the compositions related. Overview adapts the crew lobby, People adapts the
member constellation, and Moments adapts the achievement wall. The header and
navigation persist while an existing contribution is opened for inspection.

Views share the same permitted published post data, active Circle and search
filters. View selection is recorded in the URL and supports browser history.
People displays only voluntarily published updates, never private application
statuses. Every event opens the existing revision-aware contribution detail and
sharing controls. A common Circle brief disclosure retains the conversation
walkthrough; it explicitly labels delivery as unconnected. No new social service
or approval bypass was introduced.

Signed-out visitors can explore the isolated fictional Circle directly. Six
generated fictional portraits are confined to demo data; real members use
initials. The original static preview route remains resettable. Drafts, source
search, members, permissions and private citation history remain available below
the three views.

The signed-out introduction offers a fictional conversation walkthrough and an
isolated Circle preview. The dashboard gives private drafts priority, followed by
a short catch-up and searchable shared contributions. Shared activity is drawn
from the loaded page and honors its filters; it is not a personalized daily digest.
Member management, permissions and private receipts remain available.

Conversation scenarios show a roundup, a contextual contribution, a celebration
and real-use acknowledgment. All preview people, opportunities and interactions
are fictional. Preview choices never publish, send, update an application or edit
a real preparation plan. The Circle preview uses its own resettable memory store.

## Three implementation lanes

1. **Daily experience:** choose up to three permitted, useful updates, connect
   them to the recipient's preparation, and deliver through a verified channel.
   Build preference and receipt contracts before activating recurring delivery.
   See [daily design](circles-daily-design.md).
2. **Contribution and consent:** finish the owned task, offer one contextual
   contribution, show destination and exact text, then use authenticated human
   authorization. Preserve declines, revisions, retries and withdrawal. See
   [contribution design](circles-contribution-design.md).
3. **Optional dashboard:** expose review, source inspection and membership with
   the same backend/MCP rules. Keep conversational participation complete without
   the dashboard. The current implementation covers this supporting surface;
   hosted authorization and production release checks still gate real accounts.

## Release boundaries

This pass adds UI and isolated demonstrations. It does not activate the database
feature gate or change gateway social-sharing instructions. Scheduled roundups,
outbound milestone pushes, same-conversation human approval, explicit saves and
recipient-confirmed benefit events remain implementation work. Existing citation
receipts cannot substantiate stronger impact claims. Every new service must ship
matching scoped MCP operations and shared validation before it is advertised as
available to agents.
