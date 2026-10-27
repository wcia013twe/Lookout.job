import test from 'node:test';
import {databaseFailure} from '../supabase/functions/agent-gateway/request-errors.mjs';
import assert from 'node:assert/strict';
import {WORK_EXPERIENCE_TOOL,validateWorkExperience} from '../supabase/functions/agent-gateway/work-experience.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {createDispatch} from '../backend/runtime/service.ts';
import {createBackend} from '../backend/client.mjs';
import {createMemoryStore,demoFixtures,createDemoServices} from '../next-app/lib/demo.mjs';
const token='jb_agent_'+'a'.repeat(64),stamp='2026-01-01T00:00:00.000Z';
const payload={action:'add',expectedUpdatedAt:stamp,fields:{company:'Fictional Co',title:'Intern'}};
const req=(method,params)=>new Request('http://localhost/mcp',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
test('work-history MCP validates exact entry edits and rejects whole arrays, ownership and consent claims',()=>{
 assert.doesNotThrow(()=>validateRequest({operation:WORK_EXPERIENCE_TOOL.operation,payload}));
 for(const extra of [{fields:{verified:true}},{fields:{current:'yes'}},{fields:{title:null}},{fields:{}},{fields:{title:'x'.repeat(20001)}},{fields:{current:false}},{entryIndex:0},{expectedUpdatedAt:null},{expectedUpdatedAt:'invalid'},{userId:'someone'},{workExperience:[]},{action:'replace'}])assert.throws(()=>validateWorkExperience({...payload,...extra}));
 assert.doesNotThrow(()=>validateWorkExperience({...payload,action:'update',entryIndex:0,fields:{description:'',current:false}}));
 assert.doesNotThrow(()=>validateWorkExperience({action:'remove',entryIndex:0,expectedUpdatedAt:stamp}));
 for(const bad of [{...payload,action:'update'},{...payload,action:'remove',entryIndex:0},{...payload,action:'update',entryIndex:-1},{...payload,action:'update',entryIndex:50}])assert.throws(()=>validateWorkExperience(bad));
});
test('MCP scope discovery and calls require profile write; malformed edits never reach Edge',async()=>{
 for(const scopes of [['workspace:read'],['profile:write']]) {
  const calls=[];const handler=createHandler(async(_token,operation,p)=>{calls.push(operation);return {status:200,data:operation==='credentials.verify'?{scopes}:{facts:{workExperience:[p.fields]}}};});
  const list=await (await handler(req('tools/list',{}))).json();
  assert.equal(list.result.tools.some(t=>t.name==='edit_work_experience'),scopes.includes('profile:write'));
  const result=await (await handler(req('tools/call',{name:'edit_work_experience',arguments:payload}))).json();
  if(scopes.includes('profile:write')) {assert.ok(!result.result.isError);assert.equal(calls.at(-1),WORK_EXPERIENCE_TOOL.operation);}
  else {assert.equal(result.result.isError,true);assert.ok(calls.every(op=>op==='credentials.verify'));}
  const before=calls.length;await handler(req('tools/call',{name:'edit_work_experience',arguments:{...payload,fields:{approved:true}}}));
  assert.deepEqual(calls.slice(before),['credentials.verify']);
 }
});
test('Node MCP remains the access point and forwards lightweight entry edits to Edge without a job',async()=>{
 const calls=[],rpc=[];
 const dispatch=createDispatch({rpc:async(name,args)=>{rpc.push({name,args});return {data:{scopes:['profile:write']}};},supabaseUrl:'http://127.0.0.1:54321',request:async(url,options)=>{calls.push({url:url.href,body:JSON.parse(options.body)});return Response.json({data:{facts:{workExperience:[payload.fields]},updated_at:stamp}});}});
 const handler=createHandler(dispatch);
 const result=await (await handler(req('tools/call',{name:'edit_work_experience',arguments:payload}))).json();
 assert.ok(!result.result.isError);assert.equal(calls.length,1);assert.equal(calls[0].url,'http://127.0.0.1:54321/functions/v1/agent-gateway');assert.deepEqual(calls[0].body,{operation:WORK_EXPERIENCE_TOOL.operation,payload});assert.ok(rpc.every(c=>c.args.operation==='credentials.verify'));
});
test('browser adapter sends the same payload to the owner-fenced shared RPC and rejects account switches',async()=>{
 let owner='fictional-owner';const calls=[];
 const backend=createBackend({auth:{getUser:async()=>({data:{user:{id:owner}}})},rpc:async(name,args)=>{calls.push({name,args});return {data:{facts:{workExperience:[payload.fields]}}};}},owner);
 await backend.editWorkExperience(payload);assert.deepEqual(calls,[{name:'edit_work_experience',args:{payload,expected_owner:'fictional-owner'}}]);
 owner='different-owner';await assert.rejects(backend.editWorkExperience(payload),/Account changed/);assert.equal(calls.length,1);
});
test('detached demo preserves history and unrelated facts, rejects stale edits, resets and performs no account writes',async()=>{
 const fixture=demoFixtures('2026-10-26'),store=createMemoryStore(fixture.state),services=createDemoServices(store);
 const before=store.get('workflow.profile'),count=before.workExperience.length;
 const added=await services.editWorkExperience(payload);assert.equal(added.facts.workExperience.length,count+1);assert.deepEqual(added.facts.workExperience.slice(0,count),before.workExperience);assert.deepEqual(added.facts.education,before.education);assert.equal(added.facts.verified,false);
 await assert.rejects(services.editWorkExperience(payload),/changed/);
 const updated=await services.editWorkExperience({action:'update',entryIndex:count,fields:{title:'Backend Intern'},expectedUpdatedAt:added.updated_at});assert.equal(updated.facts.workExperience[count].company,'Fictional Co');
 const removed=await services.editWorkExperience({action:'remove',entryIndex:count,expectedUpdatedAt:updated.updated_at});assert.deepEqual(removed.facts.workExperience,before.workExperience);
 assert.deepEqual(demoFixtures('2026-10-26').state.workflow.profile,before);
});

test('explicit stale-profile conflicts map to HTTP 409 without a retryable serialization code',()=>{assert.equal(databaseFailure({code:'PT409'})[0],409);});
