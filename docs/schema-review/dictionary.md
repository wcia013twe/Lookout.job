# Proposed logical field dictionary

This is a design review, not a migration or a dump of the current database. UUID is the default identity; timestamps are UTC, dates retain their precision. Each top-level field is listed individually; Document subfields are defined in document-contracts.md and drawn on sheet 00b; other JSON subfields are defined in README.md. All mutable private aggregates carry an owner and optimistic revision; append-only rows inherit the owner through a constrained parent. Created/updated timestamps are shown explicitly; immutable history has no updated_at.

## 01 Catalog and discovery

### Company

Shared employer identity; names alone are not unique. Registry controls aliases and merges.

```text
PK id: uuid
name: text
normalized_name: text
domain: text?
logo_asset: text?
created_at: timestamp
updated_at: timestamp
```


### CompanyAlias

UQ(namespace, alias_key) for verified aliases. Ambiguous names remain unresolved.

```text
PK id: uuid
FK company_id: uuid
namespace: text
alias_key: text
label: text
created_at: timestamp
updated_at: timestamp
```

- `company_id` → `Company` (required parent; many children per parent).

### Job

One employer requisition/cycle. FT or Internship. Pay preserves currency, basis, period, range and source; absence is unknown.

```text
PK id: uuid
FK company_id: uuid
requisition_key: text?
title: text
type: FT / Internship
locations: json[]
setting: enum?
focus: text?
description: text?
pay: json?
eligibility: json?
posted_at: date?
state: enum
created_at: timestamp
updated_at: timestamp
```

- `company_id` → `Company` (required parent; many children per parent).

### Posting

Multiple verified employer/ATS URLs may resolve to one job. Tracking URL aliases normalize here; do not strip identity-bearing parameters.

```text
PK id: uuid
FK job_id: uuid
canonical_url: text UQ
provider: text?
external_id: text?
verified_at: timestamp?
availability: enum
created_at: timestamp
updated_at: timestamp
```

- `job_id` → `Job` (required parent; many children per parent).

### SearchRun

Pin immutable profile + source-config document versions. Snapshot mutable candidate/answer/tier inputs once, without copying document bodies. Public runs use public source checkpoints, not private documents.

```text
PK id: uuid
FK owner_id: uuid?
FK profile_document_id: uuid?
FK profile_version_no: int?
FK source_document_id: uuid?
FK source_version_no: int?
FK connection_id: uuid?
scope: public / private
mode: enum
state: enum
context_snapshot: json?
checkpoints: json[]
started_at: timestamp?
completed_at: timestamp?
event_key: text
summary: text?
updated_by: actor?
created_at: timestamp
updated_at: timestamp
```

- `profile_document_id` → `DocumentVersion` (optional parent; many children per parent).
- `connection_id` → `AgentConnection` (optional parent; many children per parent).
- `source_document_id` → `DocumentVersion` (optional parent; many children per parent).

### SourceObservation

Append-only occurrence. Allows unresolved social/list leads; employer verification required before canonical job admission. UQ(run, source_key, occurrence_key).

```text
PK id: uuid
FK run_id: uuid
FK job_id: uuid?
FK posting_id: uuid?
source_key: text
occurrence_key: text
source_url: text
observed_at: timestamp
source_age_days: int?
employer_date: date?
evidence: json
description: text?
raw_lead: json?
created_at: timestamp
```

- `run_id` → `SearchRun` (required parent; many children per parent).
- `job_id` → `Job` (optional parent; many children per parent).
- `posting_id` → `Posting` (optional parent; many children per parent).

### SelectionDecision

Private assessment, not job fact. Pins profile version; context_snapshot captures candidate/tier/answer revisions and evidence used. Short rationale stays here; longer analysis links through DocumentLink.

```text
PK id: uuid
FK owner_id: uuid
FK profile_document_id: uuid
FK profile_version_no: int
FK observation_id: uuid
FK job_id: uuid?
decision: enum
priority: enum?
rationale: text
checks: json[]
gaps: json[]
upside_tier: enum?
exclusion_preference: json?
certainty: enum?
context_snapshot: json
updated_by: actor?
reconsidered_at: timestamp?
revision: int
created_at: timestamp
updated_at: timestamp
```

