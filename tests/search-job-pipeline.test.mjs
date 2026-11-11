import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createTestDatabase} from './helpers/database.mjs';
import {workOnce,executeSearch} from '../backend/runtime/worker.ts';
import {verifyDiscoveryLeads} from '../runner/career-search-intake.mjs';
import {executeCareerTask} from '../runner/career-tools.mjs';
let db;before(async()=>{db=await createTestDatabase();});after(async()=>{await db?.close();});
async function fixture({partial=false,extraSources=0,portalId,queries=[]}={}){
 const owner=randomUUID(),profile='profile_'+owner.replaceAll('-','');
 await db.query('insert into auth.users values($1)',[owner]);
 await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Fictional pipeline',$2,array['workspace:read','preferences:write','drafts:write'],now()+interval '1 day')",[owner,owner.replaceAll('-','').repeat(2)]);
 const hash=owner.replaceAll('-','').repeat(2);
 const projection={active:true,filters:{Employment:'Full-time','Work arrangement':'Remote required'},instructions:''};
 const portals={tracked_companies:[{id:'example',name:'Example (fictional)',careers_url:'https://job-boards.greenhouse.io/example',enabled:true},...(partial?[{id:'unsupported',name:'Unsupported fictional source',careers_url:'https://unsupported.test/careers',enabled:true}]:[])],search_queries:queries};
 for(let i=1;i<=extraSources;i++)portals.tracked_companies.push({id:'example-'+i,name:`Example ${i} (fictional)`,careers_url:`https://job-boards.greenhouse.io/example${i}`,enabled:true});
 await db.query("insert into public.search_documents(user_id,kind,id,version,content,projection) values($1,'profile',$2,1,'{}',$3),($1,'portals','shared',1,'{}',$4)",[owner,profile,projection,portals]);
 const q=await db.query("select public.backend_job_dispatch($1,$2,$3) data",[hash,portalId?'backend.jobs.portal.submit':'backend.jobs.submit',{kind:'search_ats',input:{profileId:profile,...(portalId?{portalId}:{})},eventKey:'single-job'}]);
 return {owner,profile,hash,job:q.rows[0].data};
}
async function rpc(name,args){try{return {data:(await db.query('select public.backend_worker($1,$2) data',[args.operation,args.payload])).rows[0].data,error:null};}catch(e){return {data:null,error:{code:e.code,message:e.message}};}}
function tasks(){
 const calls=[];
 const rows=[['100','Software Engineer New Grad','Remote','FT'],['101','Software Engineer Intern','Remote','Internship'],['102','Software Engineer New Grad','On-site','FT']].map(([id,title,location,employmentType])=>({company:'Example (fictional)',title,location,employmentType,url:'https://job-boards.greenhouse.io/example/jobs/'+id,listingIdentity:{ats_provider:'greenhouse',board_slug:'example',posting_id:id},description:'Fictional backend systems work.',postedAt:null}));
 return {calls,execute:async(task,input)=>{
  calls.push({task,input});
  if(task==='discovery')return input.target.id==='portal:unsupported'?{status:'unsupported',jobs:[]}:{status:'ok',provider:'greenhouse',available:3,truncated:false,jobs:rows};
  if(task==='verify-discovery-leads')return {jobs:rows.filter(row=>input.leads.some(lead=>lead.url===row.url)),diagnostics:rows.filter(row=>input.leads.some(lead=>lead.url===row.url)).map(r=>({url:r.url,status:'active',reason:'Fictional verifier fixture.'}))};
  return executeCareerTask(task,input);
 }};
}
async function result(id){return (await db.query('select status,result,search_run_id from private.backend_jobs where id=$1',[id])).rows[0];}

test('one real SQL-leased job persists verified observations, screenings and a copied-dedup shortlist',async()=>{
 const f=await fixture(),t=tasks();await workOnce(rpc,{execute:t.execute});
 const j=await result(f.job.id);assert.equal(j.status,'completed');assert.equal(j.result.pipelineVersion,2);
 assert.equal(j.result.shortlist.screenedCount,3);assert.equal(j.result.shortlist.excludedCount,2);assert.equal(j.result.shortlist.retainedListingIds.length,1);assert.equal(j.result.shortlist.reporting,'pending-muse');assert.equal(j.result.shortlist.applicantEligibility,'not-evaluated');
 assert(t.calls.some(c=>c.task==='prefilter-discovery'));assert(t.calls.some(c=>c.task==='filter-discovery'));
 assert.equal((await db.query("select count(*)::int count from private.shared_job_pool where facts->>'company'='Example (fictional)' ")).rows[0].count,3);
 assert.equal((await db.query('select count(*)::int n from public.search_screenings where user_id=$1',[f.owner])).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from public.job_batches where user_id=$1',[f.owner])).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from public.applications where user_id=$1',[f.owner])).rows[0].n,0);
});

test('partial sources still finish the same pipeline but never claim exhaustive coverage',async()=>{
 const f=await fixture({partial:true}),t=tasks();await workOnce(rpc,{execute:t.execute});const j=await result(f.job.id);
 assert.equal(j.status,'partial');assert.equal(j.result.shortlist.retainedListingIds.length,1);assert.match(j.result.summary,/incomplete coverage/);
});

test('retry after run completion rebuilds the saved shortlist without recollecting or duplicating screenings',async()=>{
 const f=await fixture(),claim=(await rpc('backend_worker',{operation:'claim',payload:{}})).data,t=tasks();
 assert.equal(claim.job.id,f.job.id);
 const fenced=async(operation,payload)=>{const r=await rpc('backend_worker',{operation:'dispatch',payload:{jobId:claim.job.id,leaseToken:claim.leaseToken,expectedVersion:claim.job.version,operation,payload}});if(r.error)throw r.error;return r.data;};
 const first=await executeSearch(claim.job,fenced,{execute:t.execute});
 await assert.rejects(()=>fenced('search.screenings.read',{request:{runId:randomUUID(),listingIds:[randomUUID()],eventKey:`job:${f.job.id}:forged`}}),e=>e.code==='42501');
 const before=(await db.query('select count(*)::int n from public.search_screenings where user_id=$1',[f.owner])).rows[0].n;
 t.calls.length=0;
 const retry=await executeSearch({...claim.job,search_run_id:first.result.runId},fenced,{execute:t.execute});
 assert.deepEqual(retry.result.shortlist,first.result.shortlist);assert.equal(t.calls.some(c=>c.task==='discovery'||c.task==='verify-discovery-leads'),false);
 assert.equal((await db.query('select count(*)::int n from public.search_screenings where user_id=$1',[f.owner])).rows[0].n,before);
 const finish=await rpc('backend_worker',{operation:'finish',payload:{jobId:claim.job.id,leaseToken:claim.leaseToken,expectedVersion:claim.job.version,...retry}});assert.equal(finish.error,null);
});

