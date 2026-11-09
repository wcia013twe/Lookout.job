#!/usr/bin/env node
// Host-neutral JOB01 packets and evidence grading. Never invokes a participant.
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
export const read=p=>JSON.parse(readFileSync(p,'utf8'));
export function source(dir){
 const manifest=read(path.join(dir,'manifest.json')),raw=readFileSync(path.join(dir,'jobs.json'),'utf8'),jobs=JSON.parse(raw);
 if(manifest.schemaVersion!==1||manifest.files['jobs.json']!==hash(raw)||jobs.length!==manifest.jobCount)throw Error('Frozen source mismatch');
 const ids=new Set(jobs.map(j=>j.id));if(ids.size!==jobs.length)throw Error('Duplicate source IDs');
 return {manifest,jobs,ids};
}
export function validateReference(ref,board,spec){
 if(ref.snapshotId!==board.manifest.snapshotId||ref.sourceHash!==board.manifest.files['jobs.json'])throw Error('Reference source mismatch');
 if(ref.status!=='reviewed'||!ref.reviewer?.trim())throw Error('Independent fit-reference review required');
 for(const batch of ['initial','later']){
  const entries=ref.batches?.[batch];if(!Array.isArray(entries)||!entries.length)throw Error('Both batches required');
  const seen=new Set();for(const x of entries){
   if(!board.ids.has(x.id)||seen.has(x.id))throw Error('Invalid/repeated reference job');seen.add(x.id);

  }
 }
 if(spec){
  if(!Number.isInteger(spec.expectedTargetCount)||spec.expectedTargetCount<1)throw Error('Expected target count required');
  for(const stageId of spec.gradingStages){
   const ids=ref.expectedTargets?.[stageId],stage=spec.stages.find(s=>s.id===stageId);
   const visible=new Set(ref.batches[stage.batch].map(j=>j.id));
   if(!Array.isArray(ids)||ids.length!==spec.expectedTargetCount||new Set(ids).size!==ids.length||ids.some(id=>!visible.has(id)))throw Error('Expected checkpoint targets must be unique and present in its evidence batch');
   for(const id of ids){const r=ref.targetRationales?.[id];if(!r?.rationale?.trim()||!r?.materialGap?.trim()||!r?.evidence?.length)throw Error('Expected target rationale, gap and evidence required');}
  }
 }

}
export function packet(spec,ref,board,stageId,condition,productConfiguration){
 validateReference(ref,board,spec);
 const s=spec.stages.find(s=>s.id===stageId);if(!s||!['lookout','baseline'].includes(condition))throw Error('Invalid stage/condition');
 if(condition==='lookout'&&(!productConfiguration?.source||!productConfiguration?.wakePrompt))throw Error('Recorded product configuration required');
 const ids=new Set(ref.batches[s.batch].map(j=>j.id));
 // No future stages, reference labels, rubric, or other-condition prompt reaches participant.
 const prompt=s.kind==='user_update'?s.request:s.baseline;
 return {prompt,...(s.email?{email:s.email,delivery:'matched_uploaded_email'}:{}),jobs:board.jobs.filter(j=>ids.has(j.id)),snapshotId:board.manifest.snapshotId};
}
export function grade(spec,ref,board,run,review,authorization={}){
 validateReference(ref,board,spec);
 if(run.version!==spec.version||run.snapshotId!==ref.snapshotId||run.sourceHash!==ref.sourceHash||!['lookout','baseline'].includes(run.condition))throw Error('Run binding mismatch');
 if(!['completed','timed_out','execution_failed','harness_failed'].includes(run.status))throw Error('Terminal run required');
 if(!Array.isArray(run.checkpoints))throw Error('Checkpoints required');
 const evidenceDigest=hash(run),reviewed=(!spec.finalGraderRequired||authorization.assignmentVerified===true)&&review?.evidenceDigest===evidenceDigest&&!!review.reviewer?.trim();
 const checkpoints=[];const effort={uniqueTurns:0,scriptedInitiations:0,questions:0,repeatedContext:0,reminders:0,corrections:0,approvals:0};let duration=0;
 for(const c of run.checkpoints){
  const stage=spec.stages.find(s=>s.id===c.stage);if(!stage||checkpoints.some(x=>x.stage===c.stage))throw Error('Invalid checkpoint');
  if(!Number.isFinite(c.executionSeconds)||c.executionSeconds<0)throw Error('Invalid duration');duration+=c.executionSeconds;
  const interactions=c.interactions||{};if(!Number.isInteger(interactions.uniqueTurns)||interactions.uniqueTurns<0)throw Error('Unique interaction turn count required');for(const key of Object.keys(effort)){const n=interactions[key]??0;if(!Number.isInteger(n)||n<0)throw Error('Invalid interaction count');effort[key]+=n;}
  const q=reviewed?review.checkpoints?.[c.stage]:null;
  const keys=spec.stageQuality[stage.id];if(!Array.isArray(keys)||!keys.length)throw Error('Stage-specific quality rubric required');
  const quality=Object.fromEntries(keys.map(k=>{const a=q?.[k];return [k,a&&[0,1,2].includes(a.rating)&&a.evidence?.trim()?a:null]}));
  let selection=null;
  if(spec.gradingStages.includes(stage.id)){
   const ids=c.savedJobIds;
   if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length)throw Error('Unique checkpoint savedJobIds required');
   const expected=ref.expectedTargets[stage.id],matched=expected.filter(id=>ids.includes(id));
   selection={expectedCount:expected.length,returnedCount:ids.length,recall:matched.length/expected.length,matched,missing:expected.filter(id=>!ids.includes(id)),unexpected:ids.filter(id=>!expected.includes(id)),scope:'exact predetermined checkpoint targets; extras reviewed separately, not automatically wrong'};
  }
  checkpoints.push({stage:c.stage,quality:{selection,semantic:quality},simulatedCompletionMinute:Number.isFinite(c.simulatedCompletionMinute)?c.simulatedCompletionMinute:null});
 }
 const semanticComplete=checkpoints.length===spec.stages.length&&checkpoints.every(c=>Object.values(c.quality.semantic).every(Boolean));

 const adherence=Object.fromEntries(spec.adherence.map(k=>{const a=reviewed?review.adherence?.[k]:null;return [k,run.condition==='baseline'?{status:'not_applicable'}:a&&['used_correctly','attempted_but_failed','omitted','not_applicable'].includes(a.status)&&a.evidence?.trim()?a:{status:'unreviewed'}]}));
 return {cost:run.cost??null,version:spec.version,evidenceDigest,episodeId:run.episodeId,status:semanticComplete?'reviewed':'review_required',runStatus:run.status,timeToTask:{executionSeconds:duration,wallDurationSeconds:run.wallDurationSeconds??null,sessionStartupSeconds:run.checkpoints.reduce((n,c)=>n+(c.sessionStartupSeconds??0),0)},toolDiagnostics:run.toolDiagnostics??null,effortToTask:effort,qualityOfCompletion:checkpoints,adherence};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
 const {values:v}=parseArgs({options:{source:{type:'string'},reference:{type:'string'},scenario:{type:'string'},stage:{type:'string'},condition:{type:'string'},configuration:{type:'string'},run:{type:'string'},review:{type:'string'},output:{type:'string'}}});
 const spec=read(v.scenario||new URL('../../examples/job01/scenario.json',import.meta.url)),board=source(v.source),ref=read(v.reference);
 const result=v.run?grade(spec,ref,board,read(v.run),v.review?read(v.review):null):packet(spec,ref,board,v.stage,v.condition,v.configuration?read(v.configuration):null);
 const out=JSON.stringify(result,null,2)+'\n';if(v.output)writeFileSync(v.output,out,{flag:'wx',mode:0o600});else process.stdout.write(out);
 }catch(e){console.error(e.message);process.exitCode=1;}
}
