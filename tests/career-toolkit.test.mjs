import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {toolkitSkills,toolkitCategories,buildToolkitRequest} from '../lib/career-toolkit.mjs';
import {guideIndex,readGuide,guideDispatch} from '../supabase/functions/agent-gateway/guides.mjs';
import {createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';

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
  allow=false;assert.equal((await (await invoke()).json()).result.isError,true);
  allow=true;assert.ok((await (await invoke({id:'career-evaluate-job',ownerId:'foreign'})).json()).error);
});
