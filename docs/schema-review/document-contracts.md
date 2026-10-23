# Documents, UI fields and AI-generated text

**Proposed design; no UI/backend changes in this pass.** The existing profile and source document boundary is the starting point. Consolidating other content into Document/DocumentVersion and adding the validators below remains implementation work. The diagram contains 44 relations; the nine content-contract boxes are nested field shapes, not additional tables.

## Personal-agent boundary

Inference and reasoning happen in each user’s personal agent. The agent reads complete context through scoped MCP, researches/reasons externally, then submits analysis, recommendations or drafts. Lookout checks the write’s ownership, permissions, shape and expected version, saves it, and displays it in the existing UI. Lookout does not need to know the agent’s model, inference provider, prompt recipe, token usage or reasoning trace.

A handoff task can still record requested work, a claim and the reported outcome so agents do not duplicate actions; it is not an internal LLM job. Context/feed checkpoints are sync cursors. Document bodies, linked subjects, author/time and optional sources/input versions are enough for normal analysis output. Blob hashes and exact submission/approval evidence retain their existing integrity purpose.

## What a user types, and where it goes

| UI control or panel | Canonical storage | What remains structured |
|---|---|---|
| Job preferences: Location / Employment / work arrangement | Profile document frontmatter filters, edited through named UI fields | Server-parsed filter projection for reads; no second writable copy |
| Career goals / Tradeoffs / Rules / Advanced instructions | Named Markdown fields plus preserved custom prose in the same profile version | Document owner, kind, key, version and valid references |
| Employer-answer / Outreach writing controls | Tone, Length, Guidance in named profile sections | Writing preference is not a candidate fact or permission |
| Fallback resume / saved answers / recruiting targets | IDs and target entries in named profile sections | Actual résumé versions and reviewed answer records stay shared; validate all selected IDs |
| Sources: name / type / address | Patch source entry in canonical YAML | Source version is pinned by runs; preserve settings omitted by the simple UI |
| “Why it fits”, brief gap explanation | SelectionDecision.rationale / gaps / checks | Decision, priority, upside tier, input evidence and last-editor metadata |
| Company Research / lengthy fit or prep analysis | Linked analysis DocumentVersion.body | Typed subject links, author/time, optional sources/input versions, review version |
| A short task instruction or outreach draft | PrepTask.detail or Conversation.draft_body | Domain identity/state + ordinary last-editor metadata |
| Reusable outreach draft / debrief / prepared toolkit material | Versioned document, linked to conversation/round/plan/task as appropriate | Pinned immutable history and scoped reads; no duplicated body on the domain record |
| About me: work, education, eligibility | CandidateProfile typed fields and bounded entries | Values, provenance and explicit verification; generated prose cannot silently establish facts |
| Auto-apply toggle / tier review threshold | Typed execution-policy entry for the selected profile | Separate human action, revision and actor/time; Authorization later pins exact draft/policy |

For example, typing **“I want deeper distributed-systems work; I would accept an internship only for a substantial increase in scope”** into Career goals stores that sentence in the profile document. It does not automatically become `must_take_internship=true` or override Employment. An AI can propose a clearer preference or filter change; the user reviews that proposed change before it alters the selected setting.

The profile document might contain this existing-format excerpt:

```markdown
---
{"id":"systems","name":"Systems roles","active":true,"filters":{"Employment":"Full-time","Location":"New York"},"priorities":{"Growth":"Very important"}}
---
## Career goals & tradeoffs
- Career goals: I want deeper distributed-systems work.
- Tradeoffs: Consider an internship if the scope increase is substantial.

## Profile evaluation
- Rules: Explain the team upside and identify what still needs verification.
```

The UI displays familiar fields. Saving patches the named field, validates the full document, creates an immutable version and atomically updates its parsed projection. Unknown prose survives. The agent reads the full selected document, including exceptions, rather than only a compact filter summary.

If AI then writes **“The infrastructure scope looks promising, but the team and conversion path need verification”**, a short version belongs in the decision rationale. A multi-section comparison produced by the user’s personal agent belongs in an analysis document linked to that decision/job. The analysis references the precise profile/resume versions and source observations used. Neither statement changes the verified job facts or your application status.

## Complete nested document and AI contracts

These contracts are also visible on draw.io sheet **00b Document and AI fields**. Existing profile/source limits come from the current parser; the limits and validators for new analysis/collection functionality are proposed below. Naming uses logical document kinds `search_profile` and `source_config`; current API kinds `profile` and `portals` map to them without creating duplicate records.

### Profile: canonical header

```text
Document.kind = search_profile
body = YAML frontmatter + Markdown
id: string = stable Document.key
name: string (1..80 characters)
active: boolean
filters.Employment: string?
filters.Work arrangement: string?
filters.Location: string?
filters.Minimum base pay: string?
filters.Schedule: string?
filters.Experience level: string?
priorities: known key → importance
importance: Important / Very important
Known keys: Pay, Stability, Flexibility,
Growth, Meaningful work, Team quality,
Getting employed quickly
Other preferences stay in named prose.
```

### Profile: named Markdown fields

