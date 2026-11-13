import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
import {createBackend} from '../backend/client.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {validateRecommendationFeedback} from '../supabase/functions/agent-gateway/recommendation-feedback.mjs';
import {TOOLS,createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';

const owner='11111111-1111-1111-1111-111111111111',other='22222222-2222-2222-2222-222222222222';
const goal='33333333-3333-4333-8333-333333333333',application='44444444-4444-4444-8444-444444444444';
const target={kind:'network',targetId:'person'};
const save={...target,rating:'helpful',expectedVersion:0,requestId:'first',note:'Specific recommendation',context:{surface:'network'}};

test('feedback browser API validates and guards account changes; MCP only exposes scoped reads',async()=>{
 const calls=[];let current=owner;
 const backend=createBackend({auth:{getUser:async()=>({data:{user:{id:current}}})},rpc:async(name,args)=>{calls.push([name,args]);return {data:{rows:[]}};}},owner);
 await backend.readRecommendationFeedback({targets:[target]});await backend.saveRecommendationFeedback(save);await backend.listRecommendationFeedback();
 assert.deepEqual(calls.map(call=>call[0]),Array(3).fill('recommendation_feedback_action'));
 assert.deepEqual(calls[1][1],{operation:'recommendation.feedback.save',payload:save});
 current=other;await assert.rejects(backend.saveRecommendationFeedback(save),/Account changed/);assert.equal(calls.length,3);
 for(const patch of [{rating:'good'},{expectedVersion:-1},{requestId:''},{note:'x'.repeat(2001)},{reason:'x'.repeat(201)},{context:[]},{context:{large:'x'.repeat(8193)}},{userId:other},{source:'user'}])assert.throws(()=>validateRecommendationFeedback('recommendation.feedback.save',{...save,...patch}));
 assert.throws(()=>validateRequest({operation:'recommendation.feedback.save',payload:save}),/Unknown operation/);
 for(const payload of [{targets:[]},{targets:Array(101).fill(target)},{targets:[{...target,userId:owner}]}])assert.throws(()=>validateRequest({operation:'recommendation.feedback.read',payload}));
 for(const payload of [{limit:0},{limit:101},{after:'01'},{after:'-1'},{after:1},{ownerId:owner}])assert.throws(()=>validateRequest({operation:'recommendation.feedback.list',payload}));
 for(const name of ['read_recommendation_feedback','list_recommendation_feedback']){const tool=TOOLS.find(tool=>tool.name===name);assert.equal(tool.scope,'workspace:read');assert.equal(tool.readOnly,true);}
 assert.equal(TOOLS.some(tool=>tool.name==='save_recommendation_feedback'),false);
 let scopes=['workspace:read'];const forwarded=[];
 const handler=createHandler(async(_token,operation,payload)=>{if(operation==='credentials.verify')return {status:200,data:{scopes}};validateRequest({operation,payload});forwarded.push(operation);return {status:200,data:{rows:[],cursor:'0',hasMore:false}};});
 const request=()=>handler(new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:`Bearer jb_agent_${'a'.repeat(64)}`,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'list_recommendation_feedback',arguments:{}}})}));
 assert.equal((await(await request()).json()).result.isError,undefined);scopes=['activity:write'];assert.equal((await(await request()).json()).result.isError,true);assert.deepEqual(forwarded,['recommendation.feedback.list']);
});

