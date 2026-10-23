import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {toolkitSkills,toolkitCategories,buildToolkitRequest} from '../lib/career-toolkit.mjs';
import {discoverGuides,guideIndex,readGuide,guideDispatch,guideDiscoveryDispatch} from '../supabase/functions/agent-gateway/guides.mjs';
import {createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {createDemoWorkspace,createDemoServices} from '../next-app/lib/muse-demo-fixtures.mjs';

test('every manual resolves to an isolated, sourced agent guide with the same examples', () => {
  assert.equal(toolkitCategories.length,8);
  assert.equal(new Set(toolkitSkills.map(s=>s.id)).size,toolkitSkills.length);
  for (const skill of toolkitSkills) {
    assert.ok(toolkitCategories.some(c=>c.id===skill.category));
    const guide=readGuide(skill.guideId);
    assert.deepEqual(guide.manual,skill);
    assert.ok(guide.instructions.includes('Lookout adaptation'));
    assert.match(guide.instructions,/never fabricate/i);
    assert.ok(guide.sourceDocuments.every(doc=>doc.content.length>100));
    assert.ok(guideIndex().some(item=>item.id===skill.guideId&&item.version===skill.version));
    assert.ok(skill.inputs.length&&skill.steps.length&&skill.outputs.length&&skill.examples.length);
    for(const id of skill.related)assert.ok(toolkitSkills.some(s=>s.id===id));
    guide.manual.examples[0]='mutated';guide.sourceDocuments[0].content='mutated';
    assert.notEqual(readGuide(skill.guideId).manual.examples[0],'mutated');
    assert.notEqual(readGuide(skill.guideId).sourceDocuments[0].content,'mutated');
  }
});
test('pinned source hashes and generated bundles stay reproducible', () => {
  const output=execFileSync(process.execPath,['scripts/build-career-toolkit.mjs','--check'],{encoding:'utf8'});
  assert.match(output,/match pinned sources/);
});
test('copy requests use only chosen display context and never secret file URLs or execution settings', () => {
  const input={company:'Example Systems',title:'Backend Engineer',id:'private-id',url:'https://private.example/resume?secret=token',autoApply:true};
  const prompt=buildToolkitRequest('tailor-resume',1,input);
  assert.match(prompt,/Rewrite my summary/);
  assert.match(prompt,/Example Systems — Backend Engineer/);
  assert.match(prompt,/career-tailor-resume/);
  assert.doesNotMatch(prompt,/career[- ]ops|github\.com/i);
  assert.doesNotMatch(prompt,/private-id|private\.example|secret=|autoApply/);
  assert.match(prompt,/Match it in my owned workspace/);
  assert.throws(()=>buildToolkitRequest('../../secret'));
  assert.equal(buildToolkitRequest('tailor-resume',999),buildToolkitRequest('tailor-resume',0));
});
test('demo examples are explicitly fictional and do not change the catalog or account fixtures', () => {
  const before=JSON.stringify(toolkitSkills);
  const prompt=buildToolkitRequest('prep-plan',0,{company:'Example Systems (demo)',title:'Backend Engineer'},true);
  assert.match(prompt,/Fictional practice only/);
  assert.match(prompt,/Do not access real accounts or files/);
  assert.match(prompt,/Example Systems \(demo\)/);
  assert.equal(JSON.stringify(toolkitSkills),before);
});
test('one connection advertises every toolkit workflow for automatic intent matching', async () => {
  const discovery=discoverGuides();
  assert.equal(discovery.guides.length,toolkitSkills.length);
  assert.match(discovery.instructions,/does not need to name a skill/);
  assert.match(discovery.instructions,/automatically select/);
  for(const skill of toolkitSkills) {
    const route=discovery.guides.find(guide=>guide.id===skill.guideId);
    assert.equal(route.category,skill.category);
    assert.deepEqual(route.examples,skill.examples);
    assert.ok(route.description&&route.whenToUse&&route.requirements);
  }
  const authorized=await guideDiscoveryDispatch(async(op,args)=>{assert.equal(op,'context.developer');assert.deepEqual(args,{});return {data:{}};});
  assert.equal(authorized.data.guides.length,toolkitSkills.length);
  assert.deepEqual(await guideDiscoveryDispatch(async()=>({error:{code:'42501'}})),{error:{code:'42501'}});
});
test('demo discovery scenarios stay fictional and isolated from account writes', async () => {
  const state=createDemoWorkspace(new Date('2026-10-22T12:00:00Z'));
  const services=createDemoServices({get:path=>path.split('.').reduce((value,key)=>value?.[key],state),set(){throw Error('Discovery must not write');}});
  const scenarios=await services.discoverToolkit();
  assert.deepEqual(scenarios.map(row=>row.guideId),['career-profile-interview','career-tailor-resume','career-prep-plan']);
  scenarios[0].goal='mutated';
  assert.notEqual((await services.discoverToolkit())[0].goal,'mutated');
});
test('manual access over MCP retains workspace authorization and remains read-only', async () => {
  const credential='jb_agent_'+'a'.repeat(64);
  let allow=true;const calls=[];
  const handle=createHandler(async (token,operation,payload)=>{
    assert.equal(token,credential);calls.push(operation);
    if(operation==='credentials.verify')return {status:200,data:{scopes:allow?['workspace:read']:[]}};
    return {status:200,...await guideDispatch(payload.id,async()=>({data:{}}))};
  });
  const invoke=(args={id:'career-evaluate-job'})=>handle(new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:`Bearer ${credential}`,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'read_guide',arguments:args}})}));
  const success=await (await invoke()).json();
  assert.equal(JSON.parse(success.result.content[0].text).id,'career-evaluate-job');
  assert.ok(calls.every(op=>['credentials.verify','guides.read'].includes(op)));
  for(const id of ['career-star-answer-writer','career-interview-answer-builder']){
    const response=await (await invoke({id})).json();
    const guide=JSON.parse(response.result.content[0].text);assert.equal(guide.id,id);
    assert.match(guide.instructions,/save_artifact/);assert.match(guide.instructions,/inventory every substantive/);assert.match(guide.instructions,/Never simulate candidate replies/);assert.match(guide.instructions,/candidate detail needed|missing motivations|motivations or development/i);
  }
  allow=false;assert.equal((await (await invoke()).json()).result.isError,true);
  allow=true;assert.ok((await (await invoke({id:'career-evaluate-job',ownerId:'foreign'})).json()).error);
});