```text
Role preferences: Roles, Specializations
Company preferences: Company size, Industries
Skill preferences: Skills to use,
  Security clearance
Work-life balance & benefits:
  Work-life balance, Employer benefits
Avoid: Companies / Industries / Skills to avoid
Priority & flexibility: preference key →
  Required / Preferred / Flexible
Career goals & tradeoffs:
  Career goals: text; Tradeoffs: text
Profile evaluation / Rules: text
Application identity: preferred names,
  application email, email/document accounts,
  outreach identity (not verified facts)
Availability: start, notice, relocation
Employer answer writing: Tone, Length, Guidance
Outreach writing: Tone, Length, Guidance
Custom headings / free prose: preserved
```

### Profile: typed references in sections

```text
Application materials / Default resume ID
Application materials / Saved answer IDs[]
Company priorities / Tier list ID
Tier list name: display cache, ID wins
Recruiting targets / Targets: array (max 30)
target.id: stable string
target.name: string; active: boolean
target.roles: text
target.employment?: employment filter value
target.resumeId: document ID or blank
target.timeline: text; conditions: text
Blank resume ID → selected default resume
Validate ownership, kind, archive state.
Selected answer still needs reuse review.
Assignments follow head; drafts pin version.
```

### Source config: canonical YAML fields

```text
Document.kind = source_config
tracked_companies: source[] (max 100)
source.id: stable string, unique
source.name: text (max 120)
source.kind: board / careers / social
source.careers_url: HTTPS URL or @handle
source.enabled: boolean
source.provider: text? (max 100)
source.api: HTTPS URL?
source.keywords: text[]? (max 20)
search_queries: string[] (max 100)
title_filter.positive: string[]?
title_filter.negative: string[]?
location_filter.allow: string[]?
location_filter.strict: boolean?
Patch simple UI fields; preserve all others.
Deduplicate by kind + canonical address.
```

### Analysis: freeform content contract

```text
Document.kind = analysis
DocumentVersion.body: Markdown or HTML
attributes.analysis_kind: controlled enum
  role_fit / company_research / comparison /
  prep_recommendations / search_review / general
Headings/bullets/paragraphs remain prose.
Examples: matching evidence, material gaps,
  team questions, recommendations, tradeoffs
No table per heading or analysis subtype.
DocumentLink gives one or more typed subjects.
Optional input_refs identify context used.
Sources are optional; caveats stay in the body.
Document.reviewed_version_no: editorial only
New content never overwrites reviewed revision.
```

### Version: minimal authorship and sources

```text
author.kind: human / agent / import
author.account_id or connection_id: typed ID
created_at: timestamp (version creation)
sources[]: title, URL, observed_at (optional)
input_refs[]: optional typed references
  document: id + version_no
  observation: SourceObservation ID
  candidate: owner + revision
  saved_answer / tier_list / decision: id + revision
Mutable revision refs identify context only.
Historical values stay in run/draft evidence.
Caveats and uncertainty stay in the body.
Personal agents perform reasoning externally.
```

### Short text: ordinary record edits

```text
Text stays on its existing domain record.
updated_by?: typed actor (last record editor)
updated_at: existing record timestamp
Actor: human account / agent connection / import
Last editor does not imply all-field authorship.
Missing actor = unknown, never assume human.
Use existing domain evidence/source links.
No per-field hashes or attribution maps.
No model, provider or recipe metadata.
Reusable/reviewable output → versioned document.
```

### Collection: version-owned manifest

```text
Document.kind = collection
payload_kind = manifest; body/blob/url absent
attributes.items: ordered array (max 100)
item.document_id: same-owner document ID
item.version_no: pinned integer
item.section_title: optional text
Position derives from array order.
Atomic new version on any collection edit.
No missing references, duplicates or cycles.
Referenced child versions cannot be deleted.
```

### Execution policy: structured permission

```text
Account.execution_policy: profile-keyed map
profile_document_id: same-owner profile kind
entry.revision: optimistic integer
entry.routine_auto_apply: boolean
entry.review_threshold: S / A / B / C / D / all
entry.tier_list_id: same-owner TierList?
entry.changed_by: human account ID
entry.changed_at: timestamp
Max 50 profile entries; archive disables entry.
Account.policy_revision: map concurrency token
Separate human-only validated policy operation.
Prose can request, never grant permission.
Unknown tiers/facts/form/outcome → pause.
Authorization pins effective policy + draft.
```

## Validation, provenance and lifecycle details