- `observation_id` → `SourceObservation` (required parent; many children per parent).
- `profile_document_id` → `DocumentVersion` (required parent; many children per parent).
- `job_id` → `Job` (optional parent; many children per parent).

### Batch

Public or private collection of selected jobs. Public batch date defines lastRun; a URL/id never grants private access.

```text
PK id: uuid
FK owner_id: uuid?
FK run_id: uuid
scope: public / private
label: text
published_at: timestamp?
event_key: text
created_at: timestamp
updated_at: timestamp
```

- `run_id` → `SearchRun` (required parent; many children per parent).

### BatchItem

FK batch_id → Batch; job_id → Job. UQ(batch, position). Private rationale comes from a same-owner decision; public editorial notes stay explicitly editorial.

```text
PK/FK batch_id: uuid
PK/FK job_id: uuid
FK decision_id: uuid?
position: int
discovered_date: date
created_at: timestamp
```

- `batch_id` → `Batch` (required parent; many children per parent).
- `job_id` → `Job` (required parent; many children per parent).
- `decision_id` → `SelectionDecision` (optional parent; many children per parent).

## 02 Candidate and preferences

### Account

Settings are bounded preferences. execution_policy holds separately revisioned, profile-keyed human-controlled permissions. Profile prose may request a policy but cannot grant it.

```text
PK id: uuid
auth_subject: text UQ
login_email: text
settings: json
personal_version: int
settings_revision: int
execution_policy: json
policy_revision: int
created_at: timestamp
updated_at: timestamp
```


### CandidateProfile

One shared profile. Stable IDs inside ordered background entries. Verification is tied to values/revision; login email differs from application contact email.

```text
PK/FK owner_id: uuid
contact: json
summary: json
links: json
work: json[]
education: json[]
projects: json[]
skills: json[]
preferred_skills: text[]
languages: json[]
eligibility_by_country: json[]
revision: int
verified_revision: int?
verified_at: timestamp?
created_at: timestamp
updated_at: timestamp
```

- `owner_id` → `Account` (required parent; at most one children per parent).

### SavedAnswer

UQ(owner, exact normalized question, scope_key). Explicit global/resolved_company/unresolved_company scope; null company never implies global. Edit invalidates review. Draft snapshots preserve old answer text and revision.

```text
PK id: uuid
FK owner_id: uuid
FK company_id: uuid?
scope_kind: enum
scope_key: text
scope_label: text?
question: text
normalized_key: text
answer: text
provenance: json
reuse_policy: ask / reviewed_auto
requested_policy: enum?
revision: int
reviewed_revision: int?
reviewed_at: timestamp?
archived_at: timestamp?
created_at: timestamp
updated_at: timestamp
```

- `company_id` → `Company` (optional parent; many children per parent).

### TierList

Small ordered definitions are embedded. Display rarity derives from tier; a list is reusable across profiles.

```text
PK id: uuid
FK owner_id: uuid
name: text
description: text
ordered_tiers: json[]
revision: int
created_at: timestamp
updated_at: timestamp
```


### TierPlacement

FK list_id → TierList; company_id → Company. One company in one tier per list. Validate tier_key against that list.

```text
PK/FK list_id: uuid
PK/FK company_id: uuid
tier_key: text?
position: int
created_at: timestamp
updated_at: timestamp
```

- `list_id` → `TierList` (required parent; many children per parent).
- `company_id` → `Company` (required parent; many children per parent).

## 03 Documents and materials

### Document

Stable private identity for profile, source_config, analysis, resume, letter, template, toolkit material, debrief or collection. Projection is rebuilt from the current version; no second writable profile/source system. Review is editorial, not permission or fact verification.

```text
PK id: uuid
FK owner_id: uuid
kind: enum
key: text?
title: text (head projection)
variant: text?
current_version_no: int
projection: json (derived)
projection_version_no: int
reviewed_version_no: int?
FK reviewed_by: uuid?
reviewed_at: timestamp?
archived_at: timestamp?
created_at: timestamp
updated_at: timestamp
```


