import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {museChangeFeedResponse} from '../lib/muse-change-feed.mjs';
const owner='11111111-1111-1111-1111-111111111111',other='22222222-2222-2222-2222-222222222222';
const hash='a'.repeat(64),second='b'.repeat(64),foreign='c'.repeat(64),readonly='d'.repeat(64);
test('tracker decisions and AI Apply share the owned change feed, with fenced progress and human stops',async()=>{
 const db=await createTestDatabase();
 const sql=async(q,p=[])=> (await db.query(q,p)).rows;
 const identity=async(id)=>sql("select set_config('test.uid',$1,false)",[id]);
 const call=async(h,op,p={})=>{await identity('');return(await sql('select public.agent_dispatch($1,$2,$3) data',[h,op,p]))[0].data;};
 const board=()=>call(hash,'actions.board.read');
 const human=async(key,response,extra={})=>{await identity(owner);return(await sql('select public.respond_action_board($1) data',[{key,response,eventKey:crypto.randomUUID(),...extra}]))[0].data;};
 const record={company:'Pipeline Fixture',title:'Engineer',location:'Remote',url:'https://job-boards.greenhouse.io/pipeline/jobs/123',status:'APPLIED',employmentType:'FT',statusDate:'2026-11-07',appliedDate:'2026-11-07',archived:false,archivedDate:null,notes:'Fictional private details',needsAction:true,nextAction:'Confirm an interview time',actionDate:'2026-11-13'};
 try{
  const scopes=['workspace:read','activity:write','tracking:write','preferences:write','drafts:write','approvals:read','resumes:read'];
  for(const [h,u,s]of [[hash,owner,scopes],[second,owner,scopes],[foreign,other,scopes],[readonly,owner,['workspace:read']]])await sql("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Pipeline fixture',$2,$3,now()+interval '1 day')",[u,h,s]);
  const [{id}]=await sql("insert into public.imported_jobs(user_id,identity_key,record,source_rows) values($1,'pipeline-fixture',$2,'[]') returning id",[owner,record]);
  const watch=await call(hash,'changes.watch',{enabled:true});
  let item=(await board()).items.find(i=>i.sourceId===id);
  await assert.rejects(call(hash,'actions.tracker.progress',{key:item.key,expectedVersion:1,stage:'started',eventKey:crypto.randomUUID()}));
  const request={key:item.key,response:'accept',eventKey:crypto.randomUUID()};await identity(owner);
  await sql('select public.respond_action_board($1)',[request]);await sql('select public.respond_action_board($1)',[request]);
  assert.equal((await sql('select record from public.imported_jobs where id=$1',[id]))[0].record.needsAction,true,'Approval is not completion');
  let feed=await call(hash,'changes.read');const event=feed.items.find(i=>i.kind==='action_decision');
  assert.equal(feed.items.filter(i=>i.kind==='action_decision').length,1,'Replay emits one decision');assert.equal(event.decisionKey,item.key);assert.equal(event.response,'accept');
  assert.equal(JSON.stringify(feed).includes(record.nextAction),false,'Feed contains pointers, not task bodies');
  assert.equal((await sql('select public.agent_pending_count($1) n',[watch.watchId]))[0].n,1);
  assert.deepEqual(museChangeFeedResponse(feed).items[0].refresh,{tool:'read_action_board',arguments:{}});
  assert.equal((await call(foreign,'changes.read')).items.length,0);
  await assert.rejects(call(readonly,'actions.tracker.progress',{key:item.key,expectedVersion:1,stage:'started',eventKey:crypto.randomUUID()}),e=>e.code==='42501');
  const started={key:item.key,expectedVersion:1,stage:'started',eventKey:crypto.randomUUID()};
  const result=await call(hash,'actions.tracker.progress',started);assert.deepEqual(await call(hash,'actions.tracker.progress',started),result);
  await assert.rejects(call(second,'actions.tracker.progress',{...started,eventKey:crypto.randomUUID()}));
  await assert.rejects(call(second,'actions.tracker.progress',{key:item.key,expectedVersion:2,stage:'completed',note:'Wrong agent',eventKey:crypto.randomUUID()}),e=>e.code==='42501');
  await assert.rejects(call(hash,'imports.update',{id,expectedVersion:0,eventKey:'bypass',changes:{needsAction:false}}),e=>e.code==='42501');
  await call(hash,'actions.tracker.progress',{key:item.key,expectedVersion:2,stage:'completed',note:'Confirmed the fictional interview time with the recruiter.',eventKey:crypto.randomUUID()});
  assert.equal((await sql('select record from public.imported_jobs where id=$1',[id]))[0].record.needsAction,false);
  assert.equal((await board()).trackerWork.find(w=>w.key===item.key).state,'completed');
  assert.equal((await call(hash,'changes.read')).items.filter(i=>i.kind==='action_decision').length,1,'Progress never creates another human approval event');
  await call(hash,'changes.ack',{eventIds:[event.id]});assert.equal((await sql('select public.agent_pending_count($1) n',[watch.watchId]))[0].n,0);
  assert((await call(second,'changes.read')).items.some(e=>e.id===event.id),'Acknowledgement is per connection');

  // New source -> fresh human review; rejection survives tracker edits and blocks AI Apply.
  await identity(owner);await sql("update public.imported_jobs set record=record||'{\"needsAction\":true,\"nextAction\":\"Provide availability\"}' where id=$1",[id]);
  item=(await board()).items.find(i=>i.sourceId===id);await human(item.key,'reject');
  await assert.rejects(call(hash,'imports.update',{id,expectedVersion:1,eventKey:'after-stop',changes:{notes:'must not write'}}),e=>e.code==='42501');
  const apply={posting:{id:'pipeline-native',company:'Pipeline Fixture',title:'Engineer',url:record.url,location:'Remote',employmentType:'FT'},expectedRevision:0,eventKey:'apply-pipeline'};
  await assert.rejects(call(hash,'applications.submit_job',apply),e=>e.code==='42501');
  await identity(owner);await sql("update public.imported_jobs set record=record||'{\"nextAction\":\"Corrected availability task\"}' where id=$1",[id]);
  assert(!(await board()).items.some(i=>i.sourceId===id),'Source edits cannot lift rejection');
  assert.equal((await board()).trackerWork.find(w=>w.key===item.key).action,'Provide availability','Decision history preserves the exact approved/rejected task');
  await human(item.key,'resume_tracker');
  const fresh=(await board()).items.find(i=>i.sourceId===id);assert(fresh);assert.notEqual(fresh.key,item.key);assert.equal((await board()).trackerWork.some(w=>w.key===fresh.key&&w.state==='approved'),false);
  const queued=await call(hash,'applications.submit_job',apply);await call(hash,'applications.submit_job',apply);
  const queuedEvents=(await call(hash,'changes.read')).items.filter(e=>e.kind==='application_requested');assert.equal(queuedEvents.length,1);assert.equal(queuedEvents[0].recordId,queued.job.id);
  assert.deepEqual(museChangeFeedResponse({items:queuedEvents}).items[0].refresh,{tool:'read_backend_jobs',arguments:{jobId:queued.job.id}});
  await human(fresh.key,'accept');await call(hash,'actions.tracker.progress',{key:fresh.key,expectedVersion:1,stage:'started',eventKey:crypto.randomUUID()});
  await call(hash,'actions.tracker.progress',{key:fresh.key,expectedVersion:2,stage:'uncertain',note:'The external response was lost; verify before retrying.',eventKey:crypto.randomUUID()});
  await assert.rejects(human(fresh.key,'resume_tracker'),e=>e.code==='22023');
  await human(fresh.key,'stop_tracker');assert.equal((await sql('select status from private.backend_jobs where id=$1',[queued.job.id]))[0].status,'cancelled');
  await call(hash,'actions.tracker.progress',{key:fresh.key,expectedVersion:4,stage:'completed',note:'An already-started action returned its observed outcome after stop.',eventKey:crypto.randomUUID()});
  assert.equal((await sql('select record from public.imported_jobs where id=$1',[id]))[0].record.needsAction,true,'Late outcome never clears a stopped task');
  assert.equal((await board()).trackerWork.find(w=>w.key===fresh.key).state,'rejected');
 }finally{await db.close();}
});
test('tracker reporting validates exact keys, versions and outcomes and never accepts human decisions',()=>{
 const valid={key:'imported:fixture:revision',expectedVersion:1,stage:'started',eventKey:crypto.randomUUID()};
 assert.doesNotThrow(()=>validateRequest({operation:'actions.tracker.progress',payload:valid}));
 for(const patch of [{stage:'accept'},{expectedVersion:0},{ownerId:'other'},{stage:'completed'},{eventKey:'not-a-uuid'}])assert.throws(()=>validateRequest({operation:'actions.tracker.progress',payload:{...valid,...patch}}));
});


