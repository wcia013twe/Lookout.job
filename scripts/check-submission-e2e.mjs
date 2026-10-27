// Controlled employer fixtures only: real Chromium, Node HTTP, shared Edge handlers,
// private resume download and the complete migrated SQL database. No LLM or employer network.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {createTestDatabase} from '../tests/helpers/database.mjs';
import {createApi} from '../backend/runtime/api.ts';
import {createDispatch,credentialHash} from '../backend/runtime/service.ts';
import {createSubmissionService} from '../backend/runtime/submission.ts';
import {SUBMISSION_TOOLS} from '../supabase/functions/agent-gateway/submission-batches.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {submissionDispatch} from '../supabase/functions/agent-gateway/submission-dispatch.mjs';
import {prepareDraftWithPrefill} from '../lib/application-prefill-service.mjs';
import {updateField} from '../lib/search-profile.mjs';
import {inspectBrowserForm} from '../runner/browser.mjs';
let db,browser,edge,api,edgeUrl,apiUrl,resumeId,serial=1000,failed;
const owner='11111111-1111-1111-1111-111111111111',token='jb_agent_'+'8'.repeat(64),hash=credentialHash(token);
const bytes=Buffer.from('%PDF-1.4\nFictional submission test resume. No real person.\n%%EOF'),sha=createHash('sha256').update(bytes).digest('hex');
const resumeFiles=new Map();
const forms=new Map(),external=[];let loseCheckpointOnce=false;
const row=async(sql,args=[]) => (await db.query(sql,args)).rows[0];
const html=phone=>`<!doctype html><html><body><form id="application_form"><label for="email">Email</label><input id="email" name="email" type="email" required><label for="resume">Resume</label><input id="resume" name="resume" type="file" required>${phone?'<label for="phone">Phone</label><input id="phone" name="phone" type="tel" required>':''}<button type="submit">Submit application</button></form><script>document.querySelector('form').addEventListener('submit',async event=>{event.preventDefault();const r=await fetch(location.pathname,{method:'POST',body:new FormData(event.target)});if(r.ok){event.target.remove();const c=document.createElement('div');c.id='confirmation';c.textContent='Thank you for applying. Your application has been submitted.';document.body.appendChild(c);}});</script></body></html>`;
async function browserFactory(){
 const context=await browser.newContext();
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url()),fixture=forms.get(url.href);
  if(!fixture){external.push(url.href);return route.abort();}
  if(route.request().method()==='POST'){
   fixture.posts++;fixture.sent=route.request().postDataBuffer()?.toString('utf8');
   return route.fulfill({status:fixture.mode==='uncertain'?503:200,body:'fixture only'});
  }
  return route.fulfill({contentType:'text/html',body:fixture.mode==='unnamed'?html(false).replace('name="email"',''):html(fixture.mode==='changed')});
 });
 const page=await context.newPage();return {getPage:async()=>page,close:async()=>context.close()};
}
async function rpc(name,args){
 try{
  let data;
  if(name==='agent_dispatch')data=await row('select public.agent_dispatch($1,$2,$3) data',[args.credential_hash,args.operation,args.payload]);
  else if(name==='runner_submission_context')data=await row('select public.runner_submission_context($1,$2) data',[args.credential_hash,args.app_id]);
  else if(name==='runner_submission_transition')data=await row('select public.runner_submission_transition($1,$2,$3,$4,$5) data',[args.credential_hash,args.operation,args.p_payload,args.expected_context||null,args.execution_authorization||null]);
  else throw Error('Unexpected RPC');
  return {data:data.data,error:null};
 }catch(error){return {data:null,error};}
}
before(async()=>{
 db=await createTestDatabase();
 browser=await chromium.launch({headless:true,...(process.env.LOOKOUT_CHROMIUM_EXECUTABLE?{executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE}:{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})});
 await db.query("insert into public.profiles(user_id,facts,verified_at) values($1,$2,now())",[owner,{name:'Fictional Candidate',email:'fictional@example.com',phone:'+1 202-555-0100'}]);
 resumeFiles.set(owner+'/fixture.pdf',bytes);
 resumeId=(await row("insert into public.resumes(user_id,name,object_path,content_hash) values($1,'Fictional Resume',$2,$3) returning id",[owner,owner+'/fixture.pdf',sha])).id;
 await db.query('insert into public.preferences(user_id,search,tier_lists) values($1,$2,$3)',[owner,{autoSubmitApproved:true,defaultResumeId:resumeId},[{id:'ft',employmentType:'FT',companies:[{id:'fixture',name:'Fixture Systems'}],placements:{C:['fixture']}}]]);
 await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Fictional E2E',$2,array['workspace:read','drafts:write','approvals:read','resumes:read','preferences:write'],now()+interval '1 hour')",[owner,hash]);
 edge=createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,edgeUrl);
   if(url.pathname.startsWith('/storage/v1/object/sign/resumes/')){
    const file=resumeFiles.get(url.pathname.slice('/storage/v1/object/sign/resumes/'.length));assert(file,'Owned fixture file required');assert.equal(url.searchParams.get('token'),'fixture-only');
    return res.writeHead(200,{'Content-Type':'application/pdf'}).end(file);
   }
   assert.equal(url.pathname,'/functions/v1/agent-gateway');assert.equal(req.headers.authorization,'Bearer '+token);
   const chunks=[];for await(const part of req)chunks.push(part);
   const {operation,payload}=validateRequest(JSON.parse(Buffer.concat(chunks)));let result;
   const call=(operation,payload)=>rpc('agent_dispatch',{credential_hash:hash,operation,payload});
   if(operation.startsWith('submission.')&&!operation.startsWith('submission.batch.')){
    const reply=await submissionDispatch({operation,payload,credentialHash:hash,rpc});
    res.writeHead(reply.status,{'Content-Type':'application/json'});return res.end(JSON.stringify(reply.status===200?{data:reply.data}:{error:reply.error}));
   }
   if(operation==='drafts.prepare')result=await prepareDraftWithPrefill(call,payload,{loadJob:async id=>row('select * from public.jobs where id=$1',[id]),loadApplication:async(jobId,userId)=>row('select * from public.applications where job_id=$1 and user_id=$2',[jobId,userId])});
   else result=await call(operation,payload);
   if(result.error){console.error('Fictional Edge diagnostic:',operation,result.error.code,result.error.message);res.writeHead(['40001'].includes(result.error.code)?409:400,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:result.error.message}));}
   if(operation==='submission.batch.checkpoint'&&loseCheckpointOnce){loseCheckpointOnce=false;return res.destroy();}
   if(operation==='resumes.read')result.data={resume:result.data,url:edgeUrl+'/storage/v1/object/sign/resumes/'+result.data.object_path+'?token=fixture-only'};
   res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({data:result.data}));
  }catch(error){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}
 });edge.listen(0,'127.0.0.1');await once(edge,'listening');edgeUrl=`http://127.0.0.1:${edge.address().port}`;
 const dataDispatch=createDispatch({rpc,supabaseUrl:edgeUrl});
 // Factory is synchronous in production; allocate isolated context lazily for each request.
 const factory=()=>{let promise;return {getPage:async()=>{promise??=browserFactory();return (await promise).getPage();},close:async()=>{if(promise)await (await promise).close();}};};
 api=createApi({dispatch:createSubmissionService({dispatch:dataDispatch,projectUrl:edgeUrl,browserFactory:factory}),executionTools:SUBMISSION_TOOLS});
 api.listen(0,'127.0.0.1');await once(api,'listening');apiUrl=`http://127.0.0.1:${api.address().port}`;
});
after(async()=>{
 await browser?.close();for(const server of [api,edge])if(server){server.closeAllConnections();await new Promise(done=>server.close(done));}await db?.close();
 assert.deepEqual(external,[],'No employer network access is allowed');
});
async function direct(operation,payload){const response=await fetch(apiUrl+'/v1/operations',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({operation,payload})});const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));return body.data;}
async function tool(name,args={}){const response=await fetch(apiUrl+'/mcp',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})});const body=await response.json();assert(!body.error,JSON.stringify(body));assert(!body.result.isError,JSON.stringify(body));return JSON.parse(body.result.content[0].text);}
async function application(mode='normal',{profileId,emptyResume=false}={}){
 const number=++serial,url=`https://job-boards.greenhouse.io/fixture/jobs/${number}`,jobId='fixture-'+number;
 const fixture={mode:'normal',posts:0,sent:null};forms.set(url,fixture);
 const provider=await browserFactory(),page=await provider.getPage();await page.goto(url);const form=await inspectBrowserForm(page);await provider.close();
 await db.query('insert into public.jobs(id,canonical_url,employer) values($1,$2,$3)',[jobId,url,{company:'Fixture Systems',title:'Fictional Engineer',employmentType:'FT'}]);
 const draft={url,resumeId,resumeSha256:sha,formFingerprint:form.formFingerprint,questionsReviewed:false,questions:[{fieldId:'email',fieldType:'email',question:'Email',answer:'fictional@example.com',profileField:'email'},{fieldId:'resume',fieldType:'file',question:'Resume',answer:resumeId}]};
 if(profileId)draft.searchProfileId=profileId;
 if(emptyResume){delete draft.resumeId;delete draft.resumeSha256;draft.questions.find(q=>q.fieldId==='resume').answer='';}
 const app=await row('insert into public.applications(user_id,job_id,draft) values($1,$2,$3) returning *',[owner,jobId,draft]);fixture.mode=mode;return {app,fixture,url,jobId};
}
test('Gate 1: no agent, one actual browser submission through Node → Edge → SQL',async()=>{
 const f=await application();
 const result=await direct('local.submit',{applicationId:f.app.id,attemptId:'no-agent-e2e'});
 assert.equal(result.status,'Submitted',JSON.stringify(result));assert.equal(f.fixture.posts,1);
 assert.match(f.fixture.sent,/fictional@example.com/);assert.match(f.fixture.sent,/Fictional submission test resume/);
 const app=await row('select * from public.applications where id=$1',[f.app.id]);assert.equal(app.status,'Submitted');assert.equal(app.receipt.source,'runner-observed-greenhouse-confirmation');
 assert.equal((await direct('local.submit',{applicationId:f.app.id,attemptId:'no-agent-e2e'})).status,'Already submitted');assert.equal(f.fixture.posts,1);
});
test('Gate 2: employer form changes, no click occurs, durable HITL action appears',async()=>{
 failed=await application('changed');
 const result=await direct('local.submit',{applicationId:failed.app.id,attemptId:'changed-form-e2e'});
 assert.equal(result.status,'Needs you');assert.equal(result.reported,true);assert.equal(failed.fixture.posts,0);
 const inbox=await tool('read_action_inbox');assert(inbox.items.some(item=>item.application_id===failed.app.id&&item.kind==='resolve_blocker'));
 assert.equal((await row('select status from public.applications where id=$1',[failed.app.id])).status,'Blocked');
});
test('Gate 3: scripted agent reads HITL, repairs from verified facts through MCP, then submits',async()=>{
 assert(failed);const inbox=await tool('read_action_inbox');assert(inbox.items.some(item=>item.application_id===failed.app.id));
 const provider=await browserFactory(),page=await provider.getPage();await page.goto(failed.url);const form=await inspectBrowserForm(page);await provider.close();
 const current=await row('select * from public.applications where id=$1',[failed.app.id]);
 const draft={...current.draft,formFingerprint:form.formFingerprint,questions:form.questions.flatMap(q=>q.fields.map(field=>({fieldId:field.id,fieldType:field.type,question:q.question,required:q.required,options:field.options,answer:''})))};
 const prepared=await tool('prepare_draft',{jobId:failed.jobId,expectedRevision:current.revision,blocker:'',draft});
 assert.equal(prepared.draft,undefined,'Keep the compact handoff response');
 const saved=await tool('read_application_record',{applicationId:failed.app.id});
 assert.equal(saved.application.draft.questions.find(q=>q.fieldId==='phone').answer,'+1 202-555-0100');
 assert.equal((await row('select count(*)::int n from public.approvals where application_id=$1',[failed.app.id])).n,0,'Agent must not manufacture approval');
 const result=await tool('submit_application',{applicationId:failed.app.id,attemptId:'agent-repaired-e2e'});
 assert.equal(result.status,'Submitted',JSON.stringify(result));assert.equal(failed.fixture.posts,1);
 assert(!(await tool('read_action_inbox')).items.some(item=>item.application_id===failed.app.id));
 const history=await tool('read_action_inbox',{state:'all'});assert(history.items.some(item=>item.application_id===failed.app.id&&item.resolved_at));
});
test('Batch: independent success and HITL outcomes persist; exact replay never submits twice',async()=>{
 const a=await application(),b=await application('changed');
 const payload={eventKey:'batch-e2e',applications:[{applicationId:a.app.id,expectedRevision:a.app.revision},{applicationId:b.app.id,expectedRevision:b.app.revision}]};
 const result=await tool('submit_application_batch',payload);
 assert.equal(result.batch.status,'partial');assert.equal(result.batch.results[a.app.id].status,'Submitted');assert.equal(result.batch.results[b.app.id].status,'Needs you');
 const read=await tool('read_application_batches',{batchId:result.batch.id});assert.equal(read.batches[0].status,'partial');assert(!JSON.stringify(read).includes('lease_token'));
 await tool('submit_application_batch',payload);assert.equal(a.fixture.posts,1);assert.equal(b.fixture.posts,0);
});

