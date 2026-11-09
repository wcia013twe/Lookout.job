import {test} from 'node:test';
import assert from 'node:assert/strict';
import {guideIndex, readGuide, guideDispatch} from '../supabase/functions/agent-gateway/guides.mjs';
import {contextResponse} from '../supabase/functions/agent-gateway/context.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
test('context advertises small versioned index; guide reads are isolated',()=>{
 const index=contextResponse('context.developer',{}).guides;
 assert.deepEqual(index,guideIndex());assert.ok(index.length > 2);assert.ok(index.some(g=>g.id==='workspace-maintenance'));
 assert.ok(index.every(g=>g.version>0&&!Object.hasOwn(g,'instructions')));
 const guide=readGuide('resume-parse');assert.match(guide.instructions,/unverified/);assert.ok(guide.expectedOutput);
 guide.instructions='mutated';assert.notEqual(readGuide('resume-parse').instructions,'mutated');
 assert.equal(readGuide('../../secret'),null);
 validateRequest({operation:'guides.read',payload:{id:'resume-parse'}});
 for(const payload of [{},{id:'../secret'},{id:'resume-parse',url:'https://example.com'}])assert.throws(()=>validateRequest({operation:'guides.read',payload}));
});
test('guide reads fail closed through existing context authorization',async()=>{
 for(const code of ['28000','42501']) assert.deepEqual(await guideDispatch('resume-parse',async()=>({error:{code}})),{error:{code}});
 const authorize=async(op,args)=>{assert.equal(op,'context.developer');assert.deepEqual(args,{});return {data:{}};};
 assert.equal((await guideDispatch('cold-outreach',authorize)).data.id,'cold-outreach');
 assert.equal((await guideDispatch('missing',authorize)).error.code,'P0002');
});

test('default outreach skill delivers all starter templates and protects cached reads', async () => {
 const guide = (await guideDispatch('cold-outreach', async () => ({data:{}}))).data;
 assert.equal(guide.defaultGuide, 'cold-outreach');
 assert.equal(guide.version, guideIndex().find(row => row.id === 'cold-outreach').version);
 assert.deepEqual(guide.templates.map(row => row.id), ['recruiter-interview','warm-referral','shared-background','technical-leader','follow-up']);
 assert.match(guide.instructions, /default for customizing all outreach templates/);
 assert.match(guide.instructions, /Follow-ups require an actual sent message/);
 for (const template of guide.templates) {
  assert.ok(template.whenToUse && template.requiredEvidence.length && template.subject && template.message);
 }
 guide.templates[0].message = 'Edited by caller';
 guide.templates[0].requiredEvidence.length = 0;
 assert.notEqual(readGuide('cold-outreach').templates[0].message, 'Edited by caller');
 assert.ok(readGuide('cold-outreach').templates[0].requiredEvidence.length);
 const {default: canonical} = await import('../supabase/functions/agent-gateway/skills/outreach-templates.json', {with:{type:'json'}});
 assert.deepEqual(readGuide('cold-outreach').templates, canonical.templates);
});

