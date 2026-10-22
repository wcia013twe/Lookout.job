import {validateArtifact,artifactResponse,artifactMetadata} from '../../lib/artifacts.mjs';
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
 {id:demoArtifactIds.pack,version:1,archived:false,updated_at:today,content:{title:'Your week: SQL depth and reliable queues',purpose:'A fictional prep pack that connects upcoming interviews with a longer-term database learning goal.',kind:'weekly_prep',format:'markdown',weekOf:today,sources:[],links:[link],body:'# A focused week\n\nUse the Action Board for your current daily sessions. Interviews get the first share of your time; ongoing study fills the remaining budget.\n\n## Before the Cedar interview\n\n- Review your fictional Query Lab project and distinguish measurements from assumptions.\n- Prepare questions about storage, reliability, and how the team measures query performance.\n\n## Build database depth\n\nExplore the **index selectivity walkthrough**, then predict when reading the whole table is cheaper.\n\n## Practice out loud\n\nExplain what happens if a queue worker crashes after processing a message but before acknowledging it. Name the evidence you would collect.\n\n> Fictional demo. The queue read-up has not been prepared yet; the plan should not imply it is ready.'}},
 {id:demoArtifactIds.interactive,version:1,archived:false,updated_at:today,content:{title:'When does an index help?',purpose:'Change selectivity to compare simplified scan costs, then test your explanation.',kind:'explainer',format:'html',weekOf:today,sources:[{title:'PostgreSQL: using EXPLAIN',url:'https://www.postgresql.org/docs/current/using-explain.html',observedAt:today}],links:[link],body:`<style>body{background:#f7f6f1;color:#252923;max-width:850px;margin:auto}h1{font-size:clamp(26px,5vw,40px);line-height:1.15}label{display:block;margin:28px 0 12px;font-weight:600}input{width:100%;accent-color:#395d48}section{margin-top:32px}button{padding:12px 16px;border:1px solid #395d48;border-radius:8px;background:#395d48;color:white}#answer{padding:16px;background:#e6ecdf}p{max-width:65ch}.bar{height:28px;margin:10px 0;background:#395d48;transition:width .2s}.sequential{background:#777e65}output{font-weight:700}</style><h1>When does an index help?</h1><p>Fictional teaching model: a sequential scan costs 100 units. The index costs 5 units plus 2 units per percentage point of matching rows. These are assumptions, not benchmark results.</p><label for="selectivity">Matching rows: <output id="percent">10%</output></label><input id="selectivity" type="range" min="0" max="100" value="10"><section aria-label="Scan cost comparison"><p>Index scan: <output id="cost">25 units</output></p><div id="index-bar" class="bar" style="width:12%"></div><p>Sequential scan: 100 units</p><div class="bar sequential" style="width:49%"></div><p id="choice" role="status">The index is cheaper in this simplified model.</p></section><section><h2>Explain your prediction</h2><p>What changes when most rows match? Which assumptions would you verify in a real query plan?</p><button id="reveal">Reveal explanation</button><p id="answer" hidden>As selectivity rises, this model makes repeated indexed reads more expensive than scanning the table. Real plans depend on data layout, caching, statistics and actual I/O costs. Verify with EXPLAIN rather than treating this threshold as universal.</p></section><script>const slider=document.getElementById('selectivity');slider.addEventListener('input',()=>{const cost=5+2*Number(slider.value);document.getElementById('percent').textContent=slider.value+'%';document.getElementById('cost').textContent=cost+' units';document.getElementById('index-bar').style.width=(cost/205*100)+'%';document.getElementById('choice').textContent=cost<100?'The index is cheaper in this simplified model.':'The sequential scan is cheaper in this simplified model.';});document.getElementById('reveal').onclick=()=>{document.getElementById('answer').hidden=false;};</script>`}},
 {id:demoArtifactIds.company,version:1,archived:false,updated_at:today,content:{title:'Cedar Systems: interview research brief',purpose:'A fictional company dossier separating supplied information, hypotheses, and questions to verify.',kind:'company_research',format:'markdown',company:'Cedar Systems (demo)',weekOf:today,sources:[{title:'Fictional Cedar company page',url:'https://example.com/demo/cedar',observedAt:today}],links:interviewTask?[{applicationId:'demo-interview',taskId:interviewTask.id}]:[],body:'# Cedar Systems (fictional)\n\n## What the demo brief says\n\nCedar builds a fictional database service. The fictional recruiter brief emphasizes query plans, queue retries, and backpressure.\n\n## Your matching evidence\n\nThe demo candidate built Query Lab and profiled a sample SQL service. Use those examples without inventing production scale or impact.\n\n## Material gap\n\nProduction failure handling beyond a university project needs verification.\n\n## Questions for the team\n\n1. How do you investigate a sudden change in query latency?\n2. What happens when workers retry a partially processed request?\n3. What ownership would a new engineer have?\n\n## Unknowns\n\nTeam structure, actual stack, compensation, and conversion expectations remain unknown. This is illustrative material, not real company research.'}}
 ];
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
    const filtered=rows().filter(r=>r.archived===!!payload.archived&&(!payload.kind||r.content.kind===payload.kind)&&(!payload.weekOf||r.content.weekOf===payload.weekOf)&&(!payload.applicationId||r.content.links.some(l=>l.applicationId===payload.applicationId))&&(!payload.goalId||r.content.links.some(l=>l.goalId===payload.goalId))&&(!payload.query||JSON.stringify(r.content).toLowerCase().includes(payload.query.toLowerCase())));
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
   for(const l of content.links){const tasks=l.goalId?goals().find(g=>g.id===l.goalId)?.goal.tasks:store.get(`demo.preparationRows.${l.applicationId}`)?.plan.tasks;if(!tasks?.some(t=>t.id===l.taskId))throw Error('Owned fictional task required');}
   if(current?.version===expectedVersion+1&&JSON.stringify(current.content)===JSON.stringify(content))return artifactResponse(clone(current));
   if((current?.version??0)!==expectedVersion)throw Error('Artifact changed');
   return saveRows({id,version:expectedVersion+1,archived:current?.archived||false,updated_at:new Date().toISOString(),content});
  }
 };
}