test('Unnamed submitted fields are blocked before a click, even if values validate',async()=>{
 const f=await application('unnamed');
 const result=await direct('local.submit',{applicationId:f.app.id,attemptId:'unnamed-e2e'});
 assert.equal(result.status,'Needs you');assert.equal(f.fixture.posts,0);
});
test('Post-click timeout persists uncertainty; an agent cannot retry it into a second submission',async()=>{
 const f=await application('uncertain');
 const result=await tool('submit_application',{applicationId:f.app.id,attemptId:'uncertain-e2e'});
 assert.equal(result.status,'Needs you');assert.equal(f.fixture.posts,1);
 const attempt=await row('select state from public.submission_attempts where application_id=$1',[f.app.id]);assert.equal(attempt.state,'uncertain');
 const inbox=await tool('read_action_inbox');assert(inbox.items.some(item=>item.application_id===f.app.id&&item.kind==='check_submission'));
 const retry=await tool('submit_application',{applicationId:f.app.id,attemptId:'agent-retry-denied'});
 assert.equal(retry.status,'Needs you');assert.equal(f.fixture.posts,1);
 assert.equal((await row('select count(*)::int n from public.approvals where application_id=$1',[f.app.id])).n,0);
});

test('Interrupted batch resumes unfinished items after lease expiry without resubmitting its completed item',async()=>{
 const a=await application(),b=await application();
 const payload={eventKey:'interrupted-e2e',applications:[{applicationId:a.app.id,expectedRevision:a.app.revision},{applicationId:b.app.id,expectedRevision:b.app.revision}]};
 loseCheckpointOnce=true;
 await assert.rejects(tool('submit_application_batch',payload),/503/);
 const batches=await tool('read_application_batches');const saved=batches.batches.find(batch=>batch.event_key==='interrupted-e2e');
 assert(saved);assert.equal(saved.results[a.app.id].status,'Submitted');assert.equal(a.fixture.posts,1);assert.equal(b.fixture.posts,0);
 const busy=await tool('submit_application_batch',payload);assert.equal(busy.busy,true);assert.equal(b.fixture.posts,0);
 await db.query("update private.submission_batches set lease_expires_at=now()-interval '1 second' where id=$1",[saved.id]);
 const resumed=await tool('submit_application_batch',payload);assert.equal(resumed.batch.status,'completed');
 assert.equal(a.fixture.posts,1);assert.equal(b.fixture.posts,1);
});

