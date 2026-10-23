"""Build editable review diagrams and a field dictionary. Proposal only; no DDL."""
from pathlib import Path
import json, html, xml.etree.ElementTree as E
HERE=Path(__file__).parent
T={}; R=[]; sheets=[]
def table(name,group,fields,note):
 T[name]={'group':group,'fields':fields.split('|'),'note':note}
def fk(child,field,parent,optional=False,many=True): R.append({'child':child,'field':field,'parent':parent,'optional':optional,'many':many})
def add(group,name,fields,note): table(name,group,fields,note)
# Each JSON aggregate below is typed and bounded; it is not an arbitrary property bag.
g='01 Catalog and discovery'
add(g,'Company','','Shared employer identity; names alone are not unique. Registry controls aliases and merges.')
add(g,'CompanyAlias','','UQ(namespace, alias_key) for verified aliases. Ambiguous names remain unresolved.')
add(g,'Job','','One employer requisition/cycle. FT or Internship. Pay preserves currency, basis, period, range and source; absence is unknown.')
add(g,'Posting','','Multiple verified employer/ATS URLs may resolve to one job. Tracking URL aliases normalize here; do not strip identity-bearing parameters.')
add(g,'SearchRun','','Public catalog runs have no owner/profile; private runs require owner. Bounded per-source checkpoints include coverage, counts and blockers. Pin source settings/profile revision.')
add(g,'SourceObservation','','Append-only occurrence. Allows unresolved social/list leads; employer verification required before canonical job admission. UQ(run, source_key, occurrence_key).')
add(g,'SelectionDecision','','Private assessment, not public job fact. One current decision per owner/profile/observation; retain previous decision in run evidence when revised.')
add(g,'Batch','','Public or private collection of selected jobs. Public batch date defines lastRun; a URL/id never grants private access.')
add(g,'BatchItem','','FK batch_id → Batch; job_id → Job. UQ(batch, position). Private rationale comes from a same-owner decision; public editorial notes stay explicitly editorial.')
for a,b,c,o,m in [('CompanyAlias','company_id','Company',False,True),('Job','company_id','Company',False,True),('Posting','job_id','Job',False,True),('SearchRun','profile_id','SearchProfile',True,True),('SourceObservation','run_id','SearchRun',False,True),('SourceObservation','job_id','Job',True,True),('SourceObservation','posting_id','Posting',True,True),('SelectionDecision','observation_id','SourceObservation',False,True),('SelectionDecision','profile_id','SearchProfile',False,True),('SelectionDecision','job_id','Job',True,True),('Batch','run_id','SearchRun',False,True),('BatchItem','batch_id','Batch',False,True),('BatchItem','job_id','Job',False,True),('BatchItem','decision_id','SelectionDecision',True,True),('SearchRun','connection_id','AgentConnection',True,True)]:fk(a,b,c,o,m)
g='02 Candidate and preferences'
add(g,'Account','','Settings hold companion, notifications, timezone, routines, quiet sharing, prep budget, leaderboard opt-in/alias. Device appearance can remain local.')
add(g,'CandidateProfile','','One shared profile. Stable IDs inside ordered background entries. Verification is tied to values/revision; login email differs from application contact email.')
add(g,'SearchProfile','','Many strategies share candidate facts. Structured criteria are canonical; render agent instructions. Snapshots in run/draft preserve historical settings.')
add(g,'SavedAnswer','','UQ(owner, exact normalized question, scope_key). Explicit global/resolved_company/unresolved_company scope; null company never implies global. Edit invalidates review. Draft snapshots preserve old answer text and revision.')
add(g,'ProfileAnswer','','FK profile_id → SearchProfile; answer_id → SavedAnswer. Explicit same-owner selection; no copied question bank.')
add(g,'TierList','','Small ordered definitions are embedded. Display rarity derives from tier; a list is reusable across profiles.')
add(g,'TierPlacement','','FK list_id → TierList; company_id → Company. One company in one tier per list. Validate tier_key against that list.')
add(g,'SearchSource','','UQ(owner, kind, canonical_address). Source subscription is a search preference, not a live integration or source observation.')
for a,b,c,o,m in [('CandidateProfile','owner_id','Account',False,False),('SearchProfile','tier_list_id','TierList',True,True),('SearchProfile','fallback_document_id','Document',True,True),('SavedAnswer','company_id','Company',True,True),('ProfileAnswer','profile_id','SearchProfile',False,True),('ProfileAnswer','answer_id','SavedAnswer',False,True),('TierPlacement','list_id','TierList',False,True),('TierPlacement','company_id','Company',False,True)]:fk(a,b,c,o,m)
g='03 Documents and materials'
add(g,'Document','','Stable identity for resume, cover letter, template, toolkit material, debrief or collection. Title is a current-version projection. Kind-specific validation; document ownership is always private.')
add(g,'DocumentVersion','','FK document_id → Document. Immutable. Exactly one body/blob/source URL representation per kind. Blob unique within owner+hash; distinct named documents may share bytes.')
add(g,'ProfileMaterial','','Assignments follow stable Document; draft creation pins a concrete DocumentVersion. Resume replacement keeps assignments.')
add(g,'DocumentLink','','Exactly one target FK. Same-owner links; real constraints rather than purpose-string parsing or polymorphic unvalidated IDs.')
add(g,'CollectionItem','','Both composite FKs point to DocumentVersion. Collection must be collection kind; owner match; no recursive cycles. Children are pinned, not copied.')
for a,b,c,o,m in [('DocumentVersion','document_id','Document',False,True),('ProfileMaterial','profile_id','SearchProfile',False,True),('ProfileMaterial','document_id','Document',False,True),('DocumentLink','document_id','Document',False,True),('DocumentLink','application_id','Application',True,True),('DocumentLink','round_id','InterviewRound',True,True),('DocumentLink','plan_id','PrepPlan',True,True),('DocumentLink','task_id','PrepTask',True,True),('DocumentLink','company_target_id','CompanyTarget',True,True),('CollectionItem','collection_id','DocumentVersion',False,True),('CollectionItem','child_document_id','DocumentVersion',False,True)]:fk(a,b,c,o,m)
g='04 Applications and evidence'
add(g,'Application','','UQ(owner, job). Tracker and queued work are views over one relationship. Opening, queuing, user report and proven submission remain separate. No hard delete of referenced jobs.')
add(g,'DraftRevision','','FK application_id → Application. Immutable reviewed material; snapshot exact fact/answer values with origin IDs and revisions. New revision invalidates old authorization.')
add(g,'Authorization','','Human approval requires real human actor; routine authorization requires validated policy and provenance. Neither proves submission. Recheck current safety conditions on claim.')
add(g,'SubmissionAttempt','','One active claim per application; one-use click permit. Captured fields are immutable; receipt/resolution append under version check. Uncertain blocks retry.')
add(g,'ApplicationEvent','','Append-only timeline: status reports, email excerpts, observations, workflow transitions. Distinguish user report, agent observation and validated receipt. UQ(owner, event_key).')
add(g,'InterviewRound','','Actual scheduled round is separate from prep deadline. Supports dated-but-unconfirmed or date-only records without inventing time; activity history refers to this row.')
for a,b,c,o,m in [('Application','job_id','Job',False,True),('Application','search_profile_id','SearchProfile',True,True),('DraftRevision','application_id','Application',False,True),('DraftRevision','resume_document_id','DocumentVersion',True,True),('Authorization','application_id','DraftRevision',False,True),('SubmissionAttempt','application_id','DraftRevision',False,True),('SubmissionAttempt','authorization_id','Authorization',False,True),('ApplicationEvent','application_id','Application',False,True),('ApplicationEvent','round_id','InterviewRound',True,True),('InterviewRound','application_id','Application',False,True)]:fk(a,b,c,o,m)
g='05 Preparation and network'
add(g,'PrepPlan','','Exactly application plan OR standalone learning goal. Goal identity is the plan ID; avoid a second identical plan system. Resource bodies live in documents.')
add(g,'PrepTask','','Stable tasks independently credited and linked to material. Plan revisions preserve credited task IDs; removed tasks archive. Shared practice joins via PracticeCredit.')
add(g,'PracticeSession','','UQ(owner, idempotency_key). Real practice duration counted once even if many tasks benefit; no duplicated minutes in total metrics.')
add(g,'PracticeCredit','','FK session_id → PracticeSession; task_id → PrepTask. Same-owner, revision checked, credit bounded by session duration per target; aggregate time from session only.')
add(g,'CompanyTarget','','UQ(owner, company) when resolved. Unresolved targets retain private name/website until registry resolution. Private research and action plan separate from public company facts. Contacts/apps derive by company ID; no duplicated ID arrays.')
add(g,'Contact','','Private person identity shared by outreach and active processes. Exact verified email/LinkedIn dedupe within owner; never auto-merge names or globally share contacts.')
add(g,'Conversation','','One contact can have many threads. Referral outcome belongs to thread, not person/application. Draft text separate from logged messages; contact identity not copied.')
add(g,'ConversationApplication','','FK conversation_id → Conversation; application_id → Application. Explicit same-owner process relationship replaces tags and URL guesses.')
add(g,'Interaction','','Kind-specific checks. Messages carry sent/received; meetings carry scheduled/completed/cancelled. Logs report activity; they do not send or invite.')
for a,b,c,o,m in [('PrepPlan','application_id','Application',True,False),('PrepTask','plan_id','PrepPlan',False,True),('PracticeCredit','session_id','PracticeSession',False,True),('PracticeCredit','task_id','PrepTask',False,True),('CompanyTarget','company_id','Company',True,True),('Contact','company_id','Company',True,True),('Conversation','contact_id','Contact',False,True),('Conversation','company_id','Company',True,True),('ConversationApplication','conversation_id','Conversation',False,True),('ConversationApplication','application_id','Application',False,True),('Interaction','conversation_id','Conversation',False,True)]:fk(a,b,c,o,m)
g='06 Circles and publication'
add(g,'Circle','','Shared membership boundary. Owner is a membership role with exactly one active owner; transfer atomically.')
add(g,'CircleMember','','FK circle_id → Circle; account_id → Account. Explicit membership controls read/write; agent proposal permissions are not human publication consent.')
add(g,'CircleInvite','','Invite secret is not ordinary stored plaintext; optional encrypted value for current UI redisplay. Removed members need a newer invite. Consume/join with membership checks; no private profile information disclosed.')
add(g,'Post','','One post model for chat, round insights, resources, offers, milestones, opportunities and replies. Parent must be same circle; channel is derived from content type.')
add(g,'PostRevision','','FK post_id → Post. Immutable disclosure snapshot; redact private source. Personal disclosures require exact-revision approval. Restricted public-link templates may use explicit membership policy; validate no personal data. Human edits create new revision.')
add(g,'PostPublication','','FK circle_id → Circle; composite post/revision → PostRevision. Atomic with post visibility. Durable cursor and tombstones; revision pinned for agent consumers.')
add(g,'ModerationReport','','Member-scoped report; moderator hides/withdraws with publication event. Report visibility restricted; no public reporter disclosure.')
add(g,'AgentReceipt','','Private citation-use receipt, not publication approval. Source availability derives from current membership/visibility; retain redacted metadata after withdrawal.')
for a,b,c,o,m in [('CircleMember','circle_id','Circle',False,True),('CircleInvite','circle_id','Circle',False,True),('Post','circle_id','Circle',False,True),('Post','parent_id','Post',True,True),('PostRevision','post_id','Post',False,True),('PostPublication','post_id','PostRevision',False,True),('PostPublication','circle_id','Circle',False,True),('ModerationReport','post_id','Post',False,True),('AgentReceipt','post_id','PostRevision',False,True),('AgentReceipt','connection_id','AgentConnection',False,True)]:fk(a,b,c,o,m)
g='07 Agent execution and onboarding'
add(g,'AgentConnection','','One-time secret delivery; digest only at rest. Capability evidence is time-stamped, not inferred from issuing credentials. Recheck scope/revocation every action.')
add(g,'AgentCheckpoint','','FK connection_id → AgentConnection. Per-agent context/feed cursor; acknowledge only after consuming. Developer version is release metadata, not mutable user data.')
add(g,'OnboardingSession','','One current session/owner. Request state does not imply runner, notification or schedule active. Actual task outcomes remain separate.')
add(g,'AgentTask','','Task inbox for discover/prepare/execute and outreach requests; optional onboarding session. Bounded requested companies (up to 50); typed result references. Idempotent create, leased claim, uncertain reconciliation. References outcome IDs; no duplicated run/application snapshots.')
for a,b,c,o,m in [('AgentCheckpoint','connection_id','AgentConnection',False,True),('OnboardingSession','match_job_id','Job',True,True),('AgentTask','session_id','OnboardingSession',True,True),('AgentTask','connection_id','AgentConnection',True,True),('AgentTask','job_id','Job',True,True)]:fk(a,b,c,o,m)
from full_fields import expand
expand(T)
# Explicit account ownership edges are an invariant on every private aggregate.
colors=['#dae8fc','#d5e8d4','#e1d5e7','#ffe6cc','#fff2cc','#d5e8d4','#e1d5e7']
def model(title,subtitle):
 m=E.Element('mxGraphModel',adaptiveColors='auto',page='1',pageWidth='1500',pageHeight='2000',grid='1',gridSize='10')
 root=E.SubElement(m,'root');E.SubElement(root,'mxCell',id='0');E.SubElement(root,'mxCell',id='1',parent='0')
 vertex(root,'title',title,30,20,1360,45,'text;html=1;fontSize=26;fontStyle=1;align=left;')
 vertex(root,'subtitle',subtitle,30,70,1360,60,'text;html=1;fontSize=14;align=left;whiteSpace=wrap;')
 return m,root

