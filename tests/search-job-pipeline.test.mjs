import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createTestDatabase} from './helpers/database.mjs';
import {workOnce,executeSearch} from '../backend/runtime/worker.ts';
import {verifyDiscoveryLeads} from '../runner/career-search-intake.mjs';
import {executeCareerTask} from '../runner/career-tools.mjs';
let db;before(async()=>{db=await createTestDatabase();});after(async()=>{await db?.close();});
async function fixture({partial=false,extraSources=0}={}){
 const owner=randomUUID(),profile='profile_'+owner.replaceAll('-','');
 await db.query('insert into auth.users values($1)',[owner]);
 await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Fictional pipeline',$2,array['workspace:read','preferences:write','drafts:write'],now()+interval '1 day')",[owner,owner.replaceAll('-','').repeat(2)]);
 const hash=owner.replaceAll('-','').repeat(2);
 const projection={active:true,filters:{Employment:'Full-time','Work arrangement':'Remote required'},instructions:''};
 const portals={tracked_companies:[{id:'example',name:'Example (fictional)',careers_url:'https://job-boards.greenhouse.io/example',enabled:true},...(partial?[{id:'unsupported',name:'Unsupported fictional source',careers_url:'https://unsupported.test/careers',enabled:true}]:[])],search_queries:[]};
 for(let i=1;i<=extraSources;i++)portals.tracked_companies.push({id:'example-'+i,name:`Example ${i} (fictional)`,careers_url:`https://job-boards.greenhouse.io/example${i}`,enabled:true});
 await db.query("insert into public.search_documents(user_id,kind,id,version,content,projection) values($1,'profile',$2,1,'{}',$3),($1,'portals','shared',1,'{}',$4)",[owner,profile,projection,portals]);
 const q=await db.query("select public.backend_job_dispatch($1,'backend.jobs.submit',$2) data",[hash,{kind:'search_ats',input:{profileId:profile},eventKey:'single-job'}]);
 return {owner,profile,job:q.rows[0].data};
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

test('changed settings block success instead of publishing a mixed-version shortlist',async()=>{
 const f=await fixture(),t=tasks();let contexts=0;
 const raced=async(name,args)=>{
  if(args.operation==='dispatch'&&args.payload.operation==='search.context'&&++contexts===3)await db.query("update public.search_documents set version=version+1 where user_id=$1 and kind='profile'",[f.owner]);
  return rpc(name,args);
 };
 await workOnce(raced,{execute:t.execute});const j=await result(f.job.id);assert.equal(j.status,'failed');assert.equal(j.result.shortlist,undefined);
});

test('final SQL job receipt rejects a settings change after the last JS version read',async()=>{
 const f=await fixture(),claim=(await rpc('backend_worker',{operation:'claim',payload:{}})).data,t=tasks();
 const fenced=async(operation,payload)=>{const r=await rpc('backend_worker',{operation:'dispatch',payload:{jobId:claim.job.id,leaseToken:claim.leaseToken,expectedVersion:claim.job.version,operation,payload}});if(r.error)throw r.error;return r.data;};
 const outcome=await executeSearch(claim.job,fenced,{execute:t.execute});
 await db.query("update public.search_documents set version=version+1 where user_id=$1 and kind='profile'",[f.owner]);
 const r=await rpc('backend_worker',{operation:'finish',payload:{jobId:claim.job.id,leaseToken:claim.leaseToken,expectedVersion:claim.job.version,...outcome}});
 assert.equal(r.error.code,'PT409');assert.equal((await result(f.job.id)).result.shortlist,undefined);
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

test('direct search excludes an already tracked Applied job and preserves its application',async()=>{
 const f=await fixture(),t=tasks(),id='protected-'+f.owner;
 await db.query("insert into public.jobs(id,canonical_url,employer) values($1,'https://job-boards.greenhouse.io/example/jobs/100','{}')",[id]);
 await db.query("insert into public.applications(user_id,job_id,status) values($1,$2,'Queued')",[f.owner,id]);
 await db.query("update public.applications set status='Submitted',submitted_at=now() where user_id=$1",[f.owner]);
 const before=(await db.query('select to_jsonb(a) data from public.applications a where user_id=$1',[f.owner])).rows;
 await workOnce(rpc,{execute:t.execute});
 assert.equal((await result(f.job.id)).result.shortlist.totalRetained,0);
 assert.deepEqual((await db.query('select to_jsonb(a) data from public.applications a where user_id=$1',[f.owner])).rows,before);
 assert(!t.calls.filter(c=>c.task==='verify-discovery-leads').flatMap(c=>c.input.leads).some(lead=>lead.url.endsWith('/100')));
});

test('a completed direct shortlist reaches private Discover only through agent-reviewed publication, with replay and website parity',async()=>{
 const {batchRoles}=await import('../lib/cloud-model.mjs');
 const {readGuide}=await import('../supabase/functions/agent-gateway/guides.mjs');
 const guide=readGuide('career-find-jobs');assert.equal(guide.version,15);assert.match(guide.instructions,/never publish the raw or merely filter-passed shortlist/);assert.match(guide.instructions,/Complete the private Discover handoff/);
 const f=await fixture(),t=tasks();await workOnce(rpc,{execute:t.execute});const j=await result(f.job.id);
 assert.equal((await db.query('select count(*)::int n from public.job_batches where user_id=$1',[f.owner])).rows[0].n,0);
 const hash=f.owner.replaceAll('-','').repeat(2);
 await db.query("update private.agent_connections set scopes=array_append(scopes,'batches:write') where user_id=$1",[f.owner]);
 const listings=(await db.query("select private.search_owned($1,'search.discoveries.read',$2) as p",[f.owner,{runId:j.search_run_id,offset:0,limit:100}])).rows[0].p.listings;
 assert.equal(listings.length,1);const l=listings[0];
 // Fictional agent output, supplied only after the worker has finished. No model
 // execution, candidate facts or publication is inferred from screening alone.
 const recommendation={searchRunId:j.search_run_id,searchListingId:l.id,searchProfileId:f.profile,evaluatedProfileVersion:1,whyItFits:'Your fictional backend project connects to the verified backend systems work.',materialGap:'The fictional employer does not disclose compensation.',matchAssessment:{assessedAt:'2026-11-07T12:00:00Z',skillsExperience:{score:80,reasoning:'Fictional backend project matches the posted systems work.'},compensation:{score:null,reasoning:'Pay and a personal threshold are not disclosed in this fictional scenario.'},wellbeingCulture:{score:null,reasoning:'Team working practices are unknown in this fictional scenario.'},locationWorkSetting:{score:95,reasoning:'Verified remote work matches the fictional required remote preference.'}}};
 const payload={eventKey:`discover:${j.search_run_id}:profile:1:part:0`,label:'Fictional reviewed shortlist',jobs:[{canonicalUrl:l.canonical_url,employer:{company:l.company,title:l.title,location:l.location,employmentType:'FT',description:l.observation.description},recommendation}]};
 const publish=async()=> (await db.query("select public.agent_dispatch($1,'batches.publish',$2) as p",[hash,payload])).rows[0].p;
 const saved=await publish(),again=await publish();assert.equal(saved.batch.id,again.batch.id);
 const read=(await db.query("select public.agent_dispatch($1,'batches.read',$2) as p",[hash,{batchId:saved.batch.id}])).rows[0].p;
 assert.equal(read.items.length,1);assert.equal(read.items[0].recommendation.searchListingId,l.id);
 const websiteItems=(await db.query('select to_jsonb(i)||jsonb_build_object(\'jobs\',to_jsonb(j)) as item from public.batch_items i join public.jobs j on j.id=i.job_id where i.user_id=$1 and i.batch_id=$2 order by i.position',[f.owner,saved.batch.id])).rows.map(r=>r.item);
 const roles=batchRoles(websiteItems,read.batch.batch_date);assert.equal(roles.length,1);assert.equal(roles[0].matchAssessment.skillsExperience.score,80);assert.equal(roles[0].matchAssessment.compensation.score,null);assert.equal(roles[0].applicationUrl,l.canonical_url);
 assert.equal((await db.query('select job_id from public.search_listings where id=$1',[l.id])).rows[0].job_id,read.items[0].job_id);
 assert.equal((await db.query('select count(*)::int n from public.job_batches where user_id=$1',[f.owner])).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from public.applications where user_id=$1',[f.owner])).rows[0].n,0);
 assert(!Object.hasOwn(read.items[0].job.employer,'matchAssessment'));
});
