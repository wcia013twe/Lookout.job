import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {TOOLS,requiredToolScopes} from '../supabase/functions/agent-mcp/protocol.mjs';
import {LOCAL_TOOLS} from '../runner/runtime.mjs';
import {operationService} from '../lib/mcp-services.mjs';
import {museChangeFeedResponse} from '../lib/muse-change-feed.mjs';
import {createDispatch} from '../backend/runtime/service.ts';
const base={jobId:'11111111-1111-4111-8111-111111111111',expectedVersion:1,expectedRevision:0,eventKey:'claim:1'};
test('Muse pickup/report contracts are narrow, versioned, scoped and routed through the queue authority',()=>{
 for(const [operation,payload] of [['applications.request.claim',base],['applications.request.report',{...base,outcome:'prepared',summary:'Draft checked.'}]]){
  assert.doesNotThrow(()=>validateRequest({operation,payload}));
  assert.equal(operationService(operation).handler,'queue-rpc');
  const tool=TOOLS.find(t=>t.operation===operation);assert(tool);
  assert.deepEqual(requiredToolScopes(tool).sort(),['workspace:read','preferences:write','drafts:write','approvals:read','resumes:read'].sort());
  for(const patch of [{userId:'other'},{connectionId:'other'},{jobId:'bad'},{expectedVersion:0},{expectedRevision:-1},{eventKey:''},{receipt:{source:'fake'}}])assert.throws(()=>validateRequest({operation,payload:{...payload,...patch}}));
 }
 const final={...base,eventKey:'final:1',finalDraft:{questions:[{id:'q1',required:true,answer:'Fictional answer'}]},browserInspected:true,outcome:'prepared',summary:'Inspected fictional draft.'};
 assert.doesNotThrow(()=>validateRequest({operation:'applications.request.finalize',payload:final}));
 assert.equal(operationService('applications.request.finalize').handler,'queue-rpc');
 for(const patch of [{browserInspected:false},{blocker:'blocked'},{finalDraft:{questions:[{required:true,answer:''}]}},{outcome:'uncertain',blocker:'Unable to inspect'}]){
  if(patch.outcome==='uncertain')assert.doesNotThrow(()=>validateRequest({operation:'applications.request.finalize',payload:{...final,...patch}}));
  else assert.throws(()=>validateRequest({operation:'applications.request.finalize',payload:{...final,...patch}}));
 }
 for(const patch of [{outcome:'submitted'},{outcome:'approved'},{summary:' '},{summary:'x'.repeat(1001)}])assert.throws(()=>validateRequest({operation:'applications.request.report',payload:{...base,outcome:'prepared',summary:'Checked.',...patch}}));
});

