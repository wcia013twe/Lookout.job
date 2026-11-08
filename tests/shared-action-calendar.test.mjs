import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPreparationAgenda,buildWeeklyPreparationAgenda} from '../lib/preparation-planner.mjs';
import {createTestDatabase} from './helpers/database.mjs';
import {museFeatureDispatch} from '../supabase/functions/agent-gateway/muse-features.mjs';
const today='2026-11-07';
const mock=(id,status='scheduled')=>({id,content:{kind:'mock_interview',title:'Systems mock',scheduledAt:'2026-11-08T01:00:00Z',sessionStatus:status}});
const round=(id,extra={})=>({id,round_id:id,kind:'technical_round',label:'Systems',phase:'scheduled',confirmation:'confirmed',occurred_at:'2026-11-09T17:00:00Z',...extra});
test('calendar projects current application rounds without a prep plan and removes superseded, completed, held and terminal work',()=>{
 const app={id:'job',backendId:'app',company:'Example',status:'Interview',milestones:[round('old'),round('new',{round_id:'old',supersedes_id:'old',occurred_at:'2026-11-10T17:00:00Z'})]};
 const input={today,applications:{job:app},timeZone:'UTC'};
 let agenda=buildPreparationAgenda(input);
 assert.equal(agenda.interviews.length,1);assert.equal(agenda.interviews[0].date,'2026-11-10');
 assert.equal(buildPreparationAgenda({...input,holds:[{application_id:'app'}]}).interviews.length,0);
 for(const status of ['Rejected','Withdrawn','Closed'])assert.equal(buildPreparationAgenda({...input,applications:{job:{...app,status}}}).interviews.length,0);
 app.milestones.push(round('done',{round_id:'old',supersedes_id:'new',phase:'completed'}));assert.equal(buildPreparationAgenda(input).interviews.length,0);
 app.milestones=[round('unknown',{confirmation:'proposed'})];assert.equal(buildPreparationAgenda(input).interviews.length,0);
});
test('imported actions, real round identities, and timezone-correct Toolkit mocks share the week without invented dates or duplicate native processes',()=>{
 const record={company:'Import',title:'Engineer',status:'INTERVIEW',needsAction:true,nextAction:'Finish assessment',actionDate:'2026-11-08',rounds:[{id:'screen',label:'OA',stage:'SCREEN',phase:'received',date:'2026-11-09',cancelled:false}]};
 const input={today,timeZone:'America/Los_Angeles',imports:[{id:'i',record}],calendarArtifacts:[mock('live'),mock('done','completed'),mock('cancel','cancelled'),{...mock('archived'),archived:true}]};
 const agenda=buildPreparationAgenda(input),events=agenda.days.flatMap(d=>d.events);
 assert.equal(events.length,2);assert.equal(events.find(e=>e.kind==='Mock interview').date,today);assert.equal(events.find(e=>e.kind==='Next action').applicationId,'import:i');assert.equal(agenda.interviews[0].kind,'Screen');
 assert.equal(agenda.interviews[0].applicationId,'import:i');
 record.actionDate=null;record.rounds[0].cancelled=true;assert.equal(buildPreparationAgenda(input).days.flatMap(d=>d.events).length,1);assert.equal(buildPreparationAgenda(input).interviews.length,0);
 record.status='REJECTED';assert.equal(buildPreparationAgenda(input).days.flatMap(d=>d.events).length,1);
 record.status='INTERVIEW';record.rounds[0].cancelled=false;assert.equal(buildPreparationAgenda({...input,applications:{native:{...record,id:'native',milestones:[]}}}).interviews.length,0);
});
test('owned browser and MCP snapshots share imported dates and public mock logistics, never private interviewer preparation',async()=>{
 const db=await createTestDatabase(),owner='11111111-1111-1111-1111-111111111111',other='22222222-2222-2222-2222-222222222222',hash='a'.repeat(64);
 try{
  await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Calendar',$2,array['workspace:read'],now()+interval '1 hour')",[owner,hash]);
  for(const user of [owner,other]){
   await db.query("insert into public.imported_jobs(user_id,identity_key,record,source_rows) values($1,$2,$3,'[]')",[user,user,{company:'Import',title:'Engineer',status:'INTERVIEW',needsAction:true,nextAction:'Assessment',actionDate:'2026-11-08',notes:'private source notes'}]);
   await db.query("insert into public.career_artifacts(id,user_id,content) values(gen_random_uuid(),$1,$2)",[user,{...mock('unused').content,body:'visible logistics',sources:[],links:[],format:'markdown',purpose:'practice',timeZone:'UTC',weekOf:'2026-11-02',durationMinutes:30}]);
  }
  await db.query("select set_config('test.uid',$1,false)",[owner]);
  const browser=(await db.query('select public.read_preparation_planner() data')).rows[0].data;
  const agent=(await db.query("select public.agent_dispatch($1,'preparation.planner.read','{}') data",[hash])).rows[0].data;
  assert.deepEqual(agent,browser);assert.equal(browser.imports.length,1);assert.equal(browser.calendarArtifacts.length,1);
  assert(!JSON.stringify(browser).includes('private source notes'));assert(!JSON.stringify(browser.calendarArtifacts).includes('body'));
  const result=await museFeatureDispatch({operation:'preparation.planner.read',payload:{},now:new Date(today+'T12:00:00Z'),rpc:async()=>({data:agent})});
  assert.deepEqual(result.data.agenda,buildWeeklyPreparationAgenda({...browser,today}));
  await db.query("select set_config('test.uid',$1,false)",[other]);const foreign=(await db.query('select public.read_preparation_planner() data')).rows[0].data;
  assert.notEqual(foreign.imports[0].id,browser.imports[0].id);assert.notEqual(foreign.calendarArtifacts[0].id,browser.calendarArtifacts[0].id);
 }finally{await db.close();}
});

