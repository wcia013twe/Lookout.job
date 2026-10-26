import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {fetchSource,deduplicate} from '../backend/runtime/ats.ts';
const exec=promisify(execFile);
const root=fileURLToPath(new URL('../',import.meta.url));
const cli=process.env.SUPABASE_CLI||'/opt/homebrew/bin/supabase';
const run=async(file,args)=>await exec(file,args,{cwd:root,maxBuffer:1024*1024,timeout:60000});
const db='supabase_db_lookout-local',edge='supabase_edge_runtime_lookout-local';
const compose=['compose','-f','backend/runtime/compose.yaml'];
const uuid=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/i.test(value);
const sql=async query=>JSON.parse((await run('docker',['exec',db,'psql','-X','-U','postgres','-d','postgres','-A','-t','-q','-v','ON_ERROR_STOP=1','-c',query])).stdout.trim());
const counts=()=>sql("select json_build_object('users',(select count(*) from auth.users),'jobs',(select count(*) from private.backend_jobs),'runs',(select count(*) from public.search_runs),'listings',(select count(*) from public.search_listings));");
async function main(){
 const status=JSON.parse((await run(cli,['status','-o','json'])).stdout);
 const base=new URL(status.API_URL);
 assert.ok(base.protocol==='http:'&&['127.0.0.1','localhost'].includes(base.hostname),'Only local Supabase is allowed');
 const config=await readFile(new URL('../supabase/config.toml',import.meta.url),'utf8');
 assert.match(config,/project_id\s*=\s*"lookout-local"/);
 assert.deepEqual(await counts(),{users:0,jobs:0,runs:0,listings:0},'Proof requires the empty disposable local project');
 await run('docker',[...compose,'stop','worker']);
 const api='http://127.0.0.1:8080';
 const http=async(url,{token=status.SERVICE_ROLE_KEY,key=status.ANON_KEY,method='POST',body}={})=>{
  const response=await fetch(url,{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:'Bearer '+token,apikey:key,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const text=await response.text();let data;try{data=text?JSON.parse(text):null;}catch{throw Error('Non-JSON local response (HTTP '+response.status+')');}
  return {status:response.status,data};
 };
 const sb=(path,options)=>http(new URL(path,base),options);
 const rpc=async(name,args)=>{const result=await sb('/rest/v1/rpc/'+name,{key:status.SERVICE_ROLE_KEY,body:args});assert.equal(result.status,200,'Local '+name+' rejected the proof step (HTTP '+result.status+')');return result.data;};
 const gateway=(token,operation,payload={})=>sb('/functions/v1/agent-gateway',{token,body:{operation,payload}});
 const operation=(token,op,payload={})=>http(api+'/v1/operations',{token,body:{operation:op,payload}});
 const mcp=async(token,name,args={})=>{
  const result=await http(api+'/mcp',{token,body:{jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}}});
  assert.equal(result.status,200,'Local Node MCP HTTP failed');
  assert.ok(!result.data.error,'Local Node MCP rejected arguments');
  if(result.data.result.isError)return {error:true,data:result.data.result};
  return {data:JSON.parse(result.data.result.content[0].text)};
 };
 const users=[];let paused=false;let receipt;let failure;
 try{
  const createUser=async()=>{
   const email='discovery-proof-'+randomUUID()+'@example.test',password=randomUUID()+'aA!9';
   const created=await sb('/auth/v1/admin/users',{key:status.SERVICE_ROLE_KEY,body:{email,password,email_confirm:true,user_metadata:{name:'Fictional discovery proof'}}});
   assert.equal(created.status,200);const user={id:created.data.id,connections:[]};users.push(user);
   const login=await sb('/auth/v1/token?grant_type=password',{body:{email,password}});assert.equal(login.status,200);user.session=login.data.access_token;
   return user;
  };
  const issue=async(user,scopes)=>{
   const result=await gateway(user.session,'connections.issue',{name:'Fictional discovery proof',scopes,expiresInDays:1});
   assert.equal(result.status,200,'Local Edge human connection issuance failed');
   const connection={id:result.data.connection.id,token:result.data.token};user.connections.push(connection);return connection;
  };
  const person=await createUser(),other=await createUser();
  const connection=await issue(person,['workspace:read','preferences:write','drafts:write']);
  const limited=await issue(other,['workspace:read']);
  const profile='---\nid: discovery-proof\nname: Fictional discovery proof\nactive: true\nfilters: {}\npriorities: {}\n---\nObserve public systems postings for this fictional integration check. No candidate facts or scoring.\n';
  const portals={tracked_companies:[
   {id:'together-copy',name:'Together AI',kind:'board',careers_url:'https://boards.greenhouse.io/togetherai',enabled:true},
   {id:'together-primary',name:'Together AI',kind:'board',careers_url:'https://job-boards.greenhouse.io/togetherai',enabled:true},
   {id:'unsupported',name:'Fictional unsupported source',kind:'board',careers_url:'https://example.invalid/jobs',enabled:true},
  ],search_queries:[]};
  for(const document of [{kind:'profile',id:'discovery-proof',content:profile},{kind:'portals',id:'shared',content:JSON.stringify(portals)}]){
   const result=await gateway(connection.token,'search.document.save',{...document,expectedVersion:0,eventKey:'proof:'+document.kind});
   assert.equal(result.status,200,'Local Edge '+document.kind+' configuration failed: '+(result.data?.error||'unknown error'));
  }
  const invalid=await mcp(limited.token,'submit_backend_job',{kind:'search_ats',input:{profileId:'discovery-proof'},eventKey:'denied'});
  assert.equal(invalid.error,true,'Read-only credential must not queue work');
  assert.deepEqual((await mcp(limited.token,'read_backend_jobs')).data,{jobs:[]});
  const payload={kind:'search_ats',input:{profileId:'discovery-proof'},eventKey:'proof:approved-discovery'};
  const queued=(await mcp(connection.token,'submit_backend_job',payload)).data;
  assert.equal(queued.status,'queued');assert.ok(uuid(queued.id));
  assert.deepEqual((await mcp(connection.token,'submit_backend_job',payload)).data,queued,'Queue retry must replay');
  // Seed an actual official observation under a legitimate first lease, then
  // expire that lease. The real worker must resume the pinned run and dedup it.
  const observed=await fetchSource('portal:together-copy',portals.tracked_companies[0]);
  assert.ok(observed.listings.length>0,'Public employer ATS must return real postings for live proof');
  const claim=await rpc('backend_worker',{operation:'claim',payload:{}});
  assert.equal(claim.job.id,queued.id);
  const fence={jobId:queued.id,leaseToken:claim.leaseToken,expectedVersion:claim.job.version};
  const dispatch=async(op,args)=>rpc('backend_worker',{operation:'dispatch',payload:{...fence,operation:op,payload:args}});
  const search=await dispatch('search.run.start',{profileId:'discovery-proof',eventKey:'job:'+queued.id+':start'});
  await dispatch('search.discoveries.save',{runId:search.id,listings:[observed.listings[0]],eventKey:'job:'+queued.id+':proof-seed'});
  const identity=await dispatch('search.discoveries.read',{runId:search.id,offset:0,limit:100});
  assert.equal(identity.listings.length,1);assert.deepEqual(Object.keys(identity.listings[0]).sort(),['company','location','title','url']);
  await run('docker',['exec',db,'psql','-X','-U','postgres','-d','postgres','-q','-v','ON_ERROR_STOP=1','-c',"update private.backend_jobs set lease_expires_at=now()-interval '1 second' where id='"+queued.id+"'::uuid;"]);
  // Node queue/auth/guides and the worker must continue with Edge paused.
  await run('docker',['pause',edge]);paused=true;
  assert.ok((await mcp(connection.token,'read_guide',{id:'career-find-jobs'})).data.instructions);
  const envFile=new URL('../backend/runtime/.env.local',import.meta.url);
  let env=await readFile(envFile,'utf8');
  env=env.replace(/^LOOKOUT_EXECUTION_ENABLED=.*\n?/m,'');env+='\nLOOKOUT_EXECUTION_ENABLED=true\n';
  await writeFile(envFile,env,{mode:0o600});
  await run('docker',[...compose,'up','-d','api','worker']);
  let ready=false;
  for(let attempt=0;attempt<50;attempt++){
   try{if((await fetch(api+'/healthz',{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}
   await delay(100);
  }
  assert.equal(ready,true,'Recreated Node API must become healthy');
  let completed;
  for(let attempt=0;attempt<90;attempt++){
   const result=await mcp(connection.token,'read_backend_jobs',{jobId:queued.id});
   const current=result.data.jobs[0];
   if(!['queued','running'].includes(current.status)){completed=current;break;}
   await delay(1000);
  }
  assert.equal(completed?.status,'partial','Unsupported source must yield persisted partial coverage');
  assert.equal(completed.attempts,2,'Worker must reclaim the expired lease and resume');
  assert.equal(completed.search_run_id,search.id);
  const persisted=await sql("select json_build_object('state',(select state from public.search_runs where id='"+search.id+"'),'sources',(select json_agg(json_build_object('id',source_id,'state',state,'coverage',coverage,'saved',counts->'saved','checkpoint',checkpoint) order by source_id) from public.search_source_attempts where run_id='"+search.id+"'),'listings',(select count(*) from public.search_listings where user_id='"+person.id+"'),'observations',(select count(*) from public.search_observations where run_id='"+search.id+"'),'scores',(select count(*) from public.search_screenings where run_id='"+search.id+"'),'unknownPosted',(select count(*) from public.search_observations where run_id='"+search.id+"' and employer_posted_at is null));");
  assert.equal(persisted.state,'partial');assert.equal(persisted.scores,0,'Discovery must leave fit assessment to the agent');
  assert.equal(persisted.observations,persisted.listings,'Seeded/repeated sources must not duplicate persisted observations');
  assert.equal(persisted.listings,deduplicate(observed.listings).length,'Canonical/normalized dedup must persist the expected unique postings');
  assert.equal(persisted.sources.filter(source=>source.coverage==='inaccessible').length,1);
  assert.equal(persisted.sources.filter(source=>source.coverage==='exhaustive').length,2);
  assert.deepEqual((await mcp(limited.token,'read_backend_jobs')).data,{jobs:[]},'Other owner must not see job');
  const schedule=(await mcp(connection.token,'save_backend_schedule',{kind:'search_ats',input:{profileId:'discovery-proof'},intervalMinutes:15,enabled:false,expectedVersion:0,eventKey:'proof:disabled-schedule'})).data;
  assert.equal(schedule.enabled,false);
  const cancelled=(await mcp(connection.token,'submit_backend_job',{...payload,eventKey:'proof:cancel'})).data;
  assert.equal((await mcp(connection.token,'cancel_backend_job',{jobId:cancelled.id,expectedVersion:cancelled.version})).data.status,'cancelled');
  await run('docker',['unpause',edge]);paused=false;
  assert.equal((await gateway(connection.token,'context.versions')).status,200,'Compatibility Edge path must still work');
  const revoked=await gateway(person.session,'connections.revoke',{id:connection.id});assert.equal(revoked.status,200);
  assert.equal((await gateway(connection.token,'context.versions')).status,401);
  const denied=await http(api+'/mcp',{token:connection.token,body:{jsonrpc:'2.0',id:1,method:'tools/list'}});assert.equal(denied.status,401);
  receipt={checkedAt:new Date().toISOString(),fictionalAccounts:true,nodeApi:api,localSupabase:base.origin,jobId:queued.id,runId:search.id,workerAttempts:completed.attempts,jobState:completed.status,runState:persisted.state,publicSource:'https://boards-api.greenhouse.io/v1/boards/togetherai/jobs?content=true',publicRowsObserved:observed.total,uniqueListings:persisted.listings,observations:persisted.observations,assessmentRows:persisted.scores,unsupportedSources:1,edgePausedDuringWorker:true,scopeDenial:true,ownerIsolation:true,queueReplay:true,cancellation:true,disabledSchedule:true,revocation:true};
 }catch(error){failure=error;}
 finally{
  if(paused)await run('docker',['unpause',edge]).catch(()=>{});
  for(const user of users){
   for(const connection of user.connections||[])await gateway(user.session,'connections.revoke',{id:connection.id}).catch(()=>{});
   const removed=await sb('/auth/v1/admin/users/'+user.id,{method:'DELETE',key:status.SERVICE_ROLE_KEY}).catch(()=>null);
   if(!removed||![200,204].includes(removed.status))failure??=Error('Local fictional account cleanup failed');
  }
 }
 assert.deepEqual(await counts(),{users:0,jobs:0,runs:0,listings:0},'Fictional local account records must be removed');
 if(failure)throw failure;
 receipt.cleanupVerified=true;
 await writeFile(new URL('../backend/local/discovery-proof.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify(receipt,null,2));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
