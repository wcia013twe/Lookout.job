---
type: "Reference"
title: "Career Toolkit, artifacts, network, and Circle knowledge"
openwiki_generated: true
verified:
  - by: openwiki/0.7.2
    at: 2026-11-07T02:52:01.830Z
sources:
  - id: openwiki-source-81c5adab9ce20a401e545d9a
    resource: repo://backend/circle-knowledge.md
  - id: openwiki-source-57291caf28bfcf2ec46b220f
    resource: repo://docs/schema.md
  - id: openwiki-source-adb17fc7cf5c1e3db63991b3
    resource: repo://next-app/app/career-toolkit/_components/toolkit-workspace.tsx
  - id: openwiki-source-c88d0f9c23abcfa6c19b0a9b
    resource: repo://supabase/functions/agent-gateway/artifacts.mjs
  - id: openwiki-source-63a8badbc6b4c42e2bd92685
    resource: repo://supabase/functions/agent-gateway/knowledge.mjs
  - id: openwiki-source-3d7cb778540c5da0259bdb84
    resource: repo://supabase/functions/agent-gateway/muse-features.mjs
  - id: openwiki-source-80427b9b52cf56f6dcabb4e1
    resource: repo://supabase/functions/agent-gateway/network-people.mjs
  - id: openwiki-source-66a06808271ed9261389b373
    resource: repo://supabase/functions/agent-gateway/platform-tools.mjs
  - id: openwiki-source-502623582c08a8859546c7dc
    resource: repo://supabase/functions/agent-gateway/preparation-planner.mjs
  - id: openwiki-source-57cc4b9b326736e17bfc2b40
    resource: repo://supabase/migrations/20261015204955_circle_knowledge.sql
  - id: openwiki-source-bde45573b4fc6bb11dc04baf
    resource: repo://supabase/migrations/20261015205745_aggregated_preparation_planner.sql
  - id: openwiki-source-2b24733e8b0894528b8c2edc
    resource: repo://supabase/migrations/20261103224016_network_person_cards.sql
  - id: openwiki-source-a728c113df52e9fab2b0abb6
    resource: repo://tests/circle-knowledge.test.mjs
  - id: openwiki-source-d0c9280a20fcfc4ceaf6f053
    resource: repo://tests/preparation-planner.test.mjs
generated: { by: "openwiki/0.7.2", at: "2026-11-07T02:52:01.830Z" }
---


# Career Toolkit, artifacts, network, and Circle knowledge

Career Toolkit is the private, durable-work surface for preparation material: research, interview briefs, practice, reusable application text, and ordered prep collections. It is backed by owner-scoped artifact revisions rather than an agent transcript or a generic document store. Its adjacent preparation planner turns confirmed interview and learning-goal tasks into a bounded weekly agenda; the network model keeps people and company research private and structured.

Circles are deliberately different. They are invitation-only, membership-scoped knowledge spaces behind a release gate. A Circle post begins as an author's private revision. It is visible to other members only after an explicit sharing path; joining a Circle, recording an application event, saving an artifact, or retrieving a post never shares private application data implicitly.

For the cross-cutting ownership and revision conventions, see [Data model, ownership, and consistency rules](../architecture/data-and-ownership.md). Agent credentials, scopes, and MCP transport are covered in [Agent credentials, gateway, MCP, and guide routing](agent-access-and-mcp.md).

## Private preparation and durable artifacts

### What is stored

`career_artifacts` stores the current owner-scoped document plus an incrementing version and archive flag; `career_artifact_revisions` preserves each saved content/archive snapshot. Artifact content is structured around `title`, `purpose`, `kind`, `format`, `body`, dated public sources, and typed links. The supported kinds distinguish preparation and research from cover letters and reusable application templates. This is intentional: an artifact is useful work, not evidence of completing a task, approving an application, reusing an answer, or submitting anything.

A link names exactly one subject—an owned application, learning goal, company workspace, contact, or a shared catalog job. `taskId` can narrow an application/goal link to a real task. The service checks those ownership/subject relationships on save; historical revisions retain their original links but do not grant access to an inaccessible or deleted subject.

Two constrained formats are supported:

- **Markdown** is normal durable material. A `weekly_prep` or `interview_brief` may list up to 20 ordered `{id, version}` material references, producing a short overview that reuses exact child revisions instead of copying them. Collections cannot nest, self-reference, or include application documents.
- **HTML** is an interactive artifact, not a hosted web page. It must be self-contained; rendering inserts a restrictive CSP and sandbox that prohibits network/account access, forms, navigation, external dependencies, and persistent exercise state.

`preparedFor` is allowed only on weekly/interview preparation and only when it is a real calendar date. It makes material eligible for the Prepared shelf through that date; undated, expired, general, and incomplete work stays on Saved. The browser reads prepared and saved shelves separately, supports kind/query/archive filtering, follows artifact/version URLs, and loads an immutable revision when a version is requested.

### Authoring boundary and concurrency

The shared artifact actions are `artifacts.list`, `artifacts.read`, `artifacts.save`, and `artifacts.archive`. Reads need `workspace:read`; saves and archive changes need `drafts:write`. Creation uses a caller-provided UUID with `expectedVersion: 0`; edits and archive transitions require the current version. Exact retries can replay, while a stale version is a conflict to resolve by re-reading the artifact.

Agents should read relevant work first, revise useful material rather than save every conversation, and return the saved artifact URL/version URL only after persistence. Sources are bounded dated HTTPS observations, and typed link/source/content validation rejects malformed or unsupported structure. An artifact body may be agent-written, but it remains private working content; it cannot itself create a sharing grant, approval, autofill permission, schedule, or submission authority.

### Planner, goals, and recorded practice

Preparation plans belong to applications; active learning goals are a parallel private source of dated tasks. Planner settings contain one daily-minute budget (0–240, default 45). The agenda projects the next seven days in the user's configured time zone: it excludes closed, expired, unconfirmed, and out-of-window interview work; allocates deadline-weighted interview coverage first; then fills remaining capacity with active learning goals. Generic practice and unscoped public resources may be consolidated across interviews, but company-specific intelligence is deliberately kept separate.

A `preparation_session` records elapsed minutes once and may target multiple tasks. Completion is a user-reported practice record, not application/submission evidence. The canonical completion path locks all target plans/goals, validates every expected version and unfinished owned task before changing anything, enforces the day's remaining budget, appends the session, then credits each target and marks it complete only once accumulated credit meets its estimate. Reusing the same session ID with identical content is idempotent; a changed reuse, duplicate target, stale version, foreign target, or over-budget session fails without a partial write.

The website and agent planner use the same owned snapshot and agenda algorithm. Agent operations are `preparation.planner.read` (`workspace:read`), `preparation.budget` (`preferences:write`), and `preparation.session.complete` (`drafts:write`); they derive the owner from the connection rather than accepting one in input.

## Private company and people network

Company identity and a person's working network are separate concerns. The maintained `companies` registry resolves exact names/aliases; an owner-scoped `company_workspace` holds target/research information and explicit contact/application associations. Similar company/title text must not silently create an identity or process association. Saving a company workspace cannot alter shared identity records or applications.

Person cards remain `outreach_contacts.record` with a revision boundary. The networking extension adds optional professional title, technical interests, relationship summary, dated relationship updates, next action, dated sources, and one optional suggestion. A suggestion is an actionable `connect`, `maintain`, or `referral` recommendation with rationale/action, optional role and HTTPS role URL, dated sources, timestamps, and `active`, `done`, or `dismissed` state. Marking it done/dismissed changes only the suggestion; it does not create outreach, modify an application, or assert an outcome.

`list_companies` and `list_company_workspaces` read these boundaries, while `save_company_workspace`, `list_contacts`, `save_contact`, and `delete_contact` use owner/revision checks. `network:write` permits saved private records, not sending messages or creating a networking/search service. Network sources are bounded public HTTPS observations with an observation date, and relationship updates have unique IDs and dates. This makes agent-proposed research and follow-ups reviewable without treating agent inference as a verified relationship fact.

## Circle knowledge: separate consent and visibility model

### Entry points, membership, and gate

The authenticated website calls `knowledge_action(operation, payload)`; agents use the gateway/MCP fixed operations. Both reach the same checked Circle action path, whose actor and (for agents) connection are server-derived. Circle tables are private with RLS and no direct browser/agent table grants. The feature configuration starts disabled; while disabled, Circle actions return unavailable rather than exposing partial data.

