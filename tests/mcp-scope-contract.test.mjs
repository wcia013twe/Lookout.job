import test from 'node:test';
import assert from 'node:assert/strict';
import {TOOLS,createHandler,requiredToolScopes,CONDITIONAL_TOOL_SCOPES} from '../supabase/functions/agent-mcp/protocol.mjs';
const token='jb_agent_'+'a'.repeat(64);
const allScopes=[...new Set(TOOLS.flatMap(tool=>requiredToolScopes(tool)))];
const request=(method,params)=>new Request('http://localhost/mcp',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
const harness=scopes=>{
  const calls=[];
  const handler=createHandler(async(_token,operation,payload)=>{calls.push({operation,payload});return {status:200,data:operation==='credentials.verify'?{scopes}:{ok:true}};});
  return {calls,call:async(method,params)=>(await handler(request(method,params))).json()};
};

test('every mandatory secondary scope filters discovery and denies calls before product forwarding',async()=>{
  const scoped=TOOLS.filter(tool=>tool.requiredScopes?.length);
  assert.ok(scoped.length>=33); // 30 audited paths plus three backend writes.
  for(const tool of scoped)for(const missing of tool.requiredScopes) {
    const scopes=allScopes.filter(scope=>scope!==missing),h=harness(scopes);
    const listing=await h.call('tools/list',{});
    assert.ok(!listing.result.tools.some(item=>item.name===tool.name),tool.name+': '+missing);
    const response=await h.call('tools/call',{name:tool.name,arguments:{}});
    assert.equal(response.result.isError,true,tool.name+': '+missing);
    assert.ok(response.result.content[0].text.includes(missing));
    assert.ok(h.calls.every(call=>call.operation==='credentials.verify'));
  }
});

test('payload conditional toolkit scopes deny exact writes without over-restricting optional paths',async()=>{
  const record=TOOLS.find(tool=>tool.operation==='toolkit.record');
  assert.deepEqual(requiredToolScopes(record),['drafts:write','workspace:read']);
  assert.deepEqual(CONDITIONAL_TOOL_SCOPES['toolkit.record'],[{field:'kind',value:'source_config',scopes:['preferences:write']}]);
  const source={kind:'source_config',eventKey:'config-1',result:{targetId:'saved-target',provider:'greenhouse',options:{keywords:'backend'}}};
  const limited=harness(['workspace:read','drafts:write']);
  assert.equal((await limited.call('tools/call',{name:'record_toolkit_result',arguments:source})).result.isError,true);
  assert.ok(limited.calls.every(call=>call.operation==='credentials.verify'));
  const authorized=harness(['workspace:read','drafts:write','preferences:write']);
  assert.notEqual((await authorized.call('tools/call',{name:'record_toolkit_result',arguments:source})).result.isError,true);
  assert.equal(authorized.calls.at(-1).operation,'toolkit.record');
  const metadata={kind:'resume',eventKey:'resume-1',fileName:'example.pdf',sha256:'a'.repeat(64),bytes:100};
  const resume=harness(['workspace:read','drafts:write']);
  assert.equal((await resume.call('tools/call',{name:'begin_career_document_upload',arguments:metadata})).result.isError,true);
  assert.ok(resume.calls.every(call=>call.operation==='credentials.verify'));
  assert.notEqual((await resume.call('tools/call',{name:'begin_career_document_upload',arguments:{...metadata,kind:'cover_letter'}})).result.isError,true);
  const full=harness(['workspace:read','drafts:write','profile:write']);
  assert.notEqual((await full.call('tools/call',{name:'begin_career_document_upload',arguments:metadata})).result.isError,true);
  // Kind is hidden behind fileId/taskId here. SQL checks the owned row, rather
  // than blocking all cover-letter completion or all non-preparation task claims.
  assert.ok(!requiredToolScopes(TOOLS.find(tool=>tool.operation==='toolkit.file.complete')).includes('profile:write'));
  assert.ok(!requiredToolScopes(TOOLS.find(tool=>tool.operation==='tasks.claim')).includes('drafts:write'));
});

test('malformed empty schemas and strict nested payloads produce safe MCP argument errors',async()=>{
  const h=harness(allScopes);
  const bad=[
    {name:'read_learning_goals',arguments:{unexpected:'value'}},
    {name:'save_profile_package',arguments:{eventKey:'profile-1',expectedPersonalVersion:1,facts:{verified:true}}},
    {name:'save_search_document',arguments:{kind:'profile',id:'general',content:'invalid frontmatter',expectedVersion:0,eventKey:'document-1'}},
    {name:'begin_career_document_upload',arguments:{kind:'resume',eventKey:'file',fileName:'../secret.pdf',sha256:'a'.repeat(64),bytes:100}},
  ];
  for(const payload of bad) {
    const response=await h.call('tools/call',payload);
    assert.equal(response.error.code,-32602,payload.name);
  }
  assert.ok(h.calls.every(call=>call.operation==='credentials.verify'));
  assert.notEqual((await h.call('tools/call',{name:'read_learning_goals',arguments:{}})).result.isError,true);
});

test('onboarding reads disclose initialization and lease maintenance instead of readOnly hints',async()=>{
  const h=harness(['workspace:read']);
  const {result}=await h.call('tools/list',{});
  for(const name of ['read_onboarding_state','read_agent_tasks']) {
    const tool=result.tools.find(tool=>tool.name===name);
    assert.equal(tool.annotations.readOnlyHint,false,name);
    assert.match(tool.description,/expired|leases/);
  }
  assert.equal(result.tools.find(tool=>tool.name==='read_learning_goals').annotations.readOnlyHint,true);
});
