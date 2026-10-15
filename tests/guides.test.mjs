import {test} from 'node:test';
import assert from 'node:assert/strict';
import {guideIndex,readGuide,guideDispatch} from '../supabase/functions/agent-gateway/guides.mjs';
import {contextResponse} from '../supabase/functions/agent-gateway/context.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
test('context advertises small versioned index; guide reads are isolated',()=>{
 const index=contextResponse('context.developer',{}).guides;
 assert.deepEqual(index,guideIndex());assert.equal(index.length,2);
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
