import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,TOOLS,requiredToolScopes,CONDITIONAL_TOOL_SCOPES} from '../supabase/functions/agent-mcp/protocol.mjs';
import {ACCESS_TOOLS,DEFAULT_TOOL_NAMES,WORKFLOWS} from '../supabase/functions/agent-mcp/tool-surface.mjs';
import {enabledMcpOperation} from '../lib/feature-scope.mjs';
import {LOCAL_TOOLS} from '../runner/runtime.mjs';
import {RESUME_PARSE_TOOL} from '../lib/resume-import.mjs';
import {SUBMISSION_TOOLS} from '../supabase/functions/agent-gateway/submission-batches.mjs';
import {createDemoWorkspace,createDemoServices} from '../next-app/lib/muse-demo-fixtures.mjs';
import {bootstrapInstructions} from '../supabase/functions/agent-gateway/operating-guide.mjs';
import contract from '../supabase/functions/agent-gateway/instructions.json' with {type:'json'};
const active=TOOLS.filter(tool=>enabledMcpOperation(tool.operation));
const allScopes=[...new Set([...TOOLS,...LOCAL_TOOLS,RESUME_PARSE_TOOL].flatMap(tool=>requiredToolScopes(tool)))];
const request=(method,params,token='jb_agent_'+'a'.repeat(64))=>new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
const harness=(scopes=allScopes,extra=[],reply={status:200,data:{ok:true}})=>{
 const calls=[];
 const handler=createHandler(async(_token,operation,payload)=>{calls.push({operation,payload});return operation==='credentials.verify'?{status:200,data:{scopes}}:reply;},[],extra);
 const send=async(method,params)=>(await handler(request(method,params))).json();
 const call=(name,args={})=>send('tools/call',{name,arguments:args});
 const discover=async(workflow='all',name)=>JSON.parse((await call('discover_tools',{workflow,...(name===undefined?{}:{name})})).result.content[0].text).tools;
 return {handler,calls,send,call,discover};
};
test('initial catalog and gated counts match hosted, Node and stdio plans',async()=>{
 for(const [extras,exposed,gated] of [[[],47,74],[[RESUME_PARSE_TOOL,...SUBMISSION_TOOLS],50,74],[LOCAL_TOOLS,50,84]]){
  const h=harness(allScopes,extras),listed=(await h.send('tools/list')).result.tools,discovered=await h.discover();
  assert.equal(listed.length,exposed);assert.equal(discovered.filter(tool=>tool.gated).length,gated);
  assert.equal(discovered.length,active.length+extras.length);
  assert.equal(new Set(listed.map(t=>t.name)).size,listed.length);
  for(const tool of discovered){
   assert.equal(listed.some(t=>t.name===tool.name),!tool.gated,tool.name);
   assert.deepEqual(tool.inputSchema,JSON.parse(JSON.stringify([...TOOLS,...extras].find(t=>t.name===tool.name).inputSchema)));
  }
  assert(h.calls.every(c=>c.operation==='credentials.verify'),'Discovery never starts work');
 }
});
test('logs, outcome reports and bugs remain named; toolkit and manual components are gated',async()=>{
 const h=harness(),names=(await h.send('tools/list')).result.tools.map(t=>t.name);
 for(const name of ['start_agent_audit_run','append_agent_audit_events','read_agent_audit_run','append_activity','record_search_progress','report_agent_task_result','report_application_failure','report_submission_result','report_bug','get_bug_status'])assert(names.includes(name),name);
 for(const name of ['prepare_draft','start_search_run','claim_agent_task','read_toolkit_context','read_artifact','read_preparation_plan'])assert(!names.includes(name),name);
 const dispatch=(await h.send('tools/list')).result.tools.find(t=>t.name==='call_discovered_tool');
 assert.deepEqual(dispatch.annotations,{readOnlyHint:false,destructiveHint:true,openWorldHint:true});
 assert.equal(DEFAULT_TOOL_NAMES.size,49);
});
test('workflow groups cover the catalog once and exact-name lookup includes core and runtime tools',async()=>{
 const h=harness(allScopes,LOCAL_TOOLS),seen=[];
 for(const workflow of WORKFLOWS.filter(w=>w!=='all')){
  const tools=await h.discover(workflow);assert(tools.every(tool=>tool.workflow===workflow));seen.push(...tools.map(t=>t.name));
 }
 assert.equal(new Set(seen).size,seen.length);
 assert.deepEqual(seen.sort(),(await h.discover()).map(t=>t.name).sort());
 for(const name of ['read_toolkit_context','submit_search_leads','inspect_application'])assert.equal((await h.discover('all',name))[0].name,name);
 assert.deepEqual(await h.discover('profile','inspect_application'),[]);
 assert.deepEqual(await harness().discover('all','inspect_application'),[]);
 assert.deepEqual(await h.discover('all','not_registered'),[]);
});
test('scope filtering cannot be bypassed by discovery or dispatch, including secondary and conditional scopes',async()=>{
 for(const tool of active)for(const missing of requiredToolScopes(tool)){
  const h=harness(allScopes.filter(scope=>scope!==missing));
  assert.deepEqual(await h.discover('all',tool.name),[],tool.name);
  const response=await h.call('call_discovered_tool',{name:tool.name,arguments:{}});
  assert.equal(response.result.isError,true,tool.name);assert.match(response.result.content[0].text,/Missing required scope/);
  assert(h.calls.every(c=>c.operation==='credentials.verify'));
 }
 for(const [operation,rules] of Object.entries(CONDITIONAL_TOOL_SCOPES))for(const rule of rules){
  const tool=active.find(t=>t.operation===operation);if(!tool)continue;
  const h=harness(allScopes.filter(scope=>!rule.scopes.includes(scope)));
  const response=await h.call('call_discovered_tool',{name:tool.name,arguments:{[rule.field]:rule.value}});
  assert.equal(response.result.isError,true);assert(h.calls.every(c=>c.operation==='credentials.verify'));
 }
 assert.deepEqual(await harness([]).discover(),[]);
});
test('dispatch preserves direct-call validation/results and never accepts operation strings or recursion',async()=>{
 const h=harness();
 for(const tool of active){
  assert.deepEqual(await h.call('call_discovered_tool',{name:tool.name,arguments:{}}),await h.call(tool.name,{}),tool.name);
 }
 for(const name of ['search.run.start','call_discovered_tool','discover_tools','not_registered']){
  assert.equal((await h.call('call_discovered_tool',{name,arguments:{}})).error.code,-32602);
 }
 for(const tool of TOOLS.filter(t=>!enabledMcpOperation(t.operation))){
  assert.deepEqual(await h.discover('all',tool.name),[]);
  assert.equal((await h.call('call_discovered_tool',{name:tool.name,arguments:{}})).error.code,-32602);
 }
 const invalids=[['discover_tools',{workflow:'bad'}],['discover_tools',{workflow:'all',userId:'other'}],['discover_tools',{workflow:'all',name:''}],['call_discovered_tool',{name:'read_user_brief',arguments:[]}],['call_discovered_tool',{name:'read_user_brief'}],['call_discovered_tool',{name:'read_personal_context',arguments:{userId:'other'}}]];
 for(const [name,args] of invalids)assert.equal((await h.call(name,args)).error.code,-32602);
 const scopes=harness(allScopes,[{name:'paused_local_extra',operation:'knowledge.read',scope:'workspace:read',inputSchema:{type:'object',properties:{}}}]);
 assert.deepEqual(await scopes.discover('all','paused_local_extra'),[]);
 assert.equal((await scopes.call('call_discovered_tool',{name:'paused_local_extra',arguments:{}})).error.code,-32602);
 const unauth=await h.handler(request('tools/call',{name:'discover_tools',arguments:{workflow:'all'}},'invalid'));
 assert.equal(unauth.status,401);
});
test('generic calls preserve nested validators and backend conflict semantics',async()=>{
 const h=harness(allScopes,[],{status:409,error:'Draft changed'});
 const args={jobId:'job',expectedRevision:2,draft:{}};
 const result=await h.call('call_discovered_tool',{name:'prepare_draft',arguments:args});
 assert.equal(result.result.isError,true);assert.equal(JSON.parse(result.result.content[0].text).status,409);
 assert.deepEqual(h.calls.at(-1),{operation:'drafts.prepare',payload:args});
 const calls=h.calls.length;
 assert.equal((await h.call('call_discovered_tool',{name:'save_profile_package',arguments:{eventKey:'test',expectedPersonalVersion:1,facts:{verified:true}}})).error.code,-32602);
 assert.equal(h.calls.length,calls+1,'Only credential verification runs for malformed facts');
});
test('fictional admin demo edits profile, discovers and reads a gated brief, rejects stale writes and resets',async()=>{
 const state=createDemoWorkspace('2026-11-06T12:00:00Z');
 const store={get(path){return path.split('.').reduce((value,key)=>value?.[key],state);},set(path,value){const keys=path.split('.'),last=keys.pop();keys.reduce((value,key)=>value[key]??={},state)[last]=value;}};
 const demo=createDemoServices(store),handler=createHandler(demo.mcpDemoForward,[]);
 const send=async(name,args)=>JSON.parse((await (await handler(request('tools/call',{name,arguments:args}))).json()).result.content[0].text);
 const patch={expectedUpdatedAt:state.demo.createdAt,fields:{headline:'Fictional MCP systems builder'}};
 const saved=await send('update_profile_fields',patch);assert.equal(saved.facts.headline,patch.fields.headline);
 const discovered=await send('discover_tools',{workflow:'all',name:'read_user_brief'});assert.equal(discovered.tools[0].gated,true);
 const brief=await send('call_discovered_tool',{name:'read_user_brief',arguments:{}});assert.equal(brief.fictional,true);assert.match(brief.items[0].summary,/Fictional MCP/);
 const stale=await send('call_discovered_tool',{name:'update_profile_fields',arguments:patch});assert.equal(stale.status,409);
 assert.notEqual(createDemoWorkspace('2026-11-06T12:00:00Z').workflow.profile.headline,patch.fields.headline);
});
test('startup explains executable discovery and preserves the small permanent contract',()=>{
 assert.match(bootstrapInstructions,/discover_tools/);assert.match(bootstrapInstructions,/call_discovered_tool/);
 assert.equal(contract.developerVersion,112);
 assert(Buffer.byteLength(JSON.stringify(contract))+Buffer.byteLength(bootstrapInstructions)<=6000);
 assert.equal(ACCESS_TOOLS.length,2);
});
