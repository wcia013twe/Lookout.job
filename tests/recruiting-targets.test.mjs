import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRecruitingTargets, copyLegacyRules, recruitingTargetsHeading, recruitingTargetsKey} from '../lib/recruiting-targets.mjs';
import {initialPrompt, readField, updateField, profileFromPrompt, promptFromProfile} from '../lib/search-profile.mjs';
const target={id:'backend',name:'Backend SWE',active:true,roles:'Backend',timeline:'After graduation',resumeId:'owned-resume',conditions:'Production ownership'};
test('profile rules and targets round trip independently without losing existing criteria',async()=>{
 let full=updateField(initialPrompt(),'Profile evaluation','Rules','Prioritize long-term growth.');
 full=updateField(full,'Career goals & tradeoffs','Tradeoffs','Preserve this existing tradeoff.');
 full=updateField(full,recruitingTargetsHeading,recruitingTargetsKey,JSON.stringify([target,{...target,id:'mle',name:'MLE',active:false}]));
 const profile=profileFromPrompt(full,{id:'full-time',name:'Full-time'});
 const restored=promptFromProfile(profile);
 assert.equal(readField(restored,'Profile evaluation','Rules').value,'Prioritize long-term growth.');
 assert.equal(readField(restored,'Career goals & tradeoffs','Tradeoffs').value,'Preserve this existing tradeoff.');
 assert.equal(parseRecruitingTargets(readField(restored,recruitingTargetsHeading,recruitingTargetsKey).value)[1].active,false);
 const intern=updateField(initialPrompt(),'Profile evaluation','Rules','Check mentorship and conversion.');
 assert.equal(readField(intern,recruitingTargetsHeading,recruitingTargetsKey).value,'');
 assert.equal(readField(full,'Profile evaluation','Rules').value,'Prioritize long-term growth.');
 const {validateRequest}=await import('../supabase/functions/agent-gateway/contract.mjs');
 validateRequest({operation:'preferences.profile.save',payload:{profile,expectedVersion:0}});
});
test('empty targets preserve a simple profile and malformed target collections cannot masquerade as valid settings',()=>{
 assert.deepEqual(parseRecruitingTargets(''),[]);
 assert.throws(()=>parseRecruitingTargets('{broken'),/could not be read/);
 assert.throws(()=>parseRecruitingTargets(JSON.stringify([target,target])),/unique IDs/);
 assert.throws(()=>parseRecruitingTargets(JSON.stringify([{...target,autoSubmitApproved:true}])),/unique IDs/);
 assert.equal(parseRecruitingTargets(JSON.stringify([{...target,name:''}])).length,1);
 assert.throws(()=>parseRecruitingTargets(JSON.stringify([{...target,name:''}]),{requireNames:true}),/name/);
});

test('legacy rule copy preserves profile rules and becomes an independent one-time value',()=>{
 const source='Preserve unknown facts.';
 const existing='Prioritize systems ownership.';
 const copied=copyLegacyRules(existing,source);
 assert.ok(copied.includes(source));assert.ok(copied.includes(existing));
 assert.equal(copyLegacyRules(copied,source),copied);
 assert.equal(copyLegacyRules(existing,''),existing);
 const changedSource='A different rule later.';
 assert.ok(!copied.includes(changedSource));
});

test('resume assignments support explicit job types while legacy targets inherit the profile',async()=>{
 assert.equal(parseRecruitingTargets(JSON.stringify([target]))[0].employment,undefined);
 for (const employment of ['', 'Full-time','Internship','Part-time','Contract','Temporary']) {
  const assigned={...target,employment};
  const prompt=updateField(initialPrompt(),recruitingTargetsHeading,recruitingTargetsKey,JSON.stringify([assigned]));
  const profile=profileFromPrompt(prompt);
  const {validateRequest}=await import('../supabase/functions/agent-gateway/contract.mjs');
  validateRequest({operation:'preferences.profile.save',payload:{profile,expectedVersion:0}});
  assert.deepEqual(parseRecruitingTargets(readField(promptFromProfile(profile),recruitingTargetsHeading,recruitingTargetsKey).value),[assigned]);
 }
 for(const employment of ['Anything',null,true,{}]) assert.throws(()=>parseRecruitingTargets(JSON.stringify([{...target,employment}])));
});