test('interrupted search retries collection with its original profile and portal snapshots',async()=>{
  const f=await fixture(),t=tasks(),claim=(await rpc('backend_worker',{operation:'claim',payload:{}})).data,controller=new AbortController();let edited=false,runId;
  const fenced=async(operation,payload)=>{const r=await rpc('backend_worker',{operation:'dispatch',payload:{jobId:claim.job.id,leaseToken:claim.leaseToken,expectedVersion:claim.job.version,operation,payload}});if(r.error)throw r.error;return r.data;};
  const originalContext=await fenced('search.context',{profileId:claim.job.input.profileId});
  const dispatch=async(operation,payload)=>{
   const data=await fenced(operation,payload);
   if(operation==='search.run.start')runId=data.id;
   if(operation==='search.progress'&&payload.state==='active'&&payload.counts.staged===0&&!edited){edited=true;await db.query("update public.search_documents set version=version+1,projection=jsonb_set(projection,'{filters,Employment}',to_jsonb('Internship'::text)) where user_id=$1 and kind='profile'",[f.owner]);await db.query('insert into private.agent_settings_versions(user_id,version) values($1,2) on conflict(user_id) do update set version=private.agent_settings_versions.version+1',[f.owner]);await db.query("update public.search_documents set version=version+1,projection=jsonb_set(projection,'{tracked_companies,0}',jsonb_build_object('id','example','name','Changed portal','careers_url','https://changed.example/careers','enabled',true)) where user_id=$1 and kind='portals'",[f.owner]);controller.abort(Error('Fixture worker interrupted'));}
   return data;
  };
  await assert.rejects(()=>executeSearch(claim.job,dispatch,{execute:t.execute,signal:controller.signal}),/Fixture worker interrupted/);
  const interrupted=await result(f.job.id);assert.equal(interrupted.search_run_id,runId);
  t.calls.length=0;
  const retry=await executeSearch({...claim.job,search_run_id:interrupted.search_run_id},dispatch,{execute:t.execute});
  const filters=t.calls.filter(c=>c.task==='filter-discovery');
  const discoveries=t.calls.filter(c=>c.task==='discovery');
  assert(filters.length>0);assert(filters.every(c=>c.input.profile.filters.Employment==='Full-time'));
  assert(discoveries.length>0);assert(discoveries.every(c=>c.input.target.name==='Example (fictional)'&&c.input.target.address==='https://job-boards.greenhouse.io/example'));
  assert.equal(retry.status,'completed');assert.equal(retry.result.shortlist.evaluatedProfileVersion,1);assert.equal(retry.result.shortlist.personalVersion,originalContext.personalVersion);assert.equal(retry.result.shortlist.retainedListingIds.length,1);
  const finish=await rpc('backend_worker',{operation:'finish',payload:{jobId:claim.job.id,leaseToken:claim.leaseToken,expectedVersion:claim.job.version,...retry}});
  assert.equal(finish.error,null);assert.equal((await result(f.job.id)).status,'completed');
 });

test('final SQL job receipt accepts a settings edit after the pinned run completes',async()=>{
 const f=await fixture(),claim=(await rpc('backend_worker',{operation:'claim',payload:{}})).data,t=tasks();
 const fenced=async(operation,payload)=>{const r=await rpc('backend_worker',{operation:'dispatch',payload:{jobId:claim.job.id,leaseToken:claim.leaseToken,expectedVersion:claim.job.version,operation,payload}});if(r.error)throw r.error;return r.data;};
 const outcome=await executeSearch(claim.job,fenced,{execute:t.execute});
 await db.query("update public.search_documents set version=version+1 where user_id=$1 and kind='profile'",[f.owner]);
 const r=await rpc('backend_worker',{operation:'finish',payload:{jobId:claim.job.id,leaseToken:claim.leaseToken,expectedVersion:claim.job.version,...outcome}});
  assert.equal(r.error,null);assert.equal((await result(f.job.id)).status,'completed');
 });

test('final SQL job receipt rejects shortlist versions that do not match its run snapshot',async()=>{
 const f=await fixture(),claim=(await rpc('backend_worker',{operation:'claim',payload:{}})).data,t=tasks();
 const fenced=async(operation,payload)=>{const r=await rpc('backend_worker',{operation:'dispatch',payload:{jobId:claim.job.id,leaseToken:claim.leaseToken,expectedVersion:claim.job.version,operation,payload}});if(r.error)throw r.error;return r.data;};
 const outcome=await executeSearch(claim.job,fenced,{execute:t.execute});
 outcome.result.shortlist.personalVersion++;
 const r=await rpc('backend_worker',{operation:'finish',payload:{jobId:claim.job.id,leaseToken:claim.leaseToken,expectedVersion:claim.job.version,...outcome}});
 assert.equal(r.error.code,'PT409');assert.equal((await result(f.job.id)).status,'running');
});