test('Profile role/job-type mapping and fallback upload their own pinned resume bytes instead of the account default',async()=>{
 const mappedBytes=Buffer.from('%PDF-1.4\nMAPPED PROFILE RESUME FIXTURE\n%%EOF'),mappedHash=createHash('sha256').update(mappedBytes).digest('hex'),path=owner+'/mapped-profile.pdf';
 resumeFiles.set(path,mappedBytes);
 const mapped=(await row("insert into public.resumes(user_id,name,object_path,content_hash) values($1,'Mapped Profile Resume',$2,$3) returning *",[owner,path,mappedHash]));
 for(const variant of ['mapped','fallback']){
  const profileId='resume-'+variant;
  let instructions=updateField('','Application automation','Auto-apply routine matches','Yes');
  instructions=updateField(instructions,'Company priorities','Tier list ID','ft');
  instructions=updateField(instructions,'Application materials','Default resume ID',variant==='fallback'?mapped.id:resumeId);
  instructions=updateField(instructions,'Recruiting targets','Targets',JSON.stringify([{id:'ft',name:'Full-time fixture',active:true,roles:variant==='mapped'?'Fictional Engineer':'No matching role',employment:'Full-time',resumeId:mapped.id,timeline:'',conditions:''},{id:'intern',name:'Internship fixture',active:true,roles:'Fictional Engineer',employment:'Internship',resumeId,timeline:'',conditions:''}]));
  await tool('save_search_profile',{expectedVersion:0,profile:{id:profileId,name:'Fictional '+variant,active:true,filters:{Employment:'Full-time'},priorities:{},instructions}});
  const f=await application('normal',{profileId,emptyResume:true});
  const prepared=await tool('prepare_draft',{jobId:f.jobId,expectedRevision:f.app.revision,draft:{...f.app.draft,questions:f.app.draft.questions.map(q=>({...q,answer:''}))}});
  assert.equal(prepared.handoff.resumeSelection.resumeId,mapped.id);assert.equal(prepared.handoff.resumeSelection.status,'Selected');
  const saved=await tool('read_application_record',{applicationId:f.app.id});assert.equal(saved.application.draft.resumeId,mapped.id);assert.equal(saved.application.draft.resumeSha256,mappedHash);
  const result=await tool('submit_application',{applicationId:f.app.id,attemptId:'profile-'+variant});
  assert.equal(result.status,'Submitted',JSON.stringify(result));assert.equal(f.fixture.posts,1);
  assert.match(f.fixture.sent,/MAPPED PROFILE RESUME FIXTURE/);assert(!f.fixture.sent.includes('Fictional submission test resume.'));
  const attempt=await row('select context_snapshot from public.submission_attempts where application_id=$1',[f.app.id]);assert.equal(attempt.context_snapshot.resume.id,mapped.id);assert.equal(attempt.context_snapshot.resume.content_hash,mappedHash);
 }
});
