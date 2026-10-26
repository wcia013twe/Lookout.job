import test from 'node:test';
import assert from 'node:assert/strict';
import {BACKEND_TOOLS,BACKEND_OPERATIONS,validateBackendJob,createBackendJobsService} from '../lib/backend-jobs.mjs';
import {createBackendJobsDemo,DEMO_BACKEND_CONNECTION_ID} from '../lib/backend-jobs-demo.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {TOOLS,createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {createBackend} from '../backend/client.mjs';
import {createDemoServices,createDemoWorkspace} from '../next-app/lib/muse-demo-fixtures.mjs';
import {createMemoryStore} from '../next-app/lib/demo.mjs';
import {readGuide} from '../supabase/functions/agent-gateway/guides.mjs';
import instructions from '../supabase/functions/agent-gateway/instructions.json' with {type:'json'};
const submit={kind:'search_ats',input:{profileId:'general'},eventKey:'authorized-search-1'};
const schedule={...submit,intervalMinutes:1440,enabled:true,expectedVersion:0};
const uuid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const token='jb_agent_'+'f'.repeat(64);
const request=(method,params)=>new Request('http://localhost/mcp',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});

test('backend job tools share a closed gateway contract and expose no worker controls',()=>{
  assert.equal(new Set(BACKEND_OPERATIONS).size,5);
  for(const tool of BACKEND_TOOLS) {
    assert.equal(TOOLS.filter(t=>t.name===tool.name&&t.operation===tool.operation).length,1);
    assert.equal(tool.inputSchema.additionalProperties,false);
    assert.ok(!/worker|lease|credential|sql|shell/.test(tool.name));
  }
  assert.deepEqual(validateRequest({operation:'backend.jobs.submit',payload:submit}).payload,submit);
  assert.doesNotThrow(()=>validateRequest({operation:'backend.schedules.save',payload:schedule}));
  for(const payload of [{...submit,connectionId:uuid},{...submit,ownerId:uuid},{...submit,kind:'script'},{...submit,input:{profileId:'general',url:'https://arbitrary.example'}},{...submit,input:{profileId:'../secret'}},{...submit,eventKey:' '},{...submit,eventKey:'x'.repeat(161)},{...submit,eventKey:'key\n'}]) {
    assert.throws(()=>validateRequest({operation:'backend.jobs.submit',payload}));
  }
  assert.throws(()=>validateRequest({operation:'backend.worker.claim',payload:{}}));
  assert.throws(()=>validateBackendJob('backend.jobs.cancel',{jobId:uuid,expectedVersion:0}));
  assert.throws(()=>validateBackendJob('backend.jobs.read',{jobId:''}));
});

test('backend schedules use strict bounds, explicit enablement and exact create/update versions',()=>{
  for(const intervalMinutes of [15,10080])assert.doesNotThrow(()=>validateBackendJob('backend.schedules.save',{...schedule,intervalMinutes}));
  for(const payload of [{...schedule,intervalMinutes:14},{...schedule,intervalMinutes:10081},{...schedule,enabled:'true'},{...schedule,expectedVersion:1},{...schedule,id:uuid},{...schedule,id:uuid,expectedVersion:-1},{...schedule,expectedVersion:0.5}])assert.throws(()=>validateBackendJob('backend.schedules.save',payload));
  assert.doesNotThrow(()=>validateBackendJob('backend.schedules.save',{...schedule,id:uuid,expectedVersion:2}));
  assert.throws(()=>validateBackendJob('backend.schedules.read',{enabled:true}));
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

test('fictional backend job states, cancellation, retry receipts and schedule versions reset without execution',async()=>{
  const a=createBackendJobsDemo(),b=createBackendJobsDemo();
  const rows=(await a.read()).jobs;
  assert.deepEqual(rows.map(row=>row.status),['queued','running','completed','partial','failed','cancelled']);
  assert.ok(rows.every(row=>!Object.hasOwn(row,'lease_token')));
  const payload={...submit,connectionId:DEMO_BACKEND_CONNECTION_ID};
  const queued=await a.submit(payload);
  assert.equal(queued.status,'queued');
  assert.deepEqual(await a.submit(payload),queued);
  await assert.rejects(a.submit({...payload,input:{profileId:'different'}}),/retry key/);
  const cancelled=await a.cancel({jobId:queued.id,expectedVersion:queued.version});
  assert.equal(cancelled.status,'cancelled');
  await assert.rejects(a.cancel({jobId:queued.id,expectedVersion:queued.version}),/changed/);
  assert.equal((await b.read()).jobs.length,6);
  const saved=await a.saveSchedule({...schedule,connectionId:DEMO_BACKEND_CONNECTION_ID});
  assert.equal(saved.version,1);
  await assert.rejects(a.saveSchedule({...schedule,id:saved.id,connectionId:DEMO_BACKEND_CONNECTION_ID,eventKey:'schedule-update',expectedVersion:2}),/changed/);
  const updated=await a.saveSchedule({...schedule,id:saved.id,connectionId:DEMO_BACKEND_CONNECTION_ID,eventKey:'schedule-update',expectedVersion:1,enabled:false});
  assert.equal(updated.version,2);assert.equal(updated.enabled,false);
  a.reset();assert.deepEqual(await a.read(),await b.read());assert.deepEqual(await a.readSchedules(),await b.readSchedules());
});

test('detached demo service includes isolated backend fixtures and versioned guides describe conditional execution',async()=>{
  const fixtures=createDemoWorkspace('2026-10-26');
  const store=createMemoryStore(fixtures);
  // createDemoWorkspace already returns the complete fictional state shape.
  const demo=createDemoServices(store);
  assert.equal((await demo.backendJobs.read()).jobs.length,6);
  assert.equal(demo.backendJobs.fictional,true);
  assert.ok(instructions.developerVersion>=54);
  assert.equal(instructions.capabilities.backendJobs.hostedDeploymentVerified,false);
  assert.match(readGuide('career-find-jobs').instructions,/configured Node API and running worker/);
});
