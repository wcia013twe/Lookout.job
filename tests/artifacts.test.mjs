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
 const calls=[];let user=id;
 const client={auth:{getUser:async()=>({data:{user:{id:user}},error:null})},rpc:async(name,args)=>{calls.push([name,args]);return {data:{saved:true},error:null};}};
 const backend=createBackend(client,id);assert.deepEqual(await backend.artifactAction('artifacts.save',doc),{saved:true});
 assert.deepEqual(calls[0],['artifact_action',{operation:'artifacts.save',payload:doc}]);
 user='other';await assert.rejects(backend.artifactAction('artifacts.save',doc),/Account changed/);assert.equal(calls.length,1);
 const forwarded=[];let scopes=['workspace:read','drafts:write'];
 const handler=createHandler(async(token,operation,payload)=>{if(operation==='credentials.verify')return {status:200,data:{scopes}};forwarded.push([operation,payload]);return {status:200,data:{saved:true}};});
 const call=()=>handler(new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:`Bearer jb_agent_${'a'.repeat(64)}`,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'save_artifact',arguments:doc}})}));
 const response=await(await call()).json();assert.equal(response.result.isError,undefined);assert.deepEqual(forwarded,[['artifacts.save',doc]]);
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
 const page=await demo.artifactAction('artifacts.list');assert.equal(page.items.length,3);assert.ok(!('body' in page.items[0].content));
 const original=await demo.artifactAction('artifacts.read',{id:demoArtifactIds.interactive});assert.match(original.content.body,/type="range"/);
 const saved=await demo.artifactAction('artifacts.save',doc);assert.equal(saved.version,1);assert.equal((await demo.artifactAction('artifacts.save',doc)).version,1);
 const revised=await demo.artifactAction('artifacts.save',{...doc,expectedVersion:1,body:'Revised'});assert.equal(revised.version,2);
 assert.equal((await demo.artifactAction('artifacts.read',{id,version:1})).content.body,doc.body);
 await demo.artifactAction('artifacts.archive',{id,expectedVersion:2,archived:true});assert.equal((await demo.artifactAction('artifacts.list',{query:'A sourced brief'})).items.length,0);assert.equal((await demo.artifactAction('artifacts.read',{id})).archived,true);
 assert.ok(demo.artifactSnapshot().learningGoals.some(g=>g.id===demoGoalId));
 const reset=createArtifactDemo(createMemoryStore({demo:{fictional:true}}));assert.equal((await reset.artifactAction('artifacts.list')).items.length,3);
 assert.throws(()=>createArtifactDemo(createMemoryStore({demo:{fictional:false}})));
});
test('HTML previews receive a first-position restrictive CSP and the host blocks external frame navigation',async()=>{
 const html=artifactHtml('<script>fetch("https://example.com")</script>');
 assert.ok(html.indexOf('Content-Security-Policy')<html.indexOf('fetch('));
 for(const directive of ["default-src 'none'","connect-src 'none'","frame-src 'none'","form-action 'none'","worker-src 'none'"])assert.ok(html.includes(directive));
 const viewer=await readFile(new URL('../next-app/app/career-toolkit/_components/artifact-viewer.tsx',import.meta.url),'utf8');assert.match(viewer,/sandbox="allow-scripts"/);assert.doesNotMatch(viewer,/allow-same-origin/);
 const layout=await readFile(new URL('../next-app/app/layout.tsx',import.meta.url),'utf8');assert.match(layout,/frame-src 'self'/);
});