test('fictional Toolkit changes feed the same calendar snapshot and stay resettable',async()=>{
 const {createDemoWorkspace,createDemoServices}=await import('../next-app/lib/muse-demo-fixtures.mjs');
 const {createMemoryStore}=await import('../next-app/lib/demo.mjs');
 const fixture=createDemoWorkspace('2026-11-07T12:00:00Z'),store=createMemoryStore(fixture),services=createDemoServices(store);
 const before=await services.readPreparationPlanner();
 assert.ok(Array.isArray(before.calendarArtifacts));
 store.set('demo.artifacts',[{id:'demo-calendar',version:1,content:mock('demo-calendar').content,archived:false}]);
 assert.equal((await services.readPreparationPlanner()).calendarArtifacts.length,1);
 store.set('demo.artifacts',[{id:'demo-calendar',version:2,content:mock('demo-calendar','cancelled').content,archived:false}]);
 assert.equal(buildPreparationAgenda({...await services.readPreparationPlanner(),today}).days.flatMap(d=>d.events).length,0);
 // Use the existing fictional material collection; no real backend or account access.
 assert.ok(before.calendarArtifacts.every(row=>row.content.kind==='mock_interview'));
 assert.deepEqual((await createDemoServices(createMemoryStore(createDemoWorkspace('2026-11-07T12:00:00Z'))).readPreparationPlanner()).calendarArtifacts,before.calendarArtifacts);
});