test('startup and developer context deliver the same user-facing policy and versioned workflow guidance',async()=>{
 const {createHandler}=await import('../supabase/functions/agent-mcp/protocol.mjs');
 const context=contextResponse('context.developer',{}),policy=context.instructions[0];
 const handle=createHandler(async()=>({status:200,data:{scopes:['workspace:read']}}));
 const response=await handle(new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+'a'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25'}})}));
 const initialized=(await response.json()).result;
 assert(initialized.instructions.startsWith(policy));
 assert.match(policy,/user-facing/);assert.match(policy,/explicit troubleshooting request/);
 assert.equal(context.developerVersion,contextResponse('context.versions',{personalVersion:2}).developerVersion);
 for(const id of ['career-find-jobs','application-workspace']){
  const guide=readGuide(id);assert(!guide.instructions.includes(policy), 'global policy must have one home');
  assert.equal(context.guides.find(g=>g.id===id).version,guide.version);
 }
 assert.match(readGuide('career-find-jobs').instructions,/request_search_sweep[\s\S]*connection_pending/);
 assert(!Object.hasOwn(context,'operatingGuide'));
});

test('one fictional MCP context read returns only core and index without personal reads or setup side effects',async()=>{
 const {createHandler}=await import('../supabase/functions/agent-mcp/protocol.mjs');
 const calls=[];
 const handle=createHandler(async(_token,operation)=>{
  calls.push(operation);
  if(operation==='credentials.verify')return {status:200,data:{scopes:['workspace:read']}};
  assert.equal(operation,'context.developer');
  return {status:200,data:contextResponse(operation,{})};
 });
 const response=await handle(new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+'a'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'read_developer_context',arguments:{}}})}));
 const context=JSON.parse((await response.json()).result.content[0].text);
 assert.deepEqual(Object.keys(context),['developerVersion','instructions','guides']);
 assert(context.guides.some(g=>g.id==='agent-package'));
 assert(!JSON.stringify(context).includes('--test-wake'));
 assert.equal(calls.filter(op=>op==='context.developer').length,1);
 context.instructions[0]='mutated';
 assert.notEqual(contextResponse('context.developer',{}).instructions[0],'mutated');
});


test('material recipes are discoverable without preloading bodies and fail closed with guide authorization',async()=>{
 const {discoverGuides}=await import('../supabase/functions/agent-gateway/guides.mjs');
 const discovery=discoverGuides(),guide=readGuide(discovery.materialGuide.id);
 assert.equal(discovery.materialGuide.version,guide.version);
 assert(guideIndex().some(entry=>entry.id===guide.id&&entry.version===guide.version));
 assert(!JSON.stringify(discovery).includes('htmlTemplate'));
 assert.deepEqual(guide.materialFormats.map(format=>format.kind),['company_research','interview_brief','story_bank','mock_interview','interview_debrief','resource']);
 assert.equal(guide.materialFormats.find(format=>format.kind==='mock_interview').saveWith,'save_mock_interview');
 assert(!/<script|<iframe|<button|<input|<form|@import|url\(/i.test(guide.htmlTemplate));
 for(const format of guide.materialFormats)for(const id of format.skills)assert(readGuide(id),id);
 for(const code of ['28000','42501'])assert.deepEqual(await guideDispatch(guide.id,async()=>({error:{code}})),{error:{code}});
 guide.materialFormats[0].sections.length=0;guide.htmlTemplate='changed';
 assert(readGuide(guide.id).materialFormats[0].sections.length);assert.notEqual(readGuide(guide.id).htmlTemplate,'changed');
});

test('a workspace generator discovers the recipe and saves/reads static HTML through scoped MCP tools',async()=>{
 const {createHandler}=await import('../supabase/functions/agent-mcp/protocol.mjs');
 const {guideDiscoveryDispatch}=await import('../supabase/functions/agent-gateway/guides.mjs');
 const {createArtifactDemo}=await import('../next-app/lib/artifact-demo.mjs');
 const {createMemoryStore}=await import('../next-app/lib/demo.mjs');
 const demo=createArtifactDemo(createMemoryStore({demo:{fictional:true}}));
 let scopes=['workspace:read','drafts:write'];const writes=[];
 const handler=createHandler(async(_token,operation,payload)=>{
  if(operation==='credentials.verify')return {status:200,data:{scopes}};
  if(operation==='guides.discover')return {status:200,...await guideDiscoveryDispatch(async()=>({data:{}}))};
  if(operation==='guides.read')return {status:200,...await guideDispatch(payload.id,async()=>({data:{}}))};
  if(operation==='artifacts.save')writes.push(payload);
  return {status:200,data:await demo.artifactAction(operation,payload)};
 });
 const call=async(name,args={})=>{
  const response=await handler(new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+'a'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})}));
  const result=(await response.json()).result;if(result.isError)return result;return JSON.parse(result.content[0].text);
 };
 const discovery=await call('discover_toolkit');
 const recipe=await call('read_guide',{id:discovery.materialGuide.id});
 const tools=await call('discover_tools',{workflow:'toolkit'});
 assert(tools.tools.some(tool=>tool.name==='save_artifact'));
 const id='cccccccc-1111-4000-8000-111111111111';
 const payload={id,expectedVersion:0,title:'Example role prep',purpose:'A fictional generation evaluation',kind:'interview_brief',format:'html',body:recipe.htmlTemplate.replace('[Material title]','Example role prep'),sources:[{title:'Example resource',url:'https://example.com/resource',observedAt:'2026-11-07'}],links:[]};
 const saved=await call('call_discovered_tool',{name:'save_artifact',arguments:payload});
 const read=await call('call_discovered_tool',{name:'read_artifact',arguments:{id:saved.id}});
 assert.equal(read.content.body,payload.body);assert.deepEqual(read.content.sources,payload.sources);assert(read.path.includes(id));
 scopes=['workspace:read'];
 assert.equal((await call('call_discovered_tool',{name:'save_artifact',arguments:{...payload,expectedVersion:1}})).isError,true);
 assert.equal(writes.length,1);
});

