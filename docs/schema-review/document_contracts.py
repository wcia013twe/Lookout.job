"""Visible nested content contracts and UI data flow; these boxes are NOT tables."""
from pathlib import Path
import html
CONTRACTS = [
('Profile: canonical header', [
 'Document.kind = search_profile',
 'body = YAML frontmatter + Markdown',
 'id: string = stable Document.key',
 'name: string (1..80 characters)',
 'active: boolean',
 'filters.Employment: string?',
 'filters.Work arrangement: string?',
 'filters.Location: string?',
 'filters.Minimum base pay: string?',
 'filters.Schedule: string?',
 'filters.Experience level: string?',
 'priorities: known key → importance',
 'importance: Important / Very important',
 'Known keys: Pay, Stability, Flexibility,',
 'Growth, Meaningful work, Team quality,',
 'Getting employed quickly',
 'Other preferences stay in named prose.',
]),
('Profile: named Markdown fields', [
 'Role preferences: Roles, Specializations',
 'Company preferences: Company size, Industries',
 'Skill preferences: Skills to use,',
 '  Security clearance',
 'Work-life balance & benefits:',
 '  Work-life balance, Employer benefits',
 'Avoid: Companies / Industries / Skills to avoid',
 'Priority & flexibility: preference key →',
 '  Required / Preferred / Flexible',
 'Career goals & tradeoffs:',
 '  Career goals: text; Tradeoffs: text',
 'Profile evaluation / Rules: text',
 'Application identity: preferred names,',
 '  application email, email/document accounts,',
 '  outreach identity (not verified facts)',
 'Availability: start, notice, relocation',
 'Employer answer writing: Tone, Length, Guidance',
 'Outreach writing: Tone, Length, Guidance',
 'Custom headings / free prose: preserved',
]),
('Profile: typed references in sections', [
 'Application materials / Default resume ID',
 'Application materials / Saved answer IDs[]',
 'Company priorities / Tier list ID',
 'Tier list name: display cache, ID wins',
 'Recruiting targets / Targets: array (max 30)',
 'target.id: stable string',
 'target.name: string; active: boolean',
 'target.roles: text',
 'target.employment?: employment filter value',
 'target.resumeId: document ID or blank',
 'target.timeline: text; conditions: text',
 'Blank resume ID → selected default resume',
 'Validate ownership, kind, archive state.',
 'Selected answer still needs reuse review.',
 'Assignments follow head; drafts pin version.',
]),
('Source config: canonical YAML fields', [
 'Document.kind = source_config',
 'tracked_companies: source[] (max 100)',
 'source.id: stable string, unique',
 'source.name: text (max 120)',
 'source.kind: board / careers / social',
 'source.careers_url: HTTPS URL or @handle',
 'source.enabled: boolean',
 'source.provider: text? (max 100)',
 'source.api: HTTPS URL?',
 'source.keywords: text[]? (max 20)',
 'search_queries: string[] (max 100)',
 'title_filter.positive: string[]?',
 'title_filter.negative: string[]?',
 'location_filter.allow: string[]?',
 'location_filter.strict: boolean?',
 'Patch simple UI fields; preserve all others.',
 'Deduplicate by kind + canonical address.',
]),
('Analysis: freeform content contract', [
 'Document.kind = analysis',
 'DocumentVersion.body: Markdown or HTML',
 'attributes.analysis_kind: controlled enum',
 '  role_fit / company_research / comparison /',
 '  prep_recommendations / search_review / general',
 'Headings/bullets/paragraphs remain prose.',
 'Examples: matching evidence, material gaps,',
 '  team questions, recommendations, tradeoffs',
 'No table per heading or analysis subtype.',
 'DocumentLink gives one or more typed subjects.',
 'Optional input_refs identify context used.',
 'Sources are optional; caveats stay in the body.',
 'Document.reviewed_version_no: editorial only',
 'New content never overwrites reviewed revision.',
]),
('Version: minimal authorship and sources', [
 'author.kind: human / agent / import',
 'author.account_id or connection_id: typed ID',
 'created_at: timestamp (version creation)',
 'sources[]: title, URL, observed_at (optional)',
 'input_refs[]: optional typed references',
 '  document: id + version_no',
 '  observation: SourceObservation ID',
 '  candidate: owner + revision',
 '  saved_answer / tier_list / decision: id + revision',
 'Mutable revision refs identify context only.',
 'Historical values stay in run/draft evidence.',
 'Caveats and uncertainty stay in the body.',
 'Personal agents perform reasoning externally.',
]),
('Short text: ordinary record edits', [
 'Text stays on its existing domain record.',
 'updated_by?: typed actor (last record editor)',
 'updated_at: existing record timestamp',
 'Actor: human account / agent connection / import',
 'Last editor does not imply all-field authorship.',
 'Missing actor = unknown, never assume human.',
 'Use existing domain evidence/source links.',
 'No per-field hashes or attribution maps.',
 'No model, provider or recipe metadata.',
 'Reusable/reviewable output → versioned document.',
]),
('Collection: version-owned manifest', [
 'Document.kind = collection',
 'payload_kind = manifest; body/blob/url absent',
 'attributes.items: ordered array (max 100)',
 'item.document_id: same-owner document ID',
 'item.version_no: pinned integer',
 'item.section_title: optional text',
 'Position derives from array order.',
 'Atomic new version on any collection edit.',
 'No missing references, duplicates or cycles.',
 'Referenced child versions cannot be deleted.',
]),
('Execution policy: structured permission', [
 'Account.execution_policy: profile-keyed map',
 'profile_document_id: same-owner profile kind',
 'entry.revision: optimistic integer',
 'entry.routine_auto_apply: boolean',
 'entry.review_threshold: S / A / B / C / D / all',
 'entry.tier_list_id: same-owner TierList?',
 'entry.changed_by: human account ID',
 'entry.changed_at: timestamp',
 'Max 50 profile entries; archive disables entry.',
 'Account.policy_revision: map concurrency token',
 'Separate human-only validated policy operation.',
 'Prose can request, never grant permission.',
 'Unknown tiers/facts/form/outcome → pause.',
 'Authorization pins effective policy + draft.',
]),
]