### DocumentVersion

Immutable content. Body OR blob OR URL OR collection manifest by kind; attributes only allow enumerated kind-specific fields. Personal-agent output carries author/time and optional sources/input versions. Caveats remain in the body; no inference metadata. Collection children are bounded pinned references in attributes.

```text
PK/FK document_id: uuid
PK version_no: int
title: text
payload_kind: body / blob / url / manifest
format: enum
body: text?
blob_key: text?
source_url: text?
sha256: text?
mime: text?
bytes: bigint?
purpose: text
sources: json[]
schema_version: int
attributes: json
week_of: date?
prepared_for: date?
company_context: json?
author: json
input_refs: json[]
created_at: timestamp
```

- `document_id` → `Document` (required parent; many children per parent).

### DocumentLink

Exactly one typed subject; same owner for private targets. job_id may reference public Job. Many analyses can attach to one subject. Links locate content; input_refs records exactly what informed a revision.

```text
PK id: uuid
FK document_id: uuid
FK application_id: uuid?
FK round_id: uuid?
FK plan_id: uuid?
FK task_id: uuid?
FK company_target_id: uuid?
FK job_id: uuid?
FK decision_id: uuid?
FK contact_id: uuid?
FK conversation_id: uuid?
FK run_id: uuid?
FK profile_document_id: uuid?
FK profile_version_no: int?
relation: enum
created_at: timestamp
updated_at: timestamp
```

- `document_id` → `Document` (required parent; many children per parent).
- `application_id` → `Application` (optional parent; many children per parent).
- `round_id` → `InterviewRound` (optional parent; many children per parent).
- `plan_id` → `PrepPlan` (optional parent; many children per parent).
- `task_id` → `PrepTask` (optional parent; many children per parent).
- `company_target_id` → `CompanyTarget` (optional parent; many children per parent).
- `job_id` → `Job` (optional parent; many children per parent).
- `decision_id` → `SelectionDecision` (optional parent; many children per parent).
- `contact_id` → `Contact` (optional parent; many children per parent).
- `conversation_id` → `Conversation` (optional parent; many children per parent).
- `run_id` → `SearchRun` (optional parent; many children per parent).
- `profile_document_id` → `DocumentVersion` (optional parent; many children per parent).

## 04 Applications and evidence

### Application

UQ(owner, job). Tracker and queued work are views over one relationship. Opening, queuing, user report and proven submission remain separate. No hard delete of referenced jobs.

```text
PK id: uuid
FK owner_id: uuid
FK job_id: uuid
FK profile_document_id: uuid?
opened_at: timestamp?
queued_at: timestamp?
recruiting_stage: enum
stage_date: date?
preparation_state: enum
blocker: json?
reported_applied_at: timestamp?
revision: int
created_at: timestamp
updated_at: timestamp
```

- `job_id` → `Job` (required parent; many children per parent).
- `profile_document_id` → `Document` (optional parent; many children per parent).

### DraftRevision

FK application_id → Application. Immutable reviewed material; snapshot exact fact/answer values with origin IDs and revisions. New revision invalidates old authorization.

```text
PK/FK application_id: uuid
PK revision: int
FK resume_document_id: uuid?
FK resume_version: int?
form_fingerprint: text?
questions_answers: json[]
profile_snapshot: json
policy_snapshot: json
answer_snapshots: json[]
review_state: enum
blockers: json[]
actor: json
created_at: timestamp
```

- `application_id` → `Application` (required parent; many children per parent).
- `resume_document_id` → `DocumentVersion` (optional parent; many children per parent).

### Authorization

Human approval requires real human actor; routine authorization requires validated policy and provenance. Neither proves submission. Recheck current safety conditions on claim.

```text
PK id: uuid
FK application_id: uuid
FK draft_revision: int
kind: human / routine_policy
actor: json
policy_snapshot: json
expires_at: timestamp?
revoked_at: timestamp?
material_digest: text
created_at: timestamp
updated_at: timestamp
```

- `application_id` → `DraftRevision` (required parent; many children per parent).

### SubmissionAttempt