test('feedback SQL owns targets, preserves replay and clear changes, pages deterministically, and enforces limits',async()=>{
 const db=await createTestDatabase();
 const action=async(operation,payload)=>(await db.query('select public.recommendation_feedback_action($1,$2) data',[`recommendation.feedback.${operation}`,payload])).rows[0].data;
 const agent=async(operation,payload,hash='a'.repeat(64))=>(await db.query('select public.agent_dispatch($1,$2,$3) data',[hash,`recommendation.feedback.${operation}`,payload])).rows[0].data;
 try{
  await db.query("select set_config('test.uid',$1,false)",[owner]);
  await db.query("insert into public.outreach_contacts(user_id,id,record) values($1,'person',$2),($3,'other-person','{}')",[owner,{suggestion:{id:'suggestion',purpose:'connect',rationale:'Relevant systems experience',action:'Connect',sources:[],createdAt:'2026-11-12T00:00:00Z',updatedAt:'2026-11-12T00:00:00Z',state:'active'}},other]);
  await db.query("insert into public.jobs(id,canonical_url,employer) values('job','https://example.test/job','{}'),('unowned','https://example.test/unowned','{}')");
  const batch=(await db.query("insert into public.job_batches(user_id,label,source_event_id) values($1,'Test','test') returning id",[owner])).rows[0].id;
  await db.query('insert into public.batch_items(user_id,batch_id,job_id,position,recommendation) values($1,$2,\'job\',0,$3)',[owner,batch,{whyItFits:'Systems scope'}]);
  await db.query('insert into public.learning_goals(id,user_id,goal) values($1,$2,$3)',[goal,owner,{tasks:[{id:'task:1',title:'Practice'}]}]);
  await db.query("insert into public.applications(id,user_id,job_id) values($1,$2,'job')",[application,owner]);
  await db.query('insert into public.preparation_plans(user_id,application_id,plan) values($1,$2,$3)',[owner,application,{tasks:[{id:'prep-task',title:'Review'}]}]);
  for(const [hash,user,scopes] of [['a',owner,['workspace:read']],['b',other,['workspace:read']],['c',owner,['activity:write']]])await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Feedback',$2,$3,now()+interval '1 hour')",[user,hash.repeat(64),scopes]);
  const initial=await action('read',{targets:[target]});assert.equal(initial.rows[0].version,0);
  const first=await action('save',save);assert.equal(first.version,1);assert.equal(first.context.recommendationVersion,0);assert.deepEqual(await action('save',save),first);
  await assert.rejects(action('save',{...save,note:'different'}),/request ID/);
  await assert.rejects(action('save',{...save,requestId:'stale'}),/Feedback changed/);
  const edit=await action('save',{...save,requestId:'edit',expectedVersion:1,rating:'not-helpful',reason:'Wrong team'});assert.equal(edit.version,2);
  const clear=await action('save',{...save,requestId:'clear',expectedVersion:2,rating:null});assert.equal(clear.version,3);assert.equal(clear.rating,null);assert.equal(clear.note,'');assert.equal(clear.reason,'');
  assert.deepEqual(await action('save',save),first);
  const pages=[];let after='0';
  for(let index=0;index<3;index++){const page=await agent('list',{after,limit:1});pages.push(...page.rows);assert.equal(page.hasMore,index<2);after=page.cursor;}
  assert.deepEqual(pages.map(row=>row.version),[1,2,3]);assert.deepEqual(pages.map(row=>row.rating),['helpful','not-helpful',null]);assert.equal(after,'3');assert.deepEqual((await agent('list',{after})).rows,[]);
  assert.deepEqual((await agent('list',{},'b'.repeat(64))).rows,[]);
  await assert.rejects(agent('read',{targets:[target]},'b'.repeat(64)),/Owned recommendation/);
  await assert.rejects(agent('save',save),/Human feedback/);await assert.rejects(agent('list',{},'c'.repeat(64)),/scope/);
  for(const ownedTarget of [{kind:'job',targetId:'job'},{kind:'planning',targetId:`goal:${goal}:task:1`},{kind:'planning',targetId:`application:${application}:prep-task`}]){
   const row=await action('save',{...save,...ownedTarget,requestId:ownedTarget.targetId,expectedVersion:0});assert.equal(row.version,1);assert.ok(row.context.recommendation);
  }
  await db.query('update private.recommendation_feedback_changes set created_at=now()');
  const oldTargetEdit=await action('save',{...save,requestId:'old-target-edit',expectedVersion:3});
  const incremental=await agent('list',{after:'6'});assert.equal(incremental.cursor,'7');assert.deepEqual(incremental.rows,[oldTargetEdit]);
  assert.deepEqual((await db.query('select status,revision from public.applications where id=$1',[application])).rows,[{status:'Queued',revision:0}]);
  assert.equal((await db.query('select version from public.preparation_plans where application_id=$1',[application])).rows[0].version,1);
  for(const invalidTarget of [{kind:'network',targetId:'other-person'},{kind:'job',targetId:'unowned'},{kind:'planning',targetId:`goal:${goal}:unknown`},{kind:'planning',targetId:'2026-11-13:practice:task'}])await assert.rejects(action('save',{...save,...invalidTarget,requestId:'invalid'}),/Owned recommendation/);
  for(const patch of [{source:'user'},{note:'x'.repeat(2001)},{reason:'x'.repeat(201)},{context:{large:'x'.repeat(8193)}},{rating:'yes'},{expectedVersion:0.5},{requestId:''}])await assert.rejects(action('save',{...save,...patch}));
  for(const payload of [{limit:101},{after:'01'},{after:'-1'},{after:4}])await assert.rejects(action('list',payload));
  await assert.rejects(action('read',{targets:Array(101).fill(target)}));
  await db.exec('set role authenticated');assert.equal((await db.query('select * from public.recommendation_feedback')).rows.length,4);
  await assert.rejects(db.query("update public.recommendation_feedback set rating='helpful'"),/permission denied/);
  await db.query("select set_config('test.uid',$1,false)",[other]);assert.equal((await db.query('select * from public.recommendation_feedback')).rows.length,0);await assert.rejects(action('read',{targets:[target]}),/Owned recommendation/);
  await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[owner]);
  await db.exec('set role anon');await assert.rejects(action('list',{}),/permission denied/);await assert.rejects(db.query('select * from public.recommendation_feedback'),/permission denied/);await db.exec('reset role');
  for(let version=4;version<57;version++)await action('save',{...save,requestId:`limit-${version}`,expectedVersion:version});
  await assert.rejects(action('save',{...save,requestId:'over-limit',expectedVersion:57}),/write limit/);
  assert.deepEqual(await action('save',save),first);
  assert.equal((await db.query('select count(*)::integer count from private.recommendation_feedback_changes')).rows[0].count,60);
 }finally{await db.close();}
});

