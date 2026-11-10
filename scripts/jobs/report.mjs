// Post-grade adapter only; never executes participants, graders or product writes.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';import {parseArgs} from 'node:util';
import {validate,hash} from '../evals/contract.mjs';import {exportProvenance} from '../evals/provenance.mjs';import * as job03 from '../job03/task.mjs';import * as job04 from '../job04/task.mjs';
const repo=path.resolve(import.meta.dirname,'../..'),read=p=>JSON.parse(fs.readFileSync(p,'utf8')),digest=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n',{mode:0o600,flag:'wx'});
export function validateGrader(receipt,submissionFile){
 if(receipt.status!=='completed'||receipt.role!=='independent_grader'||receipt.model!=='gpt-5.6-terra'||JSON.stringify(receipt.observedModels)!==JSON.stringify(['gpt-5.6-terra'])||receipt.model_reasoning_effort!=='medium'||receipt.subscriptionOnly!==true||receipt.evidenceReadOnly!==true||receipt.evidenceUnchanged!==true||receipt.containerRemoved!==true||receipt.timing?.valid!==true||receipt.reviewSha256!==digest(submissionFile))throw Error('Completed exact-model independent grading provenance required');
}
function replay(root,api,submission){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'job-report-verify-'));
 try{
  for(const name of ['configuration.json','freeze.json','suite','candidate','runs']){const source=path.join(root,name);if(fs.existsSync(source))fs.cpSync(source,path.join(tmp,name),{recursive:true,filter:p=>{if(fs.lstatSync(p).isSymbolicLink())throw Error('Symlink in grading evidence');return true;}});}
  fs.mkdirSync(path.join(tmp,'grading'));for(const name of ['assignment.json','handoff.json'])fs.copyFileSync(path.join(root,'grading',name),path.join(tmp,'grading',name));
  return api.finalize(tmp,submission);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}