def vertex(root,id,value,x,y,w,h,style,parent='1'):
 cell=E.SubElement(root,'mxCell',id=id,value=value,style=style,vertex='1',parent=parent)
 E.SubElement(cell,'mxGeometry',x=str(x),y=str(y),width=str(w),height=str(h),attrib={'as':'geometry'})
 return cell

def edge(root,id,source,target,optional=False,many=True,label='',graph=False):
 style=('edgeStyle=orthogonalEdgeStyle;endArrow=classic;' if graph else 'edgeStyle=entityRelationEdgeStyle;startArrow='+('ERzeroToOne' if optional else 'ERmandOne')+';endArrow='+('ERzeroToMany' if many else 'ERzeroToOne')+';')
 c=E.SubElement(root,'mxCell',id=id,source=source,target=target,edge='1',parent='1',value=label,style=style+'html=1;rounded=1;strokeColor=#64748b;fontSize=13;defaultLabelBackgroundColor=gap;')
 E.SubElement(c,'mxGeometry',relative='1',attrib={'as':'geometry'})

m,root=model('Lookout · UI-first data relationship graph','DESIGN PROPOSAL · 49 logical relations across seven domains · Read the focused ERD sheets for fields and cardinality. No existing database schema was used.')
blocks=[('candidate','Candidate & preferences','Account · facts · profiles · answers · tiers',480,150,1),('catalog','Catalog & discovery','Companies · requisitions · observations · decisions',40,360,0),('documents','Documents & versions','Resume · letter · toolkit · debrief · collection',920,360,2),('applications','Applications & evidence','One owner + job · drafts · approvals · attempts',480,580,3),('network','Private network','Company targets · contacts · threads · interactions',40,800,4),('prep','Preparation','Plans · tasks · sessions · shared credits',920,800,4),('community','Circle publication','Membership · approved snapshots · feed · receipts',480,1030,5),('automation','Agent work','Scoped connection · onboarding · leased tasks',480,360,6)]
for id,title,desc,x,y,i in blocks:vertex(root,id,'<b>'+title+'</b><br>'+desc,x,y,350,110,f'rounded=1;whiteSpace=wrap;html=1;fontSize=17;fillColor={colors[i]};strokeColor=#64748b;spacing=12;')
for i,(a,b,label) in enumerate([('candidate','catalog','profiles guide search'),('candidate','documents','owns material'),('candidate','automation','grants scopes'),('catalog','applications','job identity'),('documents','applications','pins exact versions'),('automation','applications','scoped actions'),('applications','network','explicit thread links'),('applications','prep','rounds and deadlines'),('network','community','reviewed disclosure'),('prep','community','reviewed disclosure'),('documents','community','approved snapshots')]):edge(root,'g'+str(i),a,b,label=label,graph=True)
vertex(root,'legend','<b>Keep distinct</b> · public facts / private fit / shared disclosure<br>Opening ≠ applying · approval ≠ submission · user report ≠ employer receipt<br><b>Derived views</b> · Discover, Auto Tracker, Action Board, leaderboard, channels and weekly agenda<br><b>Not new tables</b> · demo fixtures, theme previews, toolkit catalog, device XP and transient UI',30,1230,1360,130,'rounded=1;whiteSpace=wrap;html=1;fontSize=16;fillColor=#f5f5f5;strokeColor=#94a3b8;spacing=14;align=left;')
sheets.append(('00 Relationship graph',m))
for gi,group in enumerate(dict.fromkeys(t['group'] for t in T.values())):
 names=[n for n,t in T.items() if t['group']==group]
 # A single compact reference strip makes external FKs visible without copying entity definitions.
 rel=[r for r in R if r['child'] in names]
 refs=sorted({r['parent'] for r in rel if r['parent'] not in names})
 m,root=model('Lookout · '+group,'PK = primary key · FK = foreign key · ? = nullable · crow’s feet show 0..many · outlined references are defined on another sheet. Private ownership/account edges are implicit; see dictionary for composite constraints.')
 rows={}; gridcols=3; row_heights=[]
 for j in range(0,len(names),3):row_heights.append(max(40+len(T[n]['fields'])*32 for n in names[j:j+3])+130)
 for i,n in enumerate(names):
  x=30+(i%3)*470;y=150+sum(row_heights[:i//3]);fields=T[n]['fields'];h=40+32*len(fields)
  vertex(root,n,n,x,y,330,h,f'swimlane;html=1;startSize=40;horizontal=1;collapsible=0;fontSize=17;fontStyle=1;fillColor={colors[gi]};strokeColor=#64748b;')
  for k,f in enumerate(fields):
   rid=n+'__'+str(k);rows[(n,k)]=rid
   vertex(root,rid,html.escape(f),0,40+32*k,330,32,'text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;fontSize=13;whiteSpace=wrap;',n)
 base=150+sum(row_heights)
 for i,n in enumerate(refs):
  vertex(root,'ref_'+n,'↗ '+n,30+(i%3)*470,base+(i//3)*85,330,55,'rounded=1;html=1;whiteSpace=wrap;fontSize=16;dashed=1;fillColor=#ffffff;strokeColor=#94a3b8;')
 for i,r in enumerate(rel):
  p=r['parent'];child=r['child']; fidx=next((k for k,s in enumerate(T[child]['fields']) if r['field'] in s),0)
  source=rows[(p,0)] if p in names else 'ref_'+p
  target=rows[(child,fidx)]
  edge(root,'rel_'+str(i),source,target,r['optional'],r['many'])
 vertex(root,'footnote','Proposed logical design · repeated reference boxes are not extra tables · bounded JSON fields have a typed contract in README · foreign keys require same-owner / same-circle checks.',30,base+((len(refs)+2)//3)*85+20,1370,60,'text;html=1;fontSize=14;whiteSpace=wrap;align=left;')
 m.set('pageHeight',str(int((base+((len(refs)+2)//3)*85+180+99)//100)*100))
 sheets.append((group,m))
mx=E.Element('mxfile',host='app.diagrams.net',agent='Lookout UI schema review',version='29.0.0',type='device')
for i,(name,m) in enumerate(sheets):
 d=E.SubElement(mx,'diagram',id='lookout-'+str(i),name=name);d.append(m)
E.indent(mx)
HERE.joinpath('lookout-schema.drawio').write_text(E.tostring(mx,encoding='unicode'))
HERE.joinpath('model.json').write_text(json.dumps({'status':'proposal-not-deployed','entities':T,'relationships':R},indent=2)+'\n')
md=['# Proposed logical field dictionary','','This is a design review, not a migration or a dump of the current database. UUID is the default identity; timestamps are UTC, dates retain their precision. Each top-level field is listed individually; JSON subfields are defined in README.md. All mutable private aggregates carry an owner and optimistic revision; append-only rows inherit the owner through a constrained parent. Created/updated timestamps are shown explicitly; immutable history has no updated_at.','']
for group in dict.fromkeys(t['group'] for t in T.values()):
 md+=['## '+group,'']
 for n,t in T.items():
  if t['group']!=group:continue
  md+=['### '+n,'',t['note'],'','```text',*t['fields'],'```','']
  for r in [r for r in R if r['child']==n]:md.append(f"- `{r['field']}` → `{r['parent']}` ({'optional' if r['optional'] else 'required'} parent; {'many' if r['many'] else 'at most one'} children per parent).")
  md.append('')
HERE.joinpath('dictionary.md').write_text('\n'.join(md))
HERE.joinpath('sheets.json').write_text(json.dumps([{'name':n,'xml':E.tostring(m,encoding='unicode')} for n,m in sheets],indent=2)+'\n')
print(f'Built {len(T)} entities, {len(R)} explicit relationships, {len(sheets)} draw.io sheets')