One active claim per application; one-use click permit. Captured fields are immutable; receipt/resolution append under version check. Uncertain blocks retry.

```text
PK id: uuid
FK application_id: uuid
FK draft_revision: int
FK authorization_id: uuid
state: enum
idempotency_key: text
claim: json
click_permit_digest: text?
executed_fields: json[]
resume_evidence: json
receipt: json?
resolution: json?
started_at: timestamp?
finished_at: timestamp?
created_at: timestamp
updated_at: timestamp
```

- `application_id` → `DraftRevision` (required parent; many children per parent).
- `authorization_id` → `Authorization` (required parent; many children per parent).

### ApplicationEvent

Append-only timeline: status reports, email excerpts, observations, workflow transitions. Distinguish user report, agent observation and validated receipt. UQ(owner, event_key).

```text
PK id: uuid
FK application_id: uuid
FK round_id: uuid?
kind: enum
actor: json
provenance: enum
occurred_date: date?
occurred_at: timestamp?
precision: unknown / day / time
recorded_at: timestamp
payload: json
event_key: text
created_at: timestamp
```

- `application_id` → `Application` (required parent; many children per parent).
- `round_id` → `InterviewRound` (optional parent; many children per parent).

### InterviewRound

Actual scheduled round is separate from prep deadline. Supports dated-but-unconfirmed or date-only records without inventing time; activity history refers to this row.

```text
PK id: uuid
FK application_id: uuid
kind: enum
label: text
phase: enum
scheduled_date: date?
scheduled_time: time?
timezone: text?
date_confirmed: bool
precision: unknown / day / time
source: json
notes: text
revision: int
updated_by: actor?
created_at: timestamp
updated_at: timestamp
```

- `application_id` → `Application` (required parent; many children per parent).

## 05 Preparation and network

### PrepPlan

Exactly application plan OR standalone learning goal. Goal identity is the plan ID; avoid a second identical plan system. Resource bodies live in documents.

```text
PK id: uuid
FK owner_id: uuid
FK application_id: uuid?
goal_title: text?
kind: application / learning
deadline: date?
confirmed: bool
source: json
state: enum
revision: int
created_at: timestamp
updated_at: timestamp
```

- `application_id` → `Application` (optional parent; at most one children per parent).

### PrepTask

Stable tasks independently credited and linked to material. Plan revisions preserve credited task IDs; removed tasks archive. Shared practice joins via PracticeCredit.

```text
PK id: uuid
FK plan_id: uuid
title: text
detail: text
category: enum
minutes: int
due_date: date?
position: int
state: enum
revision: int
updated_by: actor?
created_at: timestamp
updated_at: timestamp
```

- `plan_id` → `PrepPlan` (required parent; many children per parent).

### PracticeSession

UQ(owner, idempotency_key). Real practice duration counted once even if many tasks benefit; no duplicated minutes in total metrics.

```text
PK id: uuid
FK owner_id: uuid
minutes: positive int
completed_at: timestamp
idempotency_key: text
created_at: timestamp
```


### PracticeCredit

FK session_id → PracticeSession; task_id → PrepTask. Same-owner, revision checked, credit bounded by session duration per target; aggregate time from session only.

```text
PK/FK session_id: uuid
PK/FK task_id: uuid
expected_plan_revision: int
credited_minutes: int
created_at: timestamp
```

- `session_id` → `PracticeSession` (required parent; many children per parent).
- `task_id` → `PrepTask` (required parent; many children per parent).

### CompanyTarget

UQ(owner, company) when resolved. Unresolved targets retain private label/website. Short interest/questions stay inline; long Research text is a linked analysis document, not a copied second body.

```text
PK id: uuid
FK owner_id: uuid
FK company_id: uuid?
unresolved_name: text?
website: text?
priority: enum
interest: text
teams: text[]
questions: text[]
next_action: text?
follow_up_date: date?
archived_at: timestamp?
revision: int
updated_by: actor?
created_at: timestamp
updated_at: timestamp
```

- `company_id` → `Company` (optional parent; many children per parent).

### Contact