def add_content_sheets(sheets, model, vertex, edge):
 m,root=model('Lookout · From UI input to stored content','DESIGN PROPOSAL · Personal agents reason outside Lookout. Lookout stores context, validates scoped writes and displays results. No internal inference pipeline.')
 blocks=[
 ('input','1 · You use the existing UI','Filters / Career goals / Rules / Sources<br>Example goal: “I want systems depth.”',30,170,'#dae8fc'),
 ('patch','2 · One validated save boundary','Patch only the edited section + expected version.<br>Preserve unknown prose and source properties.<br>Reject duplicate headings, bad references, conflicts.',520,170,'#d5e8d4'),
 ('doc','3 · Canonical versioned document','Document → immutable DocumentVersion<br>YAML fields + Markdown narrative<br>Same write boundary for website and scoped MCP.',1010,170,'#e1d5e7'),
 ('projection','4 · Rebuildable UI / query projection','Known filters / active profiles / source list<br>Read exact version; never separately editable.<br>Agent reads complete prose and exceptions too.',1010,470,'#dae8fc'),
 ('analysis','5 · Your personal agent (external)','Reads full context through scoped MCP.<br>Researches and reasons in its own runtime.<br>Inference stays outside Lookout.',520,470,'#fff2cc'),
 ('review','7 · User reads, edits or reviews','Analysis panel loads the linked version.<br>Editing creates a new revision.<br>“AI draft” / “edited” / “newer inputs available”.',30,470,'#ffe6cc'),
 ('result','6 · Lookout validates + saves output','Body + subject link + author/time.<br>Optional sources and input versions.<br>Same version-checked document/record save.',30,790,'#e1d5e7'),
 ('facts','Structured facts and workflow','CandidateProfile · Job · Application · events<br>Verified answers · permissions · exact approval<br>SubmissionAttempt + actual receipt',520,790,'#f8cecc'),
 ]
 for id,title,desc,x,y,color in blocks:
  vertex(root,id,'<b>'+title+'</b><br><br>'+desc,x,y,430,190,('dashed=1;strokeWidth=2;' if id=='analysis' else '')+'rounded=1;whiteSpace=wrap;html=1;fontSize=17;fillColor='+color+';strokeColor=#64748b;spacing=16;')
 for i,(a,b,label) in enumerate([('input','patch',''),('patch','doc',''),('doc','projection','parse / validate'),('projection','analysis',''),('analysis','result','scoped MCP write'),('result','review','saved output'),('facts','analysis','evidence inputs'),('review','patch','edit content')]):
  edge(root,'flow'+str(i),a,b,label=label,graph=True)
 vertex(root,'boundary','<b>Explicit boundary:</b> an AI interpretation is not a verified fact, a reviewed document is not submission approval, and a profile rule is not execution permission.<br>Candidate facts and policy require their own validated action. Sharing creates a separate approved disclosure snapshot.',30,1060,1410,110,'rounded=1;whiteSpace=wrap;html=1;fontSize=17;fillColor=#f5f5f5;strokeColor=#94a3b8;spacing=16;')
 m.set('pageWidth','1500');m.set('pageHeight','1250');sheets.append(('00a UI and AI content flow',m))
 m,root=model('Lookout · Full document and AI content fields','NESTED CONTENT CONTRACTS, NOT NINE MORE TABLES · Bodies remain prose where interpretation matters. Named preferences and reference lists are validated; permissions stay structured.')
 row_heights=[]
 for j in range(0,len(CONTRACTS),3):row_heights.append(max(58+len(fields)*29 for _,fields in CONTRACTS[j:j+3])+90)
 for i,(name,fields) in enumerate(CONTRACTS):
  x=30+(i%3)*490;y=150+sum(row_heights[:i//3]);id='contract'+str(i)
  vertex(root,id,html.escape(name),x,y,440,58+29*len(fields),'swimlane;html=1;startSize=58;fontSize=17;fontStyle=1;collapsible=0;fillColor=#e1d5e7;strokeColor=#64748b;whiteSpace=wrap;')
  for k,f in enumerate(fields):vertex(root,id+'_'+str(k),html.escape(f),0,58+29*k,440,29,'text;html=1;fontSize=14;align=left;spacingLeft=10;whiteSpace=wrap;',id)
 m.set('pageHeight',str(200+sum(row_heights)));sheets.append(('00b Document and AI fields',m))

def contract_markdown():
 return '\n'.join('### '+name+'\n\n```text\n'+'\n'.join(fields)+'\n```\n' for name,fields in CONTRACTS)
