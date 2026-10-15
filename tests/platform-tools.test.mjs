import test from 'node:test';
import assert from 'node:assert/strict';
import { PLATFORM_TOOLS,validatePlatformPayload } from '../supabase/functions/agent-gateway/platform-tools.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {TOOLS} from '../supabase/functions/agent-mcp/protocol.mjs';
test('every product action has one registered tool with an explicit scope',()=>{
 for(const tool of PLATFORM_TOOLS){assert.equal(TOOLS.filter(t=>t.operation===tool.operation).length,1);assert.ok(tool.scope);assert.equal(tool.inputSchema.additionalProperties,false);}
});
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

test('contact drafts require a nonempty company name',()=>{
 for(const company of [undefined,null,'', '   ',123]) assert.throws(()=>validatePlatformPayload('contacts.save',{id:'contact',record:{company},expectedRevision:0}),/company/);
 assert.equal(validatePlatformPayload('contacts.save',{id:'contact',record:{company:'Example'},expectedRevision:0}),true);
});

test('resume references use HTTPS and cannot embed credentials',()=>{
 const base={id:'resume',name:'Master',variant:'Master',version:1};
 assert.throws(()=>validatePlatformPayload('resumes.reference.add',{...base,url:'http://example.com/resume.pdf'}));
 assert.throws(()=>validatePlatformPayload('resumes.reference.add',{...base,url:'https://secret@example.com/resume.pdf'}));
 assert.equal(validatePlatformPayload('resumes.reference.add',{...base,url:'https://example.com/resume.pdf'}),true);
});