Private person identity shared by outreach and active processes. Exact verified email/LinkedIn dedupe within owner; never auto-merge names or globally share contacts.

```text
PK id: uuid
FK owner_id: uuid
FK company_id: uuid?
unresolved_company_name: text?
name: text
employment_role: text?
contact_type: enum
email: text?
linkedin: text?
evidence: text
source_url: text?
tags: text[]
connection_context: text?
reason: text?
notes: text
archived_at: timestamp?
revision: int
updated_by: actor?
created_at: timestamp
updated_at: timestamp
```

- `company_id` → `Company` (optional parent; many children per parent).

### Conversation

One contact can have many threads. Referral outcome belongs to thread, not person/application. Draft text separate from logged messages; contact identity not copied.

```text
PK id: uuid
FK owner_id: uuid
FK contact_id: uuid
FK company_id: uuid?
unresolved_company_name: text?
target_role: text?
subject: text
draft_body: text
channel: enum?
outcome: enum
follow_up_date: date?
url: text?
notes: text
revision: int
updated_by: actor?
created_at: timestamp
updated_at: timestamp
```

- `contact_id` → `Contact` (required parent; many children per parent).
- `company_id` → `Company` (optional parent; many children per parent).

### ConversationApplication

FK conversation_id → Conversation; application_id → Application. Explicit same-owner process relationship replaces tags and URL guesses.

```text
PK/FK conversation_id: uuid
PK/FK application_id: uuid
created_at: timestamp
updated_at: timestamp
```

- `conversation_id` → `Conversation` (required parent; many children per parent).
- `application_id` → `Application` (required parent; many children per parent).

### Interaction

Kind-specific checks. Messages carry sent/received; meetings carry scheduled/completed/cancelled. Logs report activity; they do not send or invite.

```text
PK id: uuid
FK conversation_id: uuid
kind: message / meeting / coffee_chat
direction: sent / received / null
channel: LinkedIn / Email / null
status: scheduled / completed / cancelled / null
occurred_date: date
body: text?
notes: text?
location: text?
provenance: enum
revision: int
event_key: text
created_at: timestamp
updated_at: timestamp
```

- `conversation_id` → `Conversation` (required parent; many children per parent).

## 06 Circles and publication

### Circle

Shared membership boundary. Owner is a membership role with exactly one active owner; transfer atomically.

```text
PK id: uuid
name: text
revision: int
created_at: timestamp
updated_at: timestamp
```


### CircleMember

FK circle_id → Circle; account_id → Account. Explicit membership controls read/write; agent proposal permissions are not human publication consent.

```text
PK/FK circle_id: uuid
PK/FK account_id: uuid
alias: text
role: owner / member
state: active / left / removed
allowed_contribution_types: enum[]
joined_at: timestamp
removed_at: timestamp?
revision: int
created_at: timestamp
updated_at: timestamp
```

- `circle_id` → `Circle` (required parent; many children per parent).

### CircleInvite

Invite secret is not ordinary stored plaintext; optional encrypted value for current UI redisplay. Removed members need a newer invite. Consume/join with membership checks; no private profile information disclosed.

```text
PK id: uuid
FK circle_id: uuid
token_hash: text UQ
encrypted_token: text?
FK created_by: uuid
expires_at: timestamp
revoked_at: timestamp?
created_at: timestamp
updated_at: timestamp
```

- `circle_id` → `Circle` (required parent; many children per parent).

### Post

One post model for chat, round insights, resources, offers, milestones, opportunities and replies. Parent must be same circle; channel is derived from content type.

```text
PK id: uuid
FK circle_id: uuid
FK author_id: uuid
FK parent_id: uuid?
state: enum
current_revision: int
published_revision: int?
created_at: timestamp
updated_at: timestamp
```

- `circle_id` → `Circle` (required parent; many children per parent).
- `parent_id` → `Post` (optional parent; many children per parent).

### PostRevision

FK post_id → Post. Immutable disclosure snapshot; redact private source. Personal disclosures require exact-revision approval. Restricted public-link templates may use explicit membership policy; validate no personal data. Human edits create new revision.

