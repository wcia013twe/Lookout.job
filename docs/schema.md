# Lookout data model

This is the single maintained reference for the implemented schema, relationships and design. The executable source of truth is [`supabase/migrations/`](../supabase/migrations/); this document is not a second SQL schema or a deployment claim.

**Hosted, 2026-10-23:** the prepared schema rollout is deployed: 54 application tables and 49 recorded migrations, including company workspaces, career artifacts, shared practice sessions and Circle storage. Local migrations additionally include the separately developed workspace-reset feature (two more tables), which is not deployed. The old UI-first 44-entity proposal is retired; its hypothetical tables are not implementation requirements. An older editor-modified draw.io file is preserved pending its owner's cleanup.

## Design

Lookout stores context, records, documents and evidence. People's personal agents perform inference, browsing and reasoning externally. The website and narrowly scoped MCP tools share the same owner, version and validation checks.

- **Structured columns** identify owners and records, enforce uniqueness, connect records, and support queries. A company, published job and owned application each have one identity.
- **Bounded JSON** holds small cohesive values edited together: profile facts, tier lists, tasks, document metadata and form answers. These do not each need another table.
- **Freeform text** holds explanations, analysis, research, caveats, preferences and drafts. A paragraph is not a new entity. AI output remains unverified until the relevant human verification or approval action.
- **Separate history** preserves document revisions, observations, events and submission evidence. Growing independent histories belong in rows; exact approved snapshots remain immutable.
- **Read projections** are permitted when derived through one canonical writer. They are not a second editable source of truth. A source snapshot records what was known then; it is not refreshed underneath an approval or past search run.

Do not add model/provider registries, prompt logs, inference runs, per-field AI provenance or a generic entity/attribute/value layer. Existing agent tasks coordinate handoffs and leases; they do not run models.

Partial field edits and agent briefs reuse this model. `update_workspace_fields`
and the four scoped `update_*_fields` MCP tools merge only whitelisted fields into
an existing owned record under its current version, then call its canonical save
validator. Arrays replace the supplied section; missing fields are preserved.
Profile edits invalidate verification; contact drafts are not sent; artifact edits
append the existing immutable revision history. AI analysis belongs in existing
freeform fields, not profile facts or new inference tables.

