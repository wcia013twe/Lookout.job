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