```text
PK/FK post_id: uuid
PK revision: int
type: enum
title: text
body: text
contexts: json[]
offers: json[]
sources: json[]
activity: json?
insight: text?
experience_date: date?
provenance: enum
uncertainty: text?
agent_authored: bool
personal_disclosure: bool
FK human_approver: uuid?
approved_at: timestamp?
created_at: timestamp
```

- `post_id` → `Post` (required parent; many children per parent).

### PostPublication

FK circle_id → Circle; composite post/revision → PostRevision. Atomic with post visibility. Durable cursor and tombstones; revision pinned for agent consumers.

```text
PK/FK circle_id: uuid
PK sequence: bigint
FK post_id: uuid
FK revision: int
kind: publish / withdraw / hide
actor: json
occurred_at: timestamp
created_at: timestamp
```

- `post_id` → `PostRevision` (required parent; many children per parent).
- `circle_id` → `Circle` (required parent; many children per parent).

### ModerationReport

Member-scoped report; moderator hides/withdraws with publication event. Report visibility restricted; no public reporter disclosure.

```text
PK id: uuid
FK post_id: uuid
FK reporter_id: uuid
reason: text
state: enum
resolution: text?
FK resolved_by: uuid?
resolved_at: timestamp?
created_at: timestamp
updated_at: timestamp
```

- `post_id` → `Post` (required parent; many children per parent).

### AgentReceipt

Private citation-use receipt, not publication approval. Source availability derives from current membership/visibility; retain redacted metadata after withdrawal.

```text
PK id: uuid
FK owner_id: uuid
FK connection_id: uuid
FK post_id: uuid
FK post_revision: int
category: enum
reference: text
retracted_at: timestamp?
created_at: timestamp
updated_at: timestamp
```

- `post_id` → `PostRevision` (required parent; many children per parent).
- `connection_id` → `AgentConnection` (required parent; many children per parent).

## 07 Agent execution and onboarding

### AgentConnection

One-time secret delivery; digest only at rest. Capability evidence is time-stamped, not inferred from issuing credentials. Recheck scope/revocation every action.

```text
PK id: uuid
FK owner_id: uuid
name: text
credential_digest: text
scopes: enum[]
expires_at: timestamp?
revoked_at: timestamp?
capability_evidence: json
revision: int
created_at: timestamp
updated_at: timestamp
```


### AgentCheckpoint

FK connection_id → AgentConnection. Per-agent context/feed cursor; acknowledge only after consuming. Developer version is release metadata, not mutable user data.

```text
PK/FK connection_id: uuid
PK context_key: text
acknowledged_version: int?
feed_cursor: json?
created_at: timestamp
updated_at: timestamp
```

- `connection_id` → `AgentConnection` (required parent; many children per parent).

### OnboardingSession

One current session/owner. Request state does not imply runner, notification or schedule active. Actual task outcomes remain separate.

```text
PK id: uuid
FK owner_id: uuid
FK match_job_id: uuid?
step: enum
intent: text
requested_policy: enum
match_evidence: json?
delivery_request: json?
blocker: text?
paused_from: enum?
revision: int
event_key: text
created_at: timestamp
updated_at: timestamp
```

- `match_job_id` → `Job` (optional parent; many children per parent).

### AgentTask

Handoff inbox for personal agents to discover/prepare/execute and draft outreach; reasoning runs externally, not in Lookout; optional onboarding session. Bounded requested companies (up to 50); typed result references. Idempotent create, leased claim, uncertain reconciliation. References outcome IDs; no duplicated run/application snapshots.

```text
PK id: uuid
FK owner_id: uuid
FK session_id: uuid?
FK connection_id: uuid?
FK job_id: uuid?
kind: enum
state: enum
revision: int
event_key: text
claim_expires_at: timestamp?
target_companies: json[]
result_refs: json
result_summary: text?
evidence: json
updated_by: actor?
created_at: timestamp
updated_at: timestamp
```

- `session_id` → `OnboardingSession` (optional parent; many children per parent).
- `connection_id` → `AgentConnection` (optional parent; many children per parent).
- `job_id` → `Job` (optional parent; many children per parent).
