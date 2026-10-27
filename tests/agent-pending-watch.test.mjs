import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
import {pendingCountResponse} from '../supabase/functions/agent-gateway/pending-count.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {createMuseChangeFeedDemo} from '../lib/muse-change-feed-demo.mjs';
const owner='11111111-1111-1111-1111-111111111111',other='22222222-2222-2222-2222-222222222222';
test('count HTTP boundary contains a scalar only and fails closed',async()=>{
 const url='https://example.test/functions/v1/agent-gateway/pending-count?watchId='+owner;
 const read=async id=>{assert.equal(id,owner);return {data:73};};
 const res=await pendingCountResponse(new Request(url),read);assert.equal(await res.json(),73);assert.equal(res.headers.get('Cache-Control'),'no-store');
 for(const u of [url+'&userId=anything',url+'&watchId='+other,url.replace(owner,'bad')])assert.equal((await pendingCountResponse(new Request(u),()=>{throw Error('must not query');})).status,400);
 assert.equal((await pendingCountResponse(new Request(url,{method:'POST'}),read)).status,405);
 for(const read of [async()=>({error:{message:'PRIVATE'}}),async()=>{throw Error('PRIVATE');},async()=>({data:null})]){const response=await pendingCountResponse(new Request(url),read);assert.equal(response.status,503);assert.ok(!(await response.text()).includes('PRIVATE'));}
 assert.equal(await pendingCountResponse(new Request('https://example.test/agent-gateway'),read),null);
});
test('watch configuration and real counts share ownership, receipts, scopes and lifecycle through MCP and gateway SQL',async()=>{
 const db=await createTestDatabase(),h='1'.repeat(64),h2='2'.repeat(64),hf='3'.repeat(64),hr='4'.repeat(64);
 const call=async(hash,operation,payload={})=>(await db.query('select public.agent_dispatch($1,$2,$3) data',[hash,operation,payload])).rows[0].data;
 const count=async id=>Number((await db.query('select public.agent_pending_count($1) n',[id])).rows[0].n);
 try{
  for(const [hash,user,scopes]of [[h,owner,['workspace:read','activity:write']],[h2,owner,['workspace:read','activity:write']],[hf,other,['workspace:read','activity:write']],[hr,owner,['workspace:read']]])await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Fictional watch',$2,$3,now()+interval '1 day')",[user,hash,scopes]);
  for(const payload of [{},{enabled:'true'},{enabled:true,userId:other}]){assert.throws(()=>validateRequest({operation:'changes.watch',payload}));await assert.rejects(call(h,'changes.watch',payload));}
  await assert.rejects(call(hr,'changes.watch',{enabled:true}),e=>e.code==='42501');
  const handler=createHandler(async(token,operation,payload)=>({status:200,data:await call(token.slice(9),operation,payload)}));
  const response=await handler(new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+h,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'configure_agent_watch',arguments:{enabled:true}}})}));
  const result=await response.json();assert.ok(!result.result.isError,JSON.stringify(result));
  const watch=JSON.parse(result.result.content[0].text).watchId;assert.ok(watch);
  const second=(await call(h2,'changes.watch',{enabled:true})).watchId,foreign=(await call(hf,'changes.watch',{enabled:true})).watchId;
  assert.equal(await count(watch),0);assert.equal(await count(owner),0);
  for(let i=0;i<55;i++)await db.query("insert into public.activity_events(user_id,event_key,kind,actor,payload) values($1,$2,$3,'system','{}')",[owner,'muse-feed:watch:'+i,i===0?'muse.application_timeline_changed':'muse.preferences_changed']);
  assert.equal(await count(watch),55);assert.equal(await count(foreign),0);
  const http=await pendingCountResponse(new Request('https://example.test/functions/v1/agent-gateway/pending-count?watchId='+watch),async id=>({data:await count(id)}));assert.equal(http.status,200);assert.equal(await http.json(),55);
  await assert.rejects(call(watch,'changes.read'),e=>e.code==='28000');
  const page=await call(h,'changes.read');assert.equal(page.items.length,20);assert.equal(await count(watch),55);
  await call(h,'changes.ack',{eventIds:page.items.map(e=>e.id)});assert.equal(await count(watch),35);assert.equal(await count(second),55);
  await db.query("update private.agent_connections set scopes=array['workspace:read'] where token_hash=$1",[h2]);assert.equal(await count(second),0);
  await db.query("update private.agent_connections set scopes=array['workspace:read','activity:write'] where token_hash=$1",[h2]);assert.equal(await count(second),55);
  const rotated=(await call(h,'changes.watch',{enabled:true})).watchId;assert.notEqual(rotated,watch);assert.equal(await count(watch),0);assert.equal(await count(rotated),35);
  await call(h,'changes.watch',{enabled:false});assert.equal(await count(rotated),0);
  await db.query('update private.agent_connections set revoked_at=now() where token_hash=$1',[h2]);assert.equal(await count(second),0);await assert.rejects(call(h2,'changes.watch',{enabled:true}));
  await db.query("update private.agent_connections set expires_at=now()-interval '1 minute' where token_hash=$1",[hf]);assert.equal(await count(foreign),0);
  await db.exec('set role anon');try{await assert.rejects(count(second),e=>e.code==='42501');}finally{await db.exec('reset role');}
 }finally{await db.close();}
});
test('fictional watch demo rotates, acknowledges and resets without account IO',async()=>{
 const demo=createMuseChangeFeedDemo(),watch=(await demo.configureAgentWatch({enabled:true})).watchId;
 assert.equal(await demo.readAgentPendingCount(watch),4);const feed=await demo.readMuseChanges();await demo.acknowledgeMuseChanges({eventIds:[feed.items[0].id]});assert.equal(await demo.readAgentPendingCount(watch),3);
 const next=(await demo.configureAgentWatch({enabled:true})).watchId;assert.equal(await demo.readAgentPendingCount(watch),0);assert.equal(await demo.readAgentPendingCount(next),3);await demo.configureAgentWatch({enabled:false});assert.equal(await demo.readAgentPendingCount(next),0);assert.equal((await createMuseChangeFeedDemo().readMuseChanges()).items.length,4);
});
