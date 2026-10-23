"""Explicit top-level fields for the proposed logical schema (not executable DDL).
Document subfields appear on the content-contract sheet and in document-contracts.md.
Other bounded JSON contracts are specified in README.md. ? means nullable.
"""
FIELDS = {
'Company': 'PK id: uuid|name: text|normalized_name: text|domain: text?|logo_asset: text?',
'CompanyAlias': 'PK id: uuid|FK company_id: uuid|namespace: text|alias_key: text|label: text',
'Job': 'PK id: uuid|FK company_id: uuid|requisition_key: text?|title: text|type: FT / Internship|locations: json[]|setting: enum?|focus: text?|description: text?|pay: json?|eligibility: json?|posted_at: date?|state: enum',
'Posting': 'PK id: uuid|FK job_id: uuid|canonical_url: text UQ|provider: text?|external_id: text?|verified_at: timestamp?|availability: enum',
'SearchRun': 'PK id: uuid|FK owner_id: uuid?|FK profile_document_id: uuid?|FK profile_version_no: int?|FK source_document_id: uuid?|FK source_version_no: int?|FK connection_id: uuid?|scope: public / private|mode: enum|state: enum|context_snapshot: json?|checkpoints: json[]|started_at: timestamp?|completed_at: timestamp?|event_key: text|summary: text?|updated_by: actor?',
'SourceObservation': 'PK id: uuid|FK run_id: uuid|FK job_id: uuid?|FK posting_id: uuid?|source_key: text|occurrence_key: text|source_url: text|observed_at: timestamp|source_age_days: int?|employer_date: date?|evidence: json|description: text?|raw_lead: json?',
'SelectionDecision': 'PK id: uuid|FK owner_id: uuid|FK profile_document_id: uuid|FK profile_version_no: int|FK observation_id: uuid|FK job_id: uuid?|decision: enum|priority: enum?|rationale: text|checks: json[]|gaps: json[]|upside_tier: enum?|exclusion_preference: json?|certainty: enum?|context_snapshot: json|updated_by: actor?|reconsidered_at: timestamp?|revision: int',
'Batch': 'PK id: uuid|FK owner_id: uuid?|FK run_id: uuid|scope: public / private|label: text|published_at: timestamp?|event_key: text',
'BatchItem': 'PK/FK batch_id: uuid|PK/FK job_id: uuid|FK decision_id: uuid?|position: int|discovered_date: date',
'Account': 'PK id: uuid|auth_subject: text UQ|login_email: text|settings: json|personal_version: int|settings_revision: int|execution_policy: json|policy_revision: int',
'CandidateProfile': 'PK/FK owner_id: uuid|contact: json|summary: json|links: json|work: json[]|education: json[]|projects: json[]|skills: json[]|preferred_skills: text[]|languages: json[]|eligibility_by_country: json[]|revision: int|verified_revision: int?|verified_at: timestamp?',
'SavedAnswer': 'PK id: uuid|FK owner_id: uuid|FK company_id: uuid?|scope_kind: enum|scope_key: text|scope_label: text?|question: text|normalized_key: text|answer: text|provenance: json|reuse_policy: ask / reviewed_auto|requested_policy: enum?|revision: int|reviewed_revision: int?|reviewed_at: timestamp?|archived_at: timestamp?',
'TierList': 'PK id: uuid|FK owner_id: uuid|name: text|description: text|ordered_tiers: json[]|revision: int',
'TierPlacement': 'PK/FK list_id: uuid|PK/FK company_id: uuid|tier_key: text?|position: int',
'Document': 'PK id: uuid|FK owner_id: uuid|kind: enum|key: text?|title: text (head projection)|variant: text?|current_version_no: int|projection: json (derived)|projection_version_no: int|reviewed_version_no: int?|FK reviewed_by: uuid?|reviewed_at: timestamp?|archived_at: timestamp?',
'DocumentVersion': 'PK/FK document_id: uuid|PK version_no: int|title: text|payload_kind: body / blob / url / manifest|format: enum|body: text?|blob_key: text?|source_url: text?|sha256: text?|mime: text?|bytes: bigint?|purpose: text|sources: json[]|schema_version: int|attributes: json|week_of: date?|prepared_for: date?|company_context: json?|author: json|input_refs: json[]',
'DocumentLink': 'PK id: uuid|FK document_id: uuid|FK application_id: uuid?|FK round_id: uuid?|FK plan_id: uuid?|FK task_id: uuid?|FK company_target_id: uuid?|FK job_id: uuid?|FK decision_id: uuid?|FK contact_id: uuid?|FK conversation_id: uuid?|FK run_id: uuid?|FK profile_document_id: uuid?|FK profile_version_no: int?|relation: enum',
'Application': 'PK id: uuid|FK owner_id: uuid|FK job_id: uuid|FK profile_document_id: uuid?|opened_at: timestamp?|queued_at: timestamp?|recruiting_stage: enum|stage_date: date?|preparation_state: enum|blocker: json?|reported_applied_at: timestamp?|revision: int',
'DraftRevision': 'PK/FK application_id: uuid|PK revision: int|FK resume_document_id: uuid?|FK resume_version: int?|form_fingerprint: text?|questions_answers: json[]|profile_snapshot: json|policy_snapshot: json|answer_snapshots: json[]|review_state: enum|blockers: json[]|actor: json',
'Authorization': 'PK id: uuid|FK application_id: uuid|FK draft_revision: int|kind: human / routine_policy|actor: json|policy_snapshot: json|expires_at: timestamp?|revoked_at: timestamp?|material_digest: text',
'SubmissionAttempt': 'PK id: uuid|FK application_id: uuid|FK draft_revision: int|FK authorization_id: uuid|state: enum|idempotency_key: text|claim: json|click_permit_digest: text?|executed_fields: json[]|resume_evidence: json|receipt: json?|resolution: json?|started_at: timestamp?|finished_at: timestamp?',
'ApplicationEvent': 'PK id: uuid|FK application_id: uuid|FK round_id: uuid?|kind: enum|actor: json|provenance: enum|occurred_date: date?|occurred_at: timestamp?|precision: unknown / day / time|recorded_at: timestamp|payload: json|event_key: text',
'InterviewRound': 'PK id: uuid|FK application_id: uuid|kind: enum|label: text|phase: enum|scheduled_date: date?|scheduled_time: time?|timezone: text?|date_confirmed: bool|precision: unknown / day / time|source: json|notes: text|revision: int|updated_by: actor?',
'PrepPlan': 'PK id: uuid|FK owner_id: uuid|FK application_id: uuid?|goal_title: text?|kind: application / learning|deadline: date?|confirmed: bool|source: json|state: enum|revision: int',
'PrepTask': 'PK id: uuid|FK plan_id: uuid|title: text|detail: text|category: enum|minutes: int|due_date: date?|position: int|state: enum|revision: int|updated_by: actor?',
'PracticeSession': 'PK id: uuid|FK owner_id: uuid|minutes: positive int|completed_at: timestamp|idempotency_key: text',
'PracticeCredit': 'PK/FK session_id: uuid|PK/FK task_id: uuid|expected_plan_revision: int|credited_minutes: int',
'CompanyTarget': 'PK id: uuid|FK owner_id: uuid|FK company_id: uuid?|unresolved_name: text?|website: text?|priority: enum|interest: text|teams: text[]|questions: text[]|next_action: text?|follow_up_date: date?|archived_at: timestamp?|revision: int|updated_by: actor?',
'Contact': 'PK id: uuid|FK owner_id: uuid|FK company_id: uuid?|unresolved_company_name: text?|name: text|employment_role: text?|contact_type: enum|email: text?|linkedin: text?|evidence: text|source_url: text?|tags: text[]|connection_context: text?|reason: text?|notes: text|archived_at: timestamp?|revision: int|updated_by: actor?',
'Conversation': 'PK id: uuid|FK owner_id: uuid|FK contact_id: uuid|FK company_id: uuid?|unresolved_company_name: text?|target_role: text?|subject: text|draft_body: text|channel: enum?|outcome: enum|follow_up_date: date?|url: text?|notes: text|revision: int|updated_by: actor?',
'ConversationApplication': 'PK/FK conversation_id: uuid|PK/FK application_id: uuid',
'Interaction': 'PK id: uuid|FK conversation_id: uuid|kind: message / meeting / coffee_chat|direction: sent / received / null|channel: LinkedIn / Email / null|status: scheduled / completed / cancelled / null|occurred_date: date|body: text?|notes: text?|location: text?|provenance: enum|revision: int|event_key: text',
'Circle': 'PK id: uuid|name: text|revision: int',
'CircleMember': 'PK/FK circle_id: uuid|PK/FK account_id: uuid|alias: text|role: owner / member|state: active / left / removed|allowed_contribution_types: enum[]|joined_at: timestamp|removed_at: timestamp?|revision: int',
'CircleInvite': 'PK id: uuid|FK circle_id: uuid|token_hash: text UQ|encrypted_token: text?|FK created_by: uuid|expires_at: timestamp|revoked_at: timestamp?',
'Post': 'PK id: uuid|FK circle_id: uuid|FK author_id: uuid|FK parent_id: uuid?|state: enum|current_revision: int|published_revision: int?',
'PostRevision': 'PK/FK post_id: uuid|PK revision: int|type: enum|title: text|body: text|contexts: json[]|offers: json[]|sources: json[]|activity: json?|insight: text?|experience_date: date?|provenance: enum|uncertainty: text?|agent_authored: bool|personal_disclosure: bool|FK human_approver: uuid?|approved_at: timestamp?',
'PostPublication': 'PK/FK circle_id: uuid|PK sequence: bigint|FK post_id: uuid|FK revision: int|kind: publish / withdraw / hide|actor: json|occurred_at: timestamp',
'ModerationReport': 'PK id: uuid|FK post_id: uuid|FK reporter_id: uuid|reason: text|state: enum|resolution: text?|FK resolved_by: uuid?|resolved_at: timestamp?',
'AgentReceipt': 'PK id: uuid|FK owner_id: uuid|FK connection_id: uuid|FK post_id: uuid|FK post_revision: int|category: enum|reference: text|retracted_at: timestamp?',
'AgentConnection': 'PK id: uuid|FK owner_id: uuid|name: text|credential_digest: text|scopes: enum[]|expires_at: timestamp?|revoked_at: timestamp?|capability_evidence: json|revision: int',
'AgentCheckpoint': 'PK/FK connection_id: uuid|PK context_key: text|acknowledged_version: int?|feed_cursor: json?',
'OnboardingSession': 'PK id: uuid|FK owner_id: uuid|FK match_job_id: uuid?|step: enum|intent: text|requested_policy: enum|match_evidence: json?|delivery_request: json?|blocker: text?|paused_from: enum?|revision: int|event_key: text',
'AgentTask': 'PK id: uuid|FK owner_id: uuid|FK session_id: uuid?|FK connection_id: uuid?|FK job_id: uuid?|kind: enum|state: enum|revision: int|event_key: text|claim_expires_at: timestamp?|target_companies: json[]|result_refs: json|result_summary: text?|evidence: json|updated_by: actor?',
}
# Common metadata is explicitly shown on each table.
IMMUTABLE = ['ApplicationEvent', 'BatchItem', 'DocumentVersion', 'DraftRevision', 'PostPublication', 'PostRevision', 'PracticeCredit', 'PracticeSession', 'SourceObservation']
def expand(tables):
 assert set(tables)==set(FIELDS)
 for name,t in tables.items():
  t['fields']=FIELDS[name].split('|')+['created_at: timestamp']
  if name not in IMMUTABLE: t['fields'].append('updated_at: timestamp')
