import test from 'node:test';
import assert from 'node:assert/strict';
import {dateInZone,weekStart,shiftWeek,validateArtifact,artifactDiscussion,weeklyPrepRequest} from '../lib/artifacts.mjs';
import {validateMock,MOCK_TOOLS} from '../supabase/functions/agent-gateway/mock-interviews.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {createArtifactDemo} from '../next-app/lib/artifact-demo.mjs';
import {createMemoryStore} from '../next-app/lib/demo.mjs';
const id='12345678-1234-4123-8123-123456789012';
const artifact={id,expectedVersion:0,title:'Systems mock',purpose:'Practice failure modes',kind:'mock_interview',format:'markdown',body:'Call your agent when ready.',scheduledAt:'2026-11-08T19:00:00-05:00',timeZone:'America/New_York',durationMinutes:30,sessionStatus:'scheduled',weekOf:'2026-11-02',sources:[],links:[]};
test('weekly dates respect local Sunday/Monday, year rollover and DST',()=>{
 assert.equal(dateInZone('America/New_York',new Date('2026-11-09T00:00:00Z')),'2026-11-08');
 assert.equal(weekStart('2026-11-08'),'2026-11-02');assert.equal(weekStart('2026-11-09'),'2026-11-09');
 assert.equal(weekStart('2027-01-01'),'2026-12-28');assert.equal(shiftWeek('2026-12-28',1),'2027-01-04');
 validateMock('mock.save',{artifact,interviewerProfile:'Scenario, questions and rubric'});
 assert.throws(()=>validateArtifact('artifacts.save',artifact),/Use save_mock_interview/);
 for(const patch of [{weekOf:'2026-11-09'},{timeZone:'No/SuchZone'},{durationMinutes:0},{scheduledAt:'tomorrow'},{sessionStatus:'done'}])assert.throws(()=>validateMock('mock.save',{artifact:{...artifact,...patch},interviewerProfile:'x'}));
 assert.throws(()=>validateMock('mock.save',{artifact,interviewerProfile:' '}));
 assert.throws(()=>validateMock('mock.read',{id,ownerId:id}));
});
test('external resource contract is explicit and rejects unsafe destinations and misplaced metadata',()=>{
 const resource={...artifact,kind:'resource',resourceUrl:'https://www.postgresql.org/docs/current/using-explain.html'};
 for(const key of ['scheduledAt','timeZone','durationMinutes','sessionStatus'])delete resource[key];
 validateArtifact('artifacts.save',resource);
 assert.throws(()=>validateArtifact('artifacts.save',{...resource,resourceUrl:'javascript:alert(1)'}));
 assert.throws(()=>validateArtifact('artifacts.save',{...resource,resourceUrl:undefined}));
 assert.throws(()=>validateArtifact('artifacts.save',{...resource,sessionStatus:'scheduled'}));
 assert.match(weeklyPrepRequest(),/Curate and sequence strong online resources first/);
 assert.match(artifactDiscussion({id,content:artifact}),/read_mock_interview/);
 assert.doesNotMatch(artifactDiscussion({id,content:artifact}),/Scenario, questions and rubric/);
});
test('mock MCP tools share gateway validation, require scopes and forward only valid owned requests',async()=>{
 const forwarded=[];let scopes=['workspace:read','drafts:write'];
 const handler=createHandler(async(token,operation,payload)=>operation==='credentials.verify'?{status:200,data:{scopes}}:(forwarded.push({operation,payload}),{status:200,data:{artifact:{id,version:1}}}));
 const call=async(name,args)=>(await handler(new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:`Bearer jb_agent_${'a'.repeat(64)}`,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})}))).json();
 for(const tool of MOCK_TOOLS)assert.equal(tool.inputSchema.additionalProperties,false);
 const payload={artifact,interviewerProfile:'Private question sequence'};
 validateRequest({operation:'mock.save',payload});
 assert.equal((await call('save_mock_interview',payload)).result.isError,undefined);
 assert.deepEqual(forwarded,[{operation:'mock.save',payload}]);
 assert.equal((await call('save_mock_interview',{...payload,interviewerProfile:''})).error.code,-32602);
 scopes=['workspace:read'];assert.equal((await call('save_mock_interview',payload)).result.isError,true);
 assert.equal(forwarded.length,1);
});
test('detached demo exposes all five contributions and external links without interviewer answers',async()=>{
 const demo=createArtifactDemo(createMemoryStore({demo:{fictional:true}}));
 const all=await demo.artifactAction('artifacts.list',{shelf:'all'});
 for(const kind of ['company_research','interview_brief','story_bank','mock_interview','interview_debrief','resource'])assert(all.items.some(a=>a.content.kind===kind),kind);
 assert(!JSON.stringify(all).includes('interviewerProfile'));
 const week=weekStart(new Date().toISOString().slice(0,10));
 const current=await demo.artifactAction('artifacts.list',{shelf:'all',weekOf:week});assert(current.items.length>0);
 const past=await demo.artifactAction('artifacts.list',{shelf:'all',weekOf:shiftWeek(week,-1)});
 assert.equal(past.items.length,1);assert.equal(past.items[0].content.sessionStatus,'completed');
 assert.match(artifactDiscussion(past.items[0]),/Discuss my saved/);
 assert.doesNotMatch(artifactDiscussion(past.items[0]),/Start my scheduled/);
 const mock=current.items.find(a=>a.content.kind==='mock_interview');
 assert.match((await demo.artifactAction('artifacts.read',{id:mock.id})).content.body,/no interviewer service/);
});

test('calendar demo opens a timed draft without copying private briefing or identifiers',async()=>{
 const {mockCalendarPreview}=await import('../next-app/lib/mock-calendar-preview.mjs');
 const content={...artifact,title:'Backend mock',interviewerProfile:'PRIVATE QUESTIONS',id:'private-session-id',body:'Private notes'};
 const url=new URL(mockCalendarPreview(content));
 assert.equal(url.origin,'https://calendar.google.com');assert.equal(url.pathname,'/calendar/r/eventedit');
 assert.equal(url.searchParams.get('action'),'TEMPLATE');
 assert.equal(url.searchParams.get('dates'),'20261109T000000Z/20261109T003000Z');
 assert(!decodeURIComponent(url.href).includes('PRIVATE QUESTIONS'));assert(!url.href.includes('private-session-id'));
 assert.equal(mockCalendarPreview({...content,scheduledAt:'invalid'}),null);
 assert.equal(mockCalendarPreview({...content,sessionStatus:'completed'}),null);
});
test('the four embedded demo formats share a static self-contained document canvas',async()=>{
 const {demoMaterialDocument}=await import('../next-app/lib/toolkit-demo-documents.mjs');
 for(const kind of ['company_research','interview_brief','story_bank','interview_debrief']){
  const html=demoMaterialDocument(kind);assert(html.includes('<style>'));assert(html.includes('<h1>'));
  assert(!/<script|<iframe|<button|<input|<form|@import|url\(/i.test(html));
 }
 assert.equal(demoMaterialDocument('mock_interview'),null);
});
