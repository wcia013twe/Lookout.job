#!/usr/bin/env node
// Versioned experiment mapping. Structural upload only; no participant credentials/content.
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {tracingConfig} from '../../backend/runtime/trace-policy.mjs';
const sha=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const rows=p=>existsSync(p)?readFileSync(p,'utf8').split('\n').filter(Boolean).map(JSON.parse):[];
const attr=(key,v)=>({key,value:typeof v==='number'?{doubleValue:v}:{stringValue:typeof v==='string'?v:JSON.stringify(v)}});
const ns=n=>{if(!Number.isFinite(n)||n<=0)throw Error('Invalid timestamp');return (BigInt(Math.round(n*1e6))*1000n).toString()};
export function cli(args,body){
 const config=tracingConfig();if(!config)throw Error('Langfuse configuration missing');
 const executable=process.env.LANGFUSE_CLI||'npx';
 const prefix=process.env.LANGFUSE_CLI?[]:['--yes','langfuse-cli@1.3.1'];
 const r=spawnSync(executable,[...prefix,'api',...args,...(body===undefined?[]:['--body-file','-']),'--json'],{input:body===undefined?undefined:JSON.stringify(body),encoding:'utf8',timeout:60000,maxBuffer:20e6,env:{...process.env,LANGFUSE_HOST:config.baseUrl,LANGFUSE_BASE_URL:config.baseUrl,LANGFUSE_SECRET_KEY:config.secretKey}});
 if(r.status!==0)throw Error('Langfuse CLI failed for '+args.slice(0,2).join(' ')+'; credentials and response bodies suppressed');
 const parsed=JSON.parse(r.stdout);
 if(parsed.status===207||parsed.statusCode===207||parsed.ok===false)throw Error('Langfuse rejected all or part of the request; do not rerun participant');
 return parsed;
}
export function unwrap(r){return r.body??r.data??r;}
export function build(run,grade,spec,registration={}){
 const m=json(path.join(run,'run.json'));
 if(!['completed','execution_failed','timed_out','setup_failed','artifact_failed'].includes(m.status))throw Error('Terminal run required');
 if(grade.scenarioDigest!==m.scenarioDigest)throw Error('Grade/run rubric mismatch');
 if(grade.graderVersion!=='COM1-grade-v2')throw Error('Unsupported grader version');
 if(m.version!==spec.version||grade.version!==spec.version||grade.episodeId!==m.episodeId)throw Error('Run/grade/scenario mismatch');
 const evidence=spawnSync('python3',[path.join(path.dirname(fileURLToPath(import.meta.url)),'digest.py'),run],{encoding:'utf8'});
 if(evidence.status!==0||evidence.stdout.trim()!==grade.evidenceDigest)throw Error('Stale grade evidence');
 const datasetId=registration.datasetId||'lookout-com1-stream-v3';
 const itemId=registration.itemId||'COM1-stream-v3';
 const experimentId=sha(['com1-export-1',spec.version,m.pairId,m.condition,m.repeat,m.pilot===true]);
 const traceId=sha(['com1-export-1',spec.version,m.episodeId]).slice(0,32),rootId=sha(traceId+'root').slice(0,16);
 const experimentName=`${spec.version}-${m.pilot?'pilot':'measured'}-${m.pairId}-${m.condition}-r${m.repeat}`;
 const base={'langfuse.experiment.id':experimentId,'langfuse.experiment.name':experimentName,'langfuse.experiment.dataset.id':datasetId,'langfuse.experiment.item.id':itemId,'langfuse.experiment.item.root_observation_id':rootId,'langfuse.environment':m.synthetic?'verification':'benchmark','langfuse.trace.name':'COM1 networking trajectory','session.id':m.episodeId,'langfuse.experiment.metadata.condition':m.condition,'langfuse.experiment.metadata.model':m.model,'langfuse.experiment.metadata.reasoning':m.reasoning,'langfuse.experiment.metadata.pilot':String(m.pilot===true),'langfuse.experiment.metadata.synthetic':String(m.synthetic===true),'langfuse.experiment.metadata.capture':'structure-only'};
 const spans=[];
 function span(id,name,type,start,end,parent,extra={}){
  spans.push({traceId,spanId:id,...(parent?{parentSpanId:parent}:{}),name,kind:1,startTimeUnixNano:ns(start),endTimeUnixNano:ns(Math.max(start,end)),attributes:Object.entries({...base,'langfuse.observation.type':type,...extra}).map(([k,v])=>attr(k,v))});
 }
 span(rootId,'COM1 networking trajectory','span',m.startedAt,m.startedAt+m.durationSeconds,null,{'langfuse.observation.input':JSON.stringify({scenario:spec.version}),'langfuse.observation.output':JSON.stringify({status:m.status,grading:'see root scores'}),'langfuse.experiment.item.expected_output':JSON.stringify(Object.fromEntries(Object.keys(spec.quality).map(k=>[k,true])))});
 for(const dir of readdirSync(run).filter(n=>/^stage-\d+$/.test(n)).sort()){
  const sd=path.join(run,dir);if(!existsSync(path.join(sd,'stage-run.json')))continue;
  const s=json(path.join(sd,'stage-run.json')),stageId=sha(traceId+dir).slice(0,16);
  const logs=rows(path.join(sd,'trace.jsonl'));
  span(stageId,dir,'agent',s.startedAt,s.startedAt+s.durationSeconds,rootId,{'langfuse.observation.metadata.status':s.status,'langfuse.observation.metadata.threadId':s.threadId||'unknown','langfuse.observation.metadata.reportedUsage':s.usage||{},'langfuse.observation.metadata.usageScope':'whole session, not exact model calls','langfuse.observation.metadata.delivery':json(path.join(sd,'delivery.json'))});
  const pending=new Map();
  logs.forEach((r,i)=>{
   const e=r.event,x=e?.item;if(e?.type==='item.started'&&x?.id)pending.set(x.id,r);
   if(e?.type!=='item.completed'||!x)return;
   const began=pending.get(x.id);pending.delete(x.id);
   if(x.type==='reasoning')return;
   span(sha(traceId+dir+i).slice(0,16),x.type==='mcp_tool_call'?'call-tool':x.type,x.type==='agent_message'?'event':'tool',began?.capturedAt||r.capturedAt,r.capturedAt,stageId,{'langfuse.observation.metadata.itemType':x.type,'langfuse.observation.metadata.tool':x.tool||'','langfuse.observation.metadata.status':x.status||'completed','langfuse.observation.metadata.exitCode':x.exit_code??''});
  });
  for(const [id,r] of pending){if(r.event.item.type==='reasoning')continue;span(sha(traceId+dir+id+'unfinished').slice(0,16),'unfinished-tool','tool',r.capturedAt,s.startedAt+s.durationSeconds,stageId,{'langfuse.observation.level':'ERROR','langfuse.observation.metadata.status':'completion-not-observed'});}
 }
 const scores=[];
 function score(name,value,dataType='NUMERIC'){
  scores.push({id:sha([traceId,name]),traceId,observationId:rootId,name:'com1_'+name,value,dataType,environment:m.synthetic?'verification':'benchmark',timestamp:new Date((m.startedAt+m.durationSeconds)*1000).toISOString(),comment:'COM1-stream-v3; '+grade.status});
 }
 for(const [k,v] of Object.entries(grade.metrics))if(Number.isFinite(v))score(k,v);
 score('review_status',grade.status,'CATEGORICAL');
 for(const [k,v] of Object.entries(grade.adherence))score('adherence_'+k,v.status,'CATEGORICAL');
 for(const [k,v] of Object.entries(grade.quality))if(typeof v==='boolean')score('quality_'+k,v?1:0,'BOOLEAN');
 for(const l of grade.latencies)if(l.simulated_waiting_minutes!==null)score('stage_'+l.stage+'_simulated_waiting_minutes',l.simulated_waiting_minutes);
 return {traceId,rootId,experimentId,experimentName,datasetId,itemId,spans,scores};
}
export function validateReply(reply){
 const b=unwrap(reply);
 if(b?.partialSuccess?.errorMessage||Number(b?.partialSuccess?.rejectedSpans||0)>0||Number(b?.rejected||b?.rejectedCount||0)>0)throw Error('Partial Langfuse ingestion; local evidence retained');
}
async function main(){
 const {values:v}=parseArgs({options:{run:{type:'string'},grade:{type:'string'},register:{type:'boolean'},'dry-run':{type:'boolean'},verify:{type:'boolean'},connection:{type:'boolean'},'receipt-dir':{type:'string'},scenario:{type:'string'}}});
 const spec=json(v.scenario||path.join(path.dirname(fileURLToPath(import.meta.url)),'../../examples/n01/scenario.json'));
 if(v.connection){const p=unwrap(cli(['projects','list']));console.log(JSON.stringify(p));return;}
 const receiptDir=path.resolve(v['receipt-dir']||'.langfuse-exports/n01');
 mkdirSync(receiptDir,{recursive:true,mode:0o700});
 const config=tracingConfig();const project=sha(config?[config.baseUrl,config.publicKey]:['offline']);
 const regfile=path.join(receiptDir,project+'-dataset.json');
 if(v.register){
  const name='Lookout-COM1-stream-v3';
  const ds=unwrap(cli(['datasets','create'],{name,description:'COM1 networking across sessions. Structural manifest only; private user profile and event packets stay local.',metadata:{version:spec.version,unit:'whole trajectory',status:'prospective'}}));
  if(!ds.id)throw Error('Missing dataset id');
  const item=unwrap(cli(['dataset-items','create'],{datasetName:name,id:'lookout-COM1-stream-v3',input:{scenario:spec.version,stages:spec.stages.map(s=>({id:s.id,kind:s.kind,minute:s.minute})),policy:spec.policy},expectedOutput:Object.fromEntries(Object.keys(spec.quality).map(k=>[k,true])),metadata:{version:spec.version,privateEvidence:'not uploaded'}}));
  if(!item.id)throw Error('Missing item id');
  const saved={datasetId:ds.id,itemId:item.id,name,scenarioHash:sha(spec)};writeFileSync(regfile,JSON.stringify(saved,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(saved));return;
 }
 if(!v.run||!v.grade)throw Error('--run and --grade required');
 const reg=existsSync(regfile)?json(regfile):{};
 if(!v['dry-run']&&!reg.datasetId)throw Error('Register the prospective dataset first');
 if(reg.scenarioHash&&reg.scenarioHash!==sha(spec))throw Error('Scenario changed after dataset registration');
 const plan=build(path.resolve(v.run),json(v.grade),spec,reg);
 const receipt=path.join(receiptDir,project+'-'+plan.traceId+'-'+sha(plan.scores)+'.json');
 if(v['dry-run']){console.log(JSON.stringify({traceId:plan.traceId,experimentId:plan.experimentId,observations:plan.spans.length,scores:plan.scores.length,mode:'structure-only'}));return;}
 if(v.verify){
  const observations=unwrap(cli(['observations','list','--trace-id',plan.traceId,'--limit','1000','--fields','core,basic,metadata']));
  const scores=unwrap(cli(['scores','list','--trace-id',plan.traceId,'--limit','100','--fields','subject']));
  const experiments=unwrap(cli(['experiments','list','--id',plan.experimentId,'--from-start-time',new Date(Number(BigInt(plan.spans[0].startTimeUnixNano)/1000000n)-1000).toISOString()]));
  const arr=x=>Array.isArray(x)?x:x.data||[];
  const obs=arr(observations),sc=arr(scores),ex=arr(experiments);
  const verified=plan.spans.every(s=>obs.some(o=>o.id===s.spanId))&&plan.scores.every(s=>sc.some(o=>o.id===s.id&&o.name===s.name&&o.value===(s.dataType==='BOOLEAN'?Boolean(s.value):s.value)&&o.subject?.kind==='observation'&&o.subject?.id===plan.rootId&&o.subject?.traceId===plan.traceId&&o.environment===s.environment))&&ex.some(e=>e.id===plan.experimentId);
  writeFileSync(receipt+'.verification.json',JSON.stringify({verified,observations:obs.length,scores:sc.length,experiments:ex.length,traceId:plan.traceId},null,2)+'\n');
  if(!verified)throw Error('Read-back incomplete; no participant retry. Allow ingestion delay, then verify again.');
  console.log(JSON.stringify({verified,traceId:plan.traceId,experimentId:plan.experimentId}));return;
 }
 const lock=receipt+'.lock';closeSync(openSync(lock,'wx',0o600));
 try{
  if(existsSync(receipt)){console.log(JSON.stringify({status:'already_accepted',traceId:plan.traceId}));return;}
  for(let i=0;i<plan.spans.length;i+=50){
   const response=cli(['otel','export-traces'],{resourceSpans:[{resource:{attributes:[attr('service.name','lookout-n01')]},scopeSpans:[{scope:{name:'lookout-n01-stream',version:spec.version},spans:plan.spans.slice(i,i+50)}]}]});validateReply(response);
  }
  validateReply(cli(['scores','create'],plan.scores));
  writeFileSync(receipt,JSON.stringify({status:'accepted',traceId:plan.traceId,experimentId:plan.experimentId,observations:plan.spans.length,scores:plan.scores.length},null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({status:'accepted_not_verified',traceId:plan.traceId,experimentId:plan.experimentId}));
 }finally{unlinkSync(lock);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1});