test('profile-only accounts start leased searches with built-in connected sources and matching context',async()=>{
 const f=await fixture();
 await db.query("delete from public.search_documents where user_id=$1 and kind='portals'",[f.owner]);
 const claim=(await rpc('backend_worker',{operation:'claim',payload:{}})).data;
 assert.equal(claim.job.id,f.job.id);
 const dispatch=async(operation,payload)=>{
  const r=await rpc('backend_worker',{operation:'dispatch',payload:{jobId:f.job.id,leaseToken:claim.leaseToken,expectedVersion:claim.job.version,operation,payload}});
  assert.equal(r.error,null);return r.data;
 };
 const context=await dispatch('search.context',{profileId:f.profile});
 const portals=context.documents.find(d=>d.kind==='portals');
 const {sourceTemplates}=await import('../lib/search/documents.mjs');
 assert.deepEqual(portals.projection.tracked_companies,sourceTemplates);
 assert.equal(portals.builtin,true);
 const run=await dispatch('search.run.start',{profileId:f.profile,eventKey:`job:${f.job.id}:start`});
 assert.deepEqual(run.sources.map(s=>s.source).sort((a,b)=>a.id.localeCompare(b.id)),sourceTemplates.filter(s=>s.enabled).sort((a,b)=>a.id.localeCompare(b.id)));
 assert.equal(run.contextChanged,false);
 assert.equal((await db.query("select count(*)::int n from public.search_documents where user_id=$1 and kind='portals'",[f.owner])).rows[0].n,0);
 await rpc('backend_worker',{operation:'finish',payload:{jobId:f.job.id,leaseToken:claim.leaseToken,expectedVersion:claim.job.version,status:'failed',result:{summary:'Fictional test cleanup'}}});
});

test('demo profile-only context shows default sources without execution and preserves overrides',async()=>{
 const {searchDemo,synchronizeSearchDemo}=await import('../lib/search/demo.mjs');
 const {sourceTemplates}=await import('../lib/search/documents.mjs');
 const data=searchDemo();data.documents=data.documents.filter(d=>d.kind!=='portals');
 const d=synchronizeSearchDemo(data);
 assert.deepEqual(d.documents.find(d=>d.kind==='portals').projection.tracked_companies,sourceTemplates);
 const override=synchronizeSearchDemo(d,{targets:[]});
 assert.deepEqual(override.documents.find(d=>d.kind==='portals').projection.tracked_companies,[]);
});

test('profile-scoped Career Ops settings persist through authorized SQL writes and fence collection before missing targeting',async()=>{
 const {profileDocument,parseDocument}=await import('../lib/search/documents.mjs');
 const f=await fixture(),t=tasks(),hash=f.owner.replaceAll('-','').repeat(2);
 const instructions='## Role preferences\n- Roles: Software Engineer\n## Career Ops discovery filters\n```json\n'+JSON.stringify({title_filter:{positive:['Software Engineer'],negative:['word:Intern']},skip_tiers:['senior']})+'\n```';
 const content=parseDocument('profile',profileDocument({id:f.profile,name:'Fictional systems',active:true,filters:{Employment:'Full-time','Work arrangement':'Remote required'},priorities:{},instructions})).content;
 const saved=(await db.query("select public.agent_dispatch($1,'search.document.save',$2) data",[hash,{kind:'profile',id:f.profile,expectedVersion:1,content,eventKey:'configure-owned-filters'}])).rows[0].data;
 assert.equal(saved.version,2);
 await workOnce(rpc,{execute:t.execute});const j=await result(f.job.id);
 assert.equal(j.status,'completed');assert.equal(j.result.shortlist.evaluatedProfileVersion,2);assert.equal(j.result.filterPlan.config.skip_tiers[0],'senior');assert.equal(j.result.shortlist.retainedListingIds.length,1);
 assert.deepEqual((await db.query("select projection->>'instructions' instructions from public.search_documents where user_id=$1 and kind='profile' and id=$2",[f.owner,f.profile])).rows[0].instructions,instructions);
 const missing=await fixture(),m=tasks();
 await db.query("update public.search_documents set projection=jsonb_set(projection,'{instructions}',to_jsonb($2::text)) where user_id=$1 and kind='profile'",[missing.owner,'## Role preferences\n- Roles: Software Engineer']);
 await workOnce(rpc,{execute:m.execute});const failed=await result(missing.job.id);assert.equal(failed.status,'failed');assert.equal(failed.search_run_id,null);assert.equal(failed.result.code,'search_filters_not_ready');assert.match(failed.result.filterPlan.gaps[0],/title keywords/);assert.equal(failed.result.recovery.tool,'read_search_filter_plan');assert.equal(failed.result.evaluatedProfileVersion,1);assert.equal(m.calls.some(c=>c.task==='discovery'),false);
});


test('concurrent source collection preserves every distinct listing through fenced SQL writes',async()=>{
 const f=await fixture({extraSources:11});let active=0,peak=0;const verified=[];
 const execute=async(task,input)=>{
  if(task==='discovery'){
   active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,2));active--;
   const id=input.target.id.replace('portal:','');
   return {status:'ok',available:1,truncated:false,jobs:[{url:`https://job-boards.greenhouse.io/example/jobs/${id}`} ]};
  }
  if(task==='verify-discovery-leads'){
   verified.push(...input.leads.map(r=>r.url));
   return {jobs:input.leads.map(({url})=>({url,company:'Example (fictional)',title:'Software Engineer New Grad',location:'Remote',employmentType:'FT',description:'Fictional role.',postedAt:null,listingIdentity:{ats_provider:'greenhouse',board_slug:'example',posting_id:url.split('/').at(-1)}})),diagnostics:input.leads.map(({url})=>({url,status:'active',extraction:'parsed'}))};
  }
  return executeCareerTask(task,input);
 };
 await workOnce(rpc,{execute});const j=await result(f.job.id);
 assert.equal(j.status,'completed');assert(peak>1&&peak<=10);assert.equal(verified.length,12);
 assert.equal(j.result.shortlist.screenedCount,12);assert.equal(j.result.shortlist.retainedListingIds.length,12);
 assert.equal(new Set(j.result.shortlist.retainedListingIds).size,12);
});