A Circle owner creates a Circle and invitation token; a human joins using that token. Membership is required before reads and writes. Invite secrets are only returned to the human owner; removal/leave deactivates membership and clears standing permissions and unpublished approvals. A removed member cannot use an old invitation to regain access: a later-created invitation is required. Expired/revoked agent credentials and removed membership fail closed.

Agents may list/read current memberships, search/read permitted published knowledge, propose a private contribution, publish only when authorized, withdraw their human's contribution, report a post, record/retract a use receipt, and return a website handoff. They **cannot** create or revoke invitations, change membership, set sharing policy, approve an exact revision, hide/moderate a post, or mint human confirmation. Those are human-authenticated actions. `request_circle_human_action` is only a membership-checked link to the appropriate human UI; it does not perform the action.

### Draft-to-public lifecycle

A post owns immutable revisions and has `draft`, `published`, `withdrawn`, or `hidden` state. An author may update only their current revision with `expectedRevision`; an edit creates a new revision and invalidates prior approval. Other members continue to see the last published exact revision while the newer revision remains private. Replies are flat and can be created only under a published top-level thread.

```mermaid
stateDiagram-v2
    [*] --> Draft: agent or human proposes revision
    Draft --> Draft: author edits with current revision
    Draft --> Approved: human approves exact revision
    Approved --> Published: agent publishes approved revision
    Draft --> Published: human directly shares exact revision
    Published --> Draft: author creates newer revision
    Published --> Withdrawn: author withdraws
    Published --> Hidden: owner hides after member report
    Draft --> Withdrawn: author withdraws
    Approved --> Draft: revision changes or permission revoked
    Withdrawn --> [*]
    Hidden --> [*]
```

*Private drafts become member-visible only through direct human sharing or an agent publication authorized for that exact revision.*

The normal agent flow is therefore: propose private content, have the human inspect and approve that exact revision, then publish with the revision/version and a stable `eventKey`. Publication rechecks membership and policy transactionally. A human can instead publish the exact revision directly, which is the sharing act itself. All mutations use per-human idempotency receipts: same key and same semantic payload replay; a changed payload/key combination conflicts. Circle writes are rate-limited, but withdrawal and consent/recovery operations remain available.

There is one deliberately narrow exception to exact approval: a member may opt in per Circle to standing permission for a closed `resource`/`opportunity` template. It accepts only the exact generic text, `agent_observed` provenance, no optional/personal fields, and a single documentation URL from a short allowlist. Arbitrary prose, personal reports, replies, milestones, interview/timeline/offer material, contexts, job IDs, and any freeform resource still require exact human review. An agent cannot relabel personal text as safe to escape this boundary.

### Content, retrieval, feed, and citations

Knowledge revisions hold structured content: title/body/type, public labeled HTTPS sources, reported provenance/disclosure, and optional company/role/stage/date/uncertainty. Later additive fields support insight, public job URL, offer comparisons, and whitelisted context snapshots. Validators reject private storage/signed links, mail routes, internal identifiers, unrecognized fields, and agent-supplied `user_confirmed` provenance. An agent milestone proposal must reference an owned application milestone internally, but source/application IDs are omitted from shared projections; recording that milestone does not publish it.

Search is membership-filtered and returns an author's private draft only to that author; other members receive current published revisions only. It supports bounded pagination and structured filters. The separate feed is ascending committed publication activity: it returns source references and returns a post only while its exact revision remains published/visible. Consumers drain its fixed-boundary cursor, then retain a checkpoint; a later event invalidates cached old revisions (and, when required, replies). Reading, copying, searching, or receiving feed activity does not acknowledge delivery, send a message, cite a post, or authorize sharing.

After actually using another author's currently published revision in an answer or preparation plan, an agent may record a citation receipt with an opaque reference. Retrieval alone is not use. The displayed count is unretracted receipts per human per revision, so multiple agents belonging to one person cannot inflate it; self-citation is rejected. Receipt details stay private to the citing human, counts reset on a newly published revision, and an owner can retract an erroneous receipt even after its source becomes unavailable. Counts report agent-asserted use, never confirmed benefit.

