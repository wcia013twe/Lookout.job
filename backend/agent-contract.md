# Muse gateway HTTP contract

One small HTTP endpoint; no assumption that Muse accepts custom MCP servers.

`POST https://umhqfqzpwmszhcknwtrs.supabase.co/functions/v1/agent-gateway`

Headers: `Authorization: Bearer <credential>`, `Content-Type: application/json`.
Body: `{ "operation": "workspace.read", "payload": {} }`.
Agent responses wrap results in `{data: ...}`. Error responses have `{error: ...}`.
Do not put credentials in URLs, messages, job data, or logs. Store agent tokens in
Muse's local secrets. Service-role credentials stay exclusively inside the function.

## Connect a human-owned agent

Management uses the person's current Supabase Auth JWT, verified with `getUser`.
Use the existing client `functions.invoke('agent-gateway', {body})`.

- `connections.issue`: `{name, scopes, expiresInDays?}`; expiry defaults to 30 days,
  maximum 90. Returns `{connection, token}` once. Show the token once for copying;
  never persist it in browser state. Maximum 10 active connections per owner.
- `connections.list`: `{}` → `{data: [connection...]}`. No token/hash returned.
- `connections.revoke`: `{id}` → `{data: connection}`; only owned IDs accepted.

Connection fields: id, user_id, name, scopes, created_at, expires_at, revoked_at.
The UI should mark revoked/expired keys, and let users revoke lost credentials.
Agent credentials cannot manage connections. Human sign-in cannot bypass scopes by
calling agent operations. Public RPCs are executable only by service_role.

## Agent operations

Scopes can be narrowed independently. Agents cannot create human approvals. Scoped submission transitions authorize, claim, start and report supported runner attempts.

| Operation | Scope | Payload/result |
|---|---|---|
| `context.versions` | `workspace:read` | `{}` → exactly `{personalVersion,developerVersion}` |
| `context.personal` | `workspace:read` | `{}` → `{personalVersion,settings}` (owned profile/preferences/answers/resume metadata) |
| `context.developer` | `workspace:read` | `{}` → developer version, stable interaction instructions, defaults and capability flags |
| `credentials.verify` | Valid key, no extra scope | `{}` → id/name/scopes/expiry for authenticated discovery; no candidate data |
| `resumes.read` | `resumes:read` | `{resumeId}` → `{resume,url}` with 60-second private file URL or external reference URL |
| `workspace.read` | `workspace:read` | `{}` → profile, preferences, saved answers, resume references and latest 100 owned applications |
| `batches.publish` | `batches:write` | `{eventKey,label,date?,jobs}` → immutable batch, items and personalized `?batch=UUID` link |
| `runner.report_failure` | `drafts:write` | `{applicationId,eventKey,expectedRevision,stage,outcome,reason,nextAction,attempts}` → application + failure event; stale revisions reject |
| `drafts.prepare` | `drafts:write` | `{jobId,expectedRevision,draft,blocker?}` → application with current revision |
| `activity.append` | `activity:write` | `{eventKey,kind,applicationId?,data?}` → persisted event; actor is always agent |
| `approvals.read` | `approvals:read` | `{applicationId}` → owned application and exact approval matching current revision, or null |

A batch has at most 100 jobs. Existing catalog jobs use
`{jobId,recommendation?}`. New employer postings use
`{canonicalUrl,employer,recommendation?}`. `canonicalUrl` must be HTTPS;
`employer` accepts only whitelisted public job fields (company/title/location/description/compensation/etc.), never
candidate information. The public catalog is shared: put fit notes, personal
rankings and reasons only in the **private recommendation** object. Existing
catalog records are never overwritten by this endpoint. Duplicate jobs reject
and roll back the whole batch. Retry the same eventKey to receive the original
batch unchanged; use a new eventKey for a new morning batch.

A first draft uses `expectedRevision: -1`; existing drafts require the exact
revision from workspace.read. A stale revision returns 409. Updating a draft
invalidates approval through the existing database version trigger. Final-stage
applications cannot be drafted again. The draft uses the same resumeId,
questionsReviewed, questions and optional runner metadata as the web app.
Agents cannot mark questions reviewed. Changed drafts set questionsReviewed=false and enter Awaiting approval (or Blocked); human review checks that flag; routine submission can instead use separate automatic authorization after exact fact/answer validation. Exact retries ignoring that human-only flag preserve approval.

Transition activity is owned by database triggers; activity.append is for extra
agent observations, not proof of submission. Reusing an eventKey returns its
original event unchanged.

Approval response: `{application,approval}`; an approval has
`{id,user_id,application_id,revision,snapshot,approved_at}`. Snapshot contains
`{draft,profile,resume}`. No new approval is minted by reading it. Actual browser
submission requires separate runner capabilities and rechecking current approval.
Resume references include object paths, not bytes or permanent public URLs.
A separate resumes:read grant permits retrieving one owned file URL; object paths are derived exclusively from owned database rows. Never log signed URLs. The runner downloads the URL immediately; signed file links expire after 60 seconds.

## Verification and operations

`node --test tests/agent-gateway.test.mjs` validates key generation and the request
contract. Run `backend/agent-gateway-check.sql` through hosted SQL to verify
atomic batches, ownership, stale drafts, expiry and revocation without durable
fixture records (the transaction rolls back). HTTP 401/403/409/404 map to invalid
credential, missing scope, stale revision and missing owned record respectively.

The gateway deliberately has no schedules, SMS transport, general employer submit API,
queue framework, refresh tokens, or general SQL tool. An agent can search locally,
publish a batch, prepare drafts, and return the link to its user using its own
supported notification channel. Tokens require manual replacement after expiry.

Context operations accept no caller-supplied owner or cache state. Personal
version counters are private and read-only to clients. Checks never consume
updates, so several agents remain independent. Full settings are returned only
on explicit personal-context reads, not on the two-number check. Personal theme
messages take precedence over the developer defaults; neither can alter approval
or submission semantics. See `mcp/README.md` for cache/reset behavior.