test('HiringCafe, Simplify and Career Ops share verification and dedup before protected database persistence',async()=>{
 const f=await fixture();
 const sources=[{id:'cafe',name:'HiringCafe (fictional transport)',careers_url:'https://hiringcafe.com/',enabled:true},{id:'simplify',name:'Simplify (fictional transport)',careers_url:'https://github.com/SimplifyJobs/New-Grad-Positions',enabled:true},{id:'employer',name:'Example (fictional)',careers_url:'https://job-boards.greenhouse.io/example',enabled:true}];
 await db.query("update public.search_documents set projection=$2 where user_id=$1 and kind='portals'",[f.owner,{tracked_companies:sources,search_queries:[]}]);
 const base='https://job-boards.greenhouse.io/example/jobs/';const checked=[],saved=[];
 const execute=async(task,input)=>{
  if(task==='discovery'){assert.equal(input.collectOnly,true);return {status:'ok',available:2,truncated:false,jobs:['100','300'].map(id=>({url:base+id,title:'Software Engineer New Grad',company:'Example (fictional)',location:'Remote'}))};}
  if(task==='verify-discovery-leads')return verifyDiscoveryLeads(input.leads,{source:input.source,
   check:async leads=>leads.map(({url})=>{checked.push(url);const id=url.split('/').at(-1);return {url,result:id==='200'?'expired':id==='400'?'uncertain':'active',code:'fixture',reason:'Fictional employer response',checkedAt:new Date().toISOString(),method:'ats-api'};}),
   fetchJson:async url=>{const id=Number(url.match(/jobs\/(\d+)/)[1]);return {id,title:'Software Engineer New Grad',absolute_url:base+id,company_name:'Example (fictional)',location:{name:'Remote'},content:'<p>Fictional full-time backend infrastructure role.</p>'};},
  });
  return executeCareerTask(task,input);
 };
 const request=async(url,init={})=>{
  if(String(url).startsWith('https://raw.githubusercontent.com/'))return new Response(JSON.stringify(['100','200','400'].map(id=>({id,active:true,url:base+id,title:'Software Engineer New Grad',company_name:'Example (fictional)',locations:['Remote']}))));
  const call=JSON.parse(init.body);assert.equal(call.params.name,'refine_hiringcafe_job_results');
  return new Response(JSON.stringify({result:{structuredContent:{jobs:['100','200'].map(id=>({id,title:'Software Engineer New Grad',company:'Example (fictional)',applyUrl:base+id})),total_matches:2}}}));
 };
 const claim=(await rpc('backend_worker',{operation:'claim',payload:{}})).data;
 const dispatch=async(operation,payload)=>{
  if(operation==='search.discoveries.save')saved.push(...payload.listings);
  const r=await rpc('backend_worker',{operation:'dispatch',payload:{jobId:claim.job.id,leaseToken:claim.leaseToken,expectedVersion:claim.job.version,operation,payload}});
  if(r.error)throw r.error;return r.data;
 };
 const outcome=await executeSearch(claim.job,dispatch,{execute,request});
 assert.equal(outcome.status,'partial');assert(checked.includes(base+'200'));assert(checked.includes(base+'400'));
 assert(saved.every(row=>['100','300'].some(id=>row.url===base+id)));
 assert(outcome.result.shortlist.screenedCount>=2);assert.equal(outcome.result.shortlist.retainedListingIds.length,2);
 const persisted=await dispatch('search.discoveries.read',{runId:outcome.result.runId,offset:0,limit:100});
 assert.equal(persisted.listings.length,2);assert.deepEqual(new Set(persisted.listings.map(row=>row.canonical_url||row.url)),new Set([base+'100',base+'300']));
});


test('lease heartbeat extends only a live owned search without changing its fence',async()=>{
 const f=await fixture(),claim=(await rpc('backend_worker',{operation:'claim',payload:{}})).data;
 assert.equal(claim.job.id,f.job.id);
 const fence={jobId:claim.job.id,leaseToken:claim.leaseToken,expectedVersion:claim.job.version};
 await db.query("update private.backend_jobs set lease_expires_at=now()+interval '10 seconds' where id=$1",[claim.job.id]);
 const renewed=await rpc('backend_worker',{operation:'heartbeat',payload:fence});assert.equal(renewed.error,null);assert.equal(renewed.data.version,claim.job.version);
 const row=(await db.query("select lease_expires_at>now()+interval '4 minutes' as renewed,attempts from private.backend_jobs where id=$1",[claim.job.id])).rows[0];assert(row.renewed);assert.equal(row.attempts,1);
 assert.equal((await rpc('backend_worker',{operation:'heartbeat',payload:{...fence,leaseToken:randomUUID()}})).error.code,'PT409');
 assert.equal((await rpc('backend_worker',{operation:'heartbeat',payload:{...fence,expectedVersion:claim.job.version+1}})).error.code,'PT409');
 assert.equal((await rpc('backend_worker',{operation:'heartbeat',payload:{...fence,unexpected:true}})).error.code,'22023');
 await db.query("update private.backend_jobs set lease_expires_at=now()-interval '1 second' where id=$1",[claim.job.id]);
 assert.equal((await rpc('backend_worker',{operation:'heartbeat',payload:fence})).error.code,'PT409');
 const next=(await rpc('backend_worker',{operation:'claim',payload:{}})).data;assert.equal(next.job.id,claim.job.id);assert.equal(next.job.attempts,2);
 assert.equal((await rpc('backend_worker',{operation:'heartbeat',payload:fence})).error.code,'PT409');
 await db.query('update private.agent_connections set revoked_at=now() where user_id=$1',[f.owner]);
 assert.equal((await rpc('backend_worker',{operation:'heartbeat',payload:{jobId:next.job.id,leaseToken:next.leaseToken,expectedVersion:next.job.version}})).error.code,'42501');
 const permissions=(await db.query("select has_function_privilege('authenticated','public.backend_worker(text,jsonb)','execute') as exposed")).rows[0];assert.equal(permissions.exposed,false);
});
test('a saved verification batch stays temporary through interruption and the same run resumes without losing shortlisted jobs',async()=>{
 const f=await fixture(),claim=(await rpc('backend_worker',{operation:'claim',payload:{}})).data;
 const controller=new AbortController();let runId;let interrupted=false;
 const fence={jobId:claim.job.id,leaseToken:claim.leaseToken,expectedVersion:claim.job.version};
 const dispatch=async(operation,payload)=>{
  const r=await rpc('backend_worker',{operation:'dispatch',payload:{...fence,operation,payload}});if(r.error)throw r.error;
  if(operation==='search.run.start')runId=r.data.id;
  if(operation==='search.progress'&&payload.state==='active'&&payload.counts.staged===25&&!interrupted){interrupted=true;controller.abort(Error('Fixture worker interrupted'));}
  return r.data;
 };
 const rows=Array.from({length:61},(_,i)=>({company:'Example (fictional)',title:'Software Engineer New Grad',location:'Remote',employmentType:'FT',url:'https://job-boards.greenhouse.io/example/jobs/'+(1000+i),listingIdentity:{ats_provider:'greenhouse',board_slug:'example',posting_id:String(1000+i)},description:'Fictional backend systems role.',postedAt:null}));
 const batches=[];const execute=async(task,input)=>{
  if(task==='discovery')return {status:'ok',available:61,truncated:false,jobs:rows};
  if(task==='verify-discovery-leads'){batches.push(input.leads.length);return {jobs:input.leads.map(({url})=>rows.find(r=>r.url===url)),diagnostics:input.leads.map(({url})=>({url,status:'active',extraction:'parsed'}))};}
  return executeCareerTask(task,input);
 };
 await assert.rejects(executeSearch(claim.job,dispatch,{execute,signal:controller.signal}),/interrupted/);
 assert.equal((await db.query('select count(*)::int n from public.search_observations where run_id=$1',[runId])).rows[0].n,0);
 const source=(await db.query('select checkpoint,counts,state from public.search_source_attempts where run_id=$1',[runId])).rows[0];assert.equal(source.state,'active');assert.equal(source.counts.staged,25);
 const outcome=await executeSearch({...claim.job,search_run_id:runId},dispatch,{execute});
 assert.equal(outcome.result.runId,runId);assert.equal(outcome.status,'completed');assert.deepEqual(batches,[25,25,11]);
 assert.equal((await db.query('select count(*)::int n from public.search_observations where run_id=$1',[runId])).rows[0].n,61);
 assert.equal(outcome.result.shortlist.screenedCount,61);
});

