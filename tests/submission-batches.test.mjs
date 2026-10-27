import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSubmissionBatch,SUBMISSION_TOOLS} from '../supabase/functions/agent-gateway/submission-batches.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {submissionAttemptId} from '../lib/submission-batches.mjs';
import {createSubmissionService} from '../backend/runtime/submission.ts';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const good={eventKey:'fixture-batch',applications:[{applicationId:id,expectedRevision:0}]};
test('batch input is bounded, pins revisions and rejects identity/outcome injection',()=>{
 assert.doesNotThrow(()=>validateSubmissionBatch(good));
 assert.doesNotThrow(()=>validateRequest({operation:"submission.batch.begin",payload:good}));
 assert.doesNotThrow(()=>validateRequest({operation:"submission.batch.read",payload:{}}));
 for(const payload of [{...good,owner:'other'},{...good,applications:[]},{...good,eventKey:'bad\nkey'},{...good,applications:[...good.applications,...good.applications]},{...good,applications:[{applicationId:id,expectedRevision:0,approved:true}]},{...good,applications:Array(11).fill(good.applications[0])},{...good,applications:[{applicationId:id,expectedRevision:-1}]}])assert.throws(()=>validateSubmissionBatch(payload));
 assert.throws(()=>validateRequest({operation:'submission.batch.checkpoint',payload:{batchId:id,applicationId:id,leaseToken:id,expectedVersion:1,status:'Submitted'}}));
 assert.equal(submissionAttemptId(id,id),submissionAttemptId(id,id.toUpperCase()));
 for(const tool of SUBMISSION_TOOLS)assert.deepEqual(tool.requiredScopes,['workspace:read','approvals:read','resumes:read']);
});
test('Node submission service checks scopes and bounds concurrency before allocating browsers',async()=>{
 let created=0,closed=0;const pending=[];
 const service=createSubmissionService({projectUrl:'https://example.supabase.co',dispatch:async token=>({status:200,data:{scopes:token==='denied'?['workspace:read']:['workspace:read','drafts:write','approvals:read','resumes:read']}}),browserFactory:()=>{created++;return {getPage:async()=>{},close:async()=>{closed++;}};},gatewayFactory:()=>({call:async()=>new Promise(resolve=>pending.push(resolve))})});
 assert.equal((await service('denied','local.submit',{})).status,403);assert.equal(created,0);
 const a=service('one','local.submit',{}),b=service('two','local.submit',{});await Promise.resolve();await Promise.resolve();
 assert.equal((await service('three','local.submit',{})).status,429);
 pending.splice(0).forEach(resolve=>resolve({scopes:[]}));await Promise.all([a,b]);assert.equal(created,2);assert.equal(closed,2);
});

test('fictional batch outcomes are isolated, resettable and contain no execution authority',async()=>{
 const {readDemoSubmissionBatches}=await import('../lib/submission-batches-demo.mjs');
 const first=readDemoSubmissionBatches();assert.deepEqual(first.batches.map(b=>b.status),['completed','partial','running']);
 first.batches[0].status='changed';assert.equal(readDemoSubmissionBatches().batches[0].status,'completed');
 assert(!JSON.stringify(first).includes('lease_token'));assert(first.batches.every(b=>b.fictional));
});

test('submission discovery truthfully marks external side effects and keeps all required scopes',async()=>{
 const {createHandler}=await import('../supabase/functions/agent-mcp/protocol.mjs');
 const handler=createHandler(async()=>({status:200,data:{scopes:['workspace:read','drafts:write','resumes:read','approvals:read']}}),[],SUBMISSION_TOOLS);
 const response=await handler(new Request('http://localhost/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+'a'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})}));
 const tools=(await response.json()).result.tools;
 for(const name of ['submit_application','submit_application_batch']){
  const tool=tools.find(tool=>tool.name===name);assert(tool);assert.equal(tool.annotations.destructiveHint,true);assert.equal(tool.annotations.openWorldHint,true);assert.equal(tool.annotations.readOnlyHint,false);
 }
});
