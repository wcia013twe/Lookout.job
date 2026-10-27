import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {TOOLS,createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {createBackend} from '../backend/client.mjs';
import {ARTIFACT_TOOLS,artifactDiscussion,artifactHtml,weeklyPrepRequest} from '../lib/artifacts.mjs';
import {buildPreparationAgenda,recordLocalPreparationSession} from '../lib/preparation-planner.mjs';
import {createArtifactDemo,demoArtifactIds,demoGoalId} from '../next-app/lib/artifact-demo.mjs';
import {createMemoryStore} from '../next-app/lib/demo.mjs';
const id='55555555-5555-4555-8555-555555555555';
const doc={id,expectedVersion:0,title:'A sourced brief',purpose:'Prepare for an interview',kind:'company_research',format:'markdown',body:'# Research\n\nUnknowns stay unknown.',sources:[{title:'Official source',url:'https://example.com/research',observedAt:'2026-10-22'}],links:[]};
const valid=(operation,payload)=>validateRequest({operation,payload});
test('artifact contracts support documents and HTML, bounded research, strict links and revision-aware discussion',()=>{
 valid('artifacts.save',doc);valid('artifacts.save',{...doc,format:'html',body:'<button onclick="this.textContent=42">Try</button>'});
 for(const patch of [{body:''},{body:'x'.repeat(150001)},{title:' '},{format:'react'},{userId:id},{sources:[{title:'x',url:'javascript:alert(1)',observedAt:'2026-10-22'}]},{sources:[{title:'x',url:'https://user:pass@example.com',observedAt:'2026-10-22'}]},{sources:[{title:'x',url:'https://example.com',observedAt:'2026-02-30'}]},{links:[{goalId:id,applicationId:id,taskId:'x'}]},{links:[{goalId:id,taskId:'x'},{goalId:id,taskId:'x'}]},{expectedVersion:-1}])assert.throws(()=>valid('artifacts.save',{...doc,...patch}));
 valid('learning.save',{id,expectedVersion:0,title:'Systems',objective:'Learn failure modes',active:true,tasks:[{id:'queues',title:'Retries',detail:'Reason about idempotency',minutes:30,targetDate:'2026-10-23'}]});
 assert.throws(()=>valid('learning.save',{id,expectedVersion:0,title:'Systems',objective:'x',active:true,tasks:[{id:'x',title:'x',detail:'x',minutes:0,targetDate:'2026-10-23'}]}));
 for(const op of ['artifacts.read','artifacts.list','learning.read'])assert.throws(()=>valid(op,{ownerId:id}));
 const prompt=artifactDiscussion({id,version:2,content:doc});assert.match(prompt,/version 2/);assert.match(prompt,/read_artifact/);assert.match(prompt,/untrusted/);
 assert.match(weeklyPrepRequest(),/as part of preparing the plan/i);assert.match(weeklyPrepRequest(true),/Do not access or write a real account/);
});
test('all artifact and learning actions have narrowly scoped MCP boundaries',()=>{
 for(const tool of ARTIFACT_TOOLS){assert.equal(TOOLS.find(t=>t.name===tool.name).scope,tool.scope);assert.equal(tool.inputSchema.additionalProperties,false);}
 assert.equal(TOOLS.find(t=>t.name==='read_artifact').readOnly,true);
});
test('browser adapter and MCP forward identical artifact writes, and stop account changes',async()=>{
 const collection={...doc,kind:'interview_brief',preparedFor:'2026-10-23',materials:[{id:'22222222-2222-4222-8222-222222222222',version:1}]};
 const calls=[];let user=id;
 const client={auth:{getUser:async()=>({data:{user:{id:user}},error:null})},rpc:async(name,args)=>{calls.push([name,args]);return {data:{saved:true},error:null};}};
 const backend=createBackend(client,id);assert.deepEqual(await backend.artifactAction('artifacts.save',collection),{saved:true});
 assert.deepEqual(calls[0],['artifact_action',{operation:'artifacts.save',payload:collection}]);
 user='other';await assert.rejects(backend.artifactAction('artifacts.save',collection),/Account changed/);assert.equal(calls.length,1);
 const forwarded=[];let scopes=['workspace:read','drafts:write'];
 const handler=createHandler(async(token,operation,payload)=>{if(operation==='credentials.verify')return {status:200,data:{scopes}};forwarded.push([operation,payload]);return {status:200,data:{saved:true}};});
 const call=()=>handler(new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:`Bearer jb_agent_${'a'.repeat(64)}`,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'save_artifact',arguments:collection}})}));
 const response=await(await call()).json();assert.equal(response.result.isError,undefined);assert.deepEqual(forwarded,[['artifacts.save',collection]]);
 scopes=['workspace:read'];assert.equal((await(await call()).json()).result.isError,true);assert.equal(forwarded.length,1);
});
test('learning-only weeks fit the shared budget, reveal missing material and preserve partial completion',()=>{
 const today='2026-10-22',goalId=id;
 const bundle={applications:{},plans:[],settings:{dailyMinutes:15,version:0},sessions:[],timeZone:'UTC',learningGoals:[{id:goalId,version:1,goal:{title:'Database depth',active:true,tasks:[{id:'index',title:'Index practice',detail:'Explain scans',minutes:30,targetDate:'2026-10-24',completed:false},{id:'queue',title:'Queue practice',detail:'Explain retries',minutes:15,targetDate:'2026-10-24',completed:false}]}}],artifacts:[{id:'artifact',version:1,title:'Index explorer',path:'/career-toolkit/?artifact=artifact',links:[{goalId,taskId:'index'}]}]};
 const agenda=buildPreparationAgenda({...bundle,today}),items=agenda.days.flatMap(d=>d.items);
 assert.equal(items.reduce((s,i)=>s+i.minutes,0),45);assert.ok(agenda.days.every(d=>d.plannedMinutes<=15));
 assert.ok(items.find(i=>i.title==='Index practice').artifacts.length);assert.equal(items.find(i=>i.title==='Queue practice').artifacts.length,0);
 const input={sessionId:'one',minutes:15,targets:[{goalId,taskId:'index',expectedVersion:1}]};
 const partial=recordLocalPreparationSession(bundle,input,`${today}T12:00:00Z`);assert.equal(partial.learningGoals[0].version,2);assert.equal(partial.learningGoals[0].goal.tasks[0].completed,false);
 assert.deepEqual(recordLocalPreparationSession(partial,input,`${today}T12:00:00Z`),partial);
 assert.equal(buildPreparationAgenda({...partial,today}).days[0].completedMinutes,15);
 assert.throws(()=>recordLocalPreparationSession(partial,{...input,sessionId:'two'},`${today}T12:00:00Z`),/budget/);
 const done=recordLocalPreparationSession(partial,{...input,sessionId:'two',targets:[{goalId,taskId:'index',expectedVersion:2}]},'2026-10-23T12:00:00Z');assert.equal(done.learningGoals[0].goal.tasks[0].completed,true);
 assert.equal(bundle.learningGoals[0].goal.tasks[0].completed,false);
 const tooSmall=buildPreparationAgenda({...bundle,settings:{dailyMinutes:5},today:'2026-10-24'});assert.ok(tooSmall.unscheduled>0);
 const interview={application_id:'app',version:1,plan:{applicationId:'app',deadline:{date:today,status:'confirmed'},tasks:[{id:'app:questions',title:'Interview questions',minutes:15,completed:false}]}};
 const mixed=buildPreparationAgenda({...bundle,plans:[interview],applications:{app:{id:'app',company:'Example',status:'Interview'}},today});
 assert.equal(mixed.days[0].items[0].learning,false);assert.equal(mixed.days[0].items[0].title,'Interview questions');
 valid('preparation.session.complete',{sessionId:id,minutes:15,targets:[{goalId,taskId:'index',expectedVersion:1}]});
 assert.throws(()=>valid('preparation.session.complete',{sessionId:id,minutes:15,targets:[{goalId,applicationId:id,taskId:'index',expectedVersion:1}]}));
});
test('fictional demo saves, revisions, archiving and retrieval never need real storage or services',async()=>{
 const store=createMemoryStore({demo:{fictional:true}}),demo=createArtifactDemo(store);
 const page=await demo.artifactAction('artifacts.list');assert.equal(page.items.length,6);assert.ok(!('body' in page.items[0].content));
 const answers=await demo.artifactAction('artifacts.read',{id:'99999999-aaaa-4000-8000-999999999999'});assert.match(answers.content.body,/Candidate detail needed/);assert.match(answers.content.body,/Tell me about yourself/);assert.match(answers.content.body,/Resume coverage/);assert.match(answers.content.body,/Needs clarification/);
 const original=await demo.artifactAction('artifacts.read',{id:demoArtifactIds.interactive});assert.match(original.content.body,/type="range"/);
 const saved=await demo.artifactAction('artifacts.save',doc);assert.equal(saved.version,1);assert.equal((await demo.artifactAction('artifacts.save',doc)).version,1);
 const revised=await demo.artifactAction('artifacts.save',{...doc,expectedVersion:1,body:'Revised'});assert.equal(revised.version,2);
 assert.equal((await demo.artifactAction('artifacts.read',{id,version:1})).content.body,doc.body);
 await demo.artifactAction('artifacts.archive',{id,expectedVersion:2,archived:true});assert.equal((await demo.artifactAction('artifacts.list',{query:'A sourced brief'})).items.length,0);assert.equal((await demo.artifactAction('artifacts.read',{id})).archived,true);
 assert.ok(demo.artifactSnapshot().learningGoals.some(g=>g.id===demoGoalId));
 const reset=createArtifactDemo(createMemoryStore({demo:{fictional:true}}));assert.equal((await reset.artifactAction('artifacts.list')).items.length,6);
 assert.throws(()=>createArtifactDemo(createMemoryStore({demo:{fictional:false}})));
});
test('HTML previews receive a first-position restrictive CSP and the host blocks external frame navigation',async()=>{
 const html=artifactHtml('<script>fetch("https://example.com")</script>');
 assert.ok(html.indexOf('Content-Security-Policy')<html.indexOf('fetch('));
 for(const directive of ["default-src 'none'","connect-src 'none'","frame-src 'none'","form-action 'none'","worker-src 'none'"])assert.ok(html.includes(directive));
 const viewer=await readFile(new URL('../next-app/app/career-toolkit/_components/artifact-viewer.tsx',import.meta.url),'utf8');assert.match(viewer,/sandbox="allow-scripts"/);assert.doesNotMatch(viewer,/allow-same-origin/);
 const layout=await readFile(new URL('../next-app/app/layout.tsx',import.meta.url),'utf8');assert.match(layout,/frame-src 'self'/);
});

