import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {createEvents,publicAddress,signingKey,signedHeaders,callbackUrl} from '../backend/runtime/mcp-events.mjs';
import {createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {createTestDatabase} from './helpers/database.mjs';
const secret='whsec_'+Buffer.alloc(32,7).toString('base64');
const params={name:'lookout.work_available',arguments:{},delivery:{mode:'webhook',url:'https://receiver.example/events',secret}};
test('callback transport rejects nonpublic and alternate addresses and signs exact bytes with rotation',()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.1.1','169.254.169.254','100.64.0.1','198.18.0.1','192.0.0.1','0.0.0.0','224.1.1.1','::1','::ffff:8.8.8.8','2001:db8::1'])assert.equal(publicAddress(ip),false,ip);
 assert.equal(publicAddress('8.8.8.8'),true);
 for(const url of ['http://example.com','https://name:pass@example.com','https://example.com:8443','https://example.com/#fragment','https://[::1]/','https://[::ffff:127.0.0.1]/','https://2130706433/','https://127.0.0.1/'])assert.throws(()=>callbackUrl(url));
 for(const key of ['secret','whsec_YQ==','whsec_'+Buffer.alloc(65).toString('base64')])assert.throws(()=>signingKey(key));
 const body='{"test":"exact bytes"}',headers=signedHeaders({id:'sub',secret,old_secret:secret,rotate_until:'2100-01-01'},'evt',body,10000);
 assert.equal(headers['webhook-signature'],Array(2).fill('v1,'+createHmac('sha256',Buffer.alloc(32,7)).update('evt.10.'+body).digest('base64')).join(' '));
});
test('MCP event lifecycle uses real migrated authorization, durable outbox and fenced delivery',async()=>{
 const db=await createTestDatabase();
 const token='jb_agent_'+'a'.repeat(64),hash=createHash('sha256').update(token).digest('hex');
 const token2='jb_agent_'+'b'.repeat(64),hash2=createHash('sha256').update(token2).digest('hex');
 const owner='11111111-1111-1111-1111-111111111111',other='22222222-2222-2222-2222-222222222222';
 const rpc=async(name,args)=>{try{return {data:(await db.query('select public.mcp_event_dispatch($1,$2) data',[args.action,args.args])).rows[0].data};}catch(error){return {error};}};
 const received=[];let status=200;
 const post=async(url,headers,body)=>{const value=JSON.parse(body);received.push({url,headers,value});return {status,body:JSON.stringify({challenge:value.challenge})};};
 try {
  for(const [h,u] of [[hash,owner],[hash2,other]])await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Fictional events',$2,array['workspace:read','activity:write'],now()+interval '2 days')",[u,h]);
  let events=createEvents({rpc,post});
  const handler=createHandler(async()=>({status:200,data:{scopes:['workspace:read']}}),[],[],undefined,events.handle);
  const call=async(method,params)=> (await (await handler(new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}))).json());
  assert.deepEqual((await call('initialize',{protocolVersion:'2025-03-26'})).result.capabilities.events,{});
  assert.equal((await call('events/list',{})).result.events[0].name,params.name);
  const sub=(await call('events/subscribe',params)).result;assert.ok(sub.id);
  assert.equal((await events.handle(token,'events/subscribe',params)).id,sub.id);assert.equal(received.length,1);
  // Restart reuses persisted verified callback and subscription identity.
  events=createEvents({rpc,post});assert.equal((await events.handle(token,'events/subscribe',params)).id,sub.id);assert.equal(received.length,1);
  await events.handle(token2,'events/unsubscribe',params);
  assert.equal((await db.query('select count(*) n from private.mcp_event_subscriptions')).rows[0].n,1);
  const add=async(user,key,kind='muse.action_decision')=>db.query("insert into public.activity_events(user_id,event_key,kind,actor,payload) values($1,$2,$3,'system','{}') returning id",[user,key,kind]);
  await add(other,'muse-feed:foreign');await add(owner,'ordinary','ordinary');
  const id=(await add(owner,'muse-feed:owned')).rows[0].id;
  status=500;await events.deliver();assert.equal(received.at(-1).value.eventId,id);
  assert.equal((await db.query('select count(*) n from private.muse_change_receipts')).rows[0].n,0);
  await db.exec("update private.mcp_event_deliveries set due_at=now()-interval '1 second'");
  status=200;await events.deliver();assert.equal(received.at(-1).value.eventId,id);
  const deliveries=received.length;await events.deliver();assert.equal(received.length,deliveries);
  const rotated={...params,delivery:{...params.delivery,secret:'whsec_'+Buffer.alloc(32,8).toString('base64')}};
  assert.equal((await events.handle(token,'events/subscribe',rotated)).id,sub.id);
  await add(owner,'muse-feed:rotated');await events.deliver();assert.equal(received.at(-1).headers['webhook-signature'].split(' ').length,2);
  // Claims are exclusive; stale lease completion cannot acknowledge delivery.
  await add(owner,'muse-feed:leased');
  const leased=(await rpc('',{action:'claim',args:{}})).data;
  assert.equal(leased.length,1);assert.deepEqual((await rpc('',{action:'claim',args:{}})).data,[]);
  await rpc('',{action:'finish',args:{id:leased[0].id,lease:'00000000-0000-4000-8000-000000000000',status:200}});
  assert.equal((await db.query('select done from private.mcp_event_deliveries where id=$1',[leased[0].id])).rows[0].done,false);
  await rpc('',{action:'finish',args:{...leased[0],status:413}});
  assert.equal((await db.query('select done from private.mcp_event_deliveries where id=$1',[leased[0].id])).rows[0].done,true);
  await add(owner,'muse-feed:exhausted');
  await db.exec("update private.mcp_event_deliveries set attempts=6,lease_until=now()-interval '1 second' where not done");
  assert.deepEqual((await rpc('',{action:'claim',args:{}})).data,[]);
  assert.equal((await db.query('select count(*) n from private.mcp_event_deliveries where not done')).rows[0].n,0);
  await add(owner,'muse-feed:gone');status=410;await events.deliver();
  assert.equal((await db.query('select count(*) n from private.mcp_event_subscriptions')).rows[0].n,0);
  status=200;await events.handle(token,'events/subscribe',params);
  await events.handle(token,'events/unsubscribe',params);await events.handle(token,'events/unsubscribe',params);
  assert.equal((await db.query('select count(*) n from private.mcp_event_subscriptions')).rows[0].n,0);
  await events.handle(token,'events/subscribe',params);
  await db.exec("update private.mcp_event_subscriptions set expires_at=now()-interval '1 second'");
  await events.deliver();assert.equal((await db.query('select count(*) n from private.mcp_event_subscriptions')).rows[0].n,0);
  await events.handle(token,'events/subscribe',params);
  await add(owner,'muse-feed:revoked');await db.query('update private.agent_connections set revoked_at=now() where token_hash=$1',[hash]);
  const before=received.length;await events.deliver();assert.equal(received.length,before);
  assert.equal((await db.query('select count(*) n from private.mcp_event_subscriptions')).rows[0].n,0);
  await assert.rejects(events.handle(token,'events/subscribe',params));
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query("select public.mcp_event_dispatch('claim','{}')"));await db.exec('reset role');}
 } finally {await db.close();}
});
test('failed challenge never persists; invalid arguments and short TTL are bounded',async()=>{
 let saved=false;
 const rpc=async(_,args)=>({data:args.action==='authorize'?{connectionId:'fixture'}:args.action==='read'?null:(saved=true,{})});
 const events=createEvents({rpc,post:async()=>({status:200,body:'{"challenge":"wrong"}'})});
 await assert.rejects(events.handle('token','events/subscribe',params),e=>e.code===-32015&&e.reason==='challenge_failed');assert.equal(saved,false);
 for(const patch of [{arguments:{userId:'other'}},{ttlMs:0},{ttlMs:-1},{ttlMs:'1'},{cursor:'unsupported'}])await assert.rejects(events.handle('token','events/subscribe',{...params,...patch}),e=>e.code===-32602);
});
test('detached demo previews event pointers and keeps work acknowledgement separate',async()=>{
 const {createMuseChangeFeedDemo}=await import('../lib/muse-change-feed-demo.mjs');
 const demo=createMuseChangeFeedDemo();const event=await demo.readMcpEventPreview();
 assert.equal(event.name,params.name);assert.equal((await demo.readMcpEventPreview()).eventId,event.eventId);
 await demo.acknowledgeMuseChanges({eventIds:[event.eventId]});assert.notEqual((await demo.readMcpEventPreview()).eventId,event.eventId);
 assert.equal((await createMuseChangeFeedDemo().readMcpEventPreview()).eventId,event.eventId);
});
