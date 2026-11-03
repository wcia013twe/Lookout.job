import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
import {createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {contextResponse} from '../supabase/functions/agent-gateway/context.mjs';
import {operationService} from '../lib/mcp-services.mjs';
import {createMuseChangeFeedDemo} from '../lib/muse-change-feed-demo.mjs';

const owner='11111111-1111-1111-1111-111111111111',foreign='22222222-2222-2222-2222-222222222222';
const token='a'.repeat(64),otherToken='b'.repeat(64),foreignToken='c'.repeat(64),limitedToken='d'.repeat(64);

test('schedule edits flow from owned settings through pending count, targeted MCP read and connection-specific acknowledgement',async()=>{
 const db=await createTestDatabase();
 try {
  for(const [hash,user,scopes] of [[token,owner,['workspace:read','activity:write','preferences:write']],[otherToken,owner,['workspace:read','activity:write']],[foreignToken,foreign,['workspace:read','activity:write']],[limitedToken,owner,['activity:write']]])
   await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'fictional',$2,$3,now()+interval '1 day')",[user,hash,scopes]);
  const call=async(hash,operation,payload={})=>contextResponse(operation,(await db.query('select public.agent_dispatch($1,$2,$3) as data',[hash,operation,payload])).rows[0].data);
  const handler=createHandler(async(secret,operation,payload)=>{try{return {status:200,data:await call(secret.slice(9),operation,payload)}}catch(e){return {status:400,error:e.code}}});
  const mcp=async(name,args={})=>{
   const response=await handler(new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})}));
   const body=await response.json();assert.ok(!body.error&&!body.result.isError,JSON.stringify(body));return JSON.parse(body.result.content[0].text);
  };
  const initial=await mcp('read_agent_schedule');assert.equal(initial.schedule,null);assert.equal(initial.configVersion,0);assert.equal(initial.updatedAt,null);
  await assert.rejects(call(limitedToken,'automation.schedule.read'),e=>e.code==='42501');
  await assert.rejects(call(token,'automation.schedule.read',{ownerId:foreign}),e=>e.code==='22023');
  const watch=await call(token,'changes.watch',{enabled:true});const count=async id=>Number((await db.query('select public.agent_pending_count($1) as n',[id])).rows[0].n);
  assert.equal(await count(watch.watchId),0);
  const conn=initial.connectionId;
  const schedule={enabled:true,timezone:'America/New_York',configVersion:1,routines:[{id:'daily',title:'PRIVATE schedule title',description:'PRIVATE task instruction',enabled:true,mode:'scheduled',time:'18:00',sourceIds:[],connectionIds:[conn]}]};
  // The real authenticated website RPC writes the same versioned schedule.
  await db.query("select set_config('test.uid',$1,false)",[owner]);
  await db.query('select public.configure_card_pack_preferences($1,$2)', ['preferences.notifications.save',{expectedUpdatedAt:null,settings:{schedule}}]);
  assert.equal(await count(watch.watchId),1);
  const feed=await mcp('read_muse_changes');assert.equal(feed.items.length,1);
  const event=feed.items[0];assert.equal(event.kind,'schedule_changed');assert.equal(event.version,1);assert.deepEqual(event.refresh,{tool:'read_agent_schedule',arguments:{}});assert(!JSON.stringify(feed).includes('PRIVATE'));
  assert.deepEqual((await mcp(event.refresh.tool,event.refresh.arguments)).schedule,schedule);
  assert.equal((await call(foreignToken,'automation.schedule.read')).schedule,null);
  assert.equal((await call(foreignToken,'changes.read')).items.length,0);
  await assert.rejects(call(foreignToken,'changes.ack',{eventIds:[event.id]}),e=>e.code==='42501');
  await mcp('acknowledge_muse_changes',{eventIds:[event.id]});assert.equal(await count(watch.watchId),0);
  assert.equal((await call(otherToken,'changes.read')).items.length,1,'receipt is per connection');
  // A no-op leaves the count alone; the next agent edit emits one new pointer.
  await db.query('update public.preferences set updated_at=clock_timestamp() where user_id=$1',[owner]);assert.equal(await count(watch.watchId),0);
  const current=await mcp('read_agent_schedule');
  const next={...schedule,enabled:false,configVersion:2};
  await mcp('save_notification_preferences',{expectedUpdatedAt:current.updatedAt,settings:{schedule:next}});
  const second=await mcp('read_muse_changes');assert.deepEqual(second.items.map(i=>i.kind),['schedule_changed']);assert.equal(second.items[0].version,2);
  assert.equal((await mcp('read_agent_schedule')).schedule.enabled,false);assert.equal(await count(watch.watchId),1);
  // A mixed update produces both pointers and keeps unrelated preference changes visible.
  const last=await mcp('read_agent_schedule');
  await mcp('save_notification_preferences',{expectedUpdatedAt:last.updatedAt,settings:{schedule:{...next,configVersion:3},quietMode:{cadence:'daily'}}});
  const mixed=await mcp('read_muse_changes');assert.deepEqual(mixed.items.map(i=>i.kind).sort(),['preferences_changed','schedule_changed','schedule_changed']);
 } finally {await db.close();}
});

test('fictional schedule change is independently readable and resettable',async()=>{
 const demo=createMuseChangeFeedDemo(),feed=await demo.readMuseChanges();
 const event=feed.items.find(item=>item.kind==='schedule_changed');assert.deepEqual(event.refresh,{tool:'read_agent_schedule',arguments:{}});
 const result=await demo.readAgentSchedule();assert.equal(result.schedule.routines[0].title,'Fictional search');
 await demo.acknowledgeMuseChanges({eventIds:[event.id]});assert(!(await demo.readMuseChanges()).items.some(item=>item.id===event.id));
 assert((await createMuseChangeFeedDemo().readMuseChanges()).items.some(item=>item.kind==='schedule_changed'));
});


test('Node dispatch routes the schedule read to the authenticated gateway',async()=>{
 const {createDispatch}=await import('../backend/runtime/service.ts');
 let calls=0;
 const dispatch=createDispatch({supabaseUrl:'https://example.test',rpc:async()=>assert.fail('schedule read must go through gateway authorization'),request:async(url,options)=>{
  calls++;assert.equal(new URL(url).pathname,'/functions/v1/agent-gateway');
  assert.deepEqual(JSON.parse(options.body),{operation:'automation.schedule.read',payload:{}});
  return new Response(JSON.stringify({data:{schedule:null,configVersion:0,updatedAt:null,connectionId:'demo'}}),{status:200,headers:{'Content-Type':'application/json'}});
 }});
 assert.equal(operationService('automation.schedule.read').owner,'private career context');
 const result=await dispatch('jb_agent_'+token,'automation.schedule.read',{});
 assert.equal(result.status,200);assert.equal(result.data.configVersion,0);assert.equal(calls,1);
 assert.equal((await dispatch('jb_agent_'+token,'automation.schedule.read',{ownerId:foreign})).status,400);assert.equal(calls,1);
});
