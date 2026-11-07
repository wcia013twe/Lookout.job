import {test} from 'node:test';
import assert from 'node:assert/strict';
import {guideIndex,readGuide,guideDispatch} from '../supabase/functions/agent-gateway/guides.mjs';
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

test('application workspace guide is advertised with truthful personalization and approval boundaries',()=>{
 const g=readGuide('application-workspace');assert.ok(guideIndex().some(x=>x.id===g.id));
 for(const phrase of ['prepare_draft','writing preferences','NOT implemented','read back','required/optional'])assert.ok(g.instructions.toLowerCase().includes(phrase.toLowerCase()),phrase);
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

test('Discover guide connects every fit-context category to scored, evidence-based analysis', async () => {
 const {agentContextFields} = await import('../lib/search-profile.mjs');
 const guide=readGuide('career-find-jobs');
 const {TOOLS}=await import('../supabase/functions/agent-mcp/protocol.mjs');
 assert.match(TOOLS.find(tool=>tool.name==='save_search_profile').description,/read_guide career-find-jobs.*decision-brief/);
 assert(guide.instructions.includes("Write each section as a short, current decision brief: what matters to the user, what makes a role a good fit, and any important tradeoff or unknown. Include only information that could change a role evaluation. Synthesize rather than append, and never turn an assumption into a preference."));
 assert(!guide.instructions.includes('Include source/date in the note'));
 for(const {id,label} of agentContextFields) assert(guide.instructions.includes(label+' -> '+id));
 for(const phrase of ['What your agent knows','save_search_profile','expectedVersion','evaluatedProfileVersion','Use null','must-have conflict','materialGap','read back']) assert(guide.instructions.includes(phrase),phrase);
 const delivered=(await guideDispatch('career-find-jobs',async()=>({data:{}}))).data;
 assert.equal(delivered.instructions,guide.instructions);
});
