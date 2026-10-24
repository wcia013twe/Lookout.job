import {test} from 'node:test';
import assert from 'node:assert/strict';
import {contextResponse} from '../supabase/functions/agent-gateway/context.mjs';
import {createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {refreshAgentContext} from '../mcp/context-cache.mjs';
import {reportBug} from '../supabase/functions/agent-gateway/bug-report.mjs';
const request=(method,params={})=>new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+'a'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
const payload={title:'Fictional settings panel failure',description:'Attempted: Opened fictional settings.\nHappened: Panel stayed closed.\nExpected: Panel opens.'};
test('existing client refresh discovers the shared repair contract without changing personal context',async()=>{
 const version=contextResponse('context.versions',{personalVersion:12});
 assert.ok(version.developerVersion>56);
 const calls=[];
 const call=async operation=>{calls.push(operation);return contextResponse(operation,{personalVersion:12});};
 const result=await refreshAgentContext({call,cache:{connectionKey:'a',personalVersion:12,developerVersion:56},connectionKey:'a'});
 assert.deepEqual(calls,['context.versions','context.developer']);
 assert.equal(result.updates.developer.repairWorkflow.worker,'triple t');
 assert.equal(result.updates.developer.repairWorkflow.fixDelivery,'linked-draft-pull-request');
 assert.equal(result.updates.developer.repairWorkflow.pushUpdates,false);
 assert.equal(result.updates.personal,undefined);
 assert.match(result.updates.developer.instructions.join('\n'),/refresh tools\/list/);
 calls.length=0;
 assert.deepEqual((await refreshAgentContext({call,cache:result.cache,connectionKey:'a'})).updates,{});
 assert.deepEqual(calls,['context.versions']);
});
test('shared MCP guidance is discoverable without granting owner-only reporting permission',async()=>{
 for(const scopes of [['workspace:read'],['workspace:read','activity:write']]){
  let githubReads=0;
  const handle=createHandler(async(_token,operation,args)=>{
   if(operation==='credentials.verify')return {status:200,data:{scopes}};
   if(operation.startsWith('context.'))return {status:200,data:contextResponse(operation,{personalVersion:12})};
   if(operation==='bugs.report')return reportBug({payload:args,authorize:async()=>({status:200,data:{id:'other-connection',scopes}}),connectionId:'owner-connection',token:'synthetic',fetchImpl:async()=>{githubReads++;assert.fail('Unauthorized GitHub access');}});
   assert.fail(operation);
  });
  const invoke=async(method,params)=>(await (await handle(request(method,params))).json()).result;
  const init=await invoke('initialize',{protocolVersion:'2025-11-25'});
  assert.match(init.instructions,/repairWorkflow/);
  assert.match(init.instructions,/refresh tools\/list/);
  assert.deepEqual(init.capabilities,{tools:{}});
  const discovery=await invoke('tools/list');
  assert.ok(discovery.tools.some(t=>t.name==='read_developer_context'));
  assert.equal(discovery.tools.some(t=>t.name==='report_bug'),scopes.includes('activity:write'));
  const context=JSON.parse((await invoke('tools/call',{name:'read_developer_context',arguments:{}})).content[0].text);
  assert.equal(context.repairWorkflow.reportPermission,'owner-configured-connection-with-activity:write');
  const report=await invoke('tools/call',{name:'report_bug',arguments:payload});
  assert.equal(report.isError,true);
  assert.match(report.content[0].text,scopes.includes('activity:write')?/403/:/Missing required scope/);
  assert.equal(githubReads,0);
 }
});
