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


test('gateway forwarding preserves fixed actionable diagnostics without reflecting private server content',async()=>{
 const {gatewayFailure}=await import('../supabase/functions/agent-gateway/request-errors.mjs');
 assert.match(gatewayFailure(400,{error:'Unknown operation'})[1],/matching backend migration/);
 const message='Dated mock session in its local week required';
 assert.deepEqual(databaseFailure({code:'22023',message}),[400,message]);
 assert.deepEqual(gatewayFailure(400,{error:message}),[400,message]);
 for(const error of ['PRIVATE INTERVIEWER PROFILE','jb_agent_'+ 'a'.repeat(64),{message:'private'},'Unknown operation: private SQL'])assert.deepEqual(gatewayFailure(500,{error}),[500,'Gateway operation rejected; read current state before retrying']);
 const {createDispatch}=await import('../backend/runtime/service.ts');
 const dispatch=createDispatch({rpc:async()=>assert.fail('mock should retain Edge boundary'),supabaseUrl:'http://127.0.0.1:54321',request:async()=>Response.json({error:'Unknown operation'},{status:400})});
 const result=await dispatch('jb_agent_'+ 'a'.repeat(64),'mock.read',{id:'cccccccc-1111-4000-8000-111111111111'});
 assert.equal(result.status,400);assert.match(result.error,/matching backend migration/);
});
