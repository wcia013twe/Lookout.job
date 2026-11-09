#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {cli,unwrap,validateReply} from '../n01/langfuse.mjs';
import {read,hash} from './task.mjs';
export function registration(spec,manifest){
 return {datasetName:'Lookout-N02-search-v1',id:'lookout-N02-'+manifest.snapshotId,input:{scenario:spec.version,snapshotId:manifest.snapshotId,sourceHash:manifest.files['jobs.json'],stages:spec.stages.map(({id,session,kind,minute})=>({id,session,kind,minute}))},expectedOutput:{completion:'Saved job selections and evidence-grounded analyses reflect retained career and style preferences.'},metadata:{unit:'whole trajectory',status:'prospective',dimensions:['time_to_task','effort_to_task','quality_of_completion'],privateEvidence:'not uploaded',fitReference:'independently reviewed before participant execution'}};
}
export function scores(run,grade){
 if(grade.evidenceDigest!==hash(run)||grade.episodeId!==run.episodeId)throw Error('Stale grade');
 const traceId=hash(['n02',run.episodeId]).slice(0,32),out=[];
 const add=(name,value,dataType='NUMERIC')=>out.push({id:hash([traceId,name]),traceId,name:'n02_'+name,value,dataType,environment:run.synthetic?'verification':'benchmark'});
 add('time_execution_seconds',grade.timeToTask.executionSeconds);
 for(const [k,v] of Object.entries(grade.effortToTask))add('effort_'+k,v);
 add('quality_review_status',grade.status,'CATEGORICAL');add('run_status',run.status,'CATEGORICAL');
 for(const c of grade.qualityOfCompletion){
  for(const k of ['coverage','selectionPrecision'])if(c.quality[k]!==null)add('quality_'+c.stage+'_'+k,c.quality[k]);
  for(const [k,v] of Object.entries(c.quality.semantic))if(v)add('quality_'+c.stage+'_'+k,v.rating);
  if(c.simulatedCompletionMinute!==null)add('time_'+c.stage+'_simulated_completion_minute',c.simulatedCompletionMinute);
 }
 for(const [k,v] of Object.entries(grade.adherence))add('adherence_'+k,v.status,'CATEGORICAL');
 return {traceId,scores:out};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
 const {values:v}=parseArgs({options:{scenario:{type:'string'},manifest:{type:'string'},register:{type:'boolean'},'dry-run':{type:'boolean'},run:{type:'string'},grade:{type:'string'}}});
 const spec=read(v.scenario||new URL('../../examples/n02/scenario.json',import.meta.url));
 if(v.register){const item=registration(spec,read(v.manifest));if(v['dry-run'])console.log(JSON.stringify(item,null,2));else {const ds=unwrap(cli(['datasets','create'],{name:item.datasetName,description:'N02 bounded job selection and analysis across sessions; prospective infrastructure only.'}));const saved=unwrap(cli(['dataset-items','create'],item));console.log(JSON.stringify({datasetId:ds.id,itemId:saved.id,status:'registered_no_participant_run'}));}}
 else {const run=read(v.run),grade=read(v.grade),plan=scores(run,grade);if(!v['dry-run'])throw Error('Score plan only: participant host must attach trajectory trace and dataset-run item before upload');console.log(JSON.stringify(plan,null,2));}
 }catch(e){console.error(e.message);process.exitCode=1;}
}
