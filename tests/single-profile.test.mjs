import test from 'node:test';
import assert from 'node:assert/strict';
import {primaryApplicationProfile,singleResumePrompt} from '../lib/single-profile.mjs';
import {readField,updateField,profileFromPrompt} from '../lib/search-profile.mjs';
import {parseRecruitingTargets} from '../lib/recruiting-targets.mjs';
import {selectResume} from '../supabase/functions/agent-gateway/resume-selection.mjs';

test('single profile selection is stable and preserves the stored profile array',()=>{
 const profiles=[{id:'intern',active:true},{id:'general',active:true}];
 const before=structuredClone(profiles);
 assert.equal(primaryApplicationProfile(profiles).id,'general');
 assert.equal(primaryApplicationProfile([{id:'paused',active:false},{id:'active',active:true}]).id,'active');
 assert.deepEqual(profiles,before);
});
test('selecting one resume retires role assignments without erasing their evidence or unrelated preferences',()=>{
 const targets=[{id:'backend',name:'Backend',active:true,roles:'Backend Engineer',employment:'Full-time',resumeId:'old',timeline:'',conditions:''}];
 let prompt=updateField('','Recruiting targets','Targets',JSON.stringify(targets));
 prompt=updateField(prompt,'Search Filters','Employment','Full-time');
 prompt=updateField(prompt,'Role preferences','Roles','Backend Engineer');
 const next=singleResumePrompt(prompt,'selected');
 assert.equal(readField(next,'Application materials','Default resume ID').value,'selected');
 assert.deepEqual(parseRecruitingTargets(readField(next,'Recruiting targets','Targets').value),targets.map(t=>({...t,active:false})));
 assert.equal(readField(next,'Role preferences','Roles').value,'Backend Engineer');
 const profile=profileFromPrompt(next,{id:'general',active:true});
 const resumes=['old','selected'].map(id=>({id,user_id:'owner',object_path:'owner/'+id+'.pdf'}));
 const choice=selectResume({userId:'owner',job:{title:'Backend Engineer',employmentType:'FT'},resumes,preferences:{profiles:[profile]},profileId:'general'});
 assert.equal(choice.status,'Selected');assert.equal(choice.resumeId,'selected');
 assert.equal(readField(prompt,'Application materials','Default resume ID').value,'');
});