## Operations and focused verification

Do not claim production availability merely because the UI, migration, or demo exists. Circle release requires the feature gate, an authenticated hosted two-account/RLS check, and concurrency checks around publication versus removal/policy revocation. The browser keeps Circle results in memory, refreshes visible sessions periodically/on focus, and clears shared content on access errors; static export and service-worker cache must not contain private Circle data.

Focused coverage in `tests/preparation-planner.test.mjs` exercises deterministic allocation, budget limits, shared-versus-company-specific work, partial credit, stale/foreign targets, idempotent sessions, and website/MCP snapshot parity. `tests/circle-knowledge.test.mjs` uses authenticated-role database calls and scoped agent connections to test release gating, invitation membership, draft isolation, exact approval, no implicit application sharing, private citations, revision reset, conservative standing permission, pagination, reporting/moderation, removal, revocation, and expiry. These are source-level checks; hosted grants and deployment still need the explicit release verification.

## Weekly Career Toolkit and scheduled mocks (source update)

Career Toolkit keeps its existing workspace and reader. It defaults to an explicit
Monday–Sunday week in the saved preparation timezone (device timezone fallback),
with previous/next navigation and All materials. Assignments use `weekOf`; undated
legacy/reusable materials remain in All materials. Weekly filtering happens in SQL. The weekly view loads all matching metadata
before grouping dated sessions and prep chronologically, followed by undated
resources ordered by latest update. All materials retains paginated latest-update
ordering. Editing does not reassign a week.

The agent follows the pinned Career Ops research → round plan → practice → debrief
→ next-round loop. Five optional contributions are company context plus motivation,
round research plus prep brief, a separate reusable story bank, mock interviews,
and interview debriefs. It curates external resources first and creates material
only where useful. Resource artifacts use `resourceUrl`; normal saved revisions
remain usable inside briefs. Tools & skills remains the reference library.

`save_mock_interview` atomically saves visible artifact logistics and separate
interviewer preparation; `read_mock_interview` returns that preparation to the
scoped connected agent. Public browser artifact APIs never return the profile.
The profile is excluded from ordinary artifact metadata, revisions and collections
and is deleted with its session. Sessions start scheduled, may resume in_progress,
and require a saved owned debrief to complete. Completed/cancelled sessions are
terminal; archive preserves history. The user calls their existing agent externally
when ready. Saving logistics does not activate a scheduler, reminders or calls.

These are source changes requiring the migration and gateway/MCP release together
with the frontend. Demo sessions are fictional and have no interviewer service.
Live external-agent calling and hosted behavior are not established by local tests.

### Compact weekly scan

The Toolkit title and view switch share a line; one toolbar owns week navigation,
All materials, the collapsed filters. Dated mock sessions and
prep briefs lead the weekly timeline. Undated company context, stories, notes and
external resources follow without invented event dates. Primary prep uses compact
cards with rotated type icons; supporting items use denser rows. Company marks
reuse the shared logo/fallback component. Application links resolve explicit owned
artifact links against current workspace records; company text alone never creates
an association. These are presentation changes over existing scoped artifact reads.

### Static embedded demo documents

The five-material demo now uses four script-free HTML documents built with one
neutral, light artifact canvas: company/team motivation, a timed round brief,
a story bank and a debrief. Color callouts, tables, evidence labels and preparation
timelines supply hierarchy without repeating app navigation or branding. Demo
embeds use an empty sandbox, and HTML is described as a document rather than
inherently interactive. Older saved records remain available; the older demo pack
and interactive example are off the current-week shelf. The planning button and
copy-request panel were removed from the workspace. The reader has one compact back/title/discussion header; metadata and revision controls are collapsed, while resource links stay visible. Embedded documents fit the remaining viewport so ordinary reading scrolls inside the document without requiring an additional outer page scroll. The sandbox remains unchanged.

Active mock cards labeled **Add to Google Calendar** in detached demo open Google's prefilled event editor with title,
time and a generic description. They do not create an event, reminders, attendees,
a call, or a saved Calendar association. Hidden interviewer preparation and internal
record IDs are never placed in that URL. Completed/cancelled sessions retain their
saved reader/feedback route. Real-account mock routing is unchanged; a deployed
Google Calendar event integration is not claimed by this preview.