`guides.discover` returns the authenticated Career Toolkit routing catalog and
`guides.read` returns one selected workflow. Connected agents should infer the
workflow from ordinary user intent and load it without requiring a skill name or
separate installation. Both operations authorize through current developer-context
access and accept no owner identity. Discovery does not execute a workflow, grant a
permission, schedule work or guarantee host-level routing.

Failure reports preserve the draft, set Blocked and invalidate prior approval.
`stage` is approval/playwright/agent/submission; `outcome` is blocked/uncertain.
`attempts` contains at most three `{stage,status}` summaries; no raw browser
errors, typed answers or credentials. Retry the same eventKey without replaying
application execution. Submitted/final records cannot be downgraded. Notifications
remain in the agent's channel, with the personal theme's runner_failure template.

## Guarded submission operations (developer version 6)

`submission.context`, `submission.claim`, `submission.start`, `submission.finish`
require all of workspace:read, drafts:write, approvals:read and resumes:read.
They never accept user IDs, authorization snapshots or agent-provided ranks.
Context/claim/start derive policy and answer authorization server-side. Claim/start
requests pin expectedRevision and expectedPersonalVersion; SQL compares the entire
current context under row/settings locks. Only service-role RPC calls can supply
trusted authorization to the database. No human approval is minted automatically.

- Context: `{applicationId}` returns compact current records and allowed/reason.
- Claim: `{applicationId,attemptId,expectedRevision,expectedPersonalVersion}`.
- Start: `{applicationId,claimId,expectedRevision,expectedPersonalVersion}` returns
  canClick once and a five-second permit. Replayed/lost responses never authorize retry.
- Finish: `{applicationId,claimId,outcome,receipt?}`; outcomes confirmed/uncertain/
  cancelled. Confirmation is structured runner-observed evidence. Finish retries
  are idempotent and cannot turn an uncertain result into a fresh execution.

The local runner submits only supported native Greenhouse forms with a PDF résumé.
Additional documents, CAPTCHA, custom widgets, multiple/embedded forms and unsupported
confirmation markers pause. Automatic drafts need exact profileField provenance
for allowlisted contact labels, or savedAnswerId/savedAnswerVersion referencing a
unique verified exact answer with autofill_policy auto and matching company scope.
File questions carry fieldType file and the résumé ID. Defaults/rules select the
résumé; unfamiliar essays cannot automatically pass on an agent assertion.

The owner can call resolve_submission_attempt after verifying a negative outcome;
it records user-reported verification and permits a fresh attempt. Opaque agent
keys cannot invoke this human RPC. Private history contains attempts/snapshots;
no credentials or file bytes are stored there. No real application was sent in
development testing; official browser confirmations are observations, not signed
employer API receipts.

## Shared personal contact facts

The website’s Personal Info box saves shared `firstName`, `lastName`,
`preferredName`, `suffix`, `email`, `phone`, `birthday`, `location`, `address`,
`address2`, `address3`, and `postalCode` through the existing profile JSON store.
Postal codes remain strings to preserve leading zeros. Name-part edits update the
shared display `name`; existing full-name-only records retain a Full name field
until name parts are supplied. Per-application preferred-name overrides remain
separate account-identity settings.

The existing scoped `save_profile_facts` / `profile.save` tool can save these facts
with `profile:write` and the current `expectedUpdatedAt`. Read the latest profile
and preserve unrelated facts because this action replaces the supplied facts
object. This is not an extension of the narrower `profile.import` /
`save_profile_package` allowlist. Existing ownership/version checks and unverified
agent writes remain unchanged; no new tool or schema deployment is introduced.

## Profile setup (developer version 7)

The `profile:write` grant lets an agent save a prepared package without asking the
person to retype it. New full-access connections include it. Older connections
keep their scopes until their owner clicks **Enable profile setup**; this updates
the existing connection without replacing its token. Human-only
`connections.profile_setup` takes `{id,enabled}` and verifies ownership, expiry
and revocation. Agent keys cannot issue, grant or revoke their own permissions.

- `profile.import`: `{eventKey,expectedPersonalVersion,facts?,answers?,defaultResumeId?,source?}`.
  Facts merge into the owned profile; supplied history arrays replace those
  sections. Preserve unrelated fields. Omit missing/conflicting facts. Changing
  facts clears verification. A no-op does not clear an existing human review.
  Answers accept `{id?,expectedVersion?,question,answer,companyScope?,requestedPolicy?}`.
  New/changed answers have provenance agent, verified_at null and policy ask.
  requestedPolicy auto is only a suggestion for human review, not reuse permission.
  Existing answers require their own ID/version for changes; identical answers
  reuse the existing record. The default must be an owned registered private PDF.
  The result includes profile, affected answers, defaultResumeId, personalVersion
  and reviewRequired. Stale settings return 409; reload before preparing a new import.
  Retry exactly the same eventKey/payload for its original receipt, even after
  later settings changes. Reusing the key with different data returns 409.
- `resumes.begin_upload`: `{eventKey,fileName,variant,sha256,bytes}` → existing
  `{resume,personalVersion}` when that variant/hash is already registered, or
  `{uploadId,uploadUrl,method,contentType,expiresAt}`. PUT exact file bytes to the
  secret returned URL with Content-Type and x-upsert false; never send the agent
  credential to Storage. PDF/DOCX only, at most 10 MB. Begin with a fresh key if the
  reservation expires (15 minutes). Storage's signed URL itself lasts two hours;
  it never permits overwrite, while registration checks the reservation expiry.
- `resumes.complete_upload`: `{uploadId}` verifies actual size, signature and
  SHA-256, then registers immutable resume metadata and returns `{resume,personalVersion}`.
  A valid upload gets its ID from the board, not the caller. Exact retries reuse
  the registered row. Failed verification creates no resume row. The local
  `upload_profile_resume` tool handles this flow from a user-provided file path.

Read fresh personal context after uploading, then save the package against its
returned settings version. Default selection changes only defaultResumeId;
search/rankings/auto-apply/review rules stay intact. Agents cannot mint verification
or application approval through this path. **Reload account** loads imported
facts into the UI; review profile facts once and edit/review saved-answer proposals
before allowing reuse. Import receipts and reservations are private server-only
records; no new client write grants or public file bucket are introduced.