test('finalization demo saves draft and blocker atomically, replays exactly, and keeps outcomes distinct',async()=>{
 const {demoFixtures,createMemoryStore,createDemoServices}=await import('../next-app/lib/demo.mjs');
 const fixture=demoFixtures('2026-11-08');
 for(const [outcome,blocker] of [['prepared',undefined],['blocked','Required work authorization detail missing.'],['uncertain','Could not verify a required portal field.']]){
  const store=createMemoryStore(fixture.state),api=createDemoServices(store);
  const queued=await api.queueApplicationJob({posting:{id:'demo-final-'+outcome,url:'https://example.com/fictional',company:'Example (demo)',title:'Fictional Engineer',employmentType:'FT',location:'Remote'},expectedRevision:0,eventKey:'queue-'+outcome});
  const claim={jobId:queued.job.id,expectedVersion:1,expectedRevision:0,eventKey:'claim-'+outcome};
  const picked=await api.claimApplicationRequest(claim);assert(picked.application);assert(picked.handoff);assert.deepEqual(await api.claimApplicationRequest(claim),picked);
  const payload={jobId:queued.job.id,expectedVersion:2,expectedRevision:0,eventKey:'final-'+outcome,finalDraft:{questions:[{id:'q1',required:true,answer:'Fictional answer'}]},browserInspected:true,outcome,summary:'Fictional final preparation result.',...(blocker?{blocker}:{})};
  await assert.rejects(api.finalizeApplicationRequest({...payload,expectedRevision:1}));
  const result=await api.finalizeApplicationRequest(payload);assert.equal(result.application.backendRevision,1);assert.equal(result.job.result.verifiedSubmission,false);assert.equal(result.approved,false);
  assert.equal(result.application.draft.questionsReviewed,false);
  assert.deepEqual(await api.finalizeApplicationRequest(payload),result);
  await assert.rejects(api.finalizeApplicationRequest({...payload,summary:'Changed payload'}));
  assert.equal(store.get('workflow.applications.'+('demo-final-'+outcome)).status,blocker?'Blocked':'Awaiting approval');
  assert(result.actionBoardItems.every(item=>item.applicationId===queued.application.backendId));
  assert.equal(result.actionBoardItems[0].kind,outcome==='prepared'?'review_application':'resolve_blocker');
 }
});
test('Node queue-rpc claim returns the saved handoff without a second context read',async()=>{
 const calls=[],jobId=base.jobId,application={id:'app-saved',job_id:'posting-saved',revision:4,status:'Queued',draft:{questions:[null,{id:'q1',required:true,answer:null}]}},jobRecord={id:'posting-saved',canonical_url:'https://example.com/jobs/1',employer:{company:'Fictional Systems',title:'Backend Engineer'}};
 const dispatch=createDispatch({supabaseUrl:'http://127.0.0.1:54321',request:async()=>assert.fail('Claim must stay in queue-rpc'),rpc:async(name,args)=>{calls.push({name,args});return {data:{job:{id:jobId,status:'running'},application,jobRecord}};}});
 const reply=await dispatch('jb_agent_'+'a'.repeat(64),'applications.request.claim',base);
 assert.equal(reply.status,200);assert.equal(calls.length,1);assert.equal(calls[0].name,'backend_job_dispatch');assert.equal(calls[0].args.operation,'applications.request.claim');
 assert.deepEqual(reply.data.application,application);assert.deepEqual(reply.data.jobRecord,jobRecord);assert.equal(reply.data.handoff.job.url,jobRecord.canonical_url);assert.equal(reply.data.handoff.questions.length,1);
});
test('AI Apply pointers route to the existing job and application guide; deterministic browser registrations stay paused',async()=>{
 const item=museChangeFeedResponse({items:[{kind:'application_requested',recordId:base.jobId}]}).items[0];
 assert.deepEqual(item.refresh,{tool:'read_backend_jobs',arguments:{jobId:base.jobId}});assert.equal(item.workflow.guideId,'application-workspace');
 for(const name of ['inspect_application','try_application','submit_application','submit_application_batch'])assert(!LOCAL_TOOLS.some(t=>t.name===name),name);
 const source=await readFile(new URL('../backend/runtime/main.ts',import.meta.url),'utf8');
 assert.match(source,/await runWorker\(rpc,controller.signal\);/);assert.match(source,/executionTools:\[\]/);
 assert(!source.split('\n').filter(l=>!l.trim().startsWith('//')).join('\n').includes('createApplicationExecutor'));
});


test('detached demo traces request, single pickup and review outcome without marking applied; reset removes it',async()=>{
 const {demoFixtures,createMemoryStore,createDemoServices}=await import('../next-app/lib/demo.mjs');
 const {applicationRequestLabel}=await import('../lib/application-request-state.mjs');
 const fixture=demoFixtures('2026-11-08'),store=createMemoryStore(fixture.state),api=createDemoServices(store);
 const queued=await api.queueApplicationJob({posting:{id:'demo-agent-role',url:'https://example.com/fictional',company:'Example (demo)',title:'Fictional Engineer',employmentType:'FT',location:'Remote'},expectedRevision:0,eventKey:'demo-request'});
 assert.equal(applicationRequestLabel(queued.job),'Waiting for Muse');
 const payload={jobId:queued.job.id,expectedVersion:1,expectedRevision:0,eventKey:'demo-pickup'};
 const claimed=await api.claimApplicationRequest(payload);
 assert.equal(applicationRequestLabel(claimed.job),'Muse is working');assert.deepEqual(await api.claimApplicationRequest(payload),claimed);
 await assert.rejects(api.claimApplicationRequest({...payload,eventKey:'competing'}));
 const report={...payload,expectedVersion:2,eventKey:'demo-result',outcome:'prepared',summary:'Fictional draft checked; waiting for human review.'};
 const outcome=await api.reportApplicationRequest(report);assert.equal(applicationRequestLabel(outcome.job),'Ready for review');
 assert.deepEqual(await api.reportApplicationRequest(report),outcome);
 await assert.rejects(api.claimApplicationRequest({...payload,expectedVersion:outcome.job.version,eventKey:'terminal-reclaim'}));
 assert.equal(store.get('workflow.applications.demo-agent-role').status,'Queued');assert.equal(outcome.job.result.verifiedSubmission,false);
 const changes=(await api.readMuseChanges()).items;assert(changes.some(e=>e.kind==='application_requested'&&e.recordId===queued.job.id));assert(changes.some(e=>e.kind==='backend_job_finished'&&e.recordId===queued.job.id));
 const reset=createMemoryStore(fixture.state);assert.equal(reset.get('workflow.applications.demo-agent-role'),undefined);
 assert.equal((await createDemoServices(reset).readMuseChanges()).items.some(e=>e.recordId===queued.job.id),false);
 for(const [result,label] of [['completed','Muse reported completion'],['uncertain','Verify the submission outcome'],['blocked','Muse needs your input']])assert.equal(applicationRequestLabel({status:'partial',result:{executor:'muse',outcome:result}}),label);
});
