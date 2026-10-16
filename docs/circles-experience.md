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

The contribution is useful context: job link, stage and insight, with optional
company, role, experience date, public sources and uncertainty. A human message
is optional. The editor leads with insight/link/stage and tucks the message and
extra details away. Context-only entries show their insight in the stream and
open directly to factual context, not an empty social post.

Contribution details use a compact thread: author/date, usage and comment counts
and an accessible report icon in the top bar; title and an attached application
card follow. The card reuses Applications' stage renderer, highlighting only the
shared stage without inventing prior completion, dates or private application
history. Insight and the optional human message remain visible. Source/agent
context and copy controls are removed from this UI, not from scoped agent reads.
Comments use a flat thread rail with author/date and existing ownership actions.
The report icon opens the existing report form; it does not submit automatically.

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
workspace. The identity header, search, settings and sharing controls retain the
shared board colors, sans-serif type, focus treatment and 44px controls. The room
leads the experience; the connected noticeboard below supplies a second member
selector and the single published-update stream. Its current constellation and
materials are defined below. Earlier three-view descriptions remain design history.

Warm timber, lamplight, cream activity bubbles and green selected bubbles belong
to the room illustration and character controls. Keep these materials inside the
room CSS module rather than promoting them into workspace tokens. The generated
clubhouse background and transparent character, walking and station sheets are
authored in
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
materials remain scoped here and in `circle-room.module.css`; routine timing and
playback live in `room-motion.ts` and `use-room-motion.ts`.

### Station routines

Characters now use an explicit 44-second station / walk / break / return loop
rather than drifting around a fixed point. In the fictional demo, Wesley sits at
the application desk,
Priya reads at the other desk, Sam writes at the whiteboard, Alex reads practice
notes, Jordan sits with coffee, and Maya waves in celebration. Separate generated
walking frames and station poses preserve their appearance. Floor routes follow
the open aisles; direction flips and depth ordering follow the actor's position.
Overhead labels travel with the actors and lift when needed to avoid collisions.

Pause freezes the current routine without resetting its clock. Hover and keyboard
focus freeze that character for selection. Offscreen rooms and hidden tabs stop
playback. Reduced motion shows stationary station poses. These are local visual
routines, not evidence of live presence or newly completed session tasks; the
existing fictional-session and shared-update distinctions continue to apply.
For real members, station poses and walking labels describe the illustration;
they do not establish that a person is applying, practicing or taking a break.
Only the loaded published post supplies their shared-activity description.

### Connected community noticeboard

The lower feed connects to the clubhouse through its constellation and recurring
illustrated characters while retaining the standard workspace theme. Its outer
surface uses the shared `glass-panel`; panels, text, dividers, accents and selected
states use semantic board tokens. Celebration actions use the shared primary
button. This applies in both light and dark mode: no wood border, green felt or
cream paper palette is applied to the community UI. The illustration inside the
room retains its own scene materials.

The board retains sans-serif names, dates and message copy, with handwriting
reserved for the featured milestone callout. A published offer reads “Offered!”.
Generated room avatars and a full-body milestone character appear only for
fictional demo members; real-account board identities use initials.

The board's member constellation surrounds a central Everyone emblem. Selecting
a person there or in the room updates the same member filter, and Everyone or
Show everyone restores the feed. More than eight members use a grid. On narrow
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