## Preparation and trust tools (developer version 9)

| Operation | Scope | Payload/result |
|---|---|---|
| preparation.read | workspace:read | {applicationId} → owned application, employer, resume, preparation |
| preparation.update | drafts:write + workspace:read | {applicationId,expectedVersion,deadline,dailyMinutes?,resourceGuides?} → versioned server-generated plan |
| preparation.complete | drafts:write + workspace:read | {applicationId,expectedVersion,taskId,completed} → updated plan |
| selection.record | activity:write + workspace:read | {jobId,eventKey,reason,preference,evidence,certainty} → private skip explanation |
| selection.read | workspace:read | {} → decisions, employer records and reconsideration timestamps |
| notifications.read | workspace:read | {} → delivery advice, pending event IDs, summaries and application decisions |
| notifications.ack | activity:write | {eventKey,kind: digest/immediate,eventIds} → durable successful-delivery acknowledgment |
| applications.record | workspace:read | {applicationId} → application and historical attempt materials/receipt |

Preparation starts with expectedVersion 0 when absent; concurrent updates return
409. Deadline: {date: YYYY-MM-DD,stage,confirmed,source:{kind: email/manual,
messageId,subject,excerpt,receivedAt,url}}. Email dates need an exact date, message
reference and supporting wording; ambiguity never fabricates a schedule.
Optional resourceGuides (maximum 10) contain verified HTTPS url, id, title, topics,
optional companies and minutes. These are recommendations, never form instructions.

Delivery settings live at preferences.search.quietMode. Important decisions come
from owned Blocked/Awaiting approval records; deadline notifications require an
unfinished confirmed plan. Date-only preparation deadlines use end-of-day UTC as
advisory urgency, not an invented interview time. Acknowledgment accepts only
owned event IDs or current owned decision/deadline IDs. It records runtime delivery,
never employer submission. No scheduler, email reader or SMS service is added.

Submission record output omits personal settings, profile, answer library and
authorization snapshots. Exact draft materials and resume metadata come from the
immutable attempt context; current editable drafts never prove submission.

## Agent-first onboarding and task inbox

`read_onboarding_state` (`onboarding.get_state`, workspace:read) returns the
canonical step, revision, completed steps, next plain-text prompt, blockers,
capability flags, the first evidenced job, and recent owned tasks. State persists
across reconnects; the UI is a renderer of this same contract.

`update_onboarding_step` (`onboarding.submit_step`, preferences:write) takes
`{expectedRevision,eventKey,event,data}`. Replay the exact request/key to recover
its original response. Changed payloads with an old key reject. Read the current
state after a stale-revision error. The backend supports:

- `runtime`: `{browsing:true}` only after checking live runtime tools. Requires a
  verified, unexpired agent key with discovery and preferences scopes; browser
  credentials cannot impersonate this handshake.
- `intent`: `{text,constraints?}`. Ask one open question, parse only stated hard
  constraints, or import context the user explicitly permitted. Unknowns stay
  unknown. No full profile form or résumé is required before the first match.
- `first_match`: `{jobId,sourceUrl,available:true,checkedAt,evidence,fit}` for an
  owned published batch item. Freshness is limited to 24 hours and the source must
  match the canonical employer URL. The agent must actually browse and verify;
  this endpoint validates the evidence contract, not arbitrary live websites.
  `jobId` is the published job ID, not a search listing/screening ID. Put all six
  fields directly in `data`; `available` must be boolean `true` (not
  `availability`). `sourceUrl` must exactly equal the job's HTTPS `canonical_url`.
  `checkedAt` may be at most one minute ahead of server time. Trimmed `evidence`
  must be 10–2000 characters; trimmed `fit` must be 5–2000 characters. Publication,
  archival and screening records alone do not substitute for fresh evidence.
  Fit stays preliminary without profile verification and a résumé record.
- `no_match`: `{reason}` preserves first-match pending and records a concrete
  blocker. Refine `intent` after asking a focused question; never publish a demo
  role as real.
- `policy`: `{choice:"recommend"|"prepare"|"auto_apply_requested"}` only after the
  first match. Recommend-only skips résumé setup. The other branches require a
  human-verified profile plus an owned uploaded/hashed résumé before execution.
  This records a request; it does not alter existing submission authorization.
- `profile_checked`: `{}` derives prerequisites from canonical tables; no agent
  or browser-supplied verification flags are accepted.
- `execution_result`: `{taskId}` requires a completed owned task of the selected
  policy's kind. Prepared applications and found batches require real records.
- `delivery`: `{mode:"daily"|"important"|"quiet"|"skip",channel?,timezone?,time?}`
  records an inactive request. Non-skipped delivery needs a valid time zone and
  channel; daily needs local HH:MM. Separate social sharing starts private.
- `pause` / `resume`: `{}` preserve the previous active step.
- Human-only `resolve_task`: `{taskId,expectedTaskRevision}` marks uncertain work failed only after the person explicitly checks the runtime; agents cannot manufacture this recovery. Existing submission uncertainty still needs its separate guarded recovery.

The authenticated browser calls `onboarding_action(operation,payload)` using its
existing Supabase client. Ownership always comes from Auth; caller-supplied owner
IDs reject. Browser autosync preserves the scoped onboarding/delivery preference
records. Nothing in onboarding verifies facts, creates approvals, issues click
permits, reports submission, or enables automatic submission.

