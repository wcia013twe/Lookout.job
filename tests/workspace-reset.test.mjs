import test from 'node:test';
import assert from 'node:assert/strict';
import {createResetHandler} from '../supabase/functions/workspace-reset/handler.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {RESET_HANDOFF_TOOL} from '../supabase/functions/agent-gateway/workspace-reset.mjs';
import {TOOLS,createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {createBackend} from '../backend/client.mjs';
const uid='11111111-1111-4111-8111-111111111111',rid='22222222-2222-4222-8222-222222222222';
function fixture({storageError=false,finishError=false,completed=false,files=[{bucket:'resumes',name:uid+'/file.pdf'}]}={}){
 const calls=[];
 const admin={auth:{getUser:async token=>({data:{user:token==='person'?{id:uid}:null}})},rpc:async(name,args)=>{
  calls.push([name,args]);
  assert.equal(args.owner_id,uid);
  if(args.operation==='finish'&&finishError)return{error:{code:'55000'}};
  return{data:{state:args.operation==='finish'||completed?'completed':'pending',resetId:rid,files,personalVersion:2,counts:{profiles:1}}};
 },storage:{from(bucket){return{remove:async names=>{calls.push(['storage',bucket,names]);return{error:storageError?Error('offline'):null};}};}}};
 const call=async(body,token='person')=>createResetHandler(admin)(new Request('https://example.com',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify(body)}));
 return{call,calls};
}
const reset={action:'reset',resetId:rid,confirmation:'RESET MY WORKSPACE',expectedPersonalVersion:2};
test('reset endpoint rejects agents, ownership injection, malformed confirmation and oversized streaming bodies',async()=>{
 const f=fixture();for(const token of ['jb_agent_'+'a'.repeat(64),'invalid'])assert.equal((await f.call(reset,token)).status,401);
 for(const body of [{...reset,owner_id:uid},{...reset,confirmation:'yes'},{...reset,expectedPersonalVersion:0},{action:'preview',resetId:rid}])assert.equal((await f.call(body)).status,400);
 assert.equal((await f.call({...reset,confirmation:'x'.repeat(5000)})).status,413);assert.equal(f.calls.length,0);
});
test('preview is read-only and reset deletes owned Storage files before database finalization',async()=>{
 const f=fixture();assert.equal((await f.call({action:'preview'})).status,200);assert.equal(f.calls[0][1].operation,'preview');assert.equal(f.calls.length,1);
 f.calls.length=0;const response=await f.call(reset);assert.equal(response.status,200);
 assert.deepEqual(f.calls.map(c=>c[0]==='storage'?'storage':c[1].operation),['begin','storage','finish']);
 assert.deepEqual(f.calls[1],['storage','resumes',[uid+'/file.pdf']]);
});
test('partial storage and database failures never claim success; completed replay never deletes again',async()=>{
 const f=fixture({storageError:true});const response=await f.call(reset);assert.equal(response.status,503);assert.equal((await response.json()).state,'pending');assert.equal(f.calls.some(c=>c[1]?.operation==='finish'),false);
 assert.equal((await fixture({finishError:true}).call(reset)).status,503);
 const replay=fixture({completed:true});assert.equal((await replay.call(reset)).status,200);assert.equal(replay.calls.length,1);
 const injection=fixture({files:[{bucket:'resumes',name:'other/file.pdf'}]});assert.equal((await injection.call(reset)).status,503);assert.equal(injection.calls.length,1);
});
test('browser reset adapter checks account identity before and after the human-only request',async()=>{
 let owner=uid;const calls=[];
 const backend=createBackend({auth:{getUser:async()=>({data:{user:{id:owner}}})},functions:{invoke:async(name,args)=>{calls.push([name,args]);owner='other';return{data:{data:{state:'completed'}}};}}},uid);
 await assert.rejects(backend.resetWorkspace(reset),/Account changed/);assert.equal(calls[0][0],'workspace-reset');assert.equal(calls[0][1].body.owner_id,undefined);
});
test('MCP offers only the scoped human handoff, never reset execution or agent confirmation',async()=>{
 assert.equal(TOOLS.filter(t=>t.operation.startsWith('workspace.reset')).length,1);assert.equal(RESET_HANDOFF_TOOL.scope,'workspace:read');
 assert.doesNotThrow(()=>validateRequest({operation:RESET_HANDOFF_TOOL.operation,payload:{}}));
 assert.throws(()=>validateRequest({operation:RESET_HANDOFF_TOOL.operation,payload:{confirmation:'RESET MY WORKSPACE'}}));
 assert.throws(()=>validateRequest({operation:'workspace.reset',payload:{}}));
 const calls=[];const handler=createHandler(async(_token,op,payload)=>{calls.push({op,payload});return{status:200,data:op==='credentials.verify'?{scopes:['workspace:read']}:{humanActionRequired:true}};});
 const response=await handler(new Request('https://example.com',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+'a'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:RESET_HANDOFF_TOOL.name,arguments:{}}})}));
 assert.equal(response.status,200);assert.ok(calls.some(c=>c.op===RESET_HANDOFF_TOOL.operation));
});

test('demo reset empties fictional private content without backend or persisted storage and can restore fixtures',async()=>{
 const {createDemoStore}=await import('../next-app/lib/demo-store.mjs');const {previewDemoReset,resetDemoWorkspace}=await import('../next-app/lib/demo-workspace-reset.mjs');
 const initial={demo:{roles:[{id:'fictional'}]},workflow:{applications:{one:{}},resumes:[{}],savedAnswers:[{}],profile:{name:'Demo'},searchPreferences:{old:'data'}},network:{companies:[{}]}};
 const store=createDemoStore(initial);assert.equal(previewDemoReset(store).counts['Fictional applications'],1);assert.throws(()=>resetDemoWorkspace(store,'yes'));resetDemoWorkspace(store,'RESET MY WORKSPACE');
 assert.deepEqual(store.get('workflow.applications'),{});assert.equal(store.get('workflow.profile.name'),'');assert.deepEqual(store.get('network.companies'),[]);assert.deepEqual(store.get('demo'),initial.demo);
 store.reset(initial);assert.deepEqual(store.get(),initial);
});

test('reset-state checks tolerate only the missing migration and reject failures and account switches',async()=>{
 for(const code of ['PGRST202','42883','42501','network']){
  const backend=createBackend({auth:{getUser:async()=>({data:{user:{id:uid}}})},rpc:async()=>({error:{code}})},uid);
  if(['PGRST202','42883'].includes(code))assert.deepEqual(await backend.readResetState(),{});else await assert.rejects(backend.readResetState());
 }
});
