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