test('fictional decisions and AI Apply use the same resettable feed through pickup and outcome',async()=>{
 const {demoFixtures,createMemoryStore,createDemoServices}=await import('../next-app/lib/demo.mjs');
 const {withActionBoardDemo,enableActionBoardScenario}=await import('../next-app/lib/action-board-demo.mjs');
 const fixture=demoFixtures('2026-11-08');enableActionBoardScenario(fixture,'2026-11-08');
 const store=createMemoryStore(fixture.state),api=withActionBoardDemo(createDemoServices(store),store);
 const initial=(await api.readMuseChanges()).items.length;
 const item=(await api.readActionBoard()).items.find(i=>i.kind==='imported_action');
 await api.respondActionBoard({key:item.key,response:'accept',eventKey:crypto.randomUUID()});
 assert.equal((await api.readMuseChanges()).items.length,initial+1);
 assert.equal(store.get('demo.boardImports').find(r=>r.id===item.sourceId).record.needsAction,true);
 let work=(await api.readActionBoard()).trackerWork.find(w=>w.key===item.key);assert.equal(work.state,'approved');
 await api.recordTrackerActionProgress({key:item.key,expectedVersion:work.version,stage:'started',eventKey:crypto.randomUUID()});
 work=(await api.readActionBoard()).trackerWork.find(w=>w.key===item.key);assert.equal(work.state,'started');
 await api.recordTrackerActionProgress({key:item.key,expectedVersion:work.version,stage:'completed',note:'Fictional result only.',eventKey:crypto.randomUUID()});
 assert.equal((await api.readActionBoard()).trackerWork.find(w=>w.key===item.key).state,'completed');
 assert.equal((await api.readMuseChanges()).items.length,initial+1,'Progress does not manufacture another human decision');
 const request={posting:{id:'demo-new-role',company:'Example',title:'Engineer',employmentType:'FT',location:'Remote',url:'https://example.com/demo-new'},expectedRevision:0,eventKey:'demo-apply'};
 const result=await api.queueApplicationJob(request);await api.queueApplicationJob(request);
 const event=(await api.readMuseChanges()).items.find(i=>i.kind==='application_requested');assert.equal(event.recordId,result.job.id);
 assert.equal((await api.backendJobs.read({jobId:event.recordId})).jobs[0].kind,'application_submit');
 assert.equal((await api.readMuseChanges()).items.filter(i=>i.kind==='application_requested').length,1);
 const resetStore=createMemoryStore(fixture.state),reset=withActionBoardDemo(createDemoServices(resetStore),resetStore);
 assert.equal((await reset.readMuseChanges()).items.length,initial);
});
