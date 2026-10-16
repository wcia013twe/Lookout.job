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

The contribution behavior below remains current. Visual descriptions of the
earlier portrait, constellation and three-view compositions are historical; the
cloud cottage and connected community noticeboard sections define the current
Circles surface.

The contribution is useful context: job link, stage and insight, with optional
company, role, experience date, public sources and uncertainty. A human message
is optional. The editor leads with insight/link/stage and tucks the message and
extra details away. Context-only entries show their insight in the stream and
open directly to factual context, not an empty social post.

The browser, demo and scoped gateway/MCP reads use the same field projection.
There are no generated execution steps, practice checklists or action plans.
Agents decide how context relates to their human's task. Copy exports only
structured context; it does not send messages, publish content or record use.
Draft context is visible only to its owner/permitted agent and marked private.
New context fields are covered by exact-revision consent, private-link validation
and the search index. Hosted migration/gateway deployment remains unverified.

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

## Earlier implemented surface (historical)

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

## Cloud cottage — October 2026

The room now leads Circles with five decorative NPC companions in a moonlit,
plush cloud cottage. They are independent of Circle membership: the room always
contains Alfred, Iggy, Felipe, Todd and Jojo, including an empty Circle. Actual
members and their shared updates remain in the constellation below. This replaces
the earlier six-human clubhouse, member pagination and seated-human station
sheets; those assets remain historical references.

The companion identities follow the five user-supplied references: yellow Alfred
with glasses and a bow tie; pink Iggy with headphones; blue Felipe with a beret;
green Todd with big eyes and a **black bow tie**; and magenta heart-shaped Jojo
with sunglasses. `companions.ts` owns canonical names, station descriptions,
greetings and fictional-member mappings. Generated transparent three-pose strips
and `cloud-cottage.webp` are authored in `next-app/assets/circles`, with exact
generation prompts in their adjacent `.webp.json` files.

Choose a companion to hear its greeting and trigger a temporary reaction. This
selects an NPC, rather than filtering real member posts. In demo mode only, the
greeting offers a separate explicit action to see the linked fictional member's
shared updates. The mapping is illustrative, not an identity or presence claim.
The greeting is announced through a polite status region.

Moonlight and Starlight lamps change the local scene appearance. Gather on the
rug moves the companions together; Back to stations returns them. These controls
and greetings write no account or backend state. Demonstration activity labels
and fixed progress bars are explicitly fictional. Real accounts show decorative
station labels, never invented agent tasks or member activity. Actual opt-in
live sessions and their scoped agent tools remain future work.

### Scoped visual contract

The cloud cottage is an illustration exception within the existing workspace.
Soft plush forms, moonlight, stars, lilac furnishings and warm activity bubbles
belong inside the room. Header, toolbar, greeting, search, membership, sharing
and the lower community UI keep the existing shared theme, sans-serif type,
keyboard-focus treatment and 44px controls in both color modes. The room pans
inside a bounded viewport on phones, retaining full-size companion controls.

NPC buttons expose the selected greeting companion through `aria-pressed` and
announce their hello action by name. Preserve the adjacent fictional-session or
decorative-companion disclosure whenever this room is reused. No global color,
typography, spacing or component-token change, or design-system sidecar
regeneration, is required. Scene styles remain in `circle-room.module.css`;
routine coordinates and playback live in `room-motion.ts` and
`use-room-motion.ts`.

### Companion routines

The five NPCs use a 44-second station / hop / break / return loop. Alfred works
at the tiny laptop desk, Iggy grooves in the music nook, Felipe plans at the
practice board, Todd reads at the table and Jojo cheers from the rug. The three
poses combine with squash, stretch, hopping and station gestures. Floor position
controls depth; overhead labels travel with companions and lift to avoid overlap.
Gather and return use animated travel from the current position.

Pause freezes routine progress and decorative animation. Hover or keyboard focus
freezes the targeted NPC for selection. Offscreen rooms and hidden tabs suspend
playback. Reduced motion removes animation and shows stationary poses; gather
and return select their destination without spatial animation. These routines,
greetings and reactions establish no live presence, completed work, shared post
or permission to publish.

### Connected community noticeboard

The lower feed connects to the cloud cottage through its constellation and recurring
illustrated characters while retaining the standard workspace theme. Its outer
surface uses the shared `glass-panel`; panels, text, dividers, accents and selected
states use semantic board tokens. Celebration actions use the shared primary
button. This applies in both light and dark mode: no wood border, green felt or
cream paper palette is applied to the community UI. The illustration inside the
room retains its own scene materials.

The board retains sans-serif names, dates and message copy, with handwriting
reserved for the featured milestone callout. A published offer reads “Offered!”.
The five companion strips supply header avatars, constellation illustrations,
post avatars and a full-body milestone companion only in fictional demo mode.
Real-account identities use initials. Demo companion mappings are decorative
illustrations of fictional authors, not additional Circle members.

The board's member constellation surrounds a central Everyone emblem. Selecting
a person there updates the member filter, and Everyone or Show everyone restores
the feed. Demo greeting links explicitly select their linked fictional member. More than eight members use a grid. On narrow
screens the constellation stacks beneath the introduction, while notes and the
celebration reflow within the board. Selection uses semantic buttons and
`aria-pressed`, with visible names and the inherited keyboard-focus treatment.

“Find a shared update” contains the existing search in a disclosure, opened for
active results. Search results take precedence over the selected-person filter.
Each conversational note keeps author, type, date and an action opening the
existing contribution detail; the featured milestone appears once. Content
still comes only from current permitted published revisions. The board changes
presentation and filtering, without adding chat, presence, posting permissions
or a new consent path. No global token or design-system sidecar update is needed.
