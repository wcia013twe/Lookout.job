#!/usr/bin/env node
import {mkdirSync,writeFileSync,existsSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {tracingConfig} from '../../backend/runtime/trace-policy.mjs';
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {cli,unwrap,validateReply} from '../n01/langfuse.mjs';
import {read,hash} from './task.mjs';
export function registration(spec,manifest){
 return {datasetName:'Lookout-'+spec.version,id:'lookout-'+spec.version+'-'+manifest.snapshotId,input:{scenario:spec.version,snapshotId:manifest.snapshotId,sourceHash:manifest.files['jobs.json'],expectedTargetCount:spec.expectedTargetCount,stages:spec.stages.map(({id,session,kind,minute})=>({id,session,kind,minute}))},expectedOutput:{completion:'Saved job selections and evidence-grounded analyses reflect retained career and style preferences.'},metadata:{unit:'whole trajectory',status:'prospective',dimensions:['time_to_task','effort_to_task','quality_of_completion'],privateEvidence:'not uploaded',fitReference:'independently reviewed before participant execution'}};
}
export function scores(run,grade){
 if(grade.evidenceDigest!==hash(run)||grade.episodeId!==run.episodeId)throw Error('Stale grade');
 const traceId=hash([run.version,run.condition,run.episodeId]).slice(0,32),out=[];
 const add=(name,value,dataType='NUMERIC')=>out.push({id:hash([traceId,name]),traceId,name:'n02_'+name,value,dataType,environment:run.synthetic?'verification':'benchmark'});
 add('time_execution_seconds',grade.timeToTask.executionSeconds);
 for(const [k,v] of Object.entries(grade.effortToTask))add('effort_'+k,v);
 add('quality_review_status',grade.status,'CATEGORICAL');add('run_status',run.status,'CATEGORICAL');
 for(const c of grade.qualityOfCompletion){
  if(c.quality.selection){add('quality_'+c.stage+'_expected_recall',c.quality.selection.recall);add('quality_'+c.stage+'_missing_count',c.quality.selection.missing.length);add('quality_'+c.stage+'_extra_count',c.quality.selection.unexpected.length);}
  for(const k of ['coverage','selectionPrecision'])if(Number.isFinite(c.quality[k]))add('quality_'+c.stage+'_'+k,c.quality[k]);
  for(const [k,v] of Object.entries(c.quality.semantic))if(v)add('quality_'+c.stage+'_'+k,v.rating);
  if(c.simulatedCompletionMinute!==null)add('time_'+c.stage+'_simulated_completion_minute',c.simulatedCompletionMinute);
 }
 if(grade.finalSelection){for(const k of ['coverage','selectionPrecision','savedCount','targetLimit'])if(Number.isFinite(grade.finalSelection[k]))add('quality_final_'+k,grade.finalSelection[k]);add('quality_final_over_limit',grade.finalSelection.overLimit?1:0);for(const [k,v] of Object.entries(grade.finalSelection.semantic))if(v)add('quality_final_'+k,v.rating);}
 for(const [k,v] of Object.entries(grade.adherence))add('adherence_'+k,v.status,'CATEGORICAL');
 return {traceId,scores:out};
}
const attr=(key,v)=>({key,value:{stringValue:String(v)}});
export function build(run,grade,spec,reg){
 if(run.version!==spec.version||grade.version!==spec.version||!['completed','timed_out','execution_failed','harness_failed'].includes(run.status))throw Error('Terminal matching run required');
 if(reg.scenarioHash!==hash(spec)||reg.snapshotId!==run.snapshotId||reg.sourceHash!==run.sourceHash)throw Error('Registration binding mismatch');
 if(!Number.isFinite(run.startedAt)||run.startedAt<=0)throw Error('startedAt epoch seconds required');
 if(run.checkpoints.reduce((n,c)=>n+c.executionSeconds,0)!==grade.timeToTask.executionSeconds)throw Error('Duration mismatch');
 const plan=scores(run,grade),rootId=hash(plan.traceId+'root').slice(0,16);
 const experimentId=hash([spec.version,run.pairId||run.episodeId,run.condition,run.synthetic===true]);
 const base={'langfuse.experiment.id':experimentId,'langfuse.experiment.name':`${spec.version}-${run.synthetic?'synthetic':'measured'}-${run.pairId||run.episodeId}-${run.condition}`,'langfuse.experiment.dataset.id':reg.datasetId,'langfuse.experiment.item.id':reg.itemId,'langfuse.experiment.item.root_observation_id':rootId,'langfuse.environment':run.synthetic?'verification':'benchmark','langfuse.trace.name':'N02 job selection trajectory','session.id':run.episodeId,'langfuse.experiment.metadata.condition':run.condition,'langfuse.experiment.metadata.synthetic':String(run.synthetic===true),'langfuse.experiment.metadata.capture':'structure-only','langfuse.experiment.metadata.timeline':'synthetic sequential execution durations; not wall-clock stage timestamps'};
 const ns=x=>(BigInt(Math.round(x*1e6))*1000n).toString();
 const span=(id,name,start,seconds,parent)=>({traceId:plan.traceId,spanId:id,...(parent?{parentSpanId:parent}:{}),name,kind:1,startTimeUnixNano:ns(start),endTimeUnixNano:ns(start+seconds),attributes:Object.entries({...base,'langfuse.observation.type':'span'}).map(([k,v])=>attr(k,v))});
 const spans=[span(rootId,'N02 job selection trajectory',run.startedAt,grade.timeToTask.executionSeconds)];let cursor=run.startedAt;
 for(const c of run.checkpoints){if(!Number.isFinite(c.executionSeconds)||c.executionSeconds<0)throw Error('Invalid checkpoint duration');spans.push(span(hash(plan.traceId+c.stage).slice(0,16),c.stage,cursor,c.executionSeconds,rootId));cursor+=c.executionSeconds;}
 return {...plan,rootId,experimentId,spans,scores:plan.scores.map(s=>({...s,observationId:rootId}))};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
 const {values:v}=parseArgs({options:{scenario:{type:'string'},manifest:{type:'string'},register:{type:'boolean'},'dry-run':{type:'boolean'},verify:{type:'boolean'},'receipt-dir':{type:'string'},run:{type:'string'},grade:{type:'string'}}});
 const spec=read(v.scenario||new URL('../../examples/n02/scenario.json',import.meta.url));
 const config=tracingConfig(),project=hash(config?[config.baseUrl,config.publicKey]:['offline']);
 const dir=path.resolve(v['receipt-dir']||'.langfuse-exports/n02');mkdirSync(dir,{recursive:true,mode:0o700});
 const regfile=path.join(dir,project+'-'+spec.version+'-dataset.json');
 if(v.register){
  const manifest=read(v.manifest),item=registration(spec,manifest);
  if(v['dry-run'])console.log(JSON.stringify(item,null,2));
  else {
   const ds=unwrap(cli(['datasets','create'],{name:item.datasetName,description:'N02 bounded job selection and analysis across sessions; prospective infrastructure only.'}));const saved=unwrap(cli(['dataset-items','create'],item));
   if(!ds.id||!saved.id)throw Error('Registration IDs missing');
   const reg={datasetId:ds.id,itemId:saved.id,scenarioHash:hash(spec),snapshotId:manifest.snapshotId,sourceHash:manifest.files['jobs.json']};
   writeFileSync(regfile,JSON.stringify(reg,null,2)+'\n',{mode:0o600});console.log(JSON.stringify({...reg,status:'registered_no_participant_run'}));
  }
 } else {
  const run=read(v.run),grade=read(v.grade);
  if(!existsSync(regfile))throw Error('Register dataset first using same receipt directory and project');
  const plan=build(run,grade,spec,read(regfile));
  const receipt=path.join(dir,project+'-'+plan.traceId+'-'+hash(plan.scores)+'.json');
  if(v['dry-run'])console.log(JSON.stringify({traceId:plan.traceId,experimentId:plan.experimentId,observations:plan.spans.length,scores:plan.scores.length}));
  else if(v.verify){
   const arr=x=>Array.isArray(x)?x:x.data||[];
   const obs=arr(unwrap(cli(['observations','list','--trace-id',plan.traceId,'--limit','1000','--fields','core,basic,metadata'])));
   const sc=arr(unwrap(cli(['scores','list','--trace-id',plan.traceId,'--limit','100','--fields','subject'])));
   const ex=arr(unwrap(cli(['experiments','list','--id',plan.experimentId,'--from-start-time',new Date(run.startedAt*1000-1000).toISOString()])));
   const verified=plan.spans.every(s=>obs.some(o=>o.id===s.spanId))&&plan.scores.every(s=>sc.some(o=>o.id===s.id&&o.value===s.value&&o.subject?.id===plan.rootId&&o.subject?.traceId===plan.traceId&&o.environment===s.environment))&&ex.some(e=>e.id===plan.experimentId);
   writeFileSync(receipt+'.verification.json',JSON.stringify({verified,traceId:plan.traceId,experimentId:plan.experimentId})+'\n',{mode:0o600});
   if(!verified)throw Error('Read-back incomplete; verify later without rerunning participant');console.log(JSON.stringify({verified,traceId:plan.traceId,experimentId:plan.experimentId}));
  } else {
   const lock=receipt+'.lock';closeSync(openSync(lock,'wx',0o600));
   try{
    if(existsSync(receipt))console.log(JSON.stringify({status:'already_accepted',traceId:plan.traceId}));
    else {
     validateReply(cli(['otel','export-traces'],{resourceSpans:[{resource:{attributes:[attr('service.name','lookout-n02')]},scopeSpans:[{scope:{name:'lookout-n02',version:spec.version},spans:plan.spans}]}]}));
     validateReply(cli(['scores','create'],plan.scores));
     const result={status:'accepted_not_verified',traceId:plan.traceId,experimentId:plan.experimentId};writeFileSync(receipt,JSON.stringify(result)+'\n',{mode:0o600});console.log(JSON.stringify(result));
    }
   }finally{unlinkSync(lock);}
  }
 }
 }catch(e){console.error(e.message);process.exitCode=1;}
}
