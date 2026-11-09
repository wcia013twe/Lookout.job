#!/usr/bin/env node
// Post-run coordinator. Never starts an agent or participant.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';
import {read,hash,grade,source} from './task.mjs';
import {extract} from './extract.mjs';
const digest=p=>hash(fs.readFileSync(p,'utf8'));
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx',mode:0o600});
const terminal=new Set(['completed','timed_out','execution_failed','harness_failed']);
export function handoff(root){
 root=path.resolve(root);const spec=read(path.join(root,'suite/scenario.json'));
 const runs=fs.readdirSync(path.join(root,'runs')).map(n=>path.join(root,'runs',n)).filter(p=>fs.existsSync(path.join(p,'run.json')));
 if(runs.length!==2)throw Error('Exactly two preserved condition attempts required');
 const conditions=runs.map(p=>read(path.join(p,'run.json')));
 if(new Set(conditions.map(r=>r.condition)).size!==2||!conditions.every(r=>['baseline','lookout'].includes(r.condition)&&terminal.has(r.status)&&r.version===spec.version)||conditions[0].pairId!==conditions[1].pairId)throw Error('Matching terminal pair required');
 const packet={version:spec.version,pairId:conditions[0].pairId,root,freezeHash:digest(path.join(root,'freeze.json')),scenarioHash:hash(spec),instructionsHash:digest(path.join(root,'suite/grader-instructions.md')),referenceHash:digest(path.join(root,'reference.private.json')),runs:runs.map((p,i)=>({condition:conditions[i].condition,path:p,evidenceHash:digest(path.join(p,'evidence-hashes.json'))})),dispatch:'Coordinator must spawn a fresh grader with fork_turns:none. Do not use any agent that implemented, coordinated, operated or participated in this pair. Shell does not launch the grader.',readableEvidence:['candidate/profile.md','candidate/resume.pdf','suite/scenario.json','suite/grader-instructions.md','reference.private.json','runs/*/run.json','runs/*/evidence-hashes.json','runs/*/stage-*'],neverShare:['account.private.json','cloned-context.private.json','runtime-config.json','freeze.json']};
 const dir=path.join(root,'grading');fs.mkdirSync(dir,{mode:0o700});write(path.join(dir,'handoff.json'),packet);
 for(const r of packet.runs){const run=read(path.join(r.path,'run.json'));write(path.join(dir,r.condition+'-template.json'),{extraction:{reviewer:null,checkpoints:Object.fromEntries(run.checkpoints.map(c=>[c.stage,{evidence:[],...(spec.gradingStages.includes(c.stage)?{savedJobIds:null}:{}),outcomeComplete:false,additionalTurns:[]}]))},review:{reviewer:null,checkpoints:Object.fromEntries(run.checkpoints.map(c=>[c.stage,Object.fromEntries(spec.stageQuality[c.stage].map(k=>[k,{rating:null,evidence:'',evidenceFiles:[]}]))])),adherence:Object.fromEntries(spec.adherence.map(k=>[k,{status:null,evidence:'',evidenceFiles:[]}]))}});}
 return packet;
}
export function assign(h,reviewerAgentId,coordinatorId,excludedAgentIds){
 if(!reviewerAgentId?.trim()||!coordinatorId?.trim()||!Array.isArray(excludedAgentIds)||!excludedAgentIds.length||!excludedAgentIds.includes(coordinatorId)||excludedAgentIds.includes(reviewerAgentId))throw Error('Fresh reviewer and explicit implementation/operator/participant exclusion roster required');
 return {handoffHash:hash(h),reviewerAgentId,coordinatorId,excludedAgentIds,assignedAt:new Date().toISOString(),launch:{forkTurns:'none',freshAgent:true}};
}
export function authorize(h,a,attestation,root){
 if(a.handoffHash!==hash(h)||a.launch?.forkTurns!=='none'||a.launch?.freshAgent!==true||a.excludedAgentIds.includes(a.reviewerAgentId)||attestation.reviewerAgentId!==a.reviewerAgentId||attestation.assignmentHash!==hash(a)||attestation.didImplement!==false||attestation.didOperate!==false||attestation.didParticipate!==false||attestation.freshContext!==true)throw Error('Independent grader assignment/attestation required');
 if(h.freezeHash!==digest(path.join(root,'freeze.json'))||h.scenarioHash!==hash(read(path.join(root,'suite/scenario.json')))||h.instructionsHash!==digest(path.join(root,'suite/grader-instructions.md'))||h.referenceHash!==digest(path.join(root,'reference.private.json')))throw Error('Frozen rubric or evidence binding changed');
 for(const r of h.runs)if(digest(path.join(r.path,'evidence-hashes.json'))!==r.evidenceHash)throw Error('Participant evidence manifest changed');
}
export function finalize(root,boardDir,submission){
 const dir=path.join(root,'grading'),h=read(path.join(dir,'handoff.json')),a=read(path.join(dir,'assignment.json'));
 authorize(h,a,submission.attestation,root);
 const confirmationPath=path.join(dir,'native-confirmation.json'),confirmation=read(confirmationPath);
 if(!['confirmed','failed'].includes(confirmation.status)||confirmation.handoffHash!==hash(h))throw Error('Bound native confirmation attempt receipt required');
 const spec=read(path.join(root,'suite/scenario.json')),ref=read(path.join(root,'reference.private.json')),board=source(boardDir),results=[];
 for(const r of h.runs){const item=submission.conditions?.[r.condition];if(!item||item.extraction.reviewer!==a.reviewerAgentId||item.review.reviewer!==a.reviewerAgentId)throw Error('Assigned reviewer must author both conditions');
  const frozen=read(path.join(r.path,'evidence-hashes.json'));
  const checks=[...Object.values(item.review.checkpoints||{}).flatMap(Object.values),...(r.condition==='lookout'?Object.values(item.review.adherence||{}):[])];
  for(const check of checks)if(!Array.isArray(check.evidenceFiles)||!check.evidenceFiles.length||check.evidenceFiles.some(file=>!(file in frozen)))throw Error('Semantic/adherence checks must cite frozen participant evidenceFiles');
  const run=extract(r.path,item.extraction,spec);const review={...item.review,evidenceDigest:hash(run)};
  const result=grade(spec,ref,board,run,review,{assignmentVerified:true});
  const reached=new Set(run.checkpoints.map(c=>c.stage));result.unreachedStages=spec.stages.filter(s=>!reached.has(s.id)).map(s=>s.id);
  if(run.status==='completed'&&result.status!=='reviewed')throw Error('Complete evidence-backed semantic review required for completed trajectory');
  results.push({condition:r.condition,run,review,grade:result});
 }
 // Validate both before creating final results; outputs never alter participant evidence.
 write(path.join(dir,'final.json'),{assignment:a,attestation:submission.attestation,nativeConfirmation:{receiptHash:digest(confirmationPath),receipt:confirmation},results});return {status:results.every(r=>r.grade.status==='reviewed')?'reviewed':'partial_review',conditions:results.map(r=>r.condition)};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const {values:v}=parseArgs({options:{action:{type:'string'},root:{type:'string'},reviewer:{type:'string'},coordinator:{type:'string'},excluded:{type:'string'},submission:{type:'string'},source:{type:'string'}}});
 const root=path.resolve(v.root),dir=path.join(root,'grading');let result;
 if(v.action==='handoff')result=handoff(root);
 else if(v.action==='assign'){const a=assign(read(path.join(dir,'handoff.json')),v.reviewer,v.coordinator,read(v.excluded));write(path.join(dir,'assignment.json'),a);result={assigned:true,reviewerAgentId:a.reviewerAgentId,assignmentHash:hash(a)};}
 else if(v.action==='finalize')result=finalize(root,v.source,read(v.submission));else throw Error('action must be handoff, assign or finalize');
 console.log(JSON.stringify(result));}catch(e){console.error(e.message);process.exitCode=1;}
}
