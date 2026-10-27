import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
import {contextResponse} from '../supabase/functions/agent-gateway/context.mjs';
import {TOOLS,createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {MUSE_CHANGE_TYPES,museChangeFeedResponse} from '../lib/muse-change-feed.mjs';
import {createMuseChangeFeedDemo} from '../lib/muse-change-feed-demo.mjs';

const hash='e'.repeat(64),second='f'.repeat(64),foreign='d'.repeat(64);
const owner='11111111-1111-1111-1111-111111111111',other='22222222-2222-2222-2222-222222222222';

test('the label catalog uses existing read tools and the detached feed includes timeline updates',async()=>{
 assert.equal(MUSE_CHANGE_TYPES.length,5);
 for(const type of MUSE_CHANGE_TYPES)assert.ok(TOOLS.some(tool=>tool.name===type.readTool&&tool.readOnly));
 const demo=createMuseChangeFeedDemo(),feed=await demo.readMuseChanges();
 assert.deepEqual(feed.eventTypes,MUSE_CHANGE_TYPES);
 const event=feed.items.find(item=>item.kind==='application_timeline_changed');
 assert.equal(event.label,'Interview scheduled');
 assert.deepEqual(event.refresh,{tool:'read_application_timeline',arguments:{applicationId:'demo-draft'}});
 await demo.acknowledgeMuseChanges({eventIds:[event.id]});assert.ok(!(await demo.readMuseChanges()).items.some(item=>item.id===event.id));
 assert.ok((await createMuseChangeFeedDemo().readMuseChanges()).items.some(item=>item.kind==='application_timeline_changed'));
 const updated=museChangeFeedResponse({items:[{kind:'application_timeline_changed',recordId:'app',milestoneKind:'technical_round',phase:'completed'}]});
 assert.equal(updated.items[0].label,'Interview completed');
});

test('website/MCP timeline writes → labeled feed → read current timeline → acknowledge remain atomic and connection scoped',async()=>{
 const db=await createTestDatabase();
 try {
  for(const [credential,user] of [[hash,owner],[second,owner],[foreign,other]])await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Fictional timeline test',$2,array['workspace:read','activity:write'],now()+interval '1 day')",[user,credential]);
  await db.query("insert into public.jobs(id,canonical_url,employer) values('timeline-feed-test','https://example.test/timeline','{}')");
  const app=(await db.query("insert into public.applications(user_id,job_id,draft) values($1,'timeline-feed-test','{}') returning *",[owner])).rows[0];
  const call=async(credential,operation,payload={})=>contextResponse(operation,(await db.query('select public.agent_dispatch($1,$2,$3) as data',[credential,operation,payload])).rows[0].data);
  const handler=createHandler(async(token,operation,payload)=>{
   try{return {status:200,data:await call(token.slice('jb_agent_'.length),operation,payload)};}catch(e){return {status:400,error:e.code};}
  });
  const mcp=async(name,args={},credential=hash)=>{
   const response=await handler(new Request('http://localhost/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+credential,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})}));
   const body=await response.json();assert.ok(!body.error&&!body.result.isError,JSON.stringify(body));return JSON.parse(body.result.content[0].text);
  };
  const payload={eventKey:'timeline:scheduled',kind:'technical_round',label:'PRIVATE interview details',occurredAt:null,phase:'scheduled',source:{kind:'user',note:'PRIVATE interview notes'}};
  await db.query("select set_config('test.uid',$1,false)",[owner]);
  const milestone=(await db.query('select to_jsonb(public.record_application_milestone($1,$2)) as data',[app.id,payload])).rows[0].data;
  let feed=await mcp('read_muse_changes');assert.equal(feed.items.length,1);
  const event=feed.items[0];assert.equal(event.kind,'application_timeline_changed');assert.equal(event.label,'Interview scheduled');assert.equal(event.milestoneId,milestone.id);assert.equal(event.phase,'scheduled');assert.ok(!JSON.stringify(feed).includes('PRIVATE'));
  let current=await mcp(event.refresh.tool,event.refresh.arguments);assert.equal(current.milestones.length,1);assert.equal(current.milestones[0].label,'PRIVATE interview details');
  assert.equal(current.application.status,app.status);assert.equal((await db.query('select count(*)::int n from public.submission_attempts where application_id=$1',[app.id])).rows[0].n,0);
  await db.query('select public.record_application_milestone($1,$2)',[app.id,payload]);assert.equal((await mcp('read_muse_changes')).items.length,1,'Exact retry emits once');
  await assert.rejects(db.query('select public.record_application_milestone($1,$2)',[app.id,{...payload,label:'Changed evidence'}]),e=>e.code==='40001');assert.equal((await mcp('read_muse_changes')).items.length,1,'Rejected write emits no change');
  const completion={...payload,applicationId:app.id,eventKey:'timeline:completed',phase:'completed',source:{kind:'email',messageId:'fictional-completion',subject:'PRIVATE subject',excerpt:'PRIVATE evidence',receivedAt:'2026-10-26T12:00:00Z'}};
  await mcp('record_application_milestone',completion);
  await mcp('acknowledge_muse_changes',{eventIds:[event.id]});await mcp('acknowledge_muse_changes',{eventIds:[event.id]});
  feed=await mcp('read_muse_changes');assert.equal(feed.items.length,1);assert.equal(feed.items[0].label,'Interview completed');
  current=await mcp(feed.items[0].refresh.tool,feed.items[0].refresh.arguments);assert.equal(current.milestones.length,2);
  assert.equal((await mcp('read_muse_changes',{},second)).items.length,2);assert.equal((await mcp('read_muse_changes',{},foreign)).items.length,0);
  const old=feed.items[0];await db.query("update public.activity_events set occurred_at=now()-interval '40 days' where id=$1",[old.id]);await mcp('acknowledge_muse_changes',{eventIds:[old.id]});assert.equal((await db.query('select count(*)::int n from public.activity_events where id=$1',[old.id])).rows[0].n,1);await mcp('acknowledge_muse_changes',{eventIds:[old.id]},second);assert.equal((await db.query('select count(*)::int n from public.activity_events where id=$1',[old.id])).rows[0].n,0);
  await db.query("select set_config('test.uid',$1,false)",[owner]);
  await db.query('select public.set_application_stage($1,$2,$3,$4)',[app.id,app.revision,'Submitted','PRIVATE submission note']);
  const submitted=(await mcp('read_muse_changes')).items;assert.equal(submitted.length,1);assert.equal(submitted[0].status,'Submitted');
  await mcp('acknowledge_muse_changes',{eventIds:submitted.map(item=>item.id)});
  const revision=(await db.query('select revision from public.applications where id=$1',[app.id])).rows[0].revision;
  await db.query('select public.set_application_stage($1,$2,$3,$4)',[app.id,revision,'Interview','PRIVATE status note']);
  feed=await mcp('read_muse_changes');assert.equal(feed.items.length,1);assert.equal(feed.items[0].change,'stage_changed');assert.equal(feed.items[0].status,'Interview');assert.ok(!JSON.stringify(feed).includes('PRIVATE'));
  await db.query("update public.applications set status=status where id=$1",[app.id]);assert.equal((await mcp('read_muse_changes')).items.length,1,'No-op emits no update');
  await assert.rejects(call(hash,'activity.append',{eventKey:'muse-feed:spoof',kind:'muse.application_timeline_changed',data:{}}),e=>e.code==='42501');
  await assert.rejects(call(hash,'changes.read',{limit:1.5}),e=>e.code==='22023');
  await mcp('acknowledge_muse_changes',{eventIds:feed.items.map(item=>item.id)});assert.equal((await mcp('read_muse_changes')).items.length,0);
 }finally{await db.close();}
});