test('application guide requires saved, verified employer questions before notification',async()=>{
 const guide=JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../supabase/functions/agent-gateway/skills/application-workspace.json',import.meta.url),'utf8'));
 assert.match(guide.instructions,/save each newly observed page of employer questions through prepare_draft/);
 assert.match(guide.instructions,/Only this inspected full response may replace the immediate read_application_record after that draft write/);
 assert.match(guide.instructions,/compact, incomplete, missing the exact saved application\/revision\/draft[\s\S]*call read_application_record/);
 assert.match(guide.instructions,/never replaces read_action_board before a human handoff or fresh authorization\/attempt reads before submission/);
 assert.match(guide.instructions,/claim\/report response and a subagent completion message do not verify complete saved draft content/);
 assert.match(guide.instructions,/A chat bundle alone is not a saved handoff/);
 assert.match(guide.instructions,/inspectionComplete=false/);
});


test('AI Apply conditionally prepares changed or incomplete work and reuses unchanged approved drafts',()=>{
 const guide=readGuide('application-workspace').instructions;
 const section=guide.split('## Decide whether preparation is needed')[1].split('\n## ')[0];
 assert.match(section,/preparation is missing or incomplete/);
 assert.match(section,/newly observed or conditional employer questions need filling/);
 assert.match(section,/relevant facts, permitted answers or selected resume have changed/);
 assert.match(section,/Otherwise reuse the current saved draft and prepared materials/);
 assert.match(section,/Never rewrite an unchanged approved draft/);
 assert.match(section,/same application\/jobId and current expectedRevision/);
 assert.match(section,/preserving existing questions and human answers/);
 assert.match(section,/use answerUpdates for supported corrections/);
 assert.match(section,/do not assume rerunning it replaces stale values/);
 assert.match(section,/ask about conflicts rather than silently overwriting them/);
 assert.match(section,/Material corrections invalidate approval/);
});


test('routine consent follows explicit saved instructions while login and host access remain separate from submission',()=>{
 const guide=readGuide('application-workspace');
 assert.equal(guide.version,40);
 for(const phrase of ['Application consent instructions','accept those routine required notices','Decline optional marketing','Do not infer this permission from AI Apply','save_search_profile','background/credit checks','Create Account/Sign In is not automatically a human blocker','do not override it','review nonexistent answers','recheck real host/employer access','public-inspection-only work','request only the specific secure password entry','do not hand back the whole sign-in/application workflow'])assert.ok(guide.instructions.includes(phrase),phrase);
});