test('application document kinds share the website/MCP contract and isolated versioned demo storage',async()=>{
 const demo=createArtifactDemo(createMemoryStore({demo:{fictional:true}}));
 for(const kind of ['cover_letter','application_template']){
  const payload={...doc,id:crypto.randomUUID(),kind,sources:[],links:[]};
  valid('artifacts.save',payload);
  const calls=[];const client={auth:{getUser:async()=>({data:{user:{id}}})},rpc:async(name,args)=>{calls.push([name,args]);return {data:{saved:true}};}};
  await createBackend(client,id).artifactAction('artifacts.save',payload);
  assert.equal(calls[0][1].payload.kind,kind);
  assert.ok(TOOLS.find(t=>t.name==='save_artifact').inputSchema.properties.kind.enum.includes(kind));
  const row=await demo.artifactAction('artifacts.save',payload);assert.equal(row.version,1);
  const listed=await demo.artifactAction('artifacts.list',{kind});assert.ok(listed.items.some(r=>r.id===payload.id));
  await assert.rejects(demo.artifactAction('artifacts.save',{...payload,title:'Changed stale copy'}),/changed/);
  const revised=await demo.artifactAction('artifacts.save',{...payload,expectedVersion:1,body:'Updated application text'});assert.equal(revised.version,2);
 }
});

