import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createTestDatabase} from './helpers/database.mjs';
import {workOnce,executeSearch} from '../backend/runtime/worker.ts';
import {executeCareerTask} from '../runner/career-tools.mjs';
let db;before(async()=>{db=await createTestDatabase();});after(async()=>{await db?.close();});
async function fixture({partial=false}={}){
 const owner=randomUUID(),profile='profile_'+owner.replaceAll('-','');
 await db.query('insert into auth.users values($1)',[owner]);
 await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Fictional pipeline',$2,array['workspace:read','preferences:write','drafts:write'],now()+interval '1 day')",[owner,owner.replaceAll('-','').repeat(2)]);
 const hash=owner.replaceAll('-','').repeat(2);
 const projection={active:true,filters:{Employment:'Full-time','Work arrangement':'Remote required'},instructions:''};
 const portals={tracked_companies:[{id:'example',name:'Example (fictional)',careers_url:'https://job-boards.greenhouse.io/example',enabled:true},...(partial?[{id:'unsupported',name:'Unsupported fictional source',careers_url:'https://unsupported.test/careers',enabled:true}]:[])],search_queries:[]};
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
  if(task==='verify-discovery-leads')return {jobs:rows,diagnostics:rows.map(r=>({url:r.url,status:'active',reason:'Fictional verifier fixture.'}))};
  return executeCareerTask(task,input);
 }};
}
async function result(id){return (await db.query('select status,result,search_run_id from private.backend_jobs where id=$1',[id])).rows[0];}

test('one real SQL-leased job persists verified observations, screenings and a copied-dedup shortlist',async()=>{
 const f=await fixture(),t=tasks();await workOnce(rpc,{execute:t.execute});
 const j=await result(f.job.id);assert.equal(j.status,'completed');assert.equal(j.result.pipelineVersion,1);
 assert.equal(j.result.shortlist.screenedCount,3);assert.equal(j.result.shortlist.excludedCount,2);assert.equal(j.result.shortlist.retainedListingIds.length,1);assert.equal(j.result.shortlist.reporting,'pending-muse');assert.equal(j.result.shortlist.applicantEligibility,'not-evaluated');
 assert.deepEqual(t.calls.map(c=>c.task),['discovery','verify-discovery-leads','filter-discovery','dedup-discovery']);
 assert.equal((await db.query('select count(*)::int n from public.search_screenings where user_id=$1',[f.owner])).rows[0].n,3);
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
 assert.equal(r.error.code,'40001');assert.equal((await result(f.job.id)).result.shortlist,undefined);
});