`read_user_brief_snapshot` and MCP `read_user_brief` read the same bounded private
snapshot. The runtime-independent formatter labels evidence and unknowns, supplies
next actions and obeys existing notification delivery settings. Personal agents
compose and deliver the text. The detailed interaction and consent boundaries are
in [the MCP contract](../mcp/README.md#one-experience-across-personal-agents).


## Relationships at a glance

| Parent → children | Meaning and deduplication |
| --- | --- |
| Auth user → private records | `user_id` or the explicitly named owner/author identifies the permission boundary. Knowledge access also requires Circle membership and publication visibility. |
| Company → jobs / company workspaces / contacts | Shared identity and aliases; one linked company workspace per owner/company. Unknown private company targets remain valid. |
| Job → batch items / applications / search listings | `jobs.canonical_url` is unique. Private discoveries can precede publication; nullable `search_listings.job_id` links exact canonical-URL matches in either creation order. Personal evidence never becomes public through this link. |
| User + job → application | Unique pair. Opening a link is not submission; recruitment milestones, preparation and submission evidence have separate meanings. |
| Application → approvals / attempts / events / milestones / preparation | Exact revision-bound human approval, guarded execution attempts, activity history and user/agent-reported progress remain distinct. |
| Search document → revisions; run → source attempts → observations | A run pins context. Sources checkpoint independently. Screenings are versioned per private listing and identify the run. |
| Artifact → revisions; artifact → typed subjects / pinned materials | One existing document service stores Markdown/HTML. Up to 50 subject links; optional task refinement. Collections reference up to 20 exact owned artifact revisions rather than copying text. |
| Preparation session → bounded task targets | Minutes are recorded once even when practice helps several tasks. Application plans and learning goals share a budget. |
| Circle → members / invites / posts → revisions / approvals / citations | Exact approved revisions are published; private application data is not shared automatically. |

## Documents and AI text

Use existing `search_documents` for configuration and `career_artifacts` for prepared content. Resumes retain their own immutable binary-file lifecycle. Small event-specific outputs remain `career_toolkit_results`. There is no universal replacement Document table.

| What the user types or their agent saves | Storage / UI behavior |
| --- | --- |
| Name, education, experience, skills and other candidate facts | `profiles.facts`; verified separately from generated prose. Profile controls edit typed fields. |
| Search filters and priorities | Canonical profile frontmatter plus its derived preferences projection. Existing controls call the canonical writer. |
| Targeting exceptions, narrative goals and profile rules | Markdown body of the selected search profile. Rules are not candidate evidence or another global policy override. |
| Reusable verified answers | `answer_library.question`, `answer`, scope and reuse policy. Saving analysis does not verify an answer or authorize autofill. |
| Company overview and next action | Typed `company_workspaces` fields, including freeform `research`, `concerns` and `interest`. Longer standalone work can be a linked artifact. |
| Research, fit analysis, interview brief, debrief, reading notes, cover letter or reusable application text | `career_artifacts.content.body` with structured title, kind, purpose, sources and links. Markdown or self-contained HTML; 150,000-character body limit. |
| Prepared application answers | Current `applications.draft`; approval and submission preserve their own snapshots. |
| Screening explanation / selection rationale | `search_screenings.explanation` and `selection_decisions.reason/evidence`, beside the structured decision and run/context evidence. |

An artifact's `content` is `{title, purpose, kind, format, body, sources, links, weekOf?, company?, preparedFor?, materials?}`. `company` is display/context text; use a typed link for identity. Sources are at most 30 `{title,url,observedAt}` records with dated HTTPS URLs. No invented source dates. Content kinds are `weekly_prep`, `company_research`, `interview_brief`, `read_up`, `explainer`, `practice`, `decision_aid`, `notes`, `cover_letter`, `application_template`.

Each `links` item has **exactly one** `applicationId`, `goalId`, `companyWorkspaceId`, `contactId` or `jobId`. `taskId` is optional and only allowed with an application/goal that contains that task. Owned subjects are checked against the authenticated owner; jobs must exist in the shared catalog. Links are validated at save time, not SQL foreign keys inside JSON. Historical document revisions retain their original links; reading them grants no access to a deleted or inaccessible subject. No empty task or synthetic plan is needed merely to save an analysis.

For example, an agent can save a `company_research` artifact with a Markdown body and `links: [{companyWorkspaceId: "my-target"}]`. Network keeps its compact structured overview; the artifact appears in Career Toolkit and can be retrieved by the same target ID. Agents may write the prose, while the user edits facts, preferences and decisions through their existing controls. This pass adds storage/filter support, not a new Network document editor.

`materials` is an ordered list of `{id,version}` references, only for Markdown weekly/interview prep. No nesting, self-links, duplicate materials or application documents. `preparedFor` is a known upcoming need date for those prep kinds; expired and undated material remains on the saved shelf. Reading an artifact does not complete practice. HTML runs in a restricted sandbox without network/account access. Cover letters and application templates appear in About me / Documents. Debriefs use the existing `Interview debrief [applicationId]` purpose marker and revision history; they do not assert a status change.

**Shared actions:** browser `artifact_action` and MCP `list_artifacts`, `read_artifact`, `save_artifact`, `archive_artifact` use the same service. Reads require `workspace:read`; writes require `drafts:write`. Filters include the typed subject IDs. Writes require `expectedVersion`; exact retries replay, conflicting edits reject. Saving a document grants no human approval, publishing consent, answer reuse or submission authority.

## Search

Canonical profiles use JSON-compatible YAML frontmatter (`id`, `name`, `active`, `filters`, `priorities`) and Markdown prose. Shared portals contain `tracked_companies`, `search_queries`, `title_filter`, `location_filter`; a source has `id/name/kind/careers_url/enabled` and optional bounded `provider/api/keywords`. Generic autosync cannot overwrite canonical projections. Simple target edits preserve richer source fields.

`write_search_document` validates content, derives the projection and appends a revision transactionally. Resume replacement now uses that same writer when changing profile assignments; old document revisions, resume files and approved application snapshots retain their original references. A legacy profile without a document is promoted through the same writer when changed.

The personal agent loads context, starts/resumes a run, records per-source checkpoints, saves private listings and observations, and screens them against pinned context. Unknown dates remain null. Identity/canonical URL deduplicates a lead; normalized company/title/location highlights possible matches without merging distinct requisitions. Published jobs are linked by exact canonical URL, not a guessed employer/title match. A job URL change reconciles its links; deleting a job clears the nullable reference without deleting private search history.

`search_action` allows browser context configuration, reads and sweep requests. Scoped `search.*` operations support agent execution evidence; the browser cannot forge a completed sweep. `eventKey` receipts make retries idempotent. Search source attempts remain separate rows because agents can checkpoint sources independently. Scheduling and browsing remain external capabilities.

## Applications and evidence

Keep one application per owner/job. The current schema still uses `applications.status` for compatibility; richer recruitment progress comes from milestones and activity, and preparation from plans. Do not introduce another writable status that can disagree with these records. The current draft's revision advances on material edits, invalidating prior approval. Universal draft-history tables are deferred; approved/attempt snapshots already preserve consequential evidence.

A human approval identifies the exact application revision and snapshot. Automatic policy authorization is distinct from that human act. A submission attempt pins context and authorization and permits at most one guarded click. Confirmed, uncertain and user-reported outcomes are distinct. Uncertain attempts block another attempt until human verification. Neither opening a job link nor saving a document is applying.

Website transitions and MCP operations use the same owned validation. Human-only approval/recovery boundaries are described in [the gateway contract](../backend/agent-contract.md) and [runner contract](../runner/README.md); agents cannot mint consent. `data/jobs.json` remains the static public discovery feed; Supabase owns signed-in private application state.

## Companies and network

`companies` is the maintained identity registry (name, optional domain, bounded aliases). Only trusted maintenance changes it. Exact aliases resolve identity; ambiguity stays unresolved. `company_workspaces` is the private target/research record, not another company identity. Its explicit contact/application links are intentional associations, validated for ownership; company/title similarity alone never establishes process involvement.

Browser `company_action` and MCP `list_companies`, `list_company_workspaces`, `save_company_workspace` share ownership and expected-revision checks. The migration preserves old target IDs, malformed notes and review flags. Conflicts keep local drafts for explicit resolution. A saved company workspace can now be the typed subject of an artifact.

Contacts currently retain the existing bounded `record` object. Conversation notes still encode `lookout-conversation-v1`: general notes, HTTPS conversation URL, up to 50 logged messages (`id,direction,channel,date,body`) and 30 meetings (`id,kind,status,date,notes,location`), bounded to 40 KB. Logs are manual/agent-supplied records, not connected inbox evidence. Contact/application association uses explicit tags or exact job URL. A future independent-message API can normalize that growing history; this pass does not claim that contact deduplication or a conversation-table migration is complete.

## Preparation

Application plans and learning goals keep small bounded task lists with stable IDs. Tasks contain title/detail, estimated minutes, dates and completion state; completed work survives replanning. Shared settings own the daily budget. A session stores its elapsed minutes once and bounded application/goal task targets, validating all expected plan versions atomically. No separate credit table is needed yet.

Browser/MCP `read_preparation_planner`, `save_preparation_budget`, `complete_preparation_session` share the existing scoped boundary; learning goals use `read_learning_goals` / `save_learning_goal`. Interview tasks take precedence and learning fills spare capacity. Preparation completion is user-reported practice, never submission evidence. Documents may support a task or stand alone.

## Circles

Circle tables remain in the private schema behind membership-aware RPCs and a release gate. A post owns immutable revisions; publication requires its exact reviewed revision under the Circle's policy. Edits do not silently replace the published revision. Member feed events and citation receipts are derived activity, not evidence that a person benefited. Optional company references aid retrieval without rewriting approved content or granting access to private application records.

Structured revision content includes type/title/body, provenance/disclosure, sources, company/role/stage context, attached contexts and type-specific experience/offer/resource fields. Author, membership, visibility and publication filtering occur before pagination. [Circle service contract](../backend/circle-knowledge.md) defines actions, permissions and moderation. Binary Circle attachments remain deferred: current local previews are memory-only and cannot be saved/published as persisted attachments. There is no attachment table or live upload capability to document.

## Agents and operations

Connections store hashed, scoped, expiring and revocable credentials. Settings versions are server-maintained invalidation counters. Onboarding sessions and task leases let personal agents resume handoffs. Results are saved outputs, not inference traces. Retry receipts, upload intents, notification deliveries and the opt-in leaderboard projection are operational necessities, not competing domain truth.

The backend provides no model engine, notification transport, scheduler or general database-edit tool. See [MCP setup](../mcp/README.md) and the [gateway contract](../backend/agent-contract.md) for runtime protocols. Facts, consent, submitted evidence, agent observations and generated prose retain separate meanings.

## Complete field reference

The following tables and physical fields were checked against a disposable database built from the complete migration chain. `?` means nullable. PK/unique and FK entries are database constraints; JSON links described above are service-validated. All 54 tables have RLS enabled; that fact alone is not a complete hosted authorization audit. Auth and Storage platform internals are managed by Supabase and excluded.

### Candidate and preferences

**`public.profiles`**

Fields: `user_id uuid`, `facts jsonb`, `verified_at timestamp with time zone?`, `updated_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (user_id)`.

**`public.preferences`**

Fields: `user_id uuid`, `search jsonb`, `tier_lists jsonb`, `active_tier_list_id text?`, `theme jsonb`, `updated_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (user_id)`.

**`public.resumes`**

Fields: `id uuid`, `user_id uuid`, `name text`, `variant text`, `version integer`, `object_path text?`, `reference_url text?`, `content_hash text?`, `created_at timestamp with time zone`, `superseded_by uuid?`.

Keys / relationships: `FOREIGN KEY (superseded_by) REFERENCES resumes(id)`; `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (id)`; `UNIQUE (user_id, id)`.

**`public.answer_library`**

Fields: `id uuid`, `user_id uuid`, `question text`, `answer text`, `context jsonb`, `provenance text`, `verified_at timestamp with time zone?`, `updated_at timestamp with time zone`, `autofill_policy text`, `company_scope text?`.

Keys / relationships: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (id)`.

### Catalog and selection

**`public.companies`**

Fields: `id uuid`, `name text`, `domain text?`, `aliases text[]`.

Keys / relationships: `PRIMARY KEY (id)`.

**`public.jobs`**

Fields: `id text`, `canonical_url text`, `employer jsonb`, `discovered_at timestamp with time zone`, `verified_at timestamp with time zone?`, `company_id uuid?`.

Keys / relationships: `FOREIGN KEY (company_id) REFERENCES companies(id)`; `PRIMARY KEY (id)`; `UNIQUE (canonical_url)`.

**`public.job_batches`**

Fields: `id uuid`, `user_id uuid`, `label text`, `batch_date date`, `source_event_id text`, `created_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (id)`; `UNIQUE (user_id, id)`; `UNIQUE (user_id, source_event_id)`.

**`public.batch_items`**

Fields: `user_id uuid`, `batch_id uuid`, `job_id text`, `position integer`, `recommendation jsonb`, `opened_at timestamp with time zone?`, `saved_at timestamp with time zone?`.

Keys / relationships: `FOREIGN KEY (job_id) REFERENCES jobs(id)`; `FOREIGN KEY (user_id, batch_id) REFERENCES job_batches(user_id, id) ON DELETE CASCADE`; `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (batch_id, job_id)`.

**`public.selection_decisions`**

Fields: `id uuid`, `user_id uuid`, `job_id text`, `event_key text`, `reason text`, `preference text`, `evidence text`, `certainty text`, `personal_version bigint`, `created_at timestamp with time zone`, `reconsidered_at timestamp with time zone?`.

Keys / relationships: `FOREIGN KEY (job_id) REFERENCES jobs(id)`; `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (id)`; `UNIQUE (user_id, event_key)`.

### Search documents and evidence

**`public.search_documents`**

Fields: `user_id uuid`, `kind text`, `id text`, `version integer`, `content text`, `projection jsonb`, `updated_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (user_id, kind, id)`.

**`public.search_document_revisions`**

Fields: `user_id uuid`, `kind text`, `id text`, `version integer`, `content text`, `projection jsonb`, `created_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (user_id, kind, id, version)`.

**`public.search_runs`**

Fields: `id uuid`, `user_id uuid`, `profile_id text`, `context_snapshot jsonb`, `mode text`, `days integer`, `state text`, `version integer`, `summary text`, `created_at timestamp with time zone`, `finished_at timestamp with time zone?`.

Keys / relationships: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (id)`; `UNIQUE (user_id, id)`.

**`public.search_source_attempts`**

Fields: `user_id uuid`, `run_id uuid`, `source_id text`, `source jsonb`, `state text`, `version integer`, `checkpoint jsonb`, `counts jsonb`, `coverage text`, `blocker text`, `updated_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (user_id, run_id) REFERENCES search_runs(user_id, id) ON DELETE CASCADE`; `PRIMARY KEY (user_id, run_id, source_id)`.

**`public.search_listings`**

Fields: `id uuid`, `user_id uuid`, `identity text`, `canonical_url text`, `company text`, `title text`, `location text?`, `requisition_id text?`, `employment_type text?`, `match_key text`, `first_seen timestamp with time zone`, `last_seen timestamp with time zone`, `job_id text?`.

Keys / relationships: `FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL`; `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (id)`; `UNIQUE (user_id, id)`; `UNIQUE (user_id, identity)`.

**`public.search_observations`**

Fields: `id uuid`, `user_id uuid`, `listing_id uuid`, `run_id uuid`, `source_id text`, `checked_at timestamp with time zone`, `liveness text`, `employer_posted_at timestamp with time zone?`, `source_list_age_days integer?`, `evidence text`, `description text`, `observed_url text`, `created_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (user_id, listing_id) REFERENCES search_listings(user_id, id) ON DELETE CASCADE`; `FOREIGN KEY (user_id, run_id, source_id) REFERENCES search_source_attempts(user_id, run_id, source_id) ON DELETE CASCADE`; `PRIMARY KEY (id)`.

**`public.search_screenings`**

Fields: `user_id uuid`, `listing_id uuid`, `version integer`, `run_id uuid`, `decision text`, `checks jsonb`, `explanation text`, `created_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (user_id, listing_id) REFERENCES search_listings(user_id, id) ON DELETE CASCADE`; `FOREIGN KEY (user_id, run_id) REFERENCES search_runs(user_id, id) ON DELETE CASCADE`; `PRIMARY KEY (user_id, listing_id, version)`.

### Applications

**`public.applications`**

Fields: `id uuid`, `user_id uuid`, `job_id text`, `status text`, `revision integer`, `draft jsonb`, `blocker text?`, `submitted_at timestamp with time zone?`, `receipt jsonb?`, `created_at timestamp with time zone`, `updated_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (job_id) REFERENCES jobs(id)`; `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (id)`; `UNIQUE (user_id, id)`; `UNIQUE (user_id, job_id)`.

**`public.approvals`**

Fields: `id uuid`, `user_id uuid`, `application_id uuid`, `revision integer`, `snapshot jsonb`, `approved_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (user_id, application_id) REFERENCES applications(user_id, id) ON DELETE CASCADE`; `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (id)`; `UNIQUE (application_id, revision)`.

**`public.submission_attempts`**

Fields: `id uuid`, `user_id uuid`, `application_id uuid`, `credential_id uuid?`, `attempt_key text`, `revision integer`, `state text`, `context_snapshot jsonb`, `authorization_snapshot jsonb`, `receipt jsonb?`, `created_at timestamp with time zone`, `expires_at timestamp with time zone`, `started_at timestamp with time zone?`, `finished_at timestamp with time zone?`.

Keys / relationships: `FOREIGN KEY (credential_id) REFERENCES private.agent_connections(id) ON DELETE SET NULL`; `FOREIGN KEY (user_id, application_id) REFERENCES applications(user_id, id) ON DELETE CASCADE`; `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (id)`; `UNIQUE (application_id, attempt_key)`.

**`public.activity_events`**

Fields: `id uuid`, `user_id uuid`, `application_id uuid?`, `event_key text`, `kind text`, `actor text`, `payload jsonb`, `occurred_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (user_id, application_id) REFERENCES applications(user_id, id) ON DELETE CASCADE`; `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (id)`; `UNIQUE (user_id, event_key)`.

**`public.application_milestones`**

Fields: `id uuid`, `user_id uuid`, `application_id uuid`, `event_key text`, `kind text`, `label text`, `occurred_at timestamp with time zone?`, `phase text`, `source jsonb`, `created_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (user_id, application_id) REFERENCES applications(user_id, id) ON DELETE CASCADE`; `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (id)`; `UNIQUE (user_id, event_key)`.

### Company workspaces and outreach

**`public.company_workspaces`**

Fields: `user_id uuid`, `id text`, `company_id uuid?`, `name text`, `website text`, `priority text`, `interest text`, `target_teams text`, `concerns text`, `research text`, `next_action text`, `follow_up_date date?`, `sources jsonb`, `contact_ids text[]`, `application_ids text[]`, `archived boolean`, `revision integer`, `created_at timestamp with time zone`, `updated_at timestamp with time zone`, `needs_review boolean`, `legacy_notes text?`.

Keys / relationships: `FOREIGN KEY (company_id) REFERENCES companies(id)`; `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (user_id, id)`; `UNIQUE (user_id, company_id)`.

**`public.outreach_contacts`**

Fields: `id text`, `user_id uuid`, `record jsonb`, `revision integer`, `updated_at timestamp with time zone`, `deleted_at timestamp with time zone?`, `company_id uuid?`.

Keys / relationships: `FOREIGN KEY (company_id) REFERENCES companies(id)`; `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (user_id, id)`.

**`public.outreach_requests`**

Fields: `id uuid`, `user_id uuid`, `companies jsonb`, `status text`, `event_key text?`, `payload_hash text?`, `created_at timestamp with time zone`, `completed_at timestamp with time zone?`.

Keys / relationships: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (id)`.

### Preparation and generated material

**`public.preparation_plans`**

Fields: `user_id uuid`, `application_id uuid`, `plan jsonb`, `version integer`, `updated_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (user_id, application_id) REFERENCES applications(user_id, id) ON DELETE CASCADE`; `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (application_id)`.

**`public.preparation_planner_settings`**

Fields: `user_id uuid`, `daily_minutes integer`, `version integer`.

Keys / relationships: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (user_id)`.

**`public.preparation_sessions`**

Fields: `id uuid`, `user_id uuid`, `minutes integer`, `targets jsonb`, `completed_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (id)`.

**`public.learning_goals`**

Fields: `id uuid`, `user_id uuid`, `version integer`, `goal jsonb`, `updated_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (id)`.

**`public.career_artifacts`**

Fields: `id uuid`, `user_id uuid`, `version integer`, `archived boolean`, `content jsonb`, `created_at timestamp with time zone`, `updated_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (id)`.

**`public.career_artifact_revisions`**

Fields: `artifact_id uuid`, `user_id uuid`, `version integer`, `content jsonb`, `archived boolean`, `created_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (artifact_id) REFERENCES career_artifacts(id) ON DELETE CASCADE`; `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (artifact_id, version)`.

**`public.career_toolkit_results`**

Fields: `id uuid`, `user_id uuid`, `application_id uuid?`, `kind text`, `event_key text`, `result jsonb`, `created_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE`; `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (id)`; `UNIQUE (user_id, event_key)`.

### Circles

**`private.knowledge_config`**

Fields: `singleton boolean`, `enabled boolean`.

Keys / relationships: `PRIMARY KEY (singleton)`.

**`private.circles`**

Fields: `id uuid`, `name text`, `owner_id uuid`, `created_at timestamp with time zone`, `feed_sequence bigint`.

Keys / relationships: `FOREIGN KEY (owner_id) REFERENCES auth.users(id)`; `PRIMARY KEY (id)`.

**`private.circle_members`**

Fields: `circle_id uuid`, `user_id uuid`, `alias text`, `active boolean`, `access_revoked_at timestamp with time zone?`, `allowed_types text[]`.

Keys / relationships: `FOREIGN KEY (circle_id) REFERENCES private.circles(id) ON DELETE CASCADE`; `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (circle_id, user_id)`.

**`private.circle_invites`**

Fields: `id uuid`, `circle_id uuid`, `token uuid`, `created_at timestamp with time zone`, `expires_at timestamp with time zone`, `revoked_at timestamp with time zone?`.

Keys / relationships: `FOREIGN KEY (circle_id) REFERENCES private.circles(id)`; `PRIMARY KEY (id)`; `UNIQUE (token)`.

**`private.knowledge_posts`**

Fields: `id uuid`, `circle_id uuid`, `author_id uuid`, `parent_id uuid?`, `current_revision integer`, `published_revision integer?`, `state text`, `source_event_id uuid?`, `created_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (author_id) REFERENCES auth.users(id)`; `FOREIGN KEY (circle_id) REFERENCES private.circles(id)`; `FOREIGN KEY (parent_id) REFERENCES private.knowledge_posts(id)`; `PRIMARY KEY (id)`.

**`private.knowledge_revisions`**

Fields: `post_id uuid`, `revision integer`, `content jsonb`, `connection_id uuid?`, `created_at timestamp with time zone`, `search_document tsvector?`.

Keys / relationships: `FOREIGN KEY (connection_id) REFERENCES private.agent_connections(id)`; `FOREIGN KEY (post_id) REFERENCES private.knowledge_posts(id) ON DELETE CASCADE`; `PRIMARY KEY (post_id, revision)`.

**`private.knowledge_approvals`**

Fields: `post_id uuid`, `revision integer`, `user_id uuid`, `approved_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (post_id, revision) REFERENCES private.knowledge_revisions(post_id, revision)`; `FOREIGN KEY (user_id) REFERENCES auth.users(id)`; `PRIMARY KEY (post_id, revision)`.

**`private.knowledge_citations`**

Fields: `id uuid`, `post_id uuid`, `revision integer`, `user_id uuid`, `connection_id uuid?`, `category text`, `reference text`, `created_at timestamp with time zone`, `retracted_at timestamp with time zone?`.

Keys / relationships: `FOREIGN KEY (connection_id) REFERENCES private.agent_connections(id)`; `FOREIGN KEY (post_id, revision) REFERENCES private.knowledge_revisions(post_id, revision)`; `FOREIGN KEY (user_id) REFERENCES auth.users(id)`; `PRIMARY KEY (id)`; `UNIQUE (post_id, revision, user_id)`.

**`private.knowledge_reports`**

Fields: `id uuid`, `post_id uuid?`, `user_id uuid?`, `reason text`, `created_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (post_id) REFERENCES private.knowledge_posts(id)`; `FOREIGN KEY (user_id) REFERENCES auth.users(id)`; `PRIMARY KEY (id)`; `UNIQUE (post_id, user_id)`.

**`private.knowledge_requests`**

Fields: `user_id uuid`, `event_key text`, `operation text`, `payload jsonb`, `result jsonb`, `created_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (user_id) REFERENCES auth.users(id)`; `PRIMARY KEY (user_id, event_key)`.

**`private.circle_events`**

Fields: `circle_id uuid`, `position bigint`, `id uuid`, `post_id uuid`, `revision integer`, `kind text`, `created_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (circle_id) REFERENCES private.circles(id)`; `FOREIGN KEY (post_id, revision) REFERENCES private.knowledge_revisions(post_id, revision)`; `PRIMARY KEY (circle_id, "position")`; `UNIQUE (id)`; `UNIQUE (post_id, revision, kind)`.

### Agent access and operational records

**`private.agent_connections`**

Fields: `id uuid`, `user_id uuid`, `name text`, `token_hash text`, `scopes text[]`, `created_at timestamp with time zone`, `expires_at timestamp with time zone`, `revoked_at timestamp with time zone?`.

Keys / relationships: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (id)`; `UNIQUE (token_hash)`.

**`private.agent_settings_versions`**

Fields: `user_id uuid`, `version bigint`.

Keys / relationships: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (user_id)`.

**`private.agent_profile_imports`**

Fields: `user_id uuid`, `event_key text`, `request jsonb`, `result jsonb`, `created_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (user_id, event_key)`.

**`private.agent_resume_uploads`**

Fields: `id uuid`, `user_id uuid`, `event_key text`, `file_name text`, `variant text`, `extension text`, `bytes integer`, `sha256 text`, `expires_at timestamp with time zone`, `resume_id uuid?`.

Keys / relationships: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `FOREIGN KEY (user_id, resume_id) REFERENCES resumes(user_id, id) ON DELETE CASCADE`; `PRIMARY KEY (id)`; `UNIQUE (user_id, event_key)`.

**`private.resume_upload_intents`**

Fields: `id uuid`, `user_id uuid`, `metadata jsonb`, `created_at timestamp with time zone`, `completed_at timestamp with time zone?`.

Keys / relationships: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (id)`.

**`private.career_toolkit_files`**

Fields: `id uuid`, `user_id uuid`, `application_id uuid?`, `event_key text`, `kind text`, `name text`, `variant text`, `object_path text`, `sha256 text`, `bytes integer`, `completed_at timestamp with time zone?`, `expires_at timestamp with time zone`, `created_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE`; `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (id)`; `UNIQUE (object_path)`; `UNIQUE (user_id, event_key)`.

**`private.onboarding_sessions`**

Fields: `user_id uuid`, `revision bigint`, `step text`, `data jsonb`, `completed_steps text[]`, `updated_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (user_id)`.

**`private.onboarding_events`**

Fields: `user_id uuid`, `event_key text`, `request jsonb`, `response jsonb`, `created_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (user_id, event_key)`.

**`private.agent_tasks`**

Fields: `id uuid`, `user_id uuid`, `kind text`, `target jsonb`, `state text`, `revision bigint`, `onboarding_revision bigint`, `event_key text`, `claim_token uuid?`, `claimed_by uuid?`, `lease_until timestamp with time zone?`, `attempts integer`, `result jsonb`, `created_at timestamp with time zone`, `updated_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (id)`; `UNIQUE (user_id, event_key)`.

**`private.search_requests`**

Fields: `user_id uuid`, `event_key text`, `operation text`, `payload jsonb`, `response jsonb`, `created_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (user_id, event_key)`.

**`public.notification_deliveries`**

Fields: `id uuid`, `user_id uuid`, `event_key text`, `kind text`, `event_ids jsonb`, `delivered_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (id)`; `UNIQUE (user_id, event_key)`.

**`public.leaderboard_entries`**

Fields: `user_id uuid`, `alias text`, `opted_in boolean`, `xp bigint`, `streak integer`, `applications_count integer`, `updated_at timestamp with time zone`.

Keys / relationships: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`; `PRIMARY KEY (user_id)`.

## Migration history and release

Historical migrations remain required replay/upgrade code, not obsolete schema documentation. They contain backfills, triggers, grants, function replacements and compatibility dispatchers. **Do not delete or concatenate them merely to reduce file count.** Existing hosted history contains different timestamps for some equivalent named changes and is missing later features. A baseline cutover must first reconcile actual applied SQL, test upgrades with existing records and preserve an agreed baseline/version ledger. This pass has not performed that production cutover.

Use the normal isolated feature workflow. Run `npm test`, `npm run validate:data` and the production build for shared contracts. Migration tests rebuild from scratch and regression scenarios check existing records, ownership, retries and revision history. The fictional demo supports standalone subject-linked material without account/network writes.

Before release: reconcile hosted migration names/definitions and dependencies, apply the missing changes from integrated main in order, deploy gateway/MCP with developer contract **43**, then verify real website/MCP access and two-account isolation before exposing dependent features. The current GitHub `deploy.yml` publishes the frontend only; it is not evidence that database migrations or Edge Functions were released. Do not blindly replay a baseline, reset production or advertise hosted parity based on local tests.

Deferred rather than silently implemented: normalized person/conversation history, separate recruitment/preparation status columns, universal draft revision history, and migration squashing. Add each only with its service/UI migration and demonstrated need. Separate alias, tier-placement, preparation-task, practice-credit and universal document tables are not required by this implementation.

## My Agent tasks and card packs

No new tables. `preferences.search.schedule` owns reusable task definitions:
`{enabled, timezone, configVersion, routines:[{id,title,description,enabled,mode,time,sourceIds,connectionIds}]}`.
`description` is freeform task instructions (up to 4,000 characters); sources reference
existing `search.targets`, and connection IDs reference the owner's existing agent
connections. Up to 30 tasks, eight sources and four connections per task. Old daily
routines remain valid; missing `mode` means scheduled. `mode: manual` requests work
on demand. Global `enabled` requests recurring runs; a task's `enabled: false` pauses
publishing even for manual runs. Personal agents perform the work and arrange runtime
scheduling. Saving settings does not create a scheduler or grant source access.

`preferences.theme.cardPacks` is an optional list (up to eight) of
`{id,title,enabled,taskId,archive?}`. It links a widget to a task by stable ID, with no
copy of instructions, sources or agent connections. `archive: zero2sudo` explicitly
includes the existing dated public archive; it requires a linked Zero2Sudo source
at configuration time. The archive is not fresh verification. Other accounts start
without widgets. Removing a widget or task retains prior batches; a missing task is
shown as disconnected, and publishing is rejected until the widget is relinked.

Browser `configure_card_pack_preferences` and MCP `agent_dispatch` call the same
private settings writer and database validation:
`save_notification_preferences` saves task definitions, `save_theme_preferences`
saves widgets, both using the exact preferences `updated_at`. Increment the respective
`schedule.configVersion` or `theme.cardPacksVersion`. Database guards preserve those
versioned sections against stale legacy whole-workspace autosync.

`publish_batch` stores cards in existing `job_batches` → `batch_items` → canonical
`jobs`. Every item in a pack batch supplies `recommendation.cardPackId` and a selected
`sourceId`; bounded `note`, `skipReason` and `dropStatus` hold private analysis and
presentation status, not application progress. The server verifies owned, enabled
task/widget, active assigned connection and `batches:write`; it records the actual
`publisherConnectionId` and `automationTaskId`. A reserved, server-generated event key
routes the batch to its widget and preserves retry idempotency. Ordinary batches
cannot spoof that route. `read_batch` and personal-context reads remain available
without the UI. Opening/revealing a pack remains local presentation state.

Migration: `20261023060931_account_card_pack_widgets.sql`. Gateway instruction
version 46 describes this contract. The task/widget database migration was applied and ownership/version checks were verified on the hosted project on 2026-10-23. Frontend/gateway discovery deployment and external-agent execution remain pending; the broader local schema is not deployed by this change.

## Hosted rollout (2026-10-23)

Seventeen previously missing migrations plus `20261023062141_reconcile_hosted_schema.sql`
are deployed. Hosted storage moved from 35 to 54 application tables. The rollout covers
platform/MCP actions, Circle records and feeds, shared preparation, company
workspaces, artifacts and revisions, resume replacement, canonical discovery links,
and partial field updates. Reconciliation restores the current dispatcher,
connection validation and protected preference handling after older missing work.

The transaction passed its locked empty-state preflight and before/after record
checksums. All 77 existing catalog jobs were retained; optional company links were
backfilled. At deployment there were no applications, approvals, submission attempts,
resumes, private listings, legacy company-contact records or active connections.
No account was reset, credential issued, submission made or external message sent.

Hosted history now records 49 migrations. Nine equivalent timestamp aliases were
normalized without replaying them. The MCP-generated reconciliation timestamp was
aligned to the committed source version and its history SQL to the reconciliation
source; the other 17 migrations retain their own source/history records.

Pre-deployment validation passed 487 tests and catalog validation (147 roles), with
fresh/upgrade function and grant equality and exact-bundle rollback rehearsals.
Post-deployment checks found all 125 deployed application function definitions equal
to the rehearsed schema. All 54 tables have RLS. Gateway dispatch remains service-only;
artifact and Circle facades deny anonymous access. Hosted transactional probes passed
artifact read/create/update, stale-version rejection and owner mismatch rejection;
all probe writes rolled back and left zero artifacts.

Security advisors report intentional authenticated SECURITY DEFINER facades and
private RLS tables without direct-access policies. The existing
[leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
remains. The privileged facade grants are intentional;
[Supabase's advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
should be reviewed alongside their owner checks rather than suppressed.

Earlier automatic-review rejections were resolved when the user requested another
retry; `supabase_apply_migration` succeeded. This completes the prepared database
rollout. A subsequent Edge Function release is recorded below. Circle availability remains disabled
pending its hosted consent/access release verification. The separately developed
`20261023061223_workspace_reset.sql` is still local and was not part of this rollout.


## Edge Function release (2026-10-23)

Released committed local-main source `25f8160` through the Supabase connector after
local integration and validation: `agent-gateway` deployment 24, `agent-mcp`
deployment 20, developer instructions 47. Both are ACTIVE. Downloaded deployment
source matches all 43 gateway and 22 MCP bundled files exactly, including shared
validators, card-pack settings, partial field edits, user briefs and guide content.
Both retain custom authentication (`verify_jwt=false`): the gateway validates human
sessions or scoped opaque agent credentials; MCP delegates credential checks to it.
Live HTTP probes reject missing and invalid credentials with 401 on both endpoints.

The existing GitHub workflow publishes only the frontend; no automatic Edge Function
release job exists. This was an explicit connector release from merged local main,
not a feature-branch deployment or GitHub push. Previous validation passed 498 tests
and catalog validation (147 roles); no application source was edited for this release.
Authenticated MCP discovery/read/write remains unverified because no active personal
agent connection exists. Connect an agent through the human account flow, then refresh
tool discovery. No connection or credential was manufactured for release testing.
Circle activation, the separate workspace-reset migration/function, and frontend
publication remain outside this release. The reset MCP tool is only a human handoff.
