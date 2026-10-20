import test from 'node:test';
import assert from 'node:assert/strict';
import {TOOLS} from '../supabase/functions/agent-mcp/protocol.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {databaseFailure,validationMessage} from '../supabase/functions/agent-gateway/request-errors.mjs';
import {parseDocument,profileDocument} from '../lib/search/documents.mjs';
test('discovery explains the actual profile and resume write vocabulary',()=>{
 const profile=TOOLS.find(t=>t.name==='save_profile_package').inputSchema.properties;
 for(const key of ['workExperience','education','projects','linkedin'])assert(profile.facts.properties[key]);
 assert(!profile.facts.properties.experience);assert(!profile.facts.properties.links);
 assert.deepEqual(profile.answers.items.properties.requestedPolicy.enum,['ask','auto']);
 const resume=TOOLS.find(t=>t.name==='begin_resume_upload');assert.equal(resume.scope,'profile:write');
 assert(resume.inputSchema.properties.variant.enum.includes('Master'));
 const filename=new RegExp(resume.inputSchema.properties.fileName.pattern);
 assert(filename.test('resume.pdf'));assert(!filename.test('/tmp/resume.pdf'));assert(!filename.test('C:\\resume.pdf'));
});
test('batch and activity corrections reject malformed input before SQL',()=>{
 assert.doesNotThrow(()=>validateRequest({operation:'batches.publish',payload:{eventKey:'batch',label:'Test',jobs:[{jobId:'agent-example',recommendation:{whyItFits:'private'}}]}}));
 assert.throws(()=>validateRequest({operation:'batches.publish',payload:{jobs:[]}}),/eventKey, label/);
 assert.throws(()=>validateRequest({operation:'activity.append',payload:{eventKey:'a',kind:'scan',applicationId:''}}),/omit it/);
 assert.doesNotThrow(()=>validateRequest({operation:'activity.append',payload:{eventKey:'a',kind:'scan',data:{}}}));
});
test('document errors explain allowed fields without echoing private YAML',()=>{
 assert.throws(()=>parseDocument('profile',profileDocument({id:'a',name:'A',active:true,filters:{location:'US'}})),/Employment/);
 assert.throws(()=>parseDocument('portals',JSON.stringify({tracked_companies:[{id:'a',name:'A',kind:'board',url:'https://example.com'}],search_queries:[]})),/careers_url/);
 assert.equal(validationMessage(new SyntaxError('private data')),'Request body must be valid JSON.');
 assert.equal(databaseFailure({code:'42702',message:'private SQL details'})[0],500);
 assert(!databaseFailure({code:'42702',message:'private SQL details'})[1].includes('private'));
 assert.equal(databaseFailure({code:'40001'})[0],409);
 assert.equal(databaseFailure({code:'42501'})[0],403);
});