test('prep collection arguments reject invalid dates, self references, duplicate IDs and wrong formats',()=>{
 const child='22222222-2222-4222-8222-222222222222';
 const pack={...doc,kind:'interview_brief',preparedFor:'2026-10-23',materials:[{id:child,version:1}]};
 valid('artifacts.save',pack);valid('artifacts.list',{shelf:'prepared',asOf:'2026-10-22'});
 for(const patch of [{preparedFor:'2026-02-30'},{kind:'notes'},{format:'html'},{materials:[{id,version:1}]},{materials:[{id:child,version:0}]},{materials:[{id:child,version:1},{id:child.toUpperCase(),version:2}]},{materials:Array.from({length:21},()=>({id:child,version:1}))}])assert.throws(()=>valid('artifacts.save',{...pack,...patch}));
 assert.throws(()=>valid('artifacts.list',{asOf:'2026-10-22'}));
});
test('demo collections reuse saved revisions and move dated prep to saved after its need date',async()=>{
 const demo=createArtifactDemo(createMemoryStore({demo:{fictional:true}}));
 const pack=await demo.artifactAction('artifacts.read',{id:demoArtifactIds.pack});
 const featured=await demo.artifactAction('artifacts.list',{shelf:'prepared',asOf:pack.content.preparedFor});assert.equal(featured.items.length,1);
 assert.deepEqual(featured.items[0].content.materials.map(m=>m.id),[demoArtifactIds.company,'99999999-aaaa-4000-8000-999999999999',demoArtifactIds.interactive]);
 const later=new Date(pack.content.preparedFor+'T12:00:00Z');later.setUTCDate(later.getUTCDate()+1);
 assert.equal((await demo.artifactAction('artifacts.list',{shelf:'prepared',asOf:later.toISOString().slice(0,10)})).items.length,0);
 assert.ok((await demo.artifactAction('artifacts.list',{shelf:'saved',asOf:later.toISOString().slice(0,10)})).items.some(r=>r.id===pack.id));
 const child=await demo.artifactAction('artifacts.read',{id:demoArtifactIds.company});
 await demo.artifactAction('artifacts.save',{id:child.id,expectedVersion:child.version,...child.content,body:'Updated research'});
 const pinned=await demo.artifactAction('artifacts.read',pack.content.materials[0]);assert.equal(pinned.content.body,child.content.body);
 await assert.rejects(demo.artifactAction('artifacts.save',{...doc,kind:'interview_brief',materials:[{id:pack.id,version:1}]}),/non-collection/);
});

