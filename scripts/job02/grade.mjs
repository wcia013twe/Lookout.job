import fs from 'node:fs';
import path from 'node:path';
import {read,write,hash,digest,files,assertFrozen,factualEqual} from './core.mjs';
import {timingSummary} from './timing.mjs';
import {assign,authorize} from '../job01/grading.mjs';
import {validate as validateEval} from '../evals/contract.mjs';
export function handoff(root){
 const freeze=assertFrozen(root),spec=read(root+'/suite/scenario.json'),runs=['baseline','lookout'].map(condition=>{
  const p=root+'/runs/'+condition,r=read(p+'/run.json');if(!['completed','timed_out','execution_failed','harness_failed'].includes(r.status))throw Error('Terminal attempts required');
  const manifest=files(p,['browser-profile','browser-config.private.json']);write(p+'/evidence-hashes.json',manifest);return {condition,path:p,evidenceHash:digest(p+'/evidence-hashes.json')};
 });
 const packet={version:freeze.version,pairId:read(root+'/pilot-attempt.json').pairId,root,freezeHash:digest(root+'/freeze.json'),scenarioHash:hash(spec),instructionsHash:digest(root+'/suite/grader-instructions.md'),referenceHash:digest(root+'/reference.private.json'),runs,neverShare:['account.private.json','runtime.private.json','freeze.json'],dispatch:'Spawn a fresh independent final grader with fork_turns:none, excluding all implementer/operator/participant IDs. Shell does not spawn agents.'};
 write(root+'/grading/handoff.json',packet);const template={attestation:{reviewerAgentId:null,assignmentHash:null,didImplement:false,didOperate:false,didParticipate:false,freshContext:true},conditions:{}};
 for(const c of ['baseline','lookout'])template.conditions[c]={checkpoints:Object.fromEntries(spec.stages.map(s=>[s.id,Object.fromEntries(spec.targets.map(t=>[t.id,{checks:{},complete:null,evidenceFiles:[],explanation:''}]))])),additionalTurns:[],adherence:{}};
 write(root+'/grading/template.json',template);return packet;
}
export function assignGrader(root,reviewer,coordinator,excluded){const a=assign(read(root+'/grading/handoff.json'),reviewer,coordinator,excluded);write(root+'/grading/assignment.json',a);return a;}
function citation(run,check){if(!check.explanation?.trim()||!Array.isArray(check.evidenceFiles)||!check.evidenceFiles.length)throw Error('Judgment requires explanation and frozen citations');const manifest=read(run+'/evidence-hashes.json');for(const p of check.evidenceFiles){if(!(p in manifest)||digest(path.resolve(run,p))!==manifest[p])throw Error('Invalid/changed evidence citation');}}
export function finalize(root,submission){
 const h=read(root+'/grading/handoff.json'),a=read(root+'/grading/assignment.json');authorize(h,a,submission.attestation,root);
 const spec=read(root+'/suite/scenario.json'),ref=read(root+'/reference.private.json'),native=read(root+'/grading/native-confirmation.json');if(native.handoffHash!==hash(h)||!['confirmed','failed'].includes(native.status))throw Error('Bound read-only native confirmation attempt required');
 const results=[];
 for(const condition of ['baseline','lookout']){
  const dir=root+'/runs/'+condition,run=read(dir+'/run.json'),review=submission.conditions?.[condition],manifest=read(dir+'/evidence-hashes.json');
  for(const [p,value]of Object.entries(manifest))if(digest(path.join(dir,p))!==value)throw Error('Participant evidence changed');
  if(!review)throw Error('Both conditions required');const ratings=[],targets=[],fieldChecks=[];
  for(const stage of run.stages){
   const capture=dir+'/stage-'+stage.index+'/browser/final.json',browser=fs.existsSync(capture)?read(capture):{targets:[]};
   for(const t of spec.targets){
    const r=review.checkpoints?.[stage.id]?.[t.id],applicable=ref.criteria?.[stage.id]?.[t.id];if(!r||!Array.isArray(applicable)||!applicable.length)throw Error('Frozen per-stage target rubric required');citation(dir,r);
    if(typeof r.complete!=='boolean')throw Error('Explicit target completion judgment required');
    for(const k of applicable){const q=r.checks[k];if(!q||q.rating!==null&&![0,1,2].includes(q.rating))throw Error('Missing quality judgment: '+k);citation(dir,q);ratings.push(q.rating);}
    const visible=browser.targets.find(x=>x.targetId===t.id);
    if(stage.id==='continue')for(const f of ref.fields?.[t.id]||[]){const got=visible?.fields?.filter(x=>x.fieldId===f.fieldId);fieldChecks.push({targetId:t.id,fieldId:f.fieldId,observable:got?.length===1,correct:got?.length===1?f.acceptedValues.some(v=>factualEqual(f.fieldId,v,got[0].value)):null});}
    if(stage.id==='continue')targets.push({id:t.id,expectedOutcome:ref.outcomes?.[t.id]??(t.kind==='workday'?'manual':'ready'),complete:r.complete,liveReady:t.kind==='workday'?null:visible?.readyToSubmit===true,observed:t.kind==='workday'?true:visible?.observed!==false&&!!visible});
   }
  }
  const turnMap=new Map((run.interactions||[]).map(x=>[x.turnId,x]));
  for(const x of review.additionalTurns||[]){citation(dir,x);if(!x.turnId||turnMap.has(x.turnId))throw Error('Unique additional turn IDs required; do not recount captured turns');turnMap.set(x.turnId,x);}
  if(condition==='lookout')for(const k of spec.adherence){const q=review.adherence?.[k];if(!q||!['used_correctly','attempted_but_failed','omitted','not_applicable'].includes(q.status))throw Error('Adherence judgment required');citation(dir,q);}
  const reviewed=ratings.length>0&&ratings.every(r=>r!==null)&&run.stages.length===spec.stages.length,quality=reviewed?ratings.reduce((a,b)=>a+b,0)/(ratings.length*2):null;
  const finalReached=run.stages.some(s=>s.id==='continue'),allObserved=targets.length===3&&targets.every(t=>t.observed),fieldsKnown=fieldChecks.every(f=>f.observable);
  const success=reviewed&&finalReached&&allObserved&&fieldsKnown?run.status==='completed'&&targets.every(t=>t.complete&&(t.expectedOutcome!=='ready'||t.liveReady===true))&&fieldChecks.every(f=>f.correct):null;
  const timing=timingSummary(run);
  const result={timing,diagnostics:run.diagnostics??null,cost:run.cost??null,condition,status:run.status,reviewed,quality,taskSuccess:success,targets,fieldChecks,uniqueInteractionTurns:turnMap.size,prescribedInitiations:run.prescribedInitiations,wallDurationSeconds:run.endedAt-run.startedAt,activeSeconds:timing.activeSeconds,sessionStartupSeconds:timing.sessionStartupSeconds,simulatedWaitingMinutes:run.simulatedWaitingMinutes,adherence:condition==='lookout'?review.adherence:undefined};
  const summary=validateEval({schemaVersion:1,campaignId:'JOB02-pilot',suiteId:'JOB02',suiteVersion:spec.version,scenarioId:'JOB02',scenarioVersion:spec.version,condition,episodeId:run.episodeId,model:spec.model,reasoning:spec.reasoning,harnessVersion:'JOB02-host-v3',graderVersion:spec.graderVersion,repeat:1,evidenceDigest:hash(manifest),pilot:true,synthetic:false,startedAt:run.startedAt,endedAt:run.endedAt,status:run.status,cost:run.cost??undefined,evaluation:{reviewed,taskSuccess:success,quality,activeSeconds:result.activeSeconds,toolCalls:run.toolCalls,wakesUsed:run.stages.length}});
  summary.timing=timing;summary.diagnostics={...run.diagnostics,session_startup_seconds:timing.sessionStartupSeconds,raw_stage_wall_seconds:timing.rawStageWallSeconds,execution_timing_valid:Number(timing.executionValid)};summary.effort={uniqueInteractionTurns:result.uniqueInteractionTurns,prescribedInitiations:result.prescribedInitiations};summary.wallDurationSeconds=result.wallDurationSeconds;results.push({result,summary});
 }
 write(root+'/grading/final.json',{assignment:a,attestation:submission.attestation,nativeConfirmationHash:digest(root+'/grading/native-confirmation.json'),results});return results;
}
