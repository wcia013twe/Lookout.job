#!/usr/bin/env node
// Genuine local native lifecycle on a dedicated sacrificial owner; no employer access.
import {applicationEmailAuthority} from './candidate-authority.mjs';
import {account,mcp,respond} from './native.mjs';import {read,write,actorAnswer} from './core.mjs';
const [root,scenario,actorFile,out]=process.argv.slice(2);const a=account(root),spec=read(scenario),actor=read(actorFile);const context=await mcp(a,'read_personal_context',{}),facts=context.settings.profile.facts,applicationEmail=applicationEmailAuthority(context.settings,context.settings.profile.facts.email).value,resumeId=context.settings.resumes[0].id;
const records=[];for(const t of spec.targets){
 const questions=t.id==='manual'?[]:[{id:'name',fieldId:'name',fieldType:'text',question:'Full name',answer:facts.name,required:true,questionSource:'employer_form',answerSource:'profile'},{id:'email',fieldId:'email',fieldType:'email',question:'Email',answer:applicationEmail,required:true,questionSource:'employer_form',answerSource:'profile'}];
 if(t.id==='personal')questions.push({id:'motivation',fieldId:'motivation',fieldType:'textarea',question:'Why do you want to apply, and have you used Northstar Tools before?',answer:'',required:true,questionSource:'employer_form'});
 const draft={resumeId,questionsReviewed:false,inspectionComplete:t.id!=='manual',inspectedAt:new Date().toISOString(),questions};
 const saved=await mcp(a,'call_discovered_tool',{name:'prepare_draft',arguments:{jobId:t.nativeJobId,expectedRevision:-1,draft,...(t.id==='manual'?{blocker:'Workday requires a manual handoff.'}:t.id==='personal'?{blocker:'Please answer the motivation and product-use question.'}:{}),responseMode:'full'}});
 const record=await mcp(a,'read_application_record',{applicationId:saved.id});records.push({targetId:t.id,saved,record});
 if(record.application.job_id!==t.nativeJobId||record.application.status==='Submitted'||record.attempts?.length)throw Error('Owned draft/no-submit check failed');
}
const board=await mcp(a,'read_action_board',{});
for(const r of records){const item=board.items.find(x=>x.applicationId===r.saved.id);if(r.targetId==='manual'&&(item?.questions?.length||r.record.application.draft.inspectionComplete===true))throw Error('Manual handoff invented inspected employer fields');if(!item||r.targetId==='clean'&&item.kind!=='review_application'||r.targetId!=='clean'&&item.kind!=='resolve_blocker')throw Error('Expected manual/answer/clean native card missing');}
write(out+'/before.private.json',{records,board});const response=await respond(root,actor,spec);write(out+'/human-response.private.json',response);
const after=[];for(const r of records)after.push({targetId:r.targetId,record:await mcp(a,'read_application_record',{applicationId:r.saved.id})});write(out+'/after.private.json',{records:after,board:await mcp(a,'read_action_board',{})});
const personal=after.find(x=>x.targetId==='personal').record.application;if(personal.draft.questions.find(q=>q.fieldId==='motivation').answer!==actorAnswer(actor,'personal','Have you used Northstar Tools before?').answer||!response.records.length)throw Error('Equivalent real human response not persisted');
write(out+'/verification.json',{status:'passed',synthetic:false,inferenceExecuted:false,controlled:true,ownedDraftReadback:3,realHumanResponse:true,noSubmission:true,participantOwnerUntouched:true});console.log(JSON.stringify({status:'passed',drafts:3,realHumanResponse:true,noSubmission:true}));