test('a second direct search saves no unchanged jobs; a changed description updates the existing job',async()=>{
 const f=await fixture(),t=tasks();await workOnce(rpc,{execute:t.execute});
 const first=await result(f.job.id);assert.equal(first.result.shortlist.totalRetained,1);
 const hash=f.owner.replaceAll('-','').repeat(2);
 const queue=async key=>(await db.query("select public.backend_job_dispatch($1,'backend.jobs.submit',$2) data",[hash,{kind:'search_ats',input:{profileId:f.profile},eventKey:key}])).rows[0].data;
 const second=await queue('second-identical');await workOnce(rpc,{execute:t.execute});
 const repeated=await result(second.id);assert.equal(repeated.result.shortlist.totalRetained,0);assert.equal(repeated.result.saved,0);
 assert.equal((await db.query('select count(*)::int n from public.search_listings where user_id=$1',[f.owner])).rows[0].n,1);
 const third=await queue('third-changed-description');
 await workOnce(rpc,{execute:async(task,input,options)=>{const output=await t.execute(task,input,options);if(task==='verify-discovery-leads')for(const row of output.jobs){row.description+=' Changed scope.';row.title='Software Engineer New Grad - Databases';}return output;}});
 assert.equal((await result(third.id)).result.shortlist.totalRetained,1);
 assert.equal((await db.query('select title from public.search_listings where user_id=$1',[f.owner])).rows[0].title,'Software Engineer New Grad - Databases');
 assert.equal((await db.query('select count(*)::int n from public.search_listings where user_id=$1',[f.owner])).rows[0].n,1);
});

test('collection and rejected jobs remain outside permanent storage until the shortlist is ready',async()=>{
 const f=await fixture({extraSources:11}),t=tasks();let collected=0;let firstSaveAt;
 const claim=(await rpc('backend_worker',{operation:'claim',payload:{}})).data;
 const dispatch=async(operation,payload)=>{
  if(operation==='search.progress'&&payload.checkpoint.stage!=='shortlist-ready'){
   assert.equal((await db.query('select count(*)::int n from public.search_observations where user_id=$1',[f.owner])).rows[0].n,0);
  }
  if(operation==='search.discoveries.save')firstSaveAt??=collected;
  const r=await rpc('backend_worker',{operation:'dispatch',payload:{jobId:claim.job.id,leaseToken:claim.leaseToken,expectedVersion:claim.job.version,operation,payload}});if(r.error)throw r.error;return r.data;
 };
 const outcome=await executeSearch(claim.job,dispatch,{execute:async(task,input,options)=>{if(task==='discovery')collected++;return t.execute(task,input,options);}});
 assert.equal(firstSaveAt,12);assert.equal(outcome.result.shortlist.totalRetained,1);
 const rows=(await db.query('select title from public.search_listings where user_id=$1',[f.owner])).rows;
 assert.deepEqual(rows.map(row=>row.title),['Software Engineer New Grad']);
});

for(const status of ['Submitted','Rejected'])test(`direct search excludes a tracked ${status} job and preserves its application`,async()=>{
 const f=await fixture(),t=tasks(),id='protected-'+f.owner;
 await db.query("insert into public.jobs(id,canonical_url,employer) values($1,'https://job-boards.greenhouse.io/example/jobs/100','{}') on conflict(canonical_url) do nothing",[id]);
 const canonical=(await db.query("select id from public.jobs where canonical_url='https://job-boards.greenhouse.io/example/jobs/100'")).rows[0].id;
 await db.query("insert into public.applications(user_id,job_id,status) values($1,$2,'Queued')",[f.owner,canonical]);
 await db.query("update public.applications set status=$2,submitted_at=case when $2='Submitted' then now() else null end where user_id=$1",[f.owner,status]);
 const before=(await db.query('select to_jsonb(a) data from public.applications a where user_id=$1',[f.owner])).rows;
 await workOnce(rpc,{execute:t.execute});
 assert.equal((await result(f.job.id)).result.shortlist.totalRetained,0);
 assert.deepEqual((await db.query('select to_jsonb(a) data from public.applications a where user_id=$1',[f.owner])).rows,before);
 assert(!t.calls.filter(c=>c.task==='verify-discovery-leads').flatMap(c=>c.input.leads).some(lead=>lead.url.endsWith('/100')));
});