test('freeform documents link to typed subjects without fabricated tasks', async()=>{
 for(const links of [[{applicationId:id}],[{goalId:id}],[{companyWorkspaceId:'target-1'}],[{contactId:'person-1'}],[{jobId:'shared-role'}]])valid('artifacts.save',{...doc,links});
 for(const links of [[{}],[{jobId:'role',taskId:'fake'}],[{contactId:'person',companyWorkspaceId:'target'}],[{contactId:' '}],[{applicationId:id},{applicationId:id.toUpperCase()}]])assert.throws(()=>valid('artifacts.save',{...doc,links}));
 const store=createMemoryStore({demo:{fictional:true},network:{companies:[{id:'company-1'}],referrals:[{id:'person-1'}]}}),demo=createArtifactDemo(store);
 const request={...doc,links:[{companyWorkspaceId:'company-1'},{contactId:'person-1'},{goalId:demoGoalId}]};
 const saved=await demo.artifactAction('artifacts.save',request);
 assert.equal(saved.version,1);
 assert.equal((await demo.artifactAction('artifacts.list',{companyWorkspaceId:'company-1'})).items[0].id,id);
 await assert.rejects(async()=>demo.artifactAction('artifacts.save',{...request,id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',links:[{contactId:'missing'}]}));
 assert.equal((await demo.artifactAction('artifacts.read',{id})).content.body,doc.body);
});

test('artifact validation identifies missing and malformed fields without echoing private input',()=>{
 const cases=[
  [{title:'Fictional private title',purpose:'Practice',body:'# Notes'},/arguments.id is required/],
  [{...doc,id:'private-invalid-id'},/arguments.id must be a UUID/],
  [{...doc,expectedVersion:-1},/arguments.expectedVersion must be an integer/],
  [{...doc,kind:'invalid'},/arguments.kind must be one of/],
  [{...doc,sources:[{title:'Source',url:'https://example.com'}]},/arguments.sources\[0\].observedAt is required/],
  [{...doc,'private-unknown-field':'private-value'},/arguments contains an unsupported field/],
 ];
 for(const [payload,expected] of cases)assert.throws(()=>valid('artifacts.save',payload),error=>{
  assert.match(error.message,expected);assert.doesNotMatch(error.message,/private-|Fictional private/);return true;
 });
});

test('dated practice keeps its restriction and explains the supported field and kinds',()=>{
 valid('artifacts.save',{...doc,kind:'practice'});
 for(const kind of ['weekly_prep','interview_brief'])valid('artifacts.save',{...doc,kind,preparedFor:'2026-10-26'});
 assert.throws(()=>valid('artifacts.save',{...doc,kind:'practice',preparedFor:'2026-10-26'}),/preparedFor is supported only for kind weekly_prep or interview_brief; omit preparedFor for practice/);
 for(const preparedFor of ['2026-02-30','tomorrow','2026-10-26T00:00:00Z'])assert.throws(()=>valid('artifacts.save',{...doc,kind:'interview_brief',preparedFor}),/preparedFor must be a real calendar date in YYYY-MM-DD format/);
});

test('MCP and browser surface the shared artifact diagnostics before writes; scope denial still wins',async()=>{
 const payload={...doc,kind:'practice',preparedFor:'2026-10-26'};
 let scope=['workspace:read','drafts:write'];const writes=[];
 const handler=createHandler(async(_token,operation,args)=>{
  if(operation==='credentials.verify')return {status:200,data:{scopes:scope}};
  writes.push(args);return {status:200,data:{saved:true}};
 });
 const call=async arguments_=>(await handler(new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:`Bearer jb_agent_${'a'.repeat(64)}`,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'save_artifact',arguments:arguments_}})}))).json();
 const response=await call(payload);assert.equal(response.error.code,-32602);assert.match(response.error.message,/preparedFor.*weekly_prep or interview_brief/);
 const missing=await call({title:'Fictional',purpose:'Practice',body:'# Notes'});assert.match(missing.error.message,/arguments.id is required/);
 const client={auth:{getUser:async()=>({data:{user:{id}},error:null})},rpc:async()=>{throw Error('must not write');}};
 await assert.rejects(createBackend(client,id).artifactAction('artifacts.save',payload),{message:response.error.message});
 assert.equal(writes.length,0);
 scope=[];assert.match((await call(payload)).result.content[0].text,/Missing required scope/);assert.equal(writes.length,0);
 scope=['workspace:read','drafts:write'];assert.equal((await call({...doc,kind:'practice'})).result.isError,undefined);assert.equal(writes.length,1);
});