Task tools: `create_agent_task`, `read_agent_tasks`, `claim_agent_task`, and
`report_agent_task_result` map to `tasks.create/read/claim/report_result`. Creation
takes `{kind,eventKey,expectedRevision,target?}`. Kinds are bounded to `discover`,
`prepare_application`, `validate_auto_apply`, `configure_delivery`; no general
instructions or submission operation are accepted. Targets must be owned job or
application IDs. Creation is idempotent and limited to 20 tasks per owner/hour and three per kind/hour. Active or uncertain work cannot be duplicated. Known failures can retry with a new stable key; policy can downgrade to recommendations after work is settled. All agent onboarding writes also require workspace:read.
Poll each connected run, claim a task before work, then report with
`{taskId,claimToken,expectedRevision,state,result:{summary,...}}`. A claim lasts
five minutes. Exact reports replay safely. Concurrent claims cannot both win;
expired discovery claims retry at most three times, while expired preparation
and delivery become uncertain and require review. Agent expiry/revocation and
scopes are rechecked on every operation. State transitions serialize per owner.

**Unverified capabilities remain unavailable:** no verified Muse inbound hook,
managed Cappy runtime, scheduler/channel activation service, or onboarding
runner-attestation service is installed. Dispatch is polling, not push.
Auto-apply/delivery validation tasks must report `needs_user` with missing
prerequisites, not fabricate completion. Existing guarded Greenhouse submission
remains separate and unchanged. A webhook acknowledgment would never constitute
completion. No real notifications or applications are sent by onboarding.

## Circle Knowledge (gated)

See [Circle Knowledge](circle-knowledge.md) for the shared browser/gateway contract,
knowledge scopes, immutable revisions, exact sharing approvals, conservative standing
permission, private citation receipts and mandatory hosted release verification.
Existing agent scopes are not expanded. No Circle content is enabled by this code alone.

### Profile-specific application automation

The selected profile’s `Application automation` fields are `Auto-apply routine
matches: Yes/No` and `Review threshold: S/A/B/C/D/all`; its existing `Company
priorities / Tier list ID` binds the list. Save through `save_search_profile` at
the current profile version. `read_application_policy` accepts optional profileId;
`prepare_draft` carries `draft.searchProfileId`. The submission authorization
helper rechecks the saved active owned profile and blocks missing/unknown,
conflicting, paused, wrong-role or unbound profiles when explicit rules exist.
Legacy policies remain the fallback for unconfigured profiles/accounts. Global
exclusions and all existing verification, answer, resume and human approval checks
remain authoritative. This local implementation requires gateway/MCP/config
release through the production workflow and hosted verification; no new database
migration or live employer submission was part of this change.

## Company Network integration