### Palantir research demo

The current five-material preview centers on the public New York New Grad Query Engines posting, with a separately labeled fictional application. The round brief saves two short Glassdoor excerpts with report dates, anonymous attribution and review IDs; it labels those as general SWE candidate reports, not a confirmed Query Engines process. Original practice prompts are distinguished from reported questions. Visible source links and three external-resource rows open Glassdoor, the employer posting, DataFusion, PostgreSQL and Furnace pages through the existing source/resource link boundaries. Research stays dated November 7, 2026 across demo resets. Candidate stories, events, status and debrief remain fictional; no employer action or real account write occurs.

### Agent-facing material formats (contract 117 source update)

The primary guide index and `discover_toolkit.materialGuide` expose the versioned
`toolkit-materials` guide. It provides six optional recipes (five contributions
plus external resources), matching career-skill IDs, a neutral static HTML starter,
report-excerpt attribution and source-link rules. Relevant company/interview skills
load it before saving; the interview/workspace workflows reference it without
preloading bodies into startup. Static documents are the default for synthesis,
while curated resources and concise Markdown remain valid. Mock logistics/profile
separation and actual-call/Calendar limits are unchanged. Existing scoped artifact
and mock tools own execution; no new generic writer or consent is introduced.
A detached MCP generation test covers discovery, recipe loading, save/read-back
and read-only denial. Hosted availability requires the normal main-branch release.

Network UI follow-up: the suggestions section is commented out; saved suggestions and person records remain intact. People details retain external navigation, with a LinkedIn-blue profile button and a mail icon box for Gmail conversation links. Application associations continue to use existing explicit contact tags or matching role URLs; company similarity alone does not establish process relevance.

### Local mock save readiness correction (contract 118)

Tool discovery alone was insufficient: the local database lacked migration
`20261107201448`, and Node's service map omitted the `mock` prefix. The map now
routes mock reads/saves through the existing checked Edge/SQL path. Node preserves
only fixed safe scope/version/mock diagnostics and explains an unsupported
database operation as a migration mismatch; arbitrary server text remains hidden.
The local-only `scripts/check-local-toolkit-mock.mjs` checks the prerequisite and
exercises actual Node MCP -> Edge -> SQL saves, idempotent retries and private
profile separation using a disposable account removed in `finally`. It does not
create the user's requested session or any Calendar event.

Network people can now be filtered by tracked or imported application, or by No linked application. Cards display linked company/role labels using the existing explicit-tag/role-URL association rules. Company and application filters can be combined, and existing process deep links select the same filter. No contact write, new ranking store or inferred company-only process link is introduced; scoped list_contacts/save_contact remain the agent read/write boundary.

The cold-outreach guide now tells agents to suggest application-relevant contacts during authorized work, merge exact existing application IDs into contact tags, verify structured profile/conversation routes and point to the Network Application filter after read-back. Hidden UI suggestions do not disable contextual agent recommendations. Company-only matches stay unlinked until a clear role-specific purpose is established; human drafts/history/states remain intact. Source instructions require gateway/MCP release and a context refresh before availability in deployed agents is claimed.

## Canonical round preparation (connected board source update)

Application milestones now retain a stable round identity across append-only corrections, an explicit practice category and time zone, and confirmed/proposed/incorrect details. Lifecycle supports cancellation separately from completion. The milestone writer accepts `practiceCategory`, `timeZone` and optional `proposedAt`; unknown confirmed times remain null. A person may confirm a proposed time through Action Board, producing a correction that retains the original evidence.

Confirmed scheduled rounds receive round-scoped tasks inside the existing application plan and versioned preparation-session ledger. Weekly Prep derives the active date and practice grouping from the current round, without interpreting its label. Rescheduling fences stale sessions, keeps existing task IDs/completed work/time credit and recalculates allocation; completed, cancelled and superseded rounds do not produce future work. Generic practice can still share one session across its explicit task targets. Learning goals and the daily budget retain their existing rules.

Legacy tasks attach automatically only when one current confirmed round matches the application and exact date. Ambiguous or unmatched work remains standalone. Existing ledger entries are never rewritten. Task and material links select the actual round or immutable artifact revision and provide a return to Action Board. The desktop planner's existing layout is preserved.