export function record({caseId,spec,configuration,run,grade,evidenceDigest,campaign,provenance}){
 const complete=grade?.status==='reviewed',cp=run.checkpoints||[];const active=cp.length&&cp.every(x=>Number.isFinite(x.executionSeconds))?cp.reduce((n,x)=>n+x.executionSeconds,0):null;
 return validate({schemaVersion:1,campaignId:campaign,suiteId:'jobs',suiteVersion:'1',scenarioId:caseId,scenarioVersion:spec.version,condition:run.condition,repeat:configuration.repeat??run.repeat??1,episodeId:run.episodeId||run.pairId+'-'+run.condition,model:configuration.model,reasoning:configuration.reasoning,harnessVersion:configuration.hostVersion||'jobs-host',graderVersion:spec.graderVersion,evidenceDigest,startedAt:Date.parse(run.startedAt)/1000,endedAt:Date.parse(run.endedAt)/1000,status:run.status,pilot:false,synthetic:false,cost:grade?.cost??run.cost??null,evaluation:{reviewed:complete,taskSuccess:complete&&caseId==='JOB03'?grade.strictPass:null,quality:complete&&caseId==='JOB03'?grade.qualityFraction:null,activeSeconds:active,toolCalls:null,wakesUsed:null},provenance:exportProvenance(provenance)});
}
export function prepareReport(root,{campaign,output,graderRun,structuralOnly=false,evaluationId,repairStatus='none',confoundStatus='none'}){
 if(fs.existsSync(output))throw Error('Preserve existing report; use --deliver to retry saved records');
 const configuration=read(path.join(root,'configuration.json')),caseId=configuration.benchmarkTaskId,api=caseId==='JOB03'?job03:caseId==='JOB04'?job04:null;if(!api)throw Error('JOB03/04 required');
 const freeze=api.frozen(root,{reviewOnly:true}),spec=read(path.join(root,'suite/scenario.json'));let final=null,receipt=null;
 if(!structuralOnly){
  const submission=path.join(root,'grading/independent-submission.json');if(!graderRun)throw Error('Grader receipt required, or explicitly export structural-only');receipt=read(graderRun);validateGrader(receipt,submission);final=read(path.join(root,'grading/final.json'));
  if(hash(replay(root,api,read(submission)))!==hash(final))throw Error('Deterministic grading replay differs from final result');
 }
 const records=[],local=[];
 for(const condition of ['baseline','lookout']){
  const dir=path.join(root,'runs',condition);if(!fs.existsSync(path.join(dir,'run.json')))continue;const run=read(path.join(dir,'run.json')),grade=final?.grades?.[condition];
  const manifest=fs.existsSync(path.join(dir,'evidence-hashes.json'))?read(path.join(dir,'evidence-hashes.json')):{};
  for(const [relative,h]of Object.entries(manifest)){const p=path.resolve(dir,relative);if(!p.startsWith(path.resolve(dir)+path.sep)||digest(p)!==h)throw Error('Changed run evidence');}
  const provenance={evaluationId:evaluationId??run.pairId,caseId,conditionOrder:(configuration.conditionOrder||['baseline','lookout']).join(','),participantModel:configuration.model,participantReasoning:configuration.reasoning,graderModel:receipt?.model??null,graderReasoning:receipt?.model_reasoning_effort??null,participantFreezeDigest:hash(freeze),graderFreezeDigest:receipt?hash([receipt.executorSha256,receipt.instructionsSha256]):null,graderEvidenceDigest:receipt?hash(receipt.evidenceManifest):null,graderReceiptDigest:receipt?hash(receipt):null,failureStatus:run.status,repairStatus,confoundStatus,usageCoverage:run.cost?.coverage?.status??'unknown',exporterSourceDigest:digest(fileURLToPath(import.meta.url)),timingValid:run.checkpoints?.length?run.checkpoints.every(c=>Number.isFinite(c.executionSeconds)):null};
  records.push(record({caseId,spec,configuration,run,grade,evidenceDigest:hash({freeze,run,manifest,final,graderReceipt:receipt?hash(receipt):null}),campaign,provenance}));
  local.push({condition,adherence:grade?.adherence?Object.fromEntries(Object.entries(grade.adherence).map(([k,v])=>[k,v.status])):null,gradingStatus:grade?.status??'unreviewed',sourceRoot:root,graderReceipt:graderRun??null,toolCallsCoverage:'not_normalized; native and executor diagnostics remain local',detailedRemoteExporter:'unsupported_for_JOB03_JOB04'});
 }
 if(!records.length)throw Error('No terminal attempts to report');fs.mkdirSync(output,{recursive:true,mode:0o700});
 for(const r of records)save(path.join(output,r.condition+'.json'),r);
 save(path.join(output,'report.json'),{records:records.map(r=>({condition:r.condition,file:r.condition+'.json',sha256:digest(path.join(output,r.condition+'.json'))})),local,structuralOnly,sourceFinalDigest:final?hash(final):null});return records;
}
export function deliver(output,execute=spawnSync){
 const report=read(path.join(output,'report.json'));const prior=fs.readdirSync(output).filter(x=>/^delivery-\d+\.json$/.test(x)).sort((a,b)=>Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0]));if(prior.length&&read(path.join(output,prior.at(-1))).verified)return read(path.join(output,prior.at(-1)));if(prior.length>=3)throw Error('Bounded delivery attempts exhausted; retain export-only blocker');const results=[];
 for(const item of report.records){const file=path.join(output,item.file);if(digest(file)!==item.sha256)throw Error('Saved export changed');const steps=[];
  for(const verify of [false,true]){const argv=[path.join(repo,'scripts/evals/langfuse.mjs'),'--record',file,'--receipt-dir',path.join(output,'langfuse'),...(verify?['--verify']:[])];const r=execute(process.execPath,argv,{encoding:'utf8',timeout:240000,maxBuffer:1024*1024});steps.push({phase:verify?'paginated_readback':'upload',status:r.status===0?'passed':'failed'});if(r.status!==0)break;}
  results.push({condition:item.condition,verified:steps.length===2&&steps.every(s=>s.status==='passed'),steps});
 }
 const result={deliveryOnly:true,participantsRerun:false,gradersRerun:false,verified:results.every(x=>x.verified),results};save(path.join(output,'delivery-'+(prior.length+1)+'.json'),result);return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))try{
 const {values:v}=parseArgs({options:{root:{type:'string'},output:{type:'string'},campaign:{type:'string'},'grader-run':{type:'string'},'evaluation-id':{type:'string'},'repair-status':{type:'string'},'confound-status':{type:'string'},'structural-only':{type:'boolean'},publish:{type:'boolean'},deliver:{type:'string'}}});
 const output=v.deliver||v.output;if(!output)throw Error('New --output or saved --deliver directory required');if(!v.deliver)prepareReport(v.root,{output,campaign:v.campaign,graderRun:v['grader-run'],evaluationId:v['evaluation-id'],structuralOnly:v['structural-only'],repairStatus:v['repair-status'],confoundStatus:v['confound-status']});
 const result=v.publish?deliver(output):{status:'local_records_only',fullyReported:false};console.log(JSON.stringify(result));if(result.verified===false)process.exitCode=1;
}catch(error){console.error(error.message);process.exitCode=1;}