test('weekly calendar keeps Monday through Sunday including empty and past days, without allocating practice in the past',()=>{
 const input={today:'2026-11-07',learningGoals:[{id:'goal',version:1,goal:{active:true,title:'Systems',tasks:[{id:'task',title:'Practice',detail:'Explain tradeoffs',minutes:240,targetDate:'2026-11-08'}]}}],settings:{dailyMinutes:15}};
 const agenda=buildWeeklyPreparationAgenda(input);
 assert.deepEqual(agenda.days.map(d=>d.date),['2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07','2026-11-08']);
 assert(agenda.days.slice(0,5).every(d=>!d.items.length));assert.equal(agenda.unscheduled,1);assert(agenda.pending.some(t=>t.title==='Practice'&&t.reason==='Outside daily budget'));
 assert.equal(buildWeeklyPreparationAgenda({...input,weekOf:'2026-11-09'}).days[0].date,'2026-11-09');
 assert.throws(()=>buildWeeklyPreparationAgenda({...input,weekOf:'2026-11-10'}),/Monday/);
});
test('undated assessments and overdue/out-of-week actions stay visible, while cancelled and completed rounds do not return',()=>{
 const make=(id,phase='received',date=null)=>({id,label:id,stage:'SCREEN',type:'oa',phase,date,cancelled:false});
 const input={today:'2026-11-07',imports:[{id:'import',record:{company:'Assessment Co',status:'SCREEN',needsAction:true,nextAction:'Submit response',actionDate:'2026-11-01',rounds:[make('undated'),make('done','completed'),{...make('cancel'),cancelled:true},make('next-week','scheduled','2026-11-11')]}}]};
 const agenda=buildWeeklyPreparationAgenda(input);
 assert.deepEqual(agenda.pending.map(p=>p.title).sort(),['Submit response','next-week','undated']);
 assert.equal(agenda.pending.find(p=>p.title==='undated').date,null);assert.equal(agenda.pending.find(p=>p.title==='Submit response').reason,'Overdue');
 assert(buildWeeklyPreparationAgenda({...input,weekOf:'2026-11-09'}).days.flatMap(d=>d.interviews).some(r=>r.roundId==='next-week'));
});
test('MCP week selection projects the same source and rejects invalid or injected week arguments',async()=>{
 const {validateRequest}=await import('../supabase/functions/agent-gateway/contract.mjs');
 const {TOOLS}=await import('../supabase/functions/agent-mcp/protocol.mjs');
 const schema=TOOLS.find(t=>t.name==='read_preparation_planner').inputSchema;
 assert(new RegExp(schema.properties.weekOf.pattern).test('2026-11-09'));
 const payload={weekOf:'2026-11-09'},snapshot={timeZone:'America/New_York'};validateRequest({operation:'preparation.planner.read',payload});
 const result=await museFeatureDispatch({operation:'preparation.planner.read',payload,now:new Date('2026-11-08T01:00:00Z'),rpc:async(op,p)=>{assert.deepEqual(p,{});return {data:snapshot};}});
 assert.deepEqual(result.data.agenda,buildWeeklyPreparationAgenda({...snapshot,today:'2026-11-07',weekOf:payload.weekOf}));
 for(const bad of ['2026-11-10','2026-02-30',null,42])assert.throws(()=>validateRequest({operation:'preparation.planner.read',payload:{weekOf:bad}}));
 assert.throws(()=>validateRequest({operation:'preparation.planner.read',payload:{weekOf:'2026-11-09',userId:'other'}}));
});

test('saved next-action deadlines represent a lone undated assessment once, and dated rounds replace duplicate same-day actions',()=>{
 const imported=(id,date,roundDate=null)=>({id,record:{company:id,title:'Engineer',status:'SCREEN',needsAction:true,nextAction:'Complete assessment',actionDate:date,rounds:[{id:'assessment',label:'Assessment',stage:'SCREEN',type:'oa',phase:roundDate?'scheduled':'received',date:roundDate,cancelled:false}]}});
 const first=imported('Fictional Compute','2026-11-17'),second=imported('Fictional Trading','2026-12-03');
 for(const [record,week] of [[first,'2026-11-16'],[second,'2026-11-30']]){
  const agenda=buildWeeklyPreparationAgenda({today:'2026-11-07',weekOf:week,imports:[record]});
  const events=agenda.days.flatMap(d=>d.events);assert.equal(events.length,1);assert.equal(events[0].date,record.record.actionDate);assert.equal(events[0].company,record.id);assert.equal(agenda.pending.length,0);assert.equal(record.record.rounds[0].date,null,'Projection never overwrites the saved round date');
 }
 const rounds=[imported('Fictional Data','2026-11-11','2026-11-11'),imported('Fictional Robotics','2026-11-11','2026-11-11')];
 let agenda=buildWeeklyPreparationAgenda({today:'2026-11-07',weekOf:'2026-11-09',imports:rounds});
 const wednesday=agenda.days.find(d=>d.date==='2026-11-11');assert.equal(wednesday.interviews.length,2);assert.equal(wednesday.events.length,0);assert.equal(agenda.pending.length,0);
 agenda=buildWeeklyPreparationAgenda({today:'2026-11-07',imports:rounds});assert.equal(agenda.pending.length,2,'Same deduplication applies outside the visible week');
 rounds[0].record.actionDate='2026-11-12';agenda=buildWeeklyPreparationAgenda({today:'2026-11-07',weekOf:'2026-11-09',imports:rounds});assert.equal(agenda.days.flatMap(d=>d.events).length,1,'A distinct dated action is preserved');
 first.record.needsAction=false;agenda=buildWeeklyPreparationAgenda({today:'2026-11-07',weekOf:'2026-11-16',imports:[first]});assert.equal(agenda.days.flatMap(d=>d.events).length,1,'Saved dates do not depend on the attention flag');
});
