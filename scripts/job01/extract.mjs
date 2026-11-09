#!/usr/bin/env node
// Independent evidence extraction; never invokes or repairs a participant.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {read} from './task.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
export function extract(root,extraction,spec){
 root=fs.realpathSync(root);
 const run=read(path.join(root,'run.json')),frozen=read(path.join(root,'evidence-hashes.json'));
 if(!extraction.reviewer?.trim())throw Error('Independent extractor identity required');
 for(const [relative,expected]of Object.entries(frozen)){
  const file=fs.realpathSync(path.resolve(root,relative));
  if(!file.startsWith(root+path.sep)||hash(fs.readFileSync(file))!==expected)throw Error('Evidence changed or escaped run');
 }
 const out=structuredClone(run);
 for(const c of out.checkpoints){
  const entry=extraction.checkpoints?.[c.stage],stage=spec.stages.find(s=>s.id===c.stage);
  if(!entry||!Array.isArray(entry.evidence)||!entry.evidence.length)throw Error('Cited checkpoint extraction required');
  for(const file of entry.evidence)if(!(file in frozen))throw Error('Cite frozen run artifacts only');
  if(spec.gradingStages.includes(c.stage)){
   if(!Array.isArray(entry.savedJobIds)||entry.savedJobIds.some(id=>typeof id!=='string')||new Set(entry.savedJobIds).size!==entry.savedJobIds.length)throw Error('Explicit unique saved-job IDs required');
   c.savedJobIds=entry.savedJobIds;c.selectionEvidenceStatus='independently_extracted';
  }
  // Count only additional demands not already captured by ask_user; categories are disjoint additions.
  for(const name of ['questions','repeatedContext','reminders','corrections','approvals']){
   const count=entry.additionalInteractions?.[name];
   if(!Number.isInteger(count)||count<0)throw Error('Explicit additional interaction counts required');
   c.interactions[name]+=count;
  }
  c.interactionEvidenceStatus='independently_reviewed';
  c.simulatedCompletionMinute=entry.outcomeComplete===true&&c.status==='completed'?stage.minute+c.executionSeconds/60+c.interactions.questions*spec.policy.userResponseDelayMinutes:null;
  c.extractionEvidence=entry.evidence;
 }
 out.extraction={reviewer:extraction.reviewer,evidenceManifestHash:hash(fs.readFileSync(path.join(root,'evidence-hashes.json'))),timing:'fixed event minute + actual active duration + fixed delay per answered question; uncompleted outcomes remain null'};
 return out;
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename)){
 try{
  const {values:v}=parseArgs({options:{run:{type:'string'},extraction:{type:'string'},scenario:{type:'string'},output:{type:'string'}}});
  const result=extract(v.run,read(v.extraction),read(v.scenario||new URL('../../examples/job01/scenario.json',import.meta.url)));
  fs.writeFileSync(v.output,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
 }catch(e){console.error(e.message);process.exitCode=1;}
}
