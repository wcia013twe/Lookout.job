import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
import {mergeWorkspaceSync,workspaceRowKey} from '../lib/workspace-sync.mjs';
import {createBackend} from '../backend/client.mjs';
const owner='11111111-1111-1111-1111-111111111111',other='22222222-2222-2222-2222-222222222222';
async function read(db,cursor=null,user=owner){
 await db.query("select set_config('test.uid',$1,false)",[user]);await db.exec('set role authenticated');
 try{return (await db.query('select public.sync_workspace($1) data',[cursor])).rows[0].data;}finally{await db.exec('reset role');}
}
test('real SQL snapshot → unchanged → one agent update → delete → reconnect transfers only changed rows',async()=>{
 const db=await createTestDatabase();
 try{
  await db.query("insert into public.profiles(user_id,facts) values($1,'{\"name\":\"Fictional Candidate\"}')",[owner]);
  await db.query("insert into public.answer_library(user_id,question,answer,provenance) select $1,'Question '||i,'Fictional answer '||i,'user' from generate_series(1,250) i",[owner]);
  const snapshot=await read(db);assert.equal(snapshot.mode,'snapshot');assert.equal(snapshot.rows.answer_library.length,250);
  const unchanged=await read(db,snapshot.version);assert.deepEqual(unchanged.changes,{});assert.deepEqual(unchanged.signals,[]);
  const hash='d'.repeat(64);
  await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Fictional delta proof',$2,array['workspace:read','activity:write'],now()+interval '1 hour')",[owner,hash]);
  await db.query("select public.agent_dispatch($1,'activity.append',$2)",[hash,{eventKey:'delta-proof',kind:'progress',data:{note:'Fictional agent progress'}}]);
  const delta=await read(db,snapshot.version);
  assert.deepEqual(Object.keys(delta.changes),['activity_events']);assert.equal(delta.changes.activity_events.upserts.length,1);
  assert.equal(delta.changes.answer_library,undefined,'250 unchanged answers must not be transferred');
  const replay=await read(db,snapshot.version);assert.deepEqual(replay,delta);
  let cache=mergeWorkspaceSync(snapshot.rows,delta);assert.equal(cache.answer_library,snapshot.rows.answer_library,'untouched records retain their identity');
  assert.equal(cache.activity_events.length,1);cache=mergeWorkspaceSync(cache,replay);assert.equal(cache.activity_events.length,1,'replayed delta is idempotent');
  const removed=snapshot.rows.answer_library[0].id;
  await db.query('delete from public.answer_library where id=$1',[removed]);
  const deletion=await read(db,delta.version);assert.deepEqual(deletion.changes.answer_library.deleted,[removed]);assert.deepEqual(deletion.changes.answer_library.upserts,[]);
  cache=mergeWorkspaceSync(cache,deletion);assert.equal(cache.answer_library.length,249);
  // Deliberately skip notifications and make repeated updates before reconnecting.
  await db.query("update public.profiles set facts='{\"name\":\"Intermediate\"}' where user_id=$1",[owner]);
  await db.query("update public.profiles set facts='{\"name\":\"Latest\"}' where user_id=$1",[owner]);
  const reconnect=await read(db,deletion.version);assert.equal(reconnect.changes.profiles.upserts.length,1);assert.equal(reconnect.changes.profiles.upserts[0].facts.name,'Latest');
  cache=mergeWorkspaceSync(cache,reconnect);const current=await read(db);
  for(const table of Object.keys(current.rows))assert.deepEqual([...cache[table]].sort((a,b)=>workspaceRowKey(table,a).localeCompare(workspaceRowKey(table,b))),[...current.rows[table]].sort((a,b)=>workspaceRowKey(table,a).localeCompare(workspaceRowKey(table,b))),table);
  console.log(JSON.stringify({proof:'real SQL incremental workspace',initialAnswerRows:250,unchangedRows:0,agentUpdateRows:1,unchangedAnswersResent:0,deletedRows:1,reconnectProfileRows:1,snapshotBytes:JSON.stringify(snapshot).length,unchangedBytes:JSON.stringify(unchanged).length,agentDeltaBytes:JSON.stringify(delta).length}));
 }finally{await db.close();}
});
test('cursor and tombstones roll back atomically; Auth owns reads and reset cannot leak old rows',async()=>{
 const db=await createTestDatabase();
 try{
  const initial=await read(db);
  await db.exec('begin');await db.query("insert into public.profiles(user_id,facts) values($1,'{\"name\":\"Rolled back\"}')",[owner]);await db.exec('rollback');
  assert.deepEqual(await read(db,initial.version),{mode:'delta',version:initial.version,changes:{},signals:[]});
  await db.query("insert into public.profiles(user_id,facts) values($1,'{\"name\":\"Private owner\"}')",[owner]);
  const own=await read(db);assert.equal((await read(db,null,other)).rows.profiles.length,0);
  await db.query("select set_config('test.uid','',false)");await assert.rejects(()=>db.query('select public.sync_workspace(null)'),/Sign in required/);
  await db.exec('set role anon');await assert.rejects(()=>db.query('select public.sync_workspace(null)'),/permission denied/);await db.exec('reset role');
  await db.query("select set_config('test.uid',$1,false)",[owner]);await db.exec('set role authenticated');
  await assert.rejects(()=>db.query("select * from private.workspace_delta_keys"),/permission denied/);await db.exec('reset role');
  await db.query('delete from public.profiles where user_id=$1',[owner]);
  const deleted=await read(db,own.version);assert.deepEqual(deleted.changes.profiles.deleted,[owner]);assert.equal(mergeWorkspaceSync(own.rows,deleted).profiles.length,0);
  assert.equal((await read(db,Number.MAX_SAFE_INTEGER)).mode,'snapshot','a cursor ahead of restored DB must rehydrate');
 }finally{await db.close();}
});
test('employer edits refresh only referenced owned application and batch projections',async()=>{
 const db=await createTestDatabase();
 try{
  await db.exec("insert into public.jobs(id,canonical_url,employer) values('delta-job','https://fictional.test/delta','{\"company\":\"Before\"}')");
  await db.query("insert into public.applications(user_id,job_id) values($1,'delta-job')",[owner]);
  const batch=(await db.query("insert into public.job_batches(user_id,label,source_event_id) values($1,'Fictional','delta') returning id",[owner])).rows[0].id;
  await db.query("insert into public.batch_items(user_id,batch_id,job_id,position) values($1,$2,'delta-job',0)",[owner,batch]);
  const before=await read(db);await db.exec("update public.jobs set employer='{\"company\":\"After\"}' where id='delta-job'");
  const change=await read(db,before.version);assert.deepEqual(Object.keys(change.changes).sort(),['applications','batch_items']);
  assert.equal(change.changes.applications.upserts[0].jobs.employer.company,'After');assert.equal(change.changes.batch_items.upserts[0].jobs.employer.company,'After');
  assert.deepEqual((await read(db,before.version,other)).rows?.applications||[],[]);
 }finally{await db.close();}
});
test('browser adapter makes one sync RPC, fences owners, and never falls back to whole-table reads',async()=>{
 let calls=0,user=owner;const client={auth:{getUser:async()=>({data:{user:{id:user}}})},from(){throw Error('Unexpected table fetch')},async rpc(name,args){calls++;assert.equal(name,'sync_workspace');assert.equal(args.after_version,42);return {data:{mode:'delta',version:42,changes:{},signals:[]}}}};
 const api=createBackend(client,owner);assert.deepEqual((await api.readWorkspaceSync(42)).changes,{});assert.equal(calls,1);
 client.rpc=async()=>{user=other;return {data:{}}};await assert.rejects(()=>api.readWorkspaceSync(42),/Account changed/);
});
