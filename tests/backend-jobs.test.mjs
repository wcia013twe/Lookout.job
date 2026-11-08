import test from 'node:test';
import assert from 'node:assert/strict';
import {BACKEND_TOOLS, BACKEND_OPERATIONS, validateBackendJob, createBackendJobsService} from '../lib/backend-jobs.mjs';
import {createBackendJobsDemo, DEMO_BACKEND_CONNECTION_ID} from '../lib/backend-jobs-demo.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {TOOLS, createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {createBackend} from '../backend/client.mjs';

const submit={kind:'search_ats',input:{profileId:'general'},eventKey:'authorized-search-1'};
const uuid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const token='jb_agent_'+'f'.repeat(64);
const request=(method,params)=>new Request('http://localhost/mcp',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});

test('backend job tools share a closed gateway contract and expose no worker controls',()=>{
  assert.equal(new Set(BACKEND_OPERATIONS).size,4);
  for(const tool of BACKEND_TOOLS) {
    assert.equal(TOOLS.filter(t=>t.name===tool.name&&t.operation===tool.operation).length,1);
    assert.equal(tool.inputSchema.additionalProperties,false);
    assert.ok(!/worker|lease|credential|sql|shell/.test(tool.name));
  }
  assert.deepEqual(validateRequest({operation:'backend.jobs.submit',payload:submit}).payload,submit);

  for(const payload of [{...submit,connectionId:uuid},{...submit,ownerId:uuid},{...submit,kind:'script'},{...submit,input:{profileId:'general',url:'https://arbitrary.example'}},{...submit,input:{profileId:'../secret'}},{...submit,eventKey:' '},{...submit,eventKey:'x'.repeat(161)},{...submit,eventKey:'key\n'}]) {
    assert.throws(()=>validateRequest({operation:'backend.jobs.submit',payload}));
  }
  assert.throws(()=>validateRequest({operation:'backend.worker.claim',payload:{}}));
  assert.throws(()=>validateBackendJob('backend.jobs.cancel',{jobId:uuid,expectedVersion:0}));
  assert.throws(()=>validateBackendJob('backend.jobs.read',{jobId:''}));
});

test('retired recurring scheduler tools and operations are unavailable, including stale MCP calls',async()=>{
 const handle=createHandler(async()=>({status:200,data:{scopes:['workspace:read','preferences:write','drafts:write']}}));
 const list=await (await handle(request('tools/list',{}))).json();
 for(const [name,operation] of [['save_backend_schedule','backend.schedules.save'],['read_backend_schedules','backend.schedules.read']]) {
  assert.ok(!list.result.tools.some(tool=>tool.name===name));
  assert.throws(()=>validateRequest({operation,payload:{}}));
  const response=await (await handle(request('tools/call',{name,arguments:{}}))).json();
  assert.ok(response.error||response.result?.isError);
 }
 assert.equal(createBackendJobsDemo().saveSchedule,undefined);
 assert.equal(createBackendJobsDemo().readSchedules,undefined);
});

test('MCP filters writes by all required scopes and rejects nested/connection injection before forwarding',async()=>{
  for(const scopes of [['preferences:write'],['preferences:write','workspace:read'],['workspace:read','drafts:write']]) {
    const calls=[];
    const handle=createHandler(async(_token,op,payload)=>{calls.push([op,payload]);return {status:200,data:op==='credentials.verify'?{scopes}:{id:uuid}};});
    const list=await (await handle(request('tools/list',{}))).json();
    assert.ok(!list.result.tools.some(tool=>tool.name==='submit_backend_job'));
    const denied=await (await handle(request('tools/call',{name:'submit_backend_job',arguments:submit}))).json();
    assert.equal(denied.result.isError,true);
    assert.ok(!calls.some(([op])=>op==='backend.jobs.submit'));
  }
  const scopes=['preferences:write','workspace:read','drafts:write'],calls=[];
  const handle=createHandler(async(_token,op,payload)=>{calls.push([op,payload]);return {status:200,data:op==='credentials.verify'?{scopes}:{id:uuid}};});
  for(const arguments_ of [{...submit,connectionId:uuid},{...submit,input:{profileId:'general',script:'arbitrary'}}]) {
    const response=await (await handle(request('tools/call',{name:'submit_backend_job',arguments:arguments_}))).json();
    assert.equal(response.error.code,-32602);
  }
  const result=await (await handle(request('tools/call',{name:'submit_backend_job',arguments:submit}))).json();
  assert.equal(result.result.isError,undefined);
  assert.deepEqual(calls.at(-1),['backend.jobs.submit',submit]);
});