- **One canonical representation.** Profile/source bodies are the authority; Document.projection is a validated, rebuildable read cache pinned by projection_version_no. Profile header ID maps to the stable Document.key. Name/title and active/filter views cannot be independently written. A single atomic version-checked save creates content and projection; UI and MCP use that same service. Concurrent edits return a conflict rather than losing prose.
- **Named sections are not arbitrary extraction.** Reject duplicate headings/keys for known sections, malformed target JSON and invalid reference lists. Preserve unknown headings and text. The current parser does not provide all these guarantees: its frontmatter/body checks and first-heading parser need strengthening. A paragraph can stay prose indefinitely; if AI proposes structured settings from it, show the resulting field changes for review.
- **Typed embedded references.** Resolve profile default/target resumes to same-owner resume documents; answer IDs to same-owner SavedAnswer; tier-list IDs to same-owner TierList. Deduplicate selected answer IDs. Check references at save and use, including archive/unavailable state; selection does not bypass answer-review policy. Historical pinned inputs stay readable after archive, while new selection fails closed. A collection manifest is one version-owned bounded value, with referenced child versions protected from deletion. These are service-enforced references, not hidden SQL FKs. Derived dependency indexes may accelerate reverse lookup, but are never writable truth.
- **Limits.** Existing profile/source content max 60,000 characters; profile narrative max 20,000; filter value max 500; source/query count max 100; recruiting targets max 30. Proposed saved-answer selection max 100; collection members max 100; source citation and input-ref arrays max 100; text analysis max 60,000 characters; inline text max 4,000 characters per eligible field. Exceeding a limit prompts explicit split/document use, never silent truncation. A single account supports up to 50 current profile documents/policy entries in this initial contract. Large resume binaries use blob storage and independently enforced upload limits.
- **Closed content kinds.** Document.kind is search_profile, source_config, analysis, resume, cover_letter, application_template, toolkit_material, debrief, or collection. DocumentVersion.format is markdown/yaml/json/html/pdf/docx/text/url as allowed by kind. Exactly one payload path: text body, private blob, external URL, or collection manifest in attributes. Analysis requires body format markdown or sanitized/sandboxed HTML and attributes.analysis_kind; collection requires attributes.items and no body/blob/URL; other kinds have empty attributes. Do not add arbitrary properties or executable content to this envelope. The reader’s existing HTML isolation must remain.
- **Source configuration is one aggregate.** The simple source UI currently exposes only part of the portals format. Patch a specific source entry, preserving enabled/provider/API/keywords, queries and filters that it did not edit. Normalize and deduplicate addresses by kind (HTTPS canonicalization must preserve identity-bearing parameters; social handles use provider-aware normalization). A source is a search preference, not proof that an integration works.
- **Ordinary record authorship.** SearchRun, SelectionDecision, InterviewRound, PrepTask, CompanyTarget, Contact, Conversation and AgentTask keep an optional updated_by actor alongside the existing updated_at. The trusted writer sets the actual account/connection identity. This identifies the last record editor, not the creator of every field; missing actor means unknown. No per-field attribution maps, content hashes or inference metadata. Existing domain evidence/source fields remain available. SavedAnswer, DraftRevision and PostRevision retain their separate review/evidence boundaries.
- **Minimal document provenance.** DocumentVersion keeps its real author and creation time plus optional sources/input_refs. Input references are a closed typed union of document ID/version, immutable observation ID, candidate owner/revision, or saved-answer/tier-list/decision ID/revision; validate ownership. A reference to a mutable revision identifies the context used but does not guarantee reconstruction of old values. Preserve historical values where already required in SearchRun/SelectionDecision context snapshots and application draft/submission evidence; do not duplicate those snapshots into every analysis. Edits create ordinary document versions with the new author, without generation ancestry. Caveats and uncertainty stay in the freeform body. Candidate narrative drafting remains unverified until an explicit candidate edit/verification action.
- **Staleness and review.** Newer profile/resume/candidate/answer/tier revisions or newer source observations may mark prior analysis “newer inputs available”; this is derived by comparing pinned inputs, not an AI-maintained stale boolean or proof the old conclusion is false. Document review pins reviewed_version_no with a real human reviewer/time. A newer revision does not inherit review. Editing/reviewing research is not verifying facts, approving a submission or approving a Circle disclosure.
- **Profile-specific permission.** Preserve separate execution policy per profile, with human-controlled routine flag, S/A/B/C/D/all review threshold, tier-list binding, actor/time and revision. When a policy uses a tier list, pin that binding independently of the narrative preference; later narrative edits cannot change an effective permission. If the selected list or ranking revision changes, require policy reevaluation and pause execution until required review completes. Profile duplication copies content only and starts with execution disabled; archive disables it. Existing instruction-backed automation UI needs an explicit migration to this proposed human action boundary; the design does not claim it exists today.
- **Historical evidence and sharing.** Application draft/attempt snapshots remain immutable evidence of what was prepared/executed, even if the profile or AI analysis changes. A Circle publication is a separate approved snapshot with its existing exact-revision disclosure rules. Linked private analysis is never automatically public.

## Where the proposal extends current behavior

The current UI already edits profile Markdown fields and source configuration through versioned boundaries; it does not yet implement this entire unified document library, all analysis kinds, input-version comparison UI, or the new validators. Existing `compactBrief()` deliberately omits prose and tells agents to read the full rules. The diagram expresses the target storage contract; it is not evidence that live AI scoring, source integrations or automatic submission have been deployed.

No new analysis type should require a new table. Add an allowed purpose/schema version and corresponding UI presentation when needed; introduce a relation only if the data acquires an independent growing lifecycle, access boundary or query requirement that bounded document content cannot reasonably serve.