test('a completed direct shortlist reaches private Discover only through agent-reviewed publication, with replay and website parity',async()=>{
 const {batchRoles}=await import('../lib/cloud-model.mjs');
 const {readGuide}=await import('../supabase/functions/agent-gateway/guides.mjs');
  const guide=readGuide('career-find-jobs');assert.equal(guide.version,24);assert.match(guide.instructions,/never publish the raw or merely filter-passed shortlist/);assert.match(guide.instructions,/Complete the private Discover handoff/);
 const f=await fixture(),t=tasks();await workOnce(rpc,{execute:t.execute});const j=await result(f.job.id);
 assert.equal((await db.query('select count(*)::int n from public.job_batches where user_id=$1',[f.owner])).rows[0].n,0);
 const hash=f.owner.replaceAll('-','').repeat(2);
 await db.query("update private.agent_connections set scopes=array_append(scopes,'batches:write') where user_id=$1",[f.owner]);
 const listings=(await db.query("select private.search_owned($1,'search.discoveries.read',$2) as p",[f.owner,{runId:j.search_run_id,offset:0,limit:100}])).rows[0].p.listings;
 assert.equal(listings.length,1);const l=listings[0];
 // Fictional agent output, supplied only after the worker has finished. No model
 // execution, candidate facts or publication is inferred from screening alone.
 const recommendation={searchRunId:j.search_run_id,searchListingId:l.id,searchProfileId:f.profile,evaluatedProfileVersion:1,jobFacts:{sourceUrl:l.canonical_url,checkedAt:'2026-11-07T12:00:00Z',workSetting:'Remote',sponsorship:'Not disclosed',compensation:'$6,000–$8,000/month'},whyItFits:'Your fictional backend project connects to the verified backend systems work.',materialGap:'An internship pay benchmark is not available in this fictional scenario.',matchAssessment:{assessedAt:'2026-11-07T12:00:00Z',skillsExperience:{score:80,reasoning:'Fictional backend project matches the posted systems work.'},compensation:{score:null,reasoning:'Monthly pay is disclosed; a comparable internship benchmark and personal threshold remain unknown.'},wellbeingCulture:{score:null,reasoning:'Team working practices are unknown in this fictional scenario.'},locationWorkSetting:{score:95,reasoning:'Verified remote work matches the fictional required remote preference.'}}};
 const payload={eventKey:`discover:${j.search_run_id}:profile:1:part:0`,label:'Fictional reviewed shortlist',jobs:[{canonicalUrl:l.canonical_url,employer:{company:l.company,title:l.title,location:l.location,employmentType:'FT',description:l.observation.description},recommendation}]};
 const publish=async()=> (await db.query("select public.agent_dispatch($1,'batches.publish',$2) as p",[hash,payload])).rows[0].p;
 const saved=await publish(),again=await publish();assert.equal(saved.batch.id,again.batch.id);
 const read=(await db.query("select public.agent_dispatch($1,'batches.read',$2) as p",[hash,{batchId:saved.batch.id}])).rows[0].p;
 assert.equal(read.items.length,1);assert.equal(read.items[0].recommendation.searchListingId,l.id);
 const websiteItems=(await db.query('select to_jsonb(i)||jsonb_build_object(\'jobs\',to_jsonb(j)) as item from public.batch_items i join public.jobs j on j.id=i.job_id where i.user_id=$1 and i.batch_id=$2 order by i.position',[f.owner,saved.batch.id])).rows.map(r=>r.item);
 const roles=batchRoles(websiteItems,read.batch.batch_date);assert.equal(roles.length,1);assert.equal(roles[0].matchAssessment.skillsExperience.score,80);assert.equal(roles[0].matchAssessment.compensation.score,null);assert.equal(roles[0].applicationUrl,l.canonical_url);assert.equal(roles[0].compensation,'$6,000–$8,000/month');assert.equal(read.items[0].job.employer.compensation,undefined);
 assert.equal((await db.query('select job_id from public.search_listings where id=$1',[l.id])).rows[0].job_id,read.items[0].job_id);
 assert.equal((await db.query('select count(*)::int n from public.job_batches where user_id=$1',[f.owner])).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from public.applications where user_id=$1',[f.owner])).rows[0].n,0);
 assert(!Object.hasOwn(read.items[0].job.employer,'matchAssessment'));
});

test('a leased Jobright run retains every raw lead after completion and exposes only its owned temporary pool',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const path=await import('node:path');
 const {readSearchSourceLeads}=await import('../backend/runtime/search-intake.ts');
 const root=await mkdtemp(path.join(tmpdir(),'jobright-pool-test-')),f=await fixture();
 const address='https://github.com/jobright-ai/2026-Software-Engineer-New-Grad';
 const portals={tracked_companies:[{id:'jobright-newgrad',name:'Jobright fixture',careers_url:address,enabled:true}],search_queries:[]};
 const projection={active:true,filters:{Employment:'Full-time',Location:'United States'},instructions:'## Priority & flexibility\n- Location: Required\n\n## Career Ops discovery filters\n\n```json\n{"title_filter":{"positive":["Software Engineer"],"negative":["word:Senior"]},"skip_tiers":["senior"],"max_posting_age_days":7}\n```'};
 await db.query("update public.search_documents set projection=$2 where user_id=$1 and kind='profile'",[f.owner,projection]);await db.query("update public.search_documents set projection=$2 where user_id=$1 and kind='portals'",[f.owner,portals]);
 const savedFetch=globalThis.fetch,id=n=>String(n).padStart(24,'0');
 globalThis.fetch=async url=>{
  const s=String(url);if(s.includes('raw.githubusercontent'))return new Response([['Software Development Engineer',1],['Software Engineer',2],['Senior Software Engineer',3]].map(([title,n])=>`| [Fictional](https://example.test) | [${title}](https://jobright.ai/jobs/info/${id(n)}) | Hawthorne, CA | Hybrid | Nov 07 |`).join('\n'));
  const n=Number(new URL(s).pathname.split('/').at(-1));return new Response(`<script id="__NEXT_DATA__">${JSON.stringify({props:{pageProps:{dataSource:{jobResult:{jobId:id(n),applyLink:n===1?'https://job-boards.greenhouse.io/example/jobs/100':null}}}}})}</script>`);
 };
 try{
  const execute=async(task,input)=>task==='verify-discovery-leads'?{jobs:input.leads.map(({url})=>({url,title:'Software Development Engineer',company:'Fictional',location:'Hawthorne, CA',employmentType:'FT',description:'Fictional systems engineering.',postedAt:null,listingIdentity:{ats_provider:'greenhouse',board_slug:'example',posting_id:'100'}})),diagnostics:input.leads.map(({url})=>({url,status:'active',extraction:'parsed'}))}:executeCareerTask(task,input);
  await workOnce(rpc,{execute,stagingRoot:root});const j=await result(f.job.id);
  assert.equal(j.status,'partial');assert.equal(j.result.retainedLeads,3);assert.equal(j.result.pendingLeadResolution,1);assert.equal(j.result.saved,1,JSON.stringify(j.result));
  const call=async(operation,payload)=>{try{return {data:(await db.query(operation==='backend.jobs.read'?'select public.backend_job_dispatch($1,$2,$3) data':'select public.agent_dispatch($1,$2,$3) data',[f.owner.replaceAll('-','').repeat(2),operation,payload])).rows[0].data,error:null};}catch(e){return {error:{code:e.code,message:e.message}};}};
  const page=await readSearchSourceLeads(call,{runId:j.search_run_id,sourceId:'portal:jobright-newgrad',offset:0,limit:2},{stagingRoot:root});assert.equal(page.error,null);assert.equal(page.data.total,3);assert.equal(page.data.nextOffset,2);assert.equal(page.data.verified,false);
  const focused=await readSearchSourceLeads(call,{runId:j.search_run_id,sourceId:'portal:jobright-newgrad',resolution:'unresolved',limit:100},{stagingRoot:root});assert.equal(focused.data.sourceTotal,3);assert.equal(focused.data.total,1);assert.equal(focused.data.leads[0].resolution,'unresolved');assert(focused.data.leads[0].researchQuery);
  const last=await readSearchSourceLeads(call,{runId:j.search_run_id,sourceId:'portal:jobright-newgrad',offset:2,limit:2},{stagingRoot:root});assert.equal(last.data.leads[0].triageStatus,'filtered-title');assert.equal(last.data.nextOffset,null);
  const {createDispatch,credentialHash}=await import('../backend/runtime/service.ts');const token='jb_agent_'+f.owner.replaceAll('-','').repeat(2),hash=credentialHash(token);
  await db.query('update private.agent_connections set token_hash=$2 where user_id=$1',[f.owner,hash]);
  const previousRoot=process.env.LOOKOUT_SEARCH_STAGING_DIR;process.env.LOOKOUT_SEARCH_STAGING_DIR=root;
  try{
   const dispatch=createDispatch({supabaseUrl:'https://example.supabase.co',rpc:async(name,args)=>{try{return {data:(await db.query(`select public.${name}($1,$2,$3) data`,[args.credential_hash,args.operation,args.payload])).rows[0].data,error:null};}catch(e){return {data:null,error:{code:e.code,message:e.message}};}}});
   const {createHandler}=await import('../supabase/functions/agent-mcp/protocol.mjs');const handler=createHandler(dispatch);
   const response=await handler(new Request('http://local/mcp',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'read_search_source_leads',arguments:{runId:j.search_run_id,sourceId:'portal:jobright-newgrad',limit:100}}})}));
   const body=await response.json();assert(!body.result?.isError,JSON.stringify(body));const data=body.result.structuredContent||JSON.parse(body.result.content[0].text);assert.equal(data.total,3);assert.equal(data.leads.length,3);
  }finally{if(previousRoot===undefined)delete process.env.LOOKOUT_SEARCH_STAGING_DIR;else process.env.LOOKOUT_SEARCH_STAGING_DIR=previousRoot;}
  const denied=await readSearchSourceLeads(async()=>({error:{code:'42501'}}),{runId:j.search_run_id,sourceId:'portal:jobright-newgrad'},{stagingRoot:root});assert.equal(denied.error.code,'42501');
  assert.equal((await db.query('select count(distinct listing_id)::int n from public.search_observations where run_id=$1',[j.search_run_id])).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from public.applications where user_id=$1',[f.owner])).rows[0].n,0);
 }finally{globalThis.fetch=savedFetch;await rm(root,{recursive:true,force:true});}
});


