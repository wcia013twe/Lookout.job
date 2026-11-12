import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
import {createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {validateRequest,hashToken} from '../supabase/functions/agent-gateway/contract.mjs';
import {prepareSearch,searchResponse} from '../supabase/functions/agent-gateway/search.mjs';
import {profileDocument} from '../lib/search/documents.mjs';

test('worker facts are reusable through isolated agent subscriptions without per-user workers',async()=>{
 const db=await createTestDatabase();
 const producer='11111111-1111-1111-1111-111111111111',consumer='22222222-2222-2222-2222-222222222222';
 const tokens=['jb_agent_'+'d'.repeat(64),'jb_agent_'+'e'.repeat(64)],hashes=await Promise.all(tokens.map(token=>hashToken(token)));
 try{
  for(const [index,owner] of [producer,consumer].entries()){
   await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Fictional pool agent',$2,array['workspace:read','preferences:write','drafts:write','batches:write'],now()+interval '1 day')",[owner,hashes[index]]);
   await db.query('select private.search_owned($1,$2,$3)',[owner,'search.document.save',{kind:'profile',id:'general',expectedVersion:0,eventKey:'profile',content:profileDocument({id:'general',name:'Fictional systems profile',active:true,filters:{Employment:'Full-time'},priorities:{},instructions:'Private candidate note: never shared.'})}]);
  }
  const handle=createHandler(async(token,operation,payload)=>{
   try{
    validateRequest({operation,payload});
    if(operation.startsWith('search.'))payload=prepareSearch(operation,payload);
    const result=await db.query('select public.agent_dispatch($1,$2,$3) data',[await hashToken(token),operation,payload]);
    return {status:200,data:searchResponse(operation,result.rows[0].data)};
   }catch(error){return {status:400,error:error.message};}
  });
  const call=async(index,name,args={})=>{
   const response=await handle(new Request('http://localhost/mcp',{method:'POST',headers:{Authorization:'Bearer '+tokens[index],'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})}));
   const body=await response.json();assert(!body.error,JSON.stringify(body));assert(!body.result.isError,JSON.stringify(body));return body.result.structuredContent||JSON.parse(body.result.content[0].text);
  };
  const owned=async(index,operation,payload)=> (await db.query('select public.agent_dispatch($1,$2,$3) data',[hashes[index],operation,payload])).rows[0].data;
  await assert.rejects(owned(1,'search.pool.read',{profileId:'general'}),/Subscribe/);
  const subscription=await call(1,'subscribe_shared_jobs',{profileId:'general',enabled:true,expectedVersion:0,eventKey:'subscribe'});
  assert.equal(subscription.version,1);assert.equal(subscription.cursor,0);
  assert.deepEqual(await call(1,'subscribe_shared_jobs',{profileId:'general',enabled:true,expectedVersion:0,eventKey:'subscribe'}),subscription);
  assert.equal((await call(1,'read_shared_jobs',{profileId:'general'})).jobs.length,0);
  assert.equal((await db.query('select count(*)::int count from private.backend_jobs')).rows[0].count,0);
  await db.query('select public.backend_job_dispatch($1,$2,$3)',[hashes[0],'backend.jobs.submit',{kind:'search_ats',input:{profileId:'general'},eventKey:'producer'}]);
  const claim=(await db.query("select public.backend_worker('claim','{}') data")).rows[0].data;
  const dispatch=async(operation,payload)=> (await db.query("select public.backend_worker('dispatch',$1) data",[{jobId:claim.job.id,leaseToken:claim.leaseToken,expectedVersion:claim.job.version,operation,payload}])).rows[0].data;
  const run=await dispatch('search.run.start',{profileId:'general',eventKey:`job:${claim.job.id}:start`});
  const now=new Date().toISOString();
  const facts={url:'https://job-boards.greenhouse.io/fictional/jobs/1?utm_source=fixture',company:'Fictional Systems',title:'Backend Engineer',location:'Remote',checkedAt:now,liveness:'active',employerPostedAt:null,description:'Fictional public employer description.',employmentType:'FT'};
  const payload={runId:run.id,listings:[facts,{...facts,url:'https://job-boards.greenhouse.io/fictional/jobs/2',title:'Database Engineer'}],eventKey:`job:${claim.job.id}:pool:1`};
  await dispatch('search.pool.save',payload);
  await dispatch('search.pool.save',payload);
  assert.equal((await db.query('select count(*)::int count from private.shared_job_pool')).rows[0].count,2);
  await assert.rejects(dispatch('search.pool.save',{...payload,listings:[{...facts,candidate:'private'}],eventKey:`job:${claim.job.id}:pool:bad`}),/Employer facts only/);
  await assert.rejects(dispatch('search.pool.save',{...payload,listings:[{...facts,checkedAt:'2020-01-01T00:00:00Z'}],eventKey:`job:${claim.job.id}:pool:stale`}),/Recent verification/);
  for(const index of [0,1])await assert.rejects(owned(index,'search.pool.save',payload),/leased worker/);
  const page=await call(1,'read_shared_jobs',{profileId:'general',limit:1});
  assert.equal(page.jobs.length,1);assert.equal(page.hasMore,true);assert.equal(page.jobs[0].facts.employerPostedAt,null);
  assert(!JSON.stringify(page).includes('Private candidate note'));assert(!JSON.stringify(page).includes(producer));
  assert.equal(page.jobs[0].facts.url,'https://job-boards.greenhouse.io/fictional/jobs/1');
  const tail=await call(1,'read_shared_jobs',{profileId:'general',limit:1,afterCursor:page.nextCursor});
  assert.equal(tail.jobs.length,1);assert.equal(tail.hasMore,false);
  const selected=page.jobs[0];
  const published=await call(1,'publish_batch',{eventKey:'shared:general:1:'+selected.revision,label:'Fictional shared selection',jobs:[{canonicalUrl:selected.facts.url,employer:{company:selected.facts.company,title:selected.facts.title,location:selected.facts.location,employmentType:'FT',description:'Not a verified capture'},recommendation:{sharedPoolJobId:selected.id,sharedPoolRevision:selected.revision,searchProfileId:'general',evaluatedProfileVersion:1,whyItFits:'Fictional privately assessed selection.',materialGap:'Fictional team scope remains unknown.'}}]});
  const privateBatch=await call(1,'read_batch',{batchId:published.batch.id});
  assert.equal(privateBatch.items.length,1);
  assert.equal(privateBatch.items[0].job.employer.description,facts.description);
  assert.equal(privateBatch.items[0].recommendation.sharedPoolJobId,selected.id);
  await assert.rejects(call(0,'read_batch',{batchId:published.batch.id}),/Owned batch not found/);
  await assert.rejects(owned(1,'search.pool.read',{profileId:'general',afterCursor:999999}),/exceeds inventory/);
  const saved=await call(1,'subscribe_shared_jobs',{profileId:'general',enabled:true,cursor:tail.nextCursor,expectedVersion:1,eventKey:'ack'});
  await assert.rejects(owned(1,'search.pool.subscribe',{profileId:'general',enabled:false,expectedVersion:1,eventKey:'stale'}),/subscription changed/);
  assert.equal((await call(1,'read_shared_jobs',{profileId:'general'})).jobs.length,0);
  assert.equal((await call(0,'read_search_context',{profileId:'general'})).sharedPool.subscription,null);
  assert.equal((await call(1,'read_search_context',{profileId:'general'})).sharedPool.subscription.version,saved.version);
  await db.exec('alter role service_role bypassrls;set role service_role');
  assert.equal((await owned(1,'search.pool.read',{profileId:'general'})).jobs.length,0);
  await db.exec('reset role');
  await dispatch('search.pool.save',{...payload,listings:[{...facts,liveness:'expired',description:null}],eventKey:`job:${claim.job.id}:pool:closed`});
  assert.equal((await call(1,'read_shared_jobs',{profileId:'general'})).jobs[0].facts.liveness,'expired');
  await dispatch('search.pool.save',{...payload,listings:[{...facts,title:'Database Engineer'}],eventKey:`job:${claim.job.id}:pool:merge`});
  await dispatch('search.pool.save',{...payload,listings:[{...facts,title:'Database Engineer',url:'https://job-boards.greenhouse.io/fictional/jobs/3'}],eventKey:`job:${claim.job.id}:pool:move`});
  await dispatch('search.pool.save',{...payload,listings:[{...facts,title:'New Database Engineer',url:'https://job-boards.greenhouse.io/fictional/jobs/3'}],eventKey:`job:${claim.job.id}:pool:rename`});
  const identities=(await db.query('select canonical_url,match_key,facts from private.shared_job_pool')).rows;
  assert.equal(identities.length,1);assert.equal(identities[0].canonical_url,identities[0].facts.url);assert.match(identities[0].match_key,/newdatabaseengineer/);
  await db.query("update private.shared_job_pool set checked_at=now()-interval '73 hours'");
  assert.equal((await call(1,'read_shared_jobs',{profileId:'general'})).jobs.length,0);
  await assert.rejects(owned(1,'search.pool.read',{profileId:'general',userId:producer}),/Bounded shared page/);
  await assert.rejects(owned(1,'search.pool.read',{profileId:'not-owned'}),/Active owned profile/);
  await db.exec("set role authenticated;set test.uid='22222222-2222-2222-2222-222222222222'");
  await assert.rejects(db.query('select * from private.shared_job_pool'),/permission denied/);
  await assert.rejects(db.query("select public.search_action('search.pool.read','{\"profileId\":\"general\"}')"),/Agent execution operation/);
  await db.exec('reset role');
  await db.query("update private.backend_jobs set lease_expires_at=now()-interval '1 second' where id=$1",[claim.job.id]);
  await assert.rejects(dispatch('search.pool.save',{...payload,eventKey:`job:${claim.job.id}:pool:lost`}),/Search lease changed/);
  assert.equal((await db.query('select count(*)::int count from private.backend_jobs')).rows[0].count,1);
  assert.equal((await db.query('select count(*)::int count from public.job_batches where user_id=$1',[consumer])).rows[0].count,1);
  for(const table of ['applications','approvals','submission_attempts'])assert.equal((await db.query(`select count(*)::int count from public.${table}`)).rows[0].count,0);
 }finally{await db.close();}
});

test('shared pool schemas reject injection and preserve read-only semantics',()=>{
 for(const payload of [{profileId:'general',enabled:'true',expectedVersion:0,eventKey:'bad'},{profileId:'general',enabled:true,expectedVersion:0,eventKey:'bad',userId:'other'}])assert.throws(()=>validateRequest({operation:'search.pool.subscribe',payload}));
 assert.throws(()=>validateRequest({operation:'search.pool.read',payload:{profileId:'general',afterCursor:-1}}));
});

test('fictional shared inventory resets and subscription changes stay detached',async()=>{
 const {searchDemo,updateSharedPoolDemo}=await import('../lib/search/demo.mjs');
 const data=searchDemo();
 assert.equal(data.sharedPool.agentOnly,true);
 assert.deepEqual(data.sharedPool.jobs.map(job=>job.facts.liveness),['active','expired']);
 assert.equal(updateSharedPoolDemo(data,{enabled:false,cursor:2,expectedVersion:1}).version,2);
 assert.throws(()=>updateSharedPoolDemo(data,{enabled:true,cursor:0,expectedVersion:1}),/changed/);
 assert.equal(searchDemo().sharedPool.subscription.cursor,0);
 assert.equal(searchDemo().sharedPool.subscription.enabled,true);
});