test('simple skill invocations load the canonical scoped guide and preserve demo boundaries', async () => {
 const {buildSkillInvocation}=await import('../lib/career-toolkit.mjs');
 for(const skill of toolkitSkills) {
  const prompt=buildSkillInvocation(skill.id);
  assert.ok(prompt.includes(`read_guide({"id":"${skill.guideId}"})`));
  assert.ok(readGuide(skill.guideId));
  assert.match(buildSkillInvocation(skill.id,true),/Fictional practice only/);
 }
 assert.throws(()=>buildSkillInvocation('missing'));
});
test('all skill iframe documents render the same adapted guide and pinned reference sources', async () => {
 const {skillDocument}=await import('../next-app/app/career-toolkit/_lib/skill-document.ts');
 for(const skill of toolkitSkills) {
  const html=skillDocument(skill);
  assert.ok(html.includes('Lookout skill instructions'));
  for(const doc of readGuide(skill.guideId).sourceDocuments) assert.ok(html.includes(doc.path));
  assert.match(html,/default-src &#x27;none&#x27;|default-src 'none'/);
  assert.doesNotMatch(html,/<script[ >]/i);
 }
});
test('MCP discovery returns the full routing catalog through one scoped call', async () => {
  const credential='jb_agent_'+'b'.repeat(64);
  const calls=[];
  const handle=createHandler(async (token,operation,payload)=>{
    assert.equal(token,credential);calls.push({operation,payload});
    if(operation==='credentials.verify')return {status:200,data:{scopes:['workspace:read']}};
    return {status:200,...await guideDiscoveryDispatch(async()=>({data:{}}))};
  });
  const response=await handle(new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:`Bearer ${credential}`,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'discover_toolkit',arguments:{}}})}));
  const body=await response.json();
  const discovery=JSON.parse(body.result.content[0].text);
  assert.equal(discovery.guides.length,toolkitSkills.length);
  assert.deepEqual(calls.map(call=>call.operation),['credentials.verify','guides.discover']);
});