The durable company hub adds `list_companies`, `list_company_workspaces` and
`save_company_workspace`, sharing the website's owner/revision validation.
Legacy company `list_contacts`/`save_contact` records are compatibility projections.
`search_circle_knowledge` accepts one `circleId` or `scope: current_memberships`;
use `companyId` or unresolved `company` text, never both. Company/role/stage
criteria match a single primary, attached application/referral or offer context.
Cross-Circle results are permitted published root posts, with stable `authorId`,
Circle labels and derived `companyContexts`; approved revision JSON stays untouched.
Optional explicit company references retain exact-review rules. Internal posting
IDs and employer requisition IDs remain distinct.
See [the complete contract and release gates](../docs/schema.md#companies-and-network).
These additions require backend/gateway/MCP release and hosted verification before
claiming deployed parity.


## Agent-neutral field edits and briefing

All personal-agent clients use the same scoped operations and developer contract.
`profile.fields.update`, `company_workspaces.fields.update`, `contacts.fields.update`
and `artifacts.fields.update` edit existing owned records under their current token;
they delegate to the canonical save validator and preserve unspecified fields.
`brief.read` returns a bounded private snapshot formatted into evidence, uncertainty,
coverage and a reply-based next action. The browser adapter uses the same owned SQL
functions and shared formatter. No new entity or inference service is introduced.
See [the MCP workflow contract](../mcp/README.md#one-experience-across-personal-agents)
for payload semantics, task/Circle mappings, message compression and delivery rules.
Native client confirmation is not implemented; protected human actions retain the
existing authenticated review boundary. These additions are locally tested only
until migrations and gateway/MCP deployment are completed and verified.

## Simplify import

| MCP tool | Operation | Scope | Website boundary |
|---|---|---|---|
| `preview_simplify_import` | `imports.preview` | `tracking:write` | `simplify_import('preview', {rows})` |
| `import_simplify_jobs` | `imports.save` | `tracking:write` | `simplify_import('save', {rows,expectedVersion,eventKey})` |
| `list_imported_jobs` | `imports.list` | `workspace:read` | `simplify_import('list', {})` |

Rows use `{company,title,location,url,status,employmentType,appliedDate,statusDate,
archived,archivedDate,notes}`. `url` and dates are nullable; dates are ISO calendar
dates, never synthesized midnight event timestamps. Status is SAVED/APPLIED and
type is FT/Internship. Both transports derive ownership from authenticated identity,
validate rows in the database, serialize saves by owner and reject stale versions.
Exact retries return the original result; changed payloads with a reused event key
fail. Decisions expose current existing status and preserve it. Agent credentials
must be active, unexpired, unrevoked and appropriately scoped. These tools import
only on user request; they neither verify employer availability nor authorize any
application, sharing or automated execution. Uploaded prose is untrusted data.

`imported_jobs` is private tracker history with retained source rows and no foreign
key requiring a public job URL. Read it explicitly with `list_imported_jobs`; it is
not a canonical application ID for preparation, milestone or submission tools.
No capability is advertised as deployed until the migration and gateway/MCP
release has passed a hosted round trip. See README for bounds and supported format.

### Lightweight connection setup

`onboarding.submit_step(event=connection_test)` is an authenticated agent check-in, with the same revision/event replay boundary. It returns the owning account’s schedule definitions and connection ID and records `data.connectionTest`; it does not attest browsing, advance onboarding, create/claim tasks or authorize a submission. Human callers, revoked credentials, foreign owners, stale revisions and nonempty event data are rejected. `update_onboarding_step` advertises this boundary; the website reads it through `onboarding.get_state`. External runtime automation registration is requested only for saved enabled scheduled tasks assigned to this connection. Actual runtime scheduler receipts remain necessary; Lookout itself does not execute a scheduler.
### Dynamic job research and previews

`publish_batch` / `batches.publish` remains the scoped `batches:write` boundary.
Keep personal research in the existing private `batch_items.recommendation`:

```json
{
  "whyItFits": "Concrete job requirement matched to a supported profile fact.",
  "materialGap": "One material gap or uncertainty to verify.",
  "sourceFreshness": "Observed on 2026-10-23; employer posting date undisclosed.",
  "searchProfileId": "selected-owned-profile-id",
  "matchAssessment": {
    "percent": 73,
    "assessedAt": "2026-10-23T19:00:00Z",
    "evidence": "Current profile evidence compared with the official posting.",
    "factors": [
      {"label":"Role-specific requirement","value":73,"rating":"Good","reason":"Supporting evidence."},
      {"label":"Team scope","value":null,"rating":"Unknown","reason":"Not disclosed."}
    ]
  }
}
```

All fields are optional; omit unsupported scores and gaps rather than inventing
them. `matchAssessment` requires evidence, an ISO timestamp and 1–12 bounded,
evidenced factors. Percent and non-null factor values range from 0 to 100.
Gateway validation and a database trigger enforce this for new writes. The web
reads these same owned private records through existing RLS; no new generic write
or approval tool exists. Historical batches are not rewritten or given synthetic
assessments. Existing retries return original evidence; publish updated research
with a new event key. Source freshness falls back to recorded public employer
freshness, then “Not recorded.” Missing recommendation priority stays unset.

Company badges and pack reveal colors use owned tier placements, with an explicit
profile Company priorities / Tier list ID taking precedence. Ambiguous or absent
rankings remain unranked; all non-skipped roles remain eligible for pack display.
Tier display has no effect on backend application authority.

`prepare_draft` / `drafts.prepare` saves the actual employer question/answer list.
Unanswered questions and custom answers awaiting review render dynamically.
Completed profile/library bindings and attached file fields stay outside this
preview's decision list. No generic contact questions are added. Preview typing
is temporary; persistent edits and human approval use Applications. Neither a
saved assessment nor a preview interaction grants reuse consent or submission
permission. Outreach requests are queued for a connected agent; queue creation
does not prove execution or scheduling.


## Bounded Node backend jobs

The optional Node API/worker exposes five scoped backend job/schedule operations
through the same MCP contract. `search_ats` is the only executable job kind; guide
text does not become arbitrary execution. Reads require workspace:read; writes
require workspace:read, preferences:write and drafts:write. Agent connection
identity is server-bound. Browser parity uses the owned backend_job_action RPC.
See [the complete bounded-job contract](backend-jobs.md) for payloads, version and
retry rules, explicit scheduling authorization, demo coverage and release limits.
Developer contract 54 and these tools require the migration/API/worker or gateway
release and live verification before claiming hosted availability.


## MCP scope metadata and conditional checks

`agent-mcp/tool-scopes.mjs` records the complete mandatory scopes of existing
SQL and gateway routes. Discovery filters by the complete baseline and calls
check it before forwarding. `toolkit.record` with kind `source_config` additionally
requires preferences:write; `toolkit.file.begin` with kind `resume` additionally
requires profile:write. Completing a stored resume file and claiming/reporting a
stored prepare_application task have row-dependent requirements enforced by SQL;
MCP cannot infer their kind from the ID alone. Existing ownership, versions,
credential revocation and human approval checks remain authoritative downstream.

Fixed MCP operations use the full gateway payload validator and return safe
argument errors for invalid nested fields or malformed schemas. Onboarding-state
and task-list reads can initialize a missing session and reconcile expired task
leases, so their metadata does not advertise read-only behavior. Those effects
do not execute work or grant approval. Developer contract 55 documents these
existing boundaries; it does not establish deployment or consent to migrate any
service group.

## Node search pipeline

The configured Node MCP endpoint adds `read_search_source_leads`,
`submit_search_leads` and `screen_search_discoveries`. The lead read requires
workspace:read; intake/screening additionally require drafts:write. They derive
ownership from the credential, reuse existing search records and enforce current
versions and exact-request replay. Source paging/filtering and copied ATS full
parsing are bounded; unsupported and closed URLs remain explicit diagnostics.
These operations return 501 from the Edge-only endpoint with a Node handoff; they
do not silently run a different implementation there. Web search itself and
personal analysis remain the connected agent's work. See
[the source-to-publication sequence](discovery-flow.md). Hosted availability has
not been verified by the local proof.

## Direct application draft fill

`prepare_draft` now requires workspace:read as well as drafts:write. Before the
existing SQL draft write, the gateway reads current owned context, maps exact
contact labels to profile facts, selects the explicitly chosen/default résumé,
and reuses unique exact verified auto-policy saved answers with matching company
scope. The website draft editor uses the same pure resolver. Submission checks
share its contact-label vocabulary (including GitHub).

Supply inspected field IDs/types/options; nested public-form question groups are
accepted and flattened. Nonempty supplied/existing answers are preserved, and
owned existing draft metadata/blockers are retained. Selected resume upload skips
its same-group paste alternative. No other file, consent, hidden or multiselect
control is inferred. Hidden controls remain in the escape report, not the human-facing draft question list. Exact choice values must match; no semantic yes/no mapping.

The response adds `prefill: {counts, filled, preserved, escapes, skipped,
personalVersion}` alongside the saved application. Escapes include public question
text, field identity/type, required and a reason. The report is not stored as
another trace/history table or inside the approved draft. It is a handoff for Muse
to handle unresolved writing and missing facts. Draft/profile and submission
approval remain separate; questionsReviewed stays false. Existing SQL owner and
revision checks remain authoritative, with a current-personal-version check before
saving. Files are proposed by ID, never uploaded to employers by this pass.

Public API inspections are incomplete: conditional controls, hidden location
widgets, exact browser limits and form fingerprint must be checked in the existing
browser runner before actual submission. No real application submission is part
of direct-fill validation.

## Individual work-history edits

`edit_work_experience` (`profile.work_experience.edit`, `profile:write`) adds,
updates or removes one entry in `profiles.facts.workExperience`. This is ordinary
CRUD: Muse connects to Node MCP, which forwards this operation to Edge. No Node
worker, parser, LLM call, new candidate table or entry-ID backfill is involved.

Read `workspace_read` for the owned profile and exact `updated_at` first. Send
`action: add` and `fields` to append. For `update`, send `entryIndex` (zero-based)
and only changed `fields`; omitted entry fields and other entries remain intact.
For `remove`, send `entryIndex` without `fields`, only on the user's request.
Every action requires `expectedUpdatedAt`; an index is valid only for that exact
profile snapshot. Unknown fields, malformed values, missing entries, more than
50 entries, wrong scope, revoked credentials and stale versions reject. Scalar
text remains bounded at 20,000 characters and `current` is a boolean.

The database locks the owned profile before checking its timestamp and editing
its array. Changes advance the timestamp even within one transaction and clear
`verified_at`; exact no-op updates preserve both. Retrying a successful add or
removal with the old timestamp returns a conflict, rather than editing twice.
After an uncertain response, read current state and reconcile; do not blindly
retry using a fresh version. The operation does not provide a durable idempotency
receipt. Changed profile context versions remain server-triggered.

Stale entry edits raise `PT409`, mapped to HTTP 409 by PostgREST and the gateway.
This avoids the PostgREST retry loop caused by using `40001` for a persistent
application conflict. See [Supabase’s documented behavior](https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions).

Authenticated browser adapter `editWorkExperience` calls
`edit_work_experience(payload, expected_owner)`. Both transports share
`private.edit_work_experience`; the browser checks account identity before and
after the RPC. Private helper and credential dispatch are denied to browser and
anonymous roles. Existing website bulk editing and resume imports remain explicit
section-replacement paths; this change does not migrate their autosync or promise
conflict protection for those older writes. Agents must use the entry tool for
routine work-history edits rather than reconstructing the whole array.

Verification: `tests/work-experience.test.mjs` covers MCP validation/discovery,
Node-to-Edge routing, browser account fencing and fictional demo add/edit/remove,
stale rejection and reset. `tests/work-experience-check.sql` exercises actual
migration/SQL preservation, versions, scopes, ownership and browser/MCP parity.
`node scripts/check-local-work-experience.mjs` verifies real local Node MCP,
isolated Edge and Docker Supabase, writes only through a disposable fictional
account, and inspects the retained review profile read-only. It applies only this
additive migration and never restarts/rebinds shared services. Its sanitized
receipt is `backend/local/work-experience-proof.json` when successful.

Gateway/MCP release and migration deployment are required before connected
production agents can discover/use the tool. Local source/tests are not a hosted
availability claim. Refresh tool discovery on the new developer context version.

## Application preferences and compact handoff

The existing versioned job profile includes optional `Application answers` labeled
fields. `save_search_profile`/`save_search_document` and the website editor own
these values; no new store or preference endpoint. Explicit answers cover
sponsorship, F-1 status, return to school, graduation month, degree, start date,
12-week full-time internship availability, relocation and desired salary. They
are not ranking priorities. Unknown values stay blank. Ordinary location/pay/work
filters only answer questions about those preferences, never residency, office
commitments or requested salary by inference.

`prepare_draft` loads the selected active `draft.searchProfileId` from owned
`search.context`, checks its version again before saving, and records preference
provenance on filled questions. Unique exact option labels map to native values;
ambiguous/unmatched options and conflicting existing answers stay unresolved.
Missing application choices are not inferred from a résumé or search filters.
Existing verified auto-policy saved answers retain their consent requirements.
Preference-derived proposals do not authorize automatic submission; existing
human-review/submission validation remains in force.

Default response is now compact: `{id,job_id,revision,status,questionsReviewed,
prefill:{counts,personalVersion,searchProfileId,searchProfileVersion},handoff}`.
Handoff version 1 contains job/context references, unresolved questions with exact
options and known limits, separate browser checks, an explicit requiresBrowserInspection flag, and only bounded relevant
education/work/project evidence. It excludes completed answers, full draft,
full profile, file bytes and signed URLs. Profile verification state remains
explicit. `responseMode: full` is an intentional diagnostic opt-in.

To answer the packet, call the same `prepare_draft` with current expectedRevision
and `draft:{answerUpdates:[{fieldId,answer}]}`. Do not include questions too. The
server merges exact existing supported field IDs into the stored complete draft;
unknown/duplicate IDs, unsupported files/widgets, invalid choices and confirmed
length violations reject. Unchanged answers and metadata remain intact. Supplied
updates never grant reviewed state or reusable-answer verification. Use an explicit
selected profile ID when applying profile preferences; no arbitrary profile is
chosen when multiple profiles exist.

## Durable application inbox

`applications.inbox.read` accepts only optional `state` (pending/resolved/all)
and `offset` (integer 0–100000), requires `workspace:read`, and returns owned
`items` (100 maximum) plus `nextOffset`. Identity comes from the active credential.
The browser RPC `read_action_inbox` and agent operation share the same reader.
Writes are implicit atomic effects of existing validated application/attempt
transitions; no log-edit or approval shortcut is exposed. Node delegates this
lightweight operation to Edge. Deploy the migration before releasing this tool.


## Submission batch checkpoints

Node executes `submit_application_batch`; Edge persists its execution journal.
`submission.batch.begin` accepts `{eventKey,applications:[{applicationId,expectedRevision}]}`
(1–10 unique references). `submission.batch.read` accepts optional `batchId` with
workspace:read. Begin/touch/checkpoint additionally require drafts:write,
approvals:read and resumes:read; their connection binding is server-derived.
Touch/checkpoint accept only `{batchId,leaseToken,expectedVersion,applicationId}`.
Checkpoints derive outcomes from saved application and attempt rows and cannot
accept a caller's status/receipt. None of these operations grants approval.
The browser reader shares `read_submission_batches` with the MCP read boundary.
## Complete personal-profile edit flow

The website now sends only changed facts through `save_profile_changes`, and MCP
`update_profile_fields` reaches the same `private.patch_profile_facts` writer. Both
require the current profile timestamp, validate typed fields/arrays, preserve
omitted facts, clear verification on changes, and reject stale writes with
`PT409`/HTTP 409. Direct authenticated table upserts are revoked. Account reads
remain protected by RLS; Node remains Muse's MCP access point. Individual work
entries still use the scoped entry operation. No processing job is added.

Website sync keeps the original server row/version alongside its existing private
account-scoped offline cache (`workflow.profileSyncBase`). This is conflict
metadata, not another backend profile. Reloading an offline draft cannot silently
adopt a newer version and overwrite changes made by Muse. A stale save pauses
automatic retries; Reload latest profile preserves non-conflicting local changes.
Overlapping fields require Use latest values or Keep my edits. An older cache
without a known baseline requires an explicit choice. Active form editing defers
background hydration so it cannot erase text being typed.

`review_profile_facts` is a separate authenticated human-only RPC over the exact
profile version. Fact saves never set verification; a stale review rejects. The
existing MCP `request_human_action(verify-profile)` remains the agent handoff.
Agent credentials cannot call the human session RPC or include review fields in
a patch. Resume imports retain their separate proposal/review flow.

Gate: Muse adds an entry -> website receives it -> human edits a different field
-> Muse reads both -> stale browser save rejects -> explicit reload/reconciliation
-> saved data survives a page reload. Tests also cover overlapping choices,
offline-cache reloads, verification invalidation, old-table-write denial, and
account isolation. `LOOKOUT_PROFILE_FLOW_UI=1 node scripts/check-local-work-experience.mjs`
runs the actual task frontend, Node MCP, isolated Edge and local Docker database
with a disposable fictional account; the retained review profile is read-only.
It installs this migration and the already-landed Action Inbox dependency needed
by current frontend loading, without restarting shared services. The sanitized
receipt is `backend/local/profile-edit-flow-proof.json` when successful.

Demo: `/profile/?demo=1&section=about&demoApi=profile-conflict` exercises the same
conflict controls through fictional memory-only services; reload/reset restores
the scenario and no real cloud service is called. Application-profile preferences
and account-wide settings remain separate gates. Release the migration, frontend
and gateway/MCP instruction/schema changes together before advertising live support.

Preview posting facts use `recommendation.jobFacts.location`, when supplied, ahead
of the older catalog location. It is optional bounded nonempty text within the
existing source URL/check timestamp contract; `publish_batch` validates it for
both MCP and browser projections. Legacy batches retain catalog fallback. Posting
refreshes do not change assessment timestamps or grant application approval.
The application preview counts saved answers separately from required/optional
unanswered controls. Browser saves preserve `inspectedAt` and `inspectionComplete`
so autosync cannot erase the saved form inspection metadata.

`read_batch` and browser `getBatch` overlay the latest owned `search_observations`
for each catalog job, including checkedAt, liveness, publication date and full
posting text. The immutable batch/AI recommendation remains intact. The same
shared loader fences both observation and listing owners; read failures surface,
not silently stale success. The UI formats recency from this typed observation.
No newer observation means the original publication snapshot remains the fallback.

`prepare_draft.handoff.routing` classifies existing unresolved field IDs into
human, agent, optional and browser groups. The website uses the same classifier.
Required unknown personal facts/conflicts need the person; required writing can
be drafted by the agent; empty optional controls are non-blocking; unsupported
widgets/files/consent require explicit browser handling. These labels never
change stored answers, review state, approvals or submission validation.


## Profile-aware resume selection

Preparation and automatic submission now share `selectResume`: active role
assignments in the selected application profile match normalized title phrases
and job type; unmatched roles use that profile’s fallback. Blank assignment job
type inherits the profile types. Blank assignment resume uses the same fallback.
Conflicting matching files, malformed assignments, unchecked conditions/timelines
and unavailable/superseded/private-file gaps require review. Legacy account-wide
rules/defaults remain only for clients without profile resume configuration.

`prepare_draft` exposes `handoff.resumeSelection` and pins an automatically chosen
owned file/hash. It preserves existing explicit draft selections and reports
differences from current rules. Submission rereads the owned canonical profile in
its existing authorization context, including atomic claim/start comparisons.
Routine execution rejects a stale/mismatched file; exact human approval can
intentionally override the mapping. The runner downloads the draft’s pinned file,
never a newly guessed alternative. Deploy the profile-resume-selection migration
with the gateway update before claiming the new authorization behavior is live.

The website's Preview job → Confirm answer uses the same field/choice/length
validation as `prepare_draft` answerUpdates, then the existing account-scoped,
revision-guarded cloud draft save. It awaits persistence before displaying Saved
to draft; stale revisions, account switches and write failures remain explicit.
It clears prior application approval and retains questionsReviewed=false. This
confirmation is not reusable-answer verification or application approval. The
MCP equivalent remains prepare_draft with draft.answerUpdates at the current
revision; no new tool or permission is introduced.

## Muse change feed

`read_muse_changes` (`changes.read`, workspace:read) returns the oldest 20 pending
system change pointers by default (limit 1–50), with `hasMore`. `eventTypes` lists
the supported kinds, labels and existing read tools. Each item adds a readable
`label` and `refresh: {tool, arguments}` so Muse can read its current record.
Each item has an
ID, kind, time, affected entity/record ID and version; application events include
the job ID/field IDs, and backend results include status/run ID. Answers, resumes,
profiles and job results stay in their existing records.

`acknowledge_muse_changes` (`changes.ack`, workspace:read + activity:write) accepts
only 1–50 unique owned change event IDs. Acknowledgements are idempotent and
connection-specific. Reads don't mark anything seen; an older acknowledgement
cannot hide a newer event, and one connection cannot clear another's pending
work. Fetch current affected records, continue previously authorized work, then
acknowledge handled events or durable blockers. This is distinct from message
delivery acknowledgement and never wakes a runtime or grants submission consent.

Confirm answer saves `draft.lastAnswerConfirmation {id,fieldId}` with its answer.
The SQL trigger emits `answer_confirmed` in the SAME transaction, including for a
new confirmation of unchanged text. Only an authenticated owner save can emit
that event; agent draft proposals cannot forge it. Other emitted kinds are
`preferences_changed`, `profile_changed` (search profiles), and
`backend_job_finished` (completed/partial/failed/cancelled), and
`application_timeline_changed` (recorded milestones or tracking-stage changes).
Timeline pointers include `change` (`milestone_added`, `milestone_replaced` or `stage_changed`), and
milestone pointers include ID/kind/phase. Interview labels distinguish scheduled,
completed, rescheduled and received updates. Corrections include `supersedesId`. Notes, email subjects/excerpts and interview dates
remain in the existing `read_application_timeline` response. Immutable milestone
retries emit once; rejected writes and no-op stage saves emit nothing. Timeline
milestone `version` identifies its creation timestamp, not an aggregate timeline
revision; always read current records before making another update.

| Kind | Label / refresh |
| --- | --- |
| `answer_confirmed` | Application answer confirmed → `read_application_record` |
| `preferences_changed` | Shared preferences changed → `read_personal_context` |
| `profile_changed` | Application profile changed → `read_search_context` |
| `backend_job_finished` | Backend job finished → `read_backend_jobs` |
| `application_timeline_changed` | Timeline updated / Interview scheduled / Interview rescheduled / Interview completed / Interview update recorded → `read_application_timeline` |

This is two-way platform sync: existing scoped tools make updates; the feed points
Muse to updates to read and acknowledge. There is no behavior engine, field-by-field
automation policy, new work queue or inferred permission.

Theme-only and ordinary
agent draft saves don't create changes. Reserved system activity cannot be
inserted through client/agent activity APIs.

Existing activity rows store the events. `private.muse_change_receipts` stores
only connection/event IDs and acknowledgement time. Acknowledgement performs
bounded cleanup of these system pointer events older than 30 days ONLY when all
active full-workspace consumers handled them; pending changes are retained.
Workspace reset and account/application deletion retain their existing cascade
boundaries. No new scheduler, queue, message transport or broad database tool.
The detached demo feed has fictional pointers and isolated resettable receipts.
Hosted availability requires the migration and gateway/MCP release; local tests
and tool documentation do not establish a production deployment.
### Artifact validation diagnostics

`artifacts.save` / MCP `save_artifact` use the same field validation as the
browser adapter. Schema errors identify a field path (for example,
`arguments.id` or `arguments.sources[0].observedAt`) without echoing supplied
values or unknown field names. MCP checks the connection and required scope
before returning these diagnostics; rejected input is not forwarded for saving.

`preparedFor` must be a real `YYYY-MM-DD` calendar date and is supported only
for `weekly_prep` and `interview_brief`. A `practice` artifact stays undated;
omit `preparedFor` to save it. A dated preparation collection may reference a
saved practice artifact through its existing `materials` field. Saving material
does not schedule execution or record completed practice.

### Backend repair runtime readiness

Developer context64 removes separate deployment-evidence records. Deployments
bundle their exact reviewed source commit in `runtime-version.json`; the tracked
placeholder is null and therefore fails closed until stamped by the deployment
helper. `scripts/runtime-version.mjs` checks every supplied source byte against
the pinned commit before stamping. No credential or user data enters this file.

`get_bug_status` keeps owner authorization. It reads its own running gateway
version and uses the same credential for the existing authenticated MCP initialize
call, which reports MCP's running source version in `serverInfo.version`. Both
commits must contain the linked merged fix. Backend-only fixes need no frontend
release or bot receipt. Mixed frontend changes still need their frontend release.
Unknown/older versions and unsupported schema/service changes remain unready.
Readiness proves deployed code, not a successful reproduction. Runtime source
identities form a stable releaseId; never automatically retry the same identity
or an uncertain write. Backend readiness leaves reports open for the retry outcome.

Always use the stamping helper when packaging gateway/MCP deployment payloads and
read back deployed files afterward. Preserve existing authentication and scopes.
This reports loaded build identity; it does not independently inspect all source
on every status call. GitHub access failure or MCP authentication failure cannot
produce a ready result. No new public endpoint or access grant is introduced.

## Credential-free pending-count watch

Implemented locally; production requires the migration and gateway/MCP release.
An authenticated `configure_muse_watch` call (`changes.watch`, workspace:read +
activity:write) with `{enabled:true}` returns `watchId`, `enabled` and
`pollIntervalSeconds:120`. Each enable rotates the previous handle.
`{enabled:false}` invalidates it. There is one watch per connection; no user ID
or connection ID is accepted. Both MCP and gateway use the same SQL validation.

The watcher may GET `<agent-gateway URL>/pending-count?watchId=<watchId>`
without Authorization or an API key. HTTP 200 contains only a JSON integer,
including 0 for unknown, disabled, revoked, expired or scope-ineligible handles.
It counts all unacknowledged supported system events for that connection,
including timeline changes, rather than the first 20/50 feed items. Reading
counts never acknowledges events or updates connection last-used state. Responses
are no-store. Invalid queries return 400, wrong methods 405, and database failure
503; failures must never be interpreted as an empty feed.

The handle is an unguessable count-only capability, not a Lookout credential.
Anyone holding it can observe pending activity counts, so avoid public links/logs.
It cannot read records, acknowledge events, or authorize work. Rotate it after
accidental disclosure. Runtime policies must permit storing this limited handle;
this does not override a host rule against all capability URLs.

Runtime setup (outside Lookout): poll about every 120 seconds with jitter, a
request timeout and exponential error backoff. On count > 0, serialize one
authenticated worker: read_muse_changes → refresh affected records → handle
already-authorized work → acknowledge handled IDs, paging until done. Coalesce
wake-ups while active; if blocked events remain, use a cooldown/backoff rather
than repeatedly waking. Do not acknowledge before handling or on HTTP errors.
Idle polls use no model tokens, but incur normal HTTP/function/database usage.
This feature installs no scheduler or wake integration. Confirm actual host
wake behavior separately before claiming it is active.

Detached demo services expose configureMuseWatch/readMusePendingCount with
fictional handles, independent acknowledgement and reset; no network is called.
