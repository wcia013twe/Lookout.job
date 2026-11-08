import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
import {museChangeFeedResponse} from '../lib/muse-change-feed.mjs';
const owner='11111111-1111-1111-1111-111111111111',other='22222222-2222-2222-2222-222222222222',hash='e'.repeat(64),foreign='f'.repeat(64);
const note='1. NYC\n2. SF\n3. Seattle\n4. LA\n5. Phoenix';
async function fixture(db,id){
 await db.query("select set_config('test.uid',$1,false)",[owner]);
 await db.query("insert into public.jobs(id,canonical_url,employer) values($1,$2,'{\"company\":\"Fictional ranking\"}')",[id,'https://example.com/'+id]);
 const app=(await db.query("insert into public.applications(user_id,job_id,draft,blocker) values($1,$2,'{\"questions\":[],\"questionsReviewed\":false}','Rank the five hubs') returning id",[owner,id])).rows[0].id;
 const item=(await db.query("select x from private.action_board_items($1) x where x->>'sourceId'=$2 and x->>'kind'='resolve_blocker'",[owner,app])).rows[0].x;
 const request={key:item.key,response:'accept',eventKey:crypto.randomUUID(),input:{note,answers:[],confirmed:true}};
 await db.exec('set role authenticated');
 try{await db.query('select public.respond_action_board($1)',[request]);}finally{await db.exec('reset role');}
 return {app,request};
}
test('saved human text is delivered atomically, replay-safe, owned and historical acknowledgements survive upgrade',async()=>{
 let historical;
 const db=await createTestDatabase({beforeMigration:async(db,name)=>{
  if(name!=='20261108091446_action_decision_saved_response.sql')return;
  await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Receiver',$2,array['workspace:read','activity:write'],now()+interval '1 day'),($3,'Other owner',$4,array['workspace:read'],now()+interval '1 day')",[owner,hash,other,foreign]);
  historical=await fixture(db,'historical-response');
  await db.query("select public.agent_dispatch($1,'changes.ack',jsonb_build_object('eventIds',jsonb_build_array(id))) from public.activity_events where kind='muse.action_decision' and user_id=$2",[hash,owner]);
 }});
 const call=async(h,op,p={})=>(await db.query('select public.agent_dispatch($1,$2,$3) data',[h,op,p])).rows[0].data;
 try{
  assert.equal((await call(hash,'changes.read')).items.length,0,'Upgrade does not replay acknowledged consent');
  const old=(await db.query("select payload from public.activity_events where payload->>'decisionKey'=$1",[historical.request.key])).rows[0].payload;
  assert.deepEqual(old.savedResponse,historical.request,'Historical notification now contains exact saved text');
  const current=await fixture(db,'current-response');
  let feed=await call(hash,'changes.read');const event=feed.items.find(e=>e.decisionKey===current.request.key);
  assert.deepEqual(event.savedResponse,current.request);
  assert.deepEqual(museChangeFeedResponse(feed).items.find(e=>e.id===event.id).savedResponse,current.request,'Shared browser/MCP projection retains the body');
  assert.equal((await call(foreign,'changes.read')).items.length,0,'Other owner cannot read input');
  const watch=await call(hash,'changes.watch',{enabled:true});
  const count=(await db.query('select public.agent_pending_count($1) count',[watch.watchId])).rows[0].count;
  assert.equal(typeof count,'number');assert.equal(count,1,'Public wake route remains count-only');
  await db.query("select set_config('test.uid',$1,false)",[owner]);
  await db.query('select public.respond_action_board($1)',[current.request]);
  assert.equal((await call(hash,'changes.read')).items.filter(e=>e.decisionKey===current.request.key).length,1,'Retry creates no second notification');
  assert.equal((await db.query('select count(*)::int n from public.approvals where application_id=$1',[current.app])).rows[0].n,0,'Blocker response is not final approval');
  await call(hash,'changes.ack',{eventIds:[event.id]});
  assert.equal((await call(hash,'changes.read')).items.length,0);
 }finally{await db.close();}
});
test('fictional decision notification contains saved structured answers and notes without mutating the request',async()=>{
 const {createDemoWorkspace,createDemoServices}=await import('../next-app/lib/muse-demo-fixtures.mjs');
 const {createMemoryStore,demoFixtures}=await import('../next-app/lib/demo.mjs');
 const {withActionBoardDemo,enableActionBoardScenario}=await import('../next-app/lib/action-board-demo.mjs');
 const fixture=demoFixtures('2026-11-08');enableActionBoardScenario(fixture,'2026-11-08');
 const store=createMemoryStore(fixture.state),api=withActionBoardDemo(createDemoServices(store),store);
 const item=(await api.readActionBoard()).items.find(i=>i.kind==='resolve_blocker');
 const request={key:item.key,response:'accept',eventKey:crypto.randomUUID(),input:{note,confirmed:true,answers:item.questions.map(q=>q.answer||'Fictional answer')}};
 const original=structuredClone(request);await api.respondActionBoard(request);
 const event=(await api.readMuseChanges({limit:50})).items.find(e=>e.decisionKey===item.key);
 assert.deepEqual(event.savedResponse,original);assert.deepEqual(request,original);
});
