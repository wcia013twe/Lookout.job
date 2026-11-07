import test from 'node:test';
import assert from 'node:assert/strict';
import {PLATFORM_TOOLS, validatePlatformPayload} from '../supabase/functions/agent-gateway/platform-tools.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {TOOLS} from '../supabase/functions/agent-mcp/protocol.mjs';
test('pack texture changes use the scoped theme-preference tool',()=>{
 const tool=PLATFORM_TOOLS.find(item=>item.operation==='preferences.theme.save');
 assert.match(tool.description,/pack texture/);
 assert.equal(validatePlatformPayload(tool.operation,{theme:{pack:'aurora',messages:{batch_ready:'Ready'}},expectedUpdatedAt:null}),true);
});
test('writes reject owner injection and permission fields',()=>{
 assert.throws(()=>validateRequest({operation:'profile.save',payload:{facts:{},expectedUpdatedAt:null,userId:'other'}}));
 assert.throws(()=>validatePlatformPayload('preferences.notifications.save',{settings:{autoSubmitApproved:true},expectedUpdatedAt:null}));
 assert.throws(()=>validatePlatformPayload('answers.save',{id:'id',question:'q',answer:'a',companyScope:null,expectedUpdatedAt:null,verified:true}));
});
test('pagination is bounded and handoffs cannot execute approvals',()=>{
 assert.throws(()=>validatePlatformPayload('jobs.list',{limit:101,offset:0}));
 assert.throws(()=>validatePlatformPayload('human.request',{action:'approve',recordId:null}));
 assert.equal(validatePlatformPayload('human.request',{action:'approve-application',recordId:'id'}),true);
});

test('person cards allow an optional company and reject malformed company values',()=>{
 for(const company of [undefined,'','   ','Example'])assert.doesNotThrow(()=>validatePlatformPayload('contacts.save',{id:'contact',record:{contact:'Pat',company},expectedRevision:0}));
 for(const company of [null,123,'x'.repeat(201)])assert.throws(()=>validatePlatformPayload('contacts.save',{id:'contact',record:{contact:'Pat',company},expectedRevision:0}),/company/);
});

test('resume references use HTTPS and cannot embed credentials',()=>{
 const base={id:'resume',name:'Master',variant:'Master',version:1};
 assert.throws(()=>validatePlatformPayload('resumes.reference.add',{...base,url:'http://example.com/resume.pdf'}));
 assert.throws(()=>validatePlatformPayload('resumes.reference.add',{...base,url:'https://secret@example.com/resume.pdf'}));
 assert.equal(validatePlatformPayload('resumes.reference.add',{...base,url:'https://example.com/resume.pdf'}),true);
});

test('existing scoped profile fact tool accepts contact facts without ownership or verification claims',()=>{
 const facts={firstName:'Demo',lastName:'Candidate',phone:'+1 202-555-0142',address:'123 Example Street',postalCode:'00123'};
 assert.doesNotThrow(()=>validateRequest({operation:'profile.save',payload:{facts,expectedUpdatedAt:null}}));
 assert.equal(TOOLS.find(tool=>tool.name==='save_profile_facts').operation,'profile.save');
});