test('browser adapter uses the same bounded RPC with explicit owned connection and detects account switches',async()=>{
  let owner='one';const calls=[];
  const client={auth:{getUser:async()=>({data:{user:{id:owner}}})},rpc:async(name,args)=>{calls.push([name,args]);return {data:{id:uuid}};}};
  const service=createBackend(client,'one').backendJobs;
  await assert.rejects(service.submit(submit),/connection/);
  assert.equal(calls.length,0);
  const payload={...submit,connectionId:uuid};
  assert.equal((await service.submit(payload)).id,uuid);
  assert.deepEqual(calls.at(-1),['backend_job_action',{operation:'backend.jobs.submit',payload}]);
  const switched=createBackendJobsService({owner:async()=>owner,rpc:async()=>{owner='two';return {data:{id:uuid}};}});
  await assert.rejects(switched.submit(payload),/Account changed/);
});

test('fictional backend job states, cancellation, retry receipts reset without execution',async()=>{
  const a=createBackendJobsDemo(),b=createBackendJobsDemo();
  const rows=(await a.read()).jobs;
  assert.deepEqual(rows.filter(row=>row.kind==='search_ats').map(row=>row.status),['queued','running','completed','partial','failed','cancelled']);
  assert.ok(rows.every(row=>!Object.hasOwn(row,'lease_token')));
  const payload={...submit,connectionId:DEMO_BACKEND_CONNECTION_ID};
  const queued=await a.submit(payload);
  assert.equal(queued.status,'queued');
  assert.deepEqual(await a.submit(payload),queued);
  await assert.rejects(a.submit({...payload,input:{profileId:'different'}}),/retry key/);
  const cancelled=await a.cancel({jobId:queued.id,expectedVersion:queued.version});
  assert.equal(cancelled.status,'cancelled');
  await assert.rejects(a.cancel({jobId:queued.id,expectedVersion:queued.version}),/changed/);
  assert.equal((await b.read()).jobs.length,8);
  a.reset();assert.deepEqual(await a.read(),await b.read());

});


test('application demo jobs expose bounded repair and uncertain handoffs without execution',async()=>{
 const demo=createBackendJobsDemo(),{jobs}=await demo.read();
 const [uncertain,repair]=jobs.filter(job=>job.kind==='application_submit');
 assert.equal(uncertain.result.blocker.safeToRetry,false);assert.equal(uncertain.result.blocker.submitClickAttempted,true);
 assert.equal(repair.result.blocker.questions[0].fieldId,'availability');assert.equal(repair.result.blocker.recovery.action,'repair-draft');
 uncertain.result.blocker.message='mutated';
 assert.notEqual((await demo.read({jobId:uncertain.id})).jobs[0].result.blocker.message,'mutated');
 demo.reset();assert.equal((await demo.read()).jobs.length,8);
});


test('single portal MCP tool requires a portal ID and shares browser validation and demo isolation',async()=>{
 const calls=[],scopes=['workspace:read','preferences:write','drafts:write'];
 const handle=createHandler(async(_token,op,payload)=>{calls.push([op,payload]);return {status:200,data:op==='credentials.verify'?{scopes}:{id:uuid}};});
 const payload={...submit,input:{profileId:'general',portalId:'fictional-employer'}};
 const invoke=async arguments_ => (await handle(request('tools/call',{name:'call_discovered_tool',arguments:{name:'submit_portal_search',arguments:arguments_}}))).json();
 assert.equal((await invoke(submit)).error.code,-32602);
 for(const portalId of ['',null,7,'x'.repeat(161),'bad\n'])assert.throws(()=>validateBackendJob('backend.jobs.submit',{...payload,input:{...payload.input,portalId}}));
 const reply=await invoke(payload);assert.equal(reply.result.isError,undefined);assert.deepEqual(calls.at(-1),['backend.jobs.portal.submit',payload]);
 const browserCalls=[],service=createBackendJobsService({owner:async()=>uuid,rpc:async(name,args)=>{browserCalls.push([name,args]);return {data:{id:uuid}};}});
 await service.submit({...payload,connectionId:uuid});assert.deepEqual(browserCalls.at(-1),['backend_job_action',{operation:'backend.jobs.submit',payload:{...payload,connectionId:uuid}}]);
 const demo=createBackendJobsDemo(),before=await demo.read();
 assert(before.jobs.some(j=>j.input.portalId==='fictional-employer'));
 const queued=await demo.submit({...payload,connectionId:DEMO_BACKEND_CONNECTION_ID});assert.equal(queued.input.portalId,'fictional-employer');assert.equal(queued.status,'queued');
 demo.reset();assert.deepEqual(await demo.read(),before);
});