test('single portal SQL-leased job scans only its selected source, omits queries, and retries the same shortlist',async()=>{
 const f=await fixture({extraSources:2,portalId:'example-1',queries:['software engineer']}),t=tasks();
 const claim=(await rpc('backend_worker',{operation:'claim',payload:{}})).data;
 const dispatch=async(operation,payload)=>{const x=await rpc('backend_worker',{operation:'dispatch',payload:{jobId:f.job.id,leaseToken:claim.leaseToken,expectedVersion:claim.job.version,operation,payload}});if(x.error)throw x.error;return x.data;};
 await assert.rejects(()=>dispatch('search.run.start',{profileId:f.profile,eventKey:`job:${f.job.id}:start`}),e=>e.code==='42501');
 await assert.rejects(()=>dispatch('search.run.start',{profileId:f.profile,portalId:'example',eventKey:`job:${f.job.id}:start`}),e=>e.code==='42501');
 const first=await executeSearch(claim.job,dispatch,{execute:t.execute});
 assert.equal(first.status,'completed');assert.deepEqual(first.result.scope,{kind:'portal',portalId:'example-1'});
 const run=await dispatch('search.run.read',{runId:first.result.runId});
 assert.deepEqual(run.sources.map(s=>s.source_id),['portal:example-1']);
 assert.deepEqual(t.calls.filter(c=>c.task==='discovery').map(c=>c.input.target.id),['portal:example-1']);
 assert.equal(first.result.shortlist.totalRetained,1);assert.equal(first.result.shortlist.excludedCount,2);
 t.calls.length=0;
 const again=await executeSearch({...claim.job,search_run_id:run.id},dispatch,{execute:t.execute});
 assert.deepEqual(again.result.shortlist,first.result.shortlist);assert(!t.calls.some(c=>c.task==='discovery'));
 assert.equal((await db.query('select count(*)::int n from public.applications where user_id=$1',[f.owner])).rows[0].n,0);
 const done=await rpc('backend_worker',{operation:'finish',payload:{jobId:f.job.id,leaseToken:claim.leaseToken,expectedVersion:claim.job.version,...again}});assert.equal(done.error,null);
 const request={kind:'search_ats',input:{profileId:f.profile,portalId:'example-1'},eventKey:'single-job'};
 assert.equal((await db.query("select public.backend_job_dispatch($1,'backend.jobs.submit',$2) data",[f.hash,request])).rows[0].data.id,f.job.id);
 await assert.rejects(()=>db.query("select public.backend_job_dispatch($1,'backend.jobs.submit',$2)",[f.hash,{...request,input:{profileId:f.profile,portalId:'example'}}]),/Event key payload changed/);
});

