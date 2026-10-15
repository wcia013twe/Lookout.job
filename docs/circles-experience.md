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

## Current dashboard

The current refinement uses one people-first activity stream. A selected
published milestone can receive a compact portrait feature with a handwritten
stage annotation and curved arrow; offer stages read “Offered!”. The long story
stays in contribution details. Remaining posts appear once in the same stream,
with author, date, a short preview and contextual action. Selecting a member in
the constellation filters the stream in place; Show everyone restores it.
Separate opportunity/resource/recent-update collections below describe the
superseded composition. Header utilities and existing consent remain unchanged.

Circles is one dashboard, rather than three tabs. A featured celebration anchors
the main column, followed by opportunities and preparation resources. People and
recent shared updates occupy the supporting column. Selecting a person reveals
their published posts in place. The dashboard stacks on phones; larger Circles
use a member grid. Legacy view query parameters remain valid but select no tab.
Search replaces the content with matching posts and Clear restores the dashboard.
Header controls retain Settings, Share and conditional private draft review.
The earlier three-view composition below records the design history.

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
sharing controls. Conversation templates and delivery rules stay in design
documentation, outside the dashboard. No new social service or approval bypass
was introduced.

Signed-out visitors can explore the isolated fictional Circle directly. Six
generated fictional portraits are confined to demo data; real members use
initials. The original static preview route remains resettable. Drafts, source
search, members, permissions and private citation history remain available below
the three views.

The dashboard focuses on people, opportunities, resources and celebrations.
Circle switching, Settings and Share sit beside the Circle name. A draft-review
action appears there only when the loaded results contain a private draft.
Overview has an inline search with optional filters and in-place results; Clear
restores the normal overview. Settings contains membership, invitations, agent
permissions, refresh and private citation history. These utilities no longer form
a separate stack at the bottom of every view.
Drafts sit in a compact disclosure; review shows the posting identity, destination
and exact message. Member management, permissions and private receipts remain
in secondary controls. Shared activity honors the loaded search results; it is
not a scheduled digest. The fictional Circle uses resettable memory.

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

## Clubhouse room — October 2026

The shared room now leads Circles. A full-width illustrated study clubhouse has
six gently roaming character avatars with activity above their heads. Select a
character to filter that member's published updates below, and Show everyone to
restore the feed. Search, contribution inspection, sharing, revision review and
membership controls keep their existing behavior. Circles larger than six use
Previous people / More people to explore the room's members in groups.

Rainy evening and Lamplight change the local scene's appearance; Pause motion
stops character movement. Reduced-motion preferences disable it automatically.
The room pans horizontally on phones, retaining readable activity labels and
full-size character controls. None of these presentation controls writes account
or backend state, and they need no new service or MCP operation. Shared posts
still use the existing `knowledge.search` / contribution operation boundaries.

In the resettable signed-out preview and admin demo, fictional members show
example sessions: Wesley applying, interview practice, final-round preparation,
opportunity review, a coffee break and an offer celebration. Session bars are
fixed illustrative task completion, never fabricated live progress. Real Circle
activity derives only from the currently loaded permitted published revisions;
a member without a matching shared post gets “No shared activity.” Room positions
and motion never imply that members are currently online. Actual opt-in live
sessions, session-progress writes and their scoped agent tools remain future work.

### Scoped visual contract

The illustrated clubhouse is a local Circles exception within the existing navy
workspace. The identity header, search, settings, sharing controls and published
activity stream retain the shared board colors, sans-serif type, focus treatment
and 44px controls. The room replaces the constellation as the main member
selector; the single shared-update stream and compact handwritten milestone
feature continue beneath it. Earlier constellation and three-view descriptions
above remain design history.

Warm timber, lamplight, cream activity bubbles and green selected bubbles belong
to the room illustration and character controls. Keep these materials inside the
room CSS module rather than promoting them into workspace tokens. The generated
clubhouse background and transparent character sheet are authored in
`next-app/assets/circles`; their optimized public copies supply the scene.
Illustrated avatars are decorative member representations, with visible names
and published activity providing identity and meaning.

The scene retains its spatial composition in a bounded horizontal viewport on
small screens. Character buttons expose selection through `aria-pressed`, keep
activity in their accessible names, and pause movement on hover or keyboard
focus. Pause motion and reduced-motion support are part of this component's
contract. Ambience changes affect only the illustration. Preserve the adjacent
fictional-session or decorative-motion disclosure whenever this room is reused.

This extension requires no global color, typography, spacing or component-token
update, and no regeneration of the design-system sidecar. Its one-off scene
materials and motion remain scoped here and in `circle-room.module.css`.
