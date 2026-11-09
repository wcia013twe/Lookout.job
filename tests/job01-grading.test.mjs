import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {assign,authorize,handoff,finalize} from '../scripts/job01/grading.mjs';
import {hash,grade} from '../scripts/job01/task.mjs';
test('assignment requires fresh reviewer outside explicit roster',()=>{const h={pairId:'x'};assert.throws(()=>assign(h,'operator','operator',['operator']),/Fresh/);assert.throws(()=>assign(h,'fresh','operator',[]),/roster/);const a=assign(h,'fresh','operator',['operator','builder','participant']);assert.equal(a.launch.forkTurns,'none');assert.equal(a.handoffHash,hash(h));});
test('handoff binds both frozen attempts, instructions and rubric; attestation/tampering fail closed',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'job01-grader-'));const put=(p,v)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),typeof v==='string'?v:JSON.stringify(v));};
 try{
 const spec={version:'fixture',stageQuality:{initial:[]},gradingStages:['initial'],adherence:[]};put('suite/scenario.json',spec);put('suite/grader-instructions.md','frozen instructions');put('freeze.json',{});put('reference.private.json',{});
 for(const condition of ['baseline','lookout']){put('runs/'+condition+'/run.json',{version:'fixture',pairId:'pair',condition,status:'completed',checkpoints:[{stage:'initial'}]});put('runs/'+condition+'/evidence-hashes.json',{});}
 const h=handoff(root),a=assign(h,'fresh','operator',['operator','builder']);const att={reviewerAgentId:'fresh',assignmentHash:hash(a),didImplement:false,didOperate:false,didParticipate:false,freshContext:true};
 assert.doesNotThrow(()=>authorize(h,a,att,root));assert.throws(()=>authorize(h,a,{...att,didOperate:true},root),/assignment/);
 put('suite/grader-instructions.md','changed');assert.throws(()=>authorize(h,a,att,root),/binding/);
 assert.ok(!JSON.stringify(h).includes('Bearer'));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('standalone semantic review cannot claim reviewed when fresh grader is required',()=>{
 const spec={version:'v',finalGraderRequired:true,expectedTargetCount:1,gradingStages:['initial'],stages:[{id:'initial',batch:'initial'}],stageQuality:{initial:['accuracy']},adherence:[]};const board={manifest:{snapshotId:'s',files:{'jobs.json':'h'}},ids:new Set(['j'])};const ref={snapshotId:'s',sourceHash:'h',status:'reviewed',reviewer:'labeler',batches:{initial:[{id:'j'}],later:[{id:'j'}]},expectedTargets:{initial:['j']},targetRationales:{j:{rationale:'fit',materialGap:'gap',evidence:['source']}}};const run={version:'v',episodeId:'e',condition:'baseline',snapshotId:'s',sourceHash:'h',status:'completed',checkpoints:[{stage:'initial',savedJobIds:['j'],executionSeconds:1,interactions:{uniqueTurns:0}}]};const review={reviewer:'someone',evidenceDigest:hash(run),checkpoints:{initial:{accuracy:{rating:2,evidence:'artifact'}}}};assert.equal(grade(spec,ref,board,run,review).status,'review_required');
});

test('finalization rejects nonexistent semantic citations and attaches failed native receipt honestly',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'job01-final-'));const put=(p,v)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),typeof v==='string'?v:JSON.stringify(v));};
 try{
 const spec={version:'v',finalGraderRequired:true,expectedTargetCount:1,gradingStages:['initial'],stages:[{id:'initial',batch:'initial',minute:0},{id:'later',batch:'later',minute:10}],stageQuality:{initial:['accuracy'],later:['accuracy']},adherence:[],policy:{userResponseDelayMinutes:5}};
 const jobs='[{"id":"j"}]';put('board/jobs.json',jobs);put('board/manifest.json',{schemaVersion:1,snapshotId:'s',jobCount:1,files:{'jobs.json':hash(jobs)}});
 const ref={snapshotId:'s',sourceHash:hash(jobs),status:'reviewed',reviewer:'labeler',batches:{initial:[{id:'j'}],later:[{id:'j'}]},expectedTargets:{initial:['j']},targetRationales:{j:{rationale:'fit',materialGap:'gap',evidence:['source']}}};put('reference.private.json',ref);put('suite/scenario.json',spec);put('suite/grader-instructions.md','anchors');put('freeze.json',{});
 for(const condition of ['baseline','lookout']){const r={version:'v',episodeId:condition,pairId:'p',condition,snapshotId:'s',sourceHash:hash(jobs),status:'timed_out',checkpoints:[{stage:'initial',status:'timed_out',executionSeconds:1,interactionTurnIds:[],answeredTurnCount:0,interactions:{uniqueTurns:0,questions:0,repeatedContext:0,reminders:0,corrections:0,approvals:0}}]};put('runs/'+condition+'/run.json',r);put('runs/'+condition+'/evidence-hashes.json',{'run.json':hash(JSON.stringify(r))});}
 const h=handoff(root),a=assign(h,'fresh','operator',['operator','builder']);put('grading/assignment.json',a);put('grading/native-confirmation.json',{status:'failed',handoffHash:hash(h),error:'fixture failure'});
 const att={reviewerAgentId:'fresh',assignmentHash:hash(a),didImplement:false,didOperate:false,didParticipate:false,freshContext:true};
 const item={extraction:{reviewer:'fresh',checkpoints:{initial:{evidence:['run.json'],savedJobIds:[],outcomeComplete:false,additionalTurns:[]}}},review:{reviewer:'fresh',checkpoints:{initial:{accuracy:{rating:0,evidence:'No usable work',evidenceFiles:['missing.json']}}},adherence:{}}};
 const submission={attestation:att,conditions:{baseline:structuredClone(item),lookout:structuredClone(item)}};
 assert.throws(()=>finalize(root,path.join(root,'board'),submission),/evidenceFiles/);
 for(const i of Object.values(submission.conditions))i.review.checkpoints.initial.accuracy.evidenceFiles=['run.json'];
 const result=finalize(root,path.join(root,'board'),submission);assert.equal(result.status,'partial_review');const saved=JSON.parse(fs.readFileSync(path.join(root,'grading/final.json')));assert.equal(saved.nativeConfirmation.receipt.status,'failed');assert.deepEqual(saved.results[0].grade.unreachedStages,['later']);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