test('portal selection validates owner configuration, disabled sources, input shape and built-in defaults',async()=>{
 const f=await fixture(),other=await fixture({extraSources:1});
 const queue=portalId=>db.query("select public.backend_job_dispatch($1,'backend.jobs.submit',$2) data",[f.hash,{kind:'search_ats',input:{profileId:f.profile,portalId},eventKey:'portal-validation-'+String(portalId)}]);
 for(const id of ['missing','example-1','https://arbitrary.test',null,17,''])await assert.rejects(()=>queue(id),/portal/i);
 await db.query("update public.search_documents set projection=jsonb_set(projection,'{tracked_companies,0,enabled}','false') where user_id=$1 and kind='portals'",[f.owner]);
 await assert.rejects(()=>queue('example'),/Enabled owned portal/);
 await db.query("delete from public.search_documents where user_id=$1 and kind='portals'",[f.owner]);
 const builtin=await queue('careerops-b964b9ab5d89caef');assert.equal(builtin.rows[0].data.input.portalId,'careerops-b964b9ab5d89caef');
 // Agent-executed single-source runs share the same source resolver and omit queries.
 const run=(await db.query("select public.agent_dispatch($1,'search.run.start',$2) data",[f.hash,{profileId:f.profile,portalId:'careerops-b964b9ab5d89caef',eventKey:'manual-portal'}])).rows[0].data;
 assert.deepEqual(run.sources.map(s=>s.source.name),['ByteDance']);
 assert.equal((await db.query("select count(*)::int n from public.search_documents where user_id=$1 and kind='portals'",[f.owner])).rows[0].n,0);
 await db.query("update private.backend_jobs set status='cancelled' where user_id=any($1::uuid[])",[[f.owner,other.owner]]);
});


test('single-portal leased search saves a valid long employer location unchanged in the database',async()=>{
 const f=await fixture({portalId:'example'}),t=tasks(),location='Remote, United States; '.repeat(26);
 assert(location.length>500&&location.length<=2000);
 await workOnce(rpc,{execute:async(task,input)=>{
  const result=await t.execute(task,input);
  if(task==='verify-discovery-leads')return {...result,jobs:result.jobs.map(row=>row.url.endsWith('/100')?{...row,location}:row)};
  return result;
 }});
 const j=await result(f.job.id);assert.equal(j.status,'completed');assert.equal(j.result.shortlist.totalRetained,1);
 assert.equal((await db.query('select location from public.search_listings where user_id=$1',[f.owner])).rows[0].location,location);
 assert.equal((await db.query('select count(*)::int n from public.applications where user_id=$1',[f.owner])).rows[0].n,0);
});


for(const status of ['APPLIED','REJECTED'])test(`single-source search excludes an imported ${status} posting and preserves its original record`,async()=>{
 const f=await fixture({portalId:'example'}),t=tasks(),record={company:'Example (fictional)',title:'Software Engineer New Grad',location:'Remote',employmentType:'FT',url:'https://job-boards.greenhouse.io/example/jobs/100',status,appliedDate:null};
 await db.query('insert into public.imported_jobs(user_id,identity_key,record,source_rows) values($1,$2,$3,$4)',[f.owner,'url:'+record.url,record,[record]]);
 const before=(await db.query('select to_jsonb(i) data from public.imported_jobs i where user_id=$1',[f.owner])).rows;
 await workOnce(rpc,{execute:t.execute});assert.equal((await result(f.job.id)).result.shortlist.totalRetained,0);
 assert.deepEqual((await db.query('select to_jsonb(i) data from public.imported_jobs i where user_id=$1',[f.owner])).rows,before);
 assert(!t.calls.filter(c=>c.task==='verify-discovery-leads').flatMap(c=>c.input.leads).some(lead=>lead.url.endsWith('/100')));
});

test('an import recorded during collection is rechecked before the final shortlist write',async()=>{
 const f=await fixture({portalId:'example'}),t=tasks();let imported=false;
 await workOnce(rpc,{execute:async(task,input)=>{
  const value=await t.execute(task,input);
  if(task==='filter-discovery'&&!imported){imported=true;const record={company:'Example (fictional)',title:'Software Engineer New Grad',location:'Remote',url:'https://job-boards.greenhouse.io/example/jobs/100',status:'REJECTED'};await db.query('insert into public.imported_jobs(user_id,identity_key,record,source_rows) values($1,$2,$3,$4)',[f.owner,'late-import',record,[record]]);}
  return value;
 }});
 assert(imported);assert.equal((await result(f.job.id)).result.shortlist.totalRetained,0);
 assert.equal((await db.query('select count(*)::int n from public.search_listings where user_id=$1',[f.owner])).rows[0].n,0);
});


test('an unchanged SmartRecruiters posting is not saved again when its public URL form changes',async()=>{
 const f=await fixture({portalId:'example'}),t=tasks();let short=false;
 const execute=async(task,input)=>{
  const value=await t.execute(task,input);
  if(task==='verify-discovery-leads')return {...value,jobs:value.jobs.map(row=>row.url.endsWith('/100')?{...row,url:'https://jobs.smartrecruiters.com/Example/744000159509479'+(short?'':'-software-engineer?oga=true'),listingIdentity:{ats_provider:'smartrecruiters',board_slug:'Example',posting_id:'744000159509479'}}:row)};
  return value;
 };
 await workOnce(rpc,{execute});assert.equal((await result(f.job.id)).result.shortlist.totalRetained,1);
 short=true;
 const second=(await db.query('select public.backend_job_dispatch($1,$2,$3) data',[f.hash,'backend.jobs.portal.submit',{kind:'search_ats',input:{profileId:f.profile,portalId:'example'},eventKey:'smartrecruiters-url-alias'}])).rows[0].data;
 await workOnce(rpc,{execute});assert.equal((await result(second.id)).result.shortlist.totalRetained,0);
 assert.equal((await db.query('select count(*)::int n from public.search_observations where user_id=$1',[f.owner])).rows[0].n,1);
});
