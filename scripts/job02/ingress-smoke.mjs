#!/usr/bin/env node
// Sacrificial local owner only. Fictional application; no browser/employer action.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {read,write,hash} from './core.mjs';
import {account,mcp,respond} from './native.mjs';
const [root,output]=process.argv.slice(2);if(!root||!output||fs.existsSync(output))throw Error('New sacrificial smoke output required');fs.mkdirSync(output,{recursive:true,mode:0o700});
const a=account(root),spec=read(new URL('../../examples/job02/controlled-scenario.json',import.meta.url)),actor=read(new URL('../../examples/job02/controlled-actor.json',import.meta.url));
const target=spec.targets.find(t=>t.id==='personal');target.url+='-smoke-'+randomUUID();
try{
 const batch=await mcp(a,'publish_batch',{eventKey:randomUUID(),label:'Fictional ingress rehearsal',jobs:[{canonicalUrl:target.url,employer:{company:target.company,title:target.title,employmentType:'FT',location:'Remote'}}]});write(output+'/batch.private.json',batch);
 const personal=await mcp(a,'read_personal_context',{}),resumeId=personal.settings.resumes[0].id;
 const draft={resumeId,questionsReviewed:false,inspectionComplete:true,inspectedAt:new Date().toISOString(),questions:[{id:'name',fieldId:'name',fieldType:'text',question:'Full name',answer:'Fictional Person',required:true,questionSource:'employer_form',answerSource:'ai_generated'},{id:'motivation',fieldId:'motivation',fieldType:'textarea',question:'Why do you want to apply?',answer:'',required:true,questionSource:'employer_form'}]};
 const before=await mcp(a,'call_discovered_tool',{name:'prepare_draft',arguments:{jobId:batch.items[0].job_id,expectedRevision:-1,draft,blocker:'Please answer the motivation question.',responseMode:'full'}});write(output+'/draft-before.private.json',before);
 const receipt=await respond(root,actor,spec);write(output+'/response.private.json',receipt);
 if(receipt.records.length!==1)throw Error('One new fictional response expected');
 const after=await mcp(a,'read_application_record',{applicationId:before.id});write(output+'/after.private.json',after);
 if(after.application.draft.questions.find(q=>q.fieldId==='motivation').answer!==actor.facts[0].answer||after.application.status==='Submitted'||after.attempts?.length)throw Error('Saved answer or no-submit invariant failed');
 const report={status:'passed',synthetic:false,controlled:true,actualHumanRpc:true,exactSavedEventVerified:true,preservedOtherAnswer:after.application.draft.questions.find(q=>q.fieldId==='name').answer==='Fictional Person',noEmployerAccess:true,noSubmission:true,accountUserId:a.userId};write(output+'/verification.json',report);console.log(JSON.stringify(report));
}catch(e){write(output+'/failure.json',{status:'failed',error:e.message,controlled:true,inferenceExecuted:false});throw e;}