The detached scenario `?demo=1&demoApi=action-board` covers the shared decision rows, exact review, stopped/resumed applications, manual outreach readiness, proposed-round confirmation, cancellation and typed practice. It is fictional, resettable and has no account/backend access. Migration, function release and authenticated hosted verification remain separate from local tests and screenshots.

Tailored round resources use the existing `update_preparation_plan` operation with `roundId` and current `expectedVersion`, omitting `deadline`. It reads the owned current canonical round, preserves other rounds and completed task identities, and saves through the original plan validator. Legacy standalone inputs remain supported; linked plans reject newly duplicated standalone task templates and foreign-round links. Daily planning uses the owner's configured time zone while retaining the event's original time zone as evidence.

### Mock schema and rejection diagnostics (contract 123)

Mock discovery now advertises only mock fields, requires scheduling fields and
shows an RFC 3339 timestamp pattern with an explicit UTC offset. A separate
`timeZone` does not make an offset-free `scheduledAt` valid. `preparedFor` is
brief-only and is omitted from the mock schema; target-interview context belongs
in purpose/body. Material-format guide v2 states the same rules. MCP mock
validation/backend rejections produce a server diagnostic ID, stage, allowlisted
reason and field types only. They never record request values, mock IDs, tokens
or interviewer-profile content. Historical rejections without these diagnostics
cannot be reconstructed from logs; unchanged JSON-RPC error bodies preserve
client compatibility.


### Shared Action Board calendar (contract 125 source update)

The existing seven-day Weekly prep calendar also projects current application
rounds without requiring a preparation plan, explicit dated imported next actions,
and scheduled/in-progress Toolkit mock sessions. The shared owned planner snapshot
includes imported records without source notes and only visible mock logistics;
private interviewer preparation stays excluded. Website and MCP
`read_preparation_planner` use the same projector. Existing round corrections,
import updates, mock lifecycle and practice writers remain authoritative.
Cancelled/completed rounds and mocks, archived mocks and terminal applications
leave the upcoming calendar; source links open their existing editors. Dates use
the saved preparation timezone, and native/import duplicate preference matches
round stats. Existing interview/learning practice still shares one daily budget.
The visible calendar refreshes every minute, on focus/reconnect and account sync;
returning to the board reloads the owned snapshot. Demo reads the same fictional
mock sources. No external Calendar events, calls or scheduler are created.
Source validation and local runtime activation are reported in the feature note;
hosted deployment is separate.


#### Full-week calendar and missing-task correction (contract 126)

The Action Board now displays every Monday–Sunday date with previous/next/current
week controls. `read_preparation_planner` accepts optional Monday `weekOf`; website
and MCP use `buildWeeklyPreparationAgenda` over the existing owned snapshot.
The lower-level rolling allocator remains available for bounded planning checks.
Past days never acquire newly allocated practice. The saved timezone is shown.

Other pending tasks retains unfinished assessment rounds with unknown dates,
imported next actions without dates, overdue/out-of-week events and preparation
or learning tasks excluded by budget/date rules. Links open their owning source;
unknown dates remain null. Week browsing does not change dates, task completion,
budget or personal preferences. Dated interviews/mocks outside the selected week
remain accessible through navigation and pending items. Completed/cancelled rounds
and inactive/terminal/archived sources retain their existing exclusion rules.

A scoped diagnosis found zero saved learning goals/preparation plans, one mock,
and undated pending assessment rounds; it did not infer tasks from material text
or assign guessed dates. The detached demo covers an unfinished undated OA.
Validation and local activation receipts are in the shared calendar feature note;
hosted deployment remains separate.

Network relationship views now separate All people, Continue conversations and Prospects. A valid logged sent/received message or non-cancelled meeting establishes a conversation; research, drafts, thread URLs alone and legacy hiring statuses do not. Cards and details show the last logged interaction and saved reply/waiting state, not live inbox state. Update relationship edits the compact summary, existing thread URL, optional dated update, next action and follow-up using the existing contact envelope and revision boundary. Drafts/history/application links remain unchanged; no sending or inbox sync occurs. MCP list_contacts/save_contact can read and maintain the same records.
