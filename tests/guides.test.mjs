import {test} from 'node:test';
import assert from 'node:assert/strict';
import {guideIndex,readGuide,guideDispatch} from '../supabase/functions/agent-gateway/guides.mjs';
import {contextResponse} from '../supabase/functions/agent-gateway/context.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
test('context advertises small versioned index; guide reads are isolated',()=>{
 const index=contextResponse('context.developer',{}).guides;
 assert.deepEqual(index,guideIndex());assert.ok(index.length > 2);assert.ok(index.some(g=>g.id==='career-evaluate-job'));
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

test('application workspace guide is advertised with truthful personalization and approval boundaries',()=>{
 const g=readGuide('application-workspace');assert.ok(guideIndex().some(x=>x.id===g.id));
 for(const phrase of ['prepare_draft','writing preferences','NOT implemented','Fail loudly','read back','required/optional'])assert.ok(g.instructions.toLowerCase().includes(phrase.toLowerCase()),phrase);
 assert.ok(contextResponse('context.developer',{}).instructions.some(x=>x.includes('application-workspace')));
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
  const guide=readGuide(id);assert(guide.instructions.includes(policy));
  assert.equal(context.guides.find(g=>g.id===id).version,guide.version);
 }
 assert(context.operatingGuide.sections.flatMap(section=>section.instructions).some(s=>s.includes('request_search_sweep')&&s.includes('connection_pending')));
 assert(!context.operatingGuide.sections.flatMap(section=>section.instructions).some(s=>s.includes('report its destination and ID')));
});

test('one fictional MCP context read delivers the complete operating guide without personal reads or setup side effects',async()=>{
 const {createHandler}=await import('../supabase/functions/agent-mcp/protocol.mjs');
 const calls=[];
 const handle=createHandler(async(_token,operation)=>{
  calls.push(operation);
  if(operation==='credentials.verify')return {status:200,data:{scopes:['workspace:read']}};
  assert.equal(operation,'context.developer','reading the operating guide must not load personal records or activate work');
  return {status:200,data:contextResponse(operation,{})};
 });
 const send=async(method,params)=>{
  const response=await handle(new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+'a'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}));
  const body=await response.json();assert(!body.error);assert(!body.result.isError);return body.result;
 };
 const startup=await send('initialize',{protocolVersion:'2025-11-25'});
 assert.match(startup.instructions,/read_developer_context once/);
 const result=await send('tools/call',{name:'read_developer_context',arguments:{}});
 const context=JSON.parse(result.content[0].text),guide=context.operatingGuide;
 assert.deepEqual(guide.sections.map(s=>s.id),['role','connect','first-value','run','watch','workspace','search','applications','career','recover']);
 assert.match(guide.lifecycle,/Read once per version, not once forever/);
 const watch=guide.sections.find(s=>s.id==='watch').instructions.join('\n');
 for(const phrase of ['configure_agent_watch','--check','--test-wake','SHA-256','30-minute cooldown','verified enqueue/wake command','runtime receipts'])assert(watch.includes(phrase),phrase);
 const connect=guide.sections.find(s=>s.id==='connect').instructions;
 assert(connect.every(instruction=>startup.instructions.includes(instruction)),'startup must use the canonical connection rules');
 assert.equal(calls.filter(op=>op==='context.developer').length,1);
 guide.sections[0].instructions[0]='mutated';
 assert.notEqual(contextResponse('context.developer',{}).operatingGuide.sections[0].instructions[0],'mutated');
});
