import {demoMaterialSources,toolkitResearch,researchCheckedAt,palantirDemoApplicationId} from './toolkit-demo-research.mjs';
import {demoMaterialDocument} from './toolkit-demo-documents.mjs';
import {debriefMarker} from '../../lib/interview-debrief.mjs';
import {validateArtifact,artifactResponse,artifactMetadata,isPreparedArtifact,artifactSubjectKeys,weekStart,shiftWeek} from '../../lib/artifacts.mjs';
const clone=value=>structuredClone(value);
export const demoGoalId='33333333-aaaa-4000-8000-333333333333';
export const demoArtifactIds={pack:'11111111-aaaa-4000-8000-111111111111',interactive:'22222222-aaaa-4000-8000-222222222222',company:'44444444-aaaa-4000-8000-444444444444'};
export function createArtifactDemo(store){
 if(store.get('demo.fictional')!==true)throw Error('Isolated fictional store required');
 const today=new Date().toISOString().slice(0,10),end=new Date(Date.now()+6*86400000).toISOString().slice(0,10);
 const goalSeed=[{id:demoGoalId,version:1,goal:{title:'Database systems depth (demo)',objective:'Explain query plans and reliable processing using fictional practice data.',active:true,tasks:[{id:'indexes',title:'Explore index selectivity',detail:'Use the interactive walkthrough, then explain when a sequential scan wins.',minutes:30,targetDate:end,completed:false},{id:'queues',title:'Reason through queue retries',detail:'Practice a worker crash after processing but before acknowledgement. Supporting material has not been prepared yet.',minutes:30,targetDate:end,completed:false}]}}];
 const goals=()=>store.get('demo.learningGoals')??goalSeed;
 const interview=Object.values(store.get('demo.preparationRows')||{}).find(r=>r.application_id==='demo-interview');
 const interviewTask=interview?.plan.tasks.find(t=>t.key==='questions');
 const link={goalId:demoGoalId,taskId:'indexes'};
 const seed=[
 {id:demoArtifactIds.pack,version:1,archived:false,updated_at:today,content:{title:'Cedar Systems: interview prep',purpose:'Company context, personal answers, and a database refresher, gathered in one place for your upcoming conversation.',kind:'interview_brief',format:'markdown',company:'Cedar Systems (demo)',preparedFor:end,materials:[{id:demoArtifactIds.company,version:1},{id:'99999999-aaaa-4000-8000-999999999999',version:1},{id:demoArtifactIds.interactive,version:1}],weekOf:today,sources:[],links:[link],body:'# Before your Cedar interview\n\nRead the company brief, review your personal answers, then revisit the database walkthrough. Each material is saved below in that order.\n\nThe answer drafts still need details about your actions and results. Discuss those gaps with your agent before practicing.\n\nFictional demo only. Reading this pack does not record practice.'}},
 {id:demoArtifactIds.interactive,version:1,archived:false,updated_at:today,content:{title:'When does an index help?',purpose:'Change selectivity to compare simplified scan costs, then test your explanation.',kind:'explainer',format:'html',weekOf:today,sources:[{title:'PostgreSQL: using EXPLAIN',url:'https://www.postgresql.org/docs/current/using-explain.html',observedAt:today}],links:[link],body:`<style>body{background:#f7f6f1;color:#252923;max-width:850px;margin:auto}h1{font-size:clamp(26px,5vw,40px);line-height:1.15}label{display:block;margin:28px 0 12px;font-weight:600}input{width:100%;accent-color:#395d48}section{margin-top:32px}button{padding:12px 16px;border:1px solid #395d48;border-radius:8px;background:#395d48;color:white}#answer{padding:16px;background:#e6ecdf}p{max-width:65ch}.bar{height:28px;margin:10px 0;background:#395d48;transition:width .2s}.sequential{background:#777e65}output{font-weight:700}</style><h1>When does an index help?</h1><p>Fictional teaching model: a sequential scan costs 100 units. The index costs 5 units plus 2 units per percentage point of matching rows. These are assumptions, not benchmark results.</p><label for="selectivity">Matching rows: <output id="percent">10%</output></label><input id="selectivity" type="range" min="0" max="100" value="10"><section aria-label="Scan cost comparison"><p>Index scan: <output id="cost">25 units</output></p><div id="index-bar" class="bar" style="width:12%"></div><p>Sequential scan: 100 units</p><div class="bar sequential" style="width:49%"></div><p id="choice" role="status">The index is cheaper in this simplified model.</p></section><section><h2>Explain your prediction</h2><p>What changes when most rows match? Which assumptions would you verify in a real query plan?</p><button id="reveal">Reveal explanation</button><p id="answer" hidden>As selectivity rises, this model makes repeated indexed reads more expensive than scanning the table. Real plans depend on data layout, caching, statistics and actual I/O costs. Verify with EXPLAIN rather than treating this threshold as universal.</p></section><script>const slider=document.getElementById('selectivity');slider.addEventListener('input',()=>{const cost=5+2*Number(slider.value);document.getElementById('percent').textContent=slider.value+'%';document.getElementById('cost').textContent=cost+' units';document.getElementById('index-bar').style.width=(cost/205*100)+'%';document.getElementById('choice').textContent=cost<100?'The index is cheaper in this simplified model.':'The sequential scan is cheaper in this simplified model.';});document.getElementById('reveal').onclick=()=>{document.getElementById('answer').hidden=false;};</script>`}},
 {id:demoArtifactIds.company,version:1,archived:false,updated_at:today,content:{title:'Cedar Systems: interview research brief',purpose:'A fictional company dossier separating supplied information, hypotheses, and questions to verify.',kind:'company_research',format:'markdown',company:'Cedar Systems (demo)',weekOf:today,sources:[{title:'Fictional Cedar company page',url:'https://example.com/demo/cedar',observedAt:today}],links:interviewTask?[{applicationId:'demo-interview',taskId:interviewTask.id}]:[],body:'# Cedar Systems (fictional)\n\n## What the demo brief says\n\nCedar builds a fictional database service. The fictional recruiter brief emphasizes query plans, queue retries, and backpressure.\n\n## Interview participants (fictional)\n\nScheduling email demo-interview-email, subject Cedar technical conversation, explicitly says: Taylor will interview you about query plans. Taylor is a confirmed interviewer in this fictional scenario. Casey is copied only; their role is unconfirmed. Conversation: https://example.com/demo/interview-thread. Taylor’s fictional professional talk: https://example.com/demo/query-plans. Use it for preparation, not automatic outreach.\n\n## Your matching evidence\n\nThe demo candidate built Query Lab and profiled a sample SQL service. Use those examples without inventing production scale or impact.\n\n## Material gap\n\nProduction failure handling beyond a university project needs verification.\n\n## Questions for the team\n\n1. How do you investigate a sudden change in query latency?\n2. What happens when workers retry a partially processed request?\n3. What ownership would a new engineer have?\n\n## Unknowns\n\nTeam structure, actual stack, compensation, and conversion expectations remain unknown. This is illustrative material, not real company research.'}}
 ];
 seed.push(
 {id:'66666666-aaaa-4000-8000-666666666666',version:1,archived:false,updated_at:today,content:{title:'Infrastructure cover letter (demo)',purpose:'Fictional application letter; review before use.',kind:'cover_letter',format:'markdown',sources:[],links:[],body:'Dear Example Systems team,\n\nMy fictional Query Lab work gave me practice investigating database performance. I would like to learn more about your infrastructure team.\n\nDemo Candidate'}},
 {id:'77777777-aaaa-4000-8000-777777777777',version:1,archived:false,updated_at:today,content:{title:'Cover letter starting point (demo)',purpose:'Fictional reusable template; replace placeholders before use.',kind:'application_template',format:'markdown',sources:[],links:[],body:'Dear [team],\n\nI am interested in [role] because [specific reason]. My work on [verified project] involved [concrete contribution].\n\n[Your name]'}}
 );
 if(interview)seed.push({id:'88888888-aaaa-4000-8000-888888888888',version:1,archived:false,updated_at:today,content:{title:'Cedar Systems (demo) · Interview note',purpose:debriefMarker('demo-interview')+' Recruiter call',kind:'notes',format:'markdown',company:'Cedar Systems (demo)',sources:[],links:[],body:'Candidate report (fictional, saved by Muse): we discussed backend ownership and the interview process. I explained my Query Lab project clearly. I want more practice describing failure modes. The recruiter said a technical conversation would follow; no offer or outcome was promised.'}});
 seed.push({id:'99999999-aaaa-4000-8000-999999999999',version:1,archived:false,updated_at:today,content:{title:'Interview answer writers: fictional sample',purpose:'STAR and common-answer drafts with visible evidence gaps for later mock practice.',kind:'notes',format:'markdown',company:'Cedar Systems (demo)',sources:[],links:[{goalId:demoGoalId}],body:'# Fictional interview answer pack\n\n## Resume coverage\n\n| Item | Competency | Opening question | Follow-up | Evidence | Answer | Gap | State |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n| Query Lab SQL profiling | Problem solving | Walk me through your investigation. | What did you measure and personally change? | Fictional project brief only | STAR draft below | Actions and outcome | Needs clarification |\n\nThis sample covers one fictional item only; it is not a comprehensive review.\n\n## STAR: investigating a slow query\n\n**Situation:** In the fictional Query Lab project, a sample SQL query was slow.\n\n**Task:** Investigate the sample query.\n\n**Action:** I profiled the sample SQL service. [Candidate detail needed: what did you inspect and change?]\n\n**Result:** [Candidate detail needed: observed outcome; no speedup has been established.]\n\n**Reflection:** [Candidate detail needed.]\n\n**Practice probe:** Which work did you personally own? What evidence supports the result?\n\n## Tell me about yourself\n\nMy Query Lab project gave me practice investigating database performance. [Candidate detail needed: current background and next-role motivation.]\n\n## Why Cedar?\n\nThe fictional brief describes a database service. [Candidate detail needed: why does this work interest you?]\n\nThese incomplete drafts are fictional, not verified candidate claims or real company research. Discuss with my agent can load this material for a mock interview; opening it does not complete practice.'}});
 for(const row of seed)if(row.content.weekOf)row.content.weekOf=weekStart(today);
 seed.push(...[
  ['aaaaaaaa-1111-4000-8000-111111111111','Reusable project stories (demo)','story_bank','A fictional Query Lab story; personal contribution and outcomes still need clarification.'],
  ['aaaaaaaa-2222-4000-8000-222222222222','Round 1 preparation (demo)','interview_brief','Read the company brief, select a relevant project story, then explain queue retry behavior. Candidate reports are unverified.'],
  ['aaaaaaaa-3333-4000-8000-333333333333','Round 1 debrief (demo)','interview_debrief','Candidate recall (fictional): I explained retries but struggled with partial failure. Coaching: practice one failure scenario before the next round.']
 ].map(([id,title,kind,body])=>({id,version:1,archived:false,updated_at:today,content:{title,kind,body,purpose:'Fictional interview preparation',format:'markdown',weekOf:weekStart(today),sources:[],links:[]}})),
 {id:'aaaaaaaa-4444-4000-8000-444444444444',version:1,archived:false,updated_at:today,content:{title:'Read: PostgreSQL EXPLAIN (demo activity)',purpose:'Read the official guide, then explain a query plan in your own words.',kind:'resource',format:'markdown',body:'An external resource selected for this fictional preparation week.',resourceUrl:'https://www.postgresql.org/docs/current/using-explain.html',weekOf:weekStart(today),sources:[],links:[]}},
 {id:'aaaaaaaa-5555-4000-8000-555555555555',version:1,archived:false,updated_at:today,content:{title:'Backend mock interview (demo)',purpose:'Fictional scheduled practice. No real call or agent is started.',kind:'mock_interview',format:'markdown',body:'Call your agent in its app to practice. This demo has no interviewer service and makes no account requests.',scheduledAt:today+'T18:00:00Z',timeZone:'UTC',durationMinutes:30,sessionStatus:'scheduled',weekOf:weekStart(today),sources:[],links:[]}});
 seed.push({id:'aaaaaaaa-6666-4000-8000-666666666666',version:3,archived:false,updated_at:shiftWeek(today,-1),content:{title:'Completed mock interview (demo)',purpose:'Past fictional practice with saved feedback.',kind:'mock_interview',format:'markdown',body:'This fictional session is complete. Review its feedback before preparing another round.',scheduledAt:shiftWeek(today,-1)+'T18:00:00Z',timeZone:'UTC',durationMinutes:30,sessionStatus:'completed',debriefId:'aaaaaaaa-3333-4000-8000-333333333333',weekOf:weekStart(shiftWeek(today,-1)),sources:[],links:[]}});

 // One researched role, five material types; personal events and experience stay fictional.
 const previewMaterials=[
  [demoArtifactIds.company,'Company context + motivation · Palantir','What Query Engines builds, why it could fit, and what to ask the team.'],
  ['aaaaaaaa-2222-4000-8000-222222222222','Round prep · Glassdoor reports + Query Engines','Two saved candidate excerpts, original practice examples and a focused resource sequence.'],
  ['aaaaaaaa-1111-4000-8000-111111111111','Story bank · Query performance + learning','Reusable fictional examples with clear gaps to replace with your own evidence.'],
  ['aaaaaaaa-5555-4000-8000-555555555555','Mock interview · Palantir Query Engines','30-minute fictional practice slot. Add a Calendar draft; call your agent when ready.'],
  ['aaaaaaaa-3333-4000-8000-333333333333','Practice debrief · Correctness before speed','Illustrative feedback: verify operator semantics before proposing a faster plan.'],
 ];
 const application=store.get(`workflow.applications.${palantirDemoApplicationId}`);
 previewMaterials.forEach(([id,title,purpose],index)=>{
  const row=seed.find(item=>item.id===id);
  Object.assign(row.content,{title,purpose,company:'Palantir',weekOf:weekStart(today),sources:demoMaterialSources(row.content.kind),links:application?[{applicationId:palantirDemoApplicationId}]:[]});
  row.updated_at=new Date(Date.now()-index*1000).toISOString();
  const body=demoMaterialDocument(row.content.kind);
  if(body){row.content.format='html';row.content.body=body;delete row.content.materials;}
  else row.content.body='Fictional Palantir Query Engines mock. This demo has no interviewer service. The Calendar link opens a draft, not a saved event. Call your agent externally when ready; private interviewer preparation is not shown here.';
 });
 const resources=[
  ['aaaaaaaa-4444-4000-8000-444444444444','explain','Read a query plan · PostgreSQL EXPLAIN','15 min · Explain estimates, measurements and scan choices.'],
  ['bbbbbbbb-1111-4000-8000-111111111111','datafusion','Explore an engine · Apache DataFusion','10 min · Connect SQL, logical plans and execution operators.'],
  ['bbbbbbbb-2222-4000-8000-222222222222','furnace','Understand the product · Palantir Furnace','10 min · See planning and execution in a real Foundry product.'],
 ];
 for(const [id,key,title,purpose] of resources){
  const source=toolkitResearch[key];
  const content={title,purpose,kind:'resource',format:'markdown',company:'Palantir',body:'Curated public documentation for this illustrative Palantir preparation week. Opening a page does not record completed practice.',resourceUrl:source.url,weekOf:weekStart(today),sources:[{...source,observedAt:researchCheckedAt}],links:application?[{applicationId:palantirDemoApplicationId}]:[]};
  const existing=seed.find(row=>row.id===id);
  if(existing)existing.content=content;else seed.push({id,version:1,archived:false,updated_at:today,content});
 }
 // Keep older examples available without competing with the five current previews.
 for(const id of [demoArtifactIds.pack,demoArtifactIds.interactive])delete seed.find(row=>row.id===id).content.weekOf;
 const rows=()=>store.get('demo.artifacts')??seed;
 const history=()=>store.get('demo.artifactHistory')??Object.fromEntries(seed.map(r=>[r.id,[r]]));
 function saveRows(row){store.set('demo.artifacts',[row,...rows().filter(r=>r.id!==row.id)]);store.set('demo.artifactHistory',{...history(),[row.id]:[row,...(history()[row.id]||[])]});return artifactResponse(clone(row));}
 return {
  artifactSnapshot(){return {learningGoals:clone(goals()),artifacts:rows().filter(r=>!r.archived).map(r=>({id:r.id,version:r.version,title:r.content.title,links:clone(r.content.links),path:artifactResponse(r).path}))};},
  async artifactAction(operation,payload={}){
   validateArtifact(operation,payload);
   if(operation==='learning.read')return clone(goals());
   if(operation==='learning.save'){
    const {id,expectedVersion,...goal}=clone(payload),previous=goals().find(g=>g.id===id);
    goal.tasks=goal.tasks.map(t=>{const old=previous?.goal.tasks.find(o=>o.id===t.id);return old?.completed?old:{...t,minutes:old&&store.get('demo.preparationSessions')?.some(s=>s.targets.some(x=>x.goalId===id&&x.taskId===t.id))?old.minutes:t.minutes,completed:false};});
    goal.tasks.push(...(previous?.goal.tasks||[]).filter(t=>t.completed&&!goal.tasks.some(n=>n.id===t.id)));
    if(previous?.version===expectedVersion+1&&JSON.stringify(previous.goal)===JSON.stringify(goal))return clone(previous);
    if((previous?.version??0)!==expectedVersion)throw Error('Goal changed');
    const row={id,version:expectedVersion+1,goal};store.set('demo.learningGoals',[row,...goals().filter(g=>g.id!==id)]);return clone(row);
   }
   if(operation==='artifacts.list'){
    const filtered=rows().filter(r=>r.archived===!!payload.archived&&(!payload.shelf||(!['cover_letter','application_template'].includes(r.content.kind)&&(payload.shelf==='all'||isPreparedArtifact(r.content,payload.asOf||today)===(payload.shelf==='prepared'))))&&(!payload.kind||r.content.kind===payload.kind)&&(!payload.weekOf||r.content.weekOf===payload.weekOf)&&(!payload.applicationId||r.content.links.some(l=>l.applicationId===payload.applicationId))&&(!payload.goalId||r.content.links.some(l=>l.goalId===payload.goalId))&&['companyWorkspaceId','contactId','jobId'].every(k=>!payload[k]||r.content.links.some(l=>l[k]===payload[k]))&&(!payload.query||JSON.stringify(r.content).toLowerCase().includes(payload.query.toLowerCase())));
    filtered.sort((a,b)=>b.updated_at.localeCompare(a.updated_at)||a.id.localeCompare(b.id));
    if(payload.shelf==='prepared')filtered.sort((a,b)=>a.content.preparedFor.localeCompare(b.content.preparedFor));
    const off=payload.offset||0;return {items:filtered.slice(off,off+25).map(r=>artifactMetadata(artifactResponse(clone(r)))),nextOffset:filtered.length>off+25?off+25:null};
   }
   const current=rows().find(r=>r.id===payload.id);
   if(operation==='artifacts.read'){
    const row=payload.version?(history()[payload.id]||[]).find(r=>r.version===payload.version):current;
    if(!row)throw Error('Artifact not found');return {...artifactResponse(clone(row)),history:(history()[payload.id]||[]).map(r=>({version:r.version,title:r.content.title,created_at:r.updated_at}))};
   }
   if(operation==='artifacts.archive'){
    if(current?.version===payload.expectedVersion+1&&current.archived===payload.archived)return artifactResponse(clone(current));
    if(!current||current.version!==payload.expectedVersion)throw Error('Artifact changed');
    return saveRows({...current,archived:payload.archived,version:current.version+1,updated_at:new Date().toISOString()});
   }
   const {id,expectedVersion,...content}=clone(payload);
   for(const m of content.materials||[]){const child=(history()[m.id]||[]).find(r=>r.version===m.version);if(!child||child.content.materials?.length||['cover_letter','application_template'].includes(child.content.kind))throw Error('Owned non-collection material revision required');}
   for(const l of content.links){
    const target=artifactSubjectKeys.find(k=>l[k]!==undefined);
    const application=Object.values(store.get('workflow.applications')||{}).find(a=>a.id===l.applicationId||a.backendId===l.applicationId);
    const goal=goals().find(g=>g.id===l.goalId);
    const found=target==='goalId'?goal:target==='applicationId'?application:target==='companyWorkspaceId'?(store.get('network.companies')||[]).find(c=>c.id===l.companyWorkspaceId):target==='contactId'?[...(store.get('network.referrals')||[]),...(store.get('network.people')||[])].find(c=>c.id===l.contactId):Object.values(store.get('workflow.applications')||{}).find(a=>a.id===l.jobId||a.jobId===l.jobId);
    if(!found)throw Error('Existing fictional subject required');
    const tasks=l.goalId?goal?.goal.tasks:store.get(`demo.preparationRows.${l.applicationId}`)?.plan.tasks;
    if(l.taskId!==undefined&&!tasks?.some(t=>t.id===l.taskId))throw Error('Owned fictional task required');
   }
   if(current?.version===expectedVersion+1&&JSON.stringify(current.content)===JSON.stringify(content))return artifactResponse(clone(current));
   if((current?.version??0)!==expectedVersion)throw Error('Artifact changed');
   return saveRows({id,version:expectedVersion+1,archived:current?.archived||false,updated_at:new Date().toISOString(),content});
  }
 };
}
