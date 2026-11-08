import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
import {validateApplicationAgent,APPLICATION_AGENT_SCOPES} from '../lib/application-agent.mjs';
const owner='11111111-1111-1111-1111-111111111111',other='22222222-2222-2222-2222-222222222222';
test('owned agent selection fences browser and MCP routing without moving existing jobs',async()=>{
 const db=await createTestDatabase();
 try{
 const add=async(name,hash,user=owner)=> (await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,$2,$3,$4,now()+interval '1 day') returning id",[user,name,hash,APPLICATION_AGENT_SCOPES])).rows[0].id;
 const muse=await add('Muse','a'.repeat(64)),dots=await add('Dots','b'.repeat(64)),foreign=await add('Foreign','c'.repeat(64),other);
 const call=async(sql,args=[])=> (await db.query(sql,args)).rows[0].value;
 await db.query("select set_config('test.uid',$1,false)",[owner]);
 await db.exec('set role authenticated');
 assert.equal((await call('select public.read_application_agent() value')).version,0);
 await db.exec('reset role');
 await assert.rejects(db.query("select private.resolve_application_agent($1,null)",[owner]),/Choose your AI Apply agent/);
 const select=payload=>call('select public.select_application_agent($1) value',[payload]);
 await assert.rejects(select({connectionId:foreign,expectedVersion:0}),/owned agent/);
 await db.exec('set role authenticated');
 assert.equal((await select({connectionId:muse,expectedVersion:0})).version,1);
 await db.exec('reset role');
 await assert.rejects(select({connectionId:dots,expectedVersion:0}),/changed/);
 assert.equal((await call("select public.agent_dispatch($1,'applications.agent.read','{}') value",['b'.repeat(64)])).connectionId,muse);
 const payload={posting:{id:'routing-one',url:'https://careers.example.com/jobs/one',company:'Fictional',title:'Engineer',employmentType:'FT',location:'Remote'},expectedRevision:0,eventKey:'routing-one'};
 const first=await call('select public.queue_application_job($1) value',[payload]);
 assert.equal((await db.query('select connection_id from private.backend_jobs where id=$1',[first.job.id])).rows[0].connection_id,muse);
 await add('New testing connection','d'.repeat(64));
 const second=await call("select public.agent_dispatch($1,'applications.submit_job',$2) value",['b'.repeat(64),{...payload,eventKey:'routing-two',posting:{...payload.posting,id:'routing-two',url:'https://careers.example.com/jobs/two'}}]);
 assert.equal((await db.query('select connection_id from private.backend_jobs where id=$1',[second.job.id])).rows[0].connection_id,muse);
 await select({connectionId:dots,expectedVersion:1});
 assert.deepEqual(await call('select public.queue_application_job($1) value',[payload]),first);
 assert.equal((await db.query('select connection_id from private.backend_jobs where id=$1',[first.job.id])).rows[0].connection_id,muse);
 await db.query('update private.agent_connections set revoked_at=now() where id=$1',[dots]);
 await assert.rejects(db.query('select public.queue_application_job($1)',[{...payload,eventKey:'routing-three'}]),/unavailable/);
 assert.ok((await call('select private.workspace_reset_tables() value')).includes('private.application_agent_preferences'));
 const preview=await call("select private.workspace_reset_service($1,'preview','{}') value",[owner]);
 assert.equal(preview.counts['private.application_agent_preferences'],1);
 await db.query("insert into private.workspace_resets(user_id,id,state,blocked_paths) values($1,gen_random_uuid(),'pending',array[]::text[])",[owner]);
 await assert.rejects(select({connectionId:muse,expectedVersion:2}),/reset is incomplete/);
 await db.query('delete from private.workspace_resets where user_id=$1',[owner]);
 await db.query("select set_config('test.uid',$1,false)",[other]);
 assert.equal((await call('select public.read_application_agent() value')).connectionId,null);
 }finally{await db.close();}
});
test('routing payload rejects ownership injection and invalid versions',()=>{
 assert.throws(()=>validateApplicationAgent('applications.agent.select',{connectionId:owner,expectedVersion:0,userId:other}));
 assert.throws(()=>validateApplicationAgent('applications.agent.read',null));
 assert.throws(()=>validateApplicationAgent('applications.agent.select',{connectionId:owner,expectedVersion:-1}));
});

test('browser adapter rejects late responses after account changes',async()=>{
 const {createBackend}=await import('../backend/client.mjs');
 for(const method of ['readApplicationAgent','selectApplicationAgent']){
  let user=owner;const calls=[];
  const backend=createBackend({auth:{getUser:async()=>({data:{user:{id:user}}})},rpc:async(name,args)=>{calls.push({name,args});user=other;return {data:{connectionId:owner,version:1}};}},owner);
  await assert.rejects(backend[method]({connectionId:owner,expectedVersion:0}),/Account changed/);
  assert.equal(calls[0].name,method==='readApplicationAgent'?'read_application_agent':'select_application_agent');
 }
});
test('fictional demo persists agent choice, detects stale writes and unavailable connections',async()=>{
 const {createDemoServices,createDemoWorkspace}=await import('../next-app/lib/muse-demo-fixtures.mjs');
 const {createMemoryStore}=await import('../next-app/lib/demo.mjs');
 const store=createMemoryStore(createDemoWorkspace()),services=createDemoServices(store);
 const connectionId='88888888-8888-4888-8888-888888888888';
 assert.equal((await services.readApplicationAgent()).version,0);
 assert.equal((await services.selectApplicationAgent({connectionId,expectedVersion:0})).available,true);
 await assert.rejects(services.selectApplicationAgent({connectionId,expectedVersion:0}),/changed/);
 await services.connections('connections.issue',{name:'New testing agent',scopes:APPLICATION_AGENT_SCOPES});
 assert.equal((await services.readApplicationAgent()).connectionId,connectionId);
 await services.connections('connections.revoke',{id:connectionId});
 assert.equal((await services.readApplicationAgent()).available,false);
 await assert.rejects(services.queueApplicationJob({posting:{id:'fictional-routing',url:'https://example.com/jobs/routing',company:'Fictional',title:'Engineer',employmentType:'FT',location:'Remote'},eventKey:'demo-routing',expectedRevision:0}),/unavailable/);
});