test('feedback reset deletes private records, guards pending writes, and never rewinds incremental cursors',async()=>{
 const db=await createTestDatabase();
 const action=async(operation,payload)=>(await db.query('select public.recommendation_feedback_action($1,$2) data',[`recommendation.feedback.${operation}`,payload])).rows[0].data;
 const reset=async(operation,payload={})=>(await db.query('select public.workspace_reset_service($1,$2,$3) data',[owner,operation,payload])).rows[0].data;
 try{
  await db.query("insert into public.outreach_contacts(user_id,id,record) values($1,'person','{}'),($2,'person','{}')",[owner,other]);
  await db.query("select set_config('test.uid',$1,false)",[owner]);await action('save',save);
  const firstPage=await action('list',{});
  await db.query("select set_config('test.uid',$1,false)",[other]);await action('save',save);
  await db.query("select set_config('test.uid',$1,false)",[owner]);await action('save',{...save,requestId:'edit',expectedVersion:1});
  await db.exec('begin');await action('save',{...save,requestId:'rolled-back',expectedVersion:2});await db.exec('rollback');
  await action('save',{...save,requestId:'after-rollback',expectedVersion:2});
  const secondPage=await action('list',{after:firstPage.cursor,limit:1});assert.deepEqual(secondPage.rows.map(row=>row.version),[2]);assert.equal(secondPage.hasMore,true);
  const thirdPage=await action('list',{after:secondPage.cursor,limit:1});assert.deepEqual(thirdPage.rows.map(row=>row.version),[3]);assert.equal(thirdPage.hasMore,false);assert(BigInt(thirdPage.cursor)>BigInt(secondPage.cursor)+1n);
  const preview=await reset('preview');assert.equal(preview.counts['public.recommendation_feedback'],1);assert.equal(preview.counts['private.recommendation_feedback_changes'],3);
  const resetId='55555555-5555-4555-8555-555555555555';
  await reset('begin',{resetId,confirmation:'RESET MY WORKSPACE',expectedPersonalVersion:preview.personalVersion});
  await assert.rejects(action('save',{...save,requestId:'pending-reset',expectedVersion:3}),/Workspace reset is incomplete/);
  const completed=await reset('finish',{resetId});assert.equal(completed.state,'completed');assert.equal(completed.counts['public.recommendation_feedback'],0);assert.equal(completed.counts['private.recommendation_feedback_changes'],0);
  assert.deepEqual((await action('list',{after:thirdPage.cursor})).rows,[]);
  await db.query("insert into public.outreach_contacts(user_id,id,record) values($1,'person','{}')",[owner]);
  await action('save',{...save,requestId:'after-reset'});
  const afterReset=await action('list',{after:thirdPage.cursor});assert.equal(afterReset.rows.length,1);assert.equal(afterReset.rows[0].version,1);assert(BigInt(afterReset.cursor)>BigInt(thirdPage.cursor));
  await db.query("select set_config('test.uid',$1,false)",[other]);assert.equal((await action('list',{})).rows.length,1);
 }finally{await db.close();}
});
