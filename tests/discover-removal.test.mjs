import test from 'node:test';
import assert from 'node:assert/strict';
import {TOOLS,createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';

test('Discover removal is scoped and rejects extra or missing arguments',async()=>{
 const tool=TOOLS.find(t=>t.name==='remove_discover_job');
 assert.equal(tool.scope,'activity:write');
 const payload={batchId:'11111111-1111-1111-1111-111111111111',jobId:'fictional-role'};
 assert.doesNotThrow(()=>validateRequest({operation:'batches.item.dismiss',payload}));
 assert.throws(()=>validateRequest({operation:'batches.item.dismiss',payload:{...payload,userId:'other'}}));
 assert.throws(()=>validateRequest({operation:'batches.item.dismiss',payload:{batchId:payload.batchId}}));
 const calls=[];
 const handler=createHandler(async(_token,operation,args)=>{
  if(operation==='credentials.verify')return {status:200,data:{scopes:['activity:write']}};
  validateRequest({operation,payload:args});calls.push([operation,args]);return {status:200,data:{dismissedAt:'2026-11-07T00:00:00Z'}};
 });
 const response=await handler(new Request('http://local/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+ 'a'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'remove_discover_job',arguments:payload}})}));
 const result=await response.json();assert.ok(result.result&&!result.result.isError,JSON.stringify(result));assert.deepEqual(calls,[[ 'batches.item.dismiss',payload ]]);
});
