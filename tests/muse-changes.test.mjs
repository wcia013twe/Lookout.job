import test from 'node:test';import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {operationService} from '../lib/mcp-services.mjs';
import {TOOLS,requiredToolScopes} from '../supabase/functions/agent-mcp/protocol.mjs';
test('Muse feed tools accept only bounded owned changes, never cursors, identity or arbitrary payloads',()=>{
 for(const [op,p]of [['changes.read',{}],['changes.read',{limit:50}],['changes.ack',{eventIds:['11111111-1111-1111-1111-111111111111']} ]])assert.doesNotThrow(()=>validateRequest({operation:op,payload:p}));
 for(const [op,p]of [['changes.read',{userId:'injected'}],['changes.read',{limit:51}],['changes.read',{offset:1}],['changes.ack',{eventIds:[]}],['changes.ack',{eventIds:['bad']}],['changes.ack',{eventIds:['11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111']} ]])assert.throws(()=>validateRequest({operation:op,payload:p}));
 for(const name of ['read_muse_changes','acknowledge_muse_changes'])assert.equal(operationService(TOOLS.find(t=>t.name===name).operation)?.handler,'edge');
 assert.deepEqual(requiredToolScopes(TOOLS.find(t=>t.name==='acknowledge_muse_changes')).sort(),['activity:write','workspace:read']);
});
test('real migrated feed keeps events compact, atomic, owned, pending and independently acknowledged',async t=>{
 const db=await createTestDatabase(),owner='11111111-1111-1111-1111-111111111111',foreign='22222222-2222-2222-2222-222222222222',h='a'.repeat(64),h2='b'.repeat(64),hf='c'.repeat(64),hr='d'.repeat(64);let app,c1,c2;
 const call=async(hash,op,p={})=>(await db.query('select public.agent_dispatch($1,$2,$3) data',[hash,op,p])).rows[0].data;
 const read=()=>call(h,'changes.read');const setOwner=()=>db.query("select set_config('test.uid',$1,false)",[owner]);
 async function confirm(id,answer='PRIVATE CITY',fieldId='location'){
  await setOwner();return(await db.query("update public.applications set draft=jsonb_set(jsonb_set(draft,'{questions}', $2::jsonb),'{lastAnswerConfirmation}',$3::jsonb) where id=$1 returning *",[app,[{fieldId:'location',question:'Location',required:true,answer}],{id,fieldId}])).rows[0];
 }
 try{
  for(const [hash,user,scopes]of [[h,owner,['workspace:read','activity:write']],[h2,owner,['workspace:read','activity:write']],[hf,foreign,['workspace:read','activity:write']],[hr,owner,['workspace:read']]])await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Feed fixture',$2,$3,now()+interval '1 day')",[user,hash,scopes]);
  c1=(await db.query('select id from private.agent_connections where token_hash=$1',[h])).rows[0].id;c2=(await db.query('select id from private.agent_connections where token_hash=$1',[h2])).rows[0].id;
  await db.query("insert into public.jobs(id,canonical_url,employer) values('muse-feed-fixture','https://example.test/feed','{\"company\":\"Fictional employer\"}')");
  app=(await db.query("insert into public.applications(user_id,job_id,draft,blocker) values($1,'muse-feed-fixture',$2,'Browser review required') returning id",[owner,{questions:[{fieldId:'location',question:'Location',required:true,answer:''}],questionsReviewed:false}])).rows[0].id;
  await t.test('answer save emits one pointer atomically; duplicate retries do not duplicate it',async()=>{
   const id='00000000-0000-4000-8000-000000000001';const saved=await confirm(id);const feed=await read();assert.equal(feed.items.length,1);assert.equal(feed.items[0].kind,'answer_confirmed');assert.deepEqual(feed.items[0].fieldIds,['location']);assert.equal(feed.items[0].version,saved.revision);assert(!JSON.stringify(feed).includes('PRIVATE CITY'));assert.equal(saved.draft.questionsReviewed,false);assert.notEqual(saved.status,'Approved');await confirm(id);assert.equal((await read()).items.length,1);
   await assert.rejects(confirm('00000000-0000-4000-8000-000000000002','SHOULD ROLLBACK','unknown'),e=>e.code==='22023');assert.equal((await db.query("select draft->'questions'->0->>'answer' answer from public.applications where id=$1",[app])).rows[0].answer,'PRIVATE CITY');assert.equal((await read()).items.length,1);
  });
  await t.test('authenticated website saves emit the event under RLS; clients cannot forge system feed rows',async()=>{
   await setOwner();await db.exec('set role authenticated');try{await db.query("update public.applications set draft=jsonb_set(draft,'{lastAnswerConfirmation}',$2::jsonb) where id=$1",[app,{id:'00000000-0000-4000-8000-000000000005',fieldId:'location'}]);await assert.rejects(db.query("insert into public.activity_events(user_id,event_key,kind,actor) values($1,'muse-feed:client-spoof','muse.answer_confirmed','system')",[owner]),e=>e.code==='42501');}finally{await db.exec('reset role');}
   const events=(await read()).items;assert.equal(events.length,2);await call(h,'changes.ack',{eventIds:[events.at(-1).id]});
  });
  await t.test('identical text can be confirmed again and older acknowledgement cannot hide the new event',async()=>{
   const first=(await read()).items[0];await confirm('00000000-0000-4000-8000-000000000003');await call(h,'changes.ack',{eventIds:[first.id]});await call(h,'changes.ack',{eventIds:[first.id]});assert.equal((await read()).items.length,1);assert.equal((await call(h2,'changes.read')).items.length,3);
  });
  await t.test('foreign/mixed acknowledgements are atomic; read-only scope and reserved inserts reject',async()=>{
   const ids=(await read()).items.map(i=>i.id);assert.equal((await call(hf,'changes.read')).items.length,0);await assert.rejects(call(hf,'changes.ack',{eventIds:ids}),e=>e.code==='42501');await assert.rejects(call(hr,'changes.ack',{eventIds:ids}),e=>e.code==='42501');await assert.rejects(call(h,'changes.ack',{eventIds:[ids[0],'ffffffff-ffff-4fff-8fff-ffffffffffff']}),e=>e.code==='42501');assert.equal((await read()).items.length,1);
   await assert.rejects(call(h,'activity.append',{eventKey:'muse-feed:spoof',kind:'muse.answer_confirmed',data:{}}),e=>e.code==='42501');
   await assert.rejects(call(h,'changes.read',{ownerId:foreign}),e=>e.code==='22023');
  });
  await t.test('agent draft changes never forge a human confirmation',async()=>{
   const before=(await read()).items.length;await db.query("select set_config('test.uid','',false)");await db.query("update public.applications set draft=jsonb_set(draft,'{lastAnswerConfirmation}',$2::jsonb) where id=$1",[app,{id:'00000000-0000-4000-8000-000000000004',fieldId:'location'}]);assert.equal((await read()).items.length,before);
  });
  await t.test('substantive preferences/profile changes and terminal jobs create pointers, not bodies',async()=>{
   await db.query('insert into public.preferences(user_id) values($1) on conflict do nothing',[owner]);await db.query("update public.preferences set search='{\"location\":\"PRIVATE PREFERENCE\"}',updated_at=now() where user_id=$1",[owner]);let n=(await read()).items.length;await db.query("update public.preferences set theme='{\"pack\":\"base\"}' where user_id=$1",[owner]);assert.equal((await read()).items.length,n);
   await db.query("insert into public.search_documents(user_id,kind,id,version,content,projection) values($1,'profile','feed-profile',1,'PRIVATE PROFILE BODY','{\"active\":true}')",[owner]);
   const job=(await db.query("insert into private.backend_jobs(user_id,connection_id,kind,input) values($1,$2,'search_ats','{\"profileId\":\"feed-profile\"}') returning id",[owner,c1])).rows[0].id;n=(await read()).items.length;await db.query("update private.backend_jobs set status='running' where id=$1",[job]);assert.equal((await read()).items.length,n);await db.query("update private.backend_jobs set status='partial',version=version+1,result='{\"private\":\"PRIVATE JOB BODY\"}' where id=$1",[job]);const f=await read();assert(f.items.some(i=>i.kind==='backend_job_finished'&&i.status==='partial'));assert(f.items.some(i=>i.kind==='profile_changed'));assert(f.items.some(i=>i.kind==='preferences_changed'));assert(!/PRIVATE (PREFERENCE|PROFILE|JOB)/.test(JSON.stringify(f)));
  });
  await t.test('old events are retained until all active consumers acknowledge, then cleaned with receipts',async()=>{
   const event=(await read()).items.find(i=>i.kind==='backend_job_finished');await db.query("update public.activity_events set occurred_at=now()-interval '40 days' where id=$1",[event.id]);await call(h,'changes.ack',{eventIds:[event.id]});assert.equal((await db.query('select count(*)::int n from public.activity_events where id=$1',[event.id])).rows[0].n,1);await call(h2,'changes.ack',{eventIds:[event.id]});assert.equal((await db.query('select count(*)::int n from public.activity_events where id=$1',[event.id])).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from private.muse_change_receipts where event_id=$1',[event.id])).rows[0].n,0);
  });
  await t.test('bounded pending pages do not acknowledge unseen changes or store offsets',async()=>{
   for(let i=0;i<52;i++)await db.query("insert into public.activity_events(user_id,event_key,kind,actor,payload) values($1,$2,'muse.preferences_changed','system',$3)",[owner,'muse-feed:page:'+i,{entity:'preferences',recordId:owner,version:i,text:'Preferences changed'}]);
   const page=await call(h,'changes.read',{limit:2});assert.equal(page.items.length,2);assert.equal(page.hasMore,true);const again=await call(h,'changes.read',{limit:2});assert.deepEqual(page,again);await call(h,'changes.ack',{eventIds:page.items.map(i=>i.id)});const next=await call(h,'changes.read',{limit:2});assert.equal(next.items.length,2);assert(next.items.every(i=>!page.items.some(p=>p.id===i.id)));
  });
 }finally{await db.close();}
});


test('detached Muse feed demo acknowledges handled events and resets independently',async()=>{
 const {demoFixtures,createMemoryStore,createDemoServices}=await import('../next-app/lib/demo.mjs');
 const store=createMemoryStore(demoFixtures('2026-10-26').state),api=createDemoServices(store);const first=await api.readMuseChanges({limit:1});assert.equal(first.items.length,1);assert.equal(first.hasMore,true);await api.acknowledgeMuseChanges({eventIds:[first.items[0].id]});assert.equal((await api.readMuseChanges()).items.length,2);assert.equal((await createDemoServices(store).readMuseChanges()).items.length,3);
});
