#!/usr/bin/env node
// JOB03 offline coordinator. It never imports participant/account credentials.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';
import {summarize as summarizeCost,validatePolicy} from './cost.mjs';
import * as hostGates from '../jobs/preflight.mjs';
export const hash=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
export const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
export const write=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n',{flag:'wx',mode:0o600});
const check=(x,m)=>{if(!x)throw Error(m);};
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const conditions=['baseline','lookout'];
export function prepare(root,configuration){
 check(!fs.existsSync(root),'Destination must be new');
 check(configuration?.benchmarkTaskId==='JOB03'&&configuration.dedicated===true&&configuration.fictional===true,'Dedicated fictional JOB03 configuration required');
 check(typeof configuration.source==='string'&&configuration.source.trim()&&configuration.normalProductConfiguration&&configuration.model&&configuration.reasoning,'Record actual normal product configuration, source, model and reasoning');
 fs.mkdirSync(root,{recursive:true,mode:0o700});fs.mkdirSync(path.join(root,'suite'));
 validatePolicy(configuration.costPolicy);
 const files=['scripts/job03/cost.mjs','examples/job03/scenario.json','examples/job03/fixture.json','scripts/job03/task.mjs','scripts/job03/grader-instructions.md'];
 const bindings={};for(const f of files){const content=fs.readFileSync(path.join(base,f));const name=path.basename(f);fs.writeFileSync(path.join(root,'suite',name),content,{flag:'wx',mode:0o600});bindings[name]=hash(content.toString());}
 write(path.join(root,'configuration.json'),configuration);bindings['configuration.json']=hash(configuration);
 const executables=Object.fromEntries(['scripts/job03/task.mjs','scripts/job03/cost.mjs','scripts/n01/cost-export.mjs'].map(n=>{const p=path.join(base,n);return [p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')];}));
 write(path.join(root,'freeze.json'),{version:read(path.join(root,'suite/scenario.json')).version,files:bindings,executables,createdAt:new Date().toISOString(),participantExecuted:false});return {prepared:true,root};
}
export function frozen(root,{reviewOnly=false}={}){const f=read(path.join(root,'freeze.json'));for(const [name,h]of Object.entries(f.files)){const content=name==='configuration.json'?hash(read(path.join(root,name))):hash(fs.readFileSync(path.join(root,'suite',name),'utf8'));check(content===h,'Frozen input changed: '+name);}if(!reviewOnly)for(const [name,h]of Object.entries(f.executables||{}))check(crypto.createHash('sha256').update(fs.readFileSync(name)).digest('hex')===h,'Frozen executable changed: '+name);return f;}
// Bind adapter entrypoint plus declared dependencies/image locks; argv alone is insufficient.
export function runtimeBinding(command,config){
 check(Array.isArray(command)&&command.length&&command.every(x=>typeof x==='string'),'Adapter command argv required');
 check(path.isAbsolute(command[0]),'Absolute adapter executable required');
 check(config.runtimeFiles===undefined||Array.isArray(config.runtimeFiles),'runtimeFiles must list adapter dependencies');
 const names=[...command.filter(v=>path.isAbsolute(v)&&fs.existsSync(v)&&fs.statSync(v).isFile()),...(config.runtimeFiles||[])];
 const files=Object.fromEntries(names.map(name=>{const real=fs.realpathSync(name);check(fs.statSync(real).isFile(),'Runtime binding must be a file');return [real,crypto.createHash('sha256').update(fs.readFileSync(real)).digest('hex')];}));
 check(command.some(v=>path.isAbsolute(v)&&fs.existsSync(v)&&files[fs.realpathSync(v)]),'Adapter entrypoint must be in runtimeFiles');
 return {command,files};
}
// One JSON request/response per process. No shell interpolation, no implicit retries.
export function adapter(command,request,timeout=30000){
 check(Array.isArray(command)&&command.length&&command.every(x=>typeof x==='string'),'Adapter command argv required');
 const r=spawnSync(command[0],command.slice(1),{input:JSON.stringify(request)+'\n',encoding:'utf8',timeout,maxBuffer:16*1024*1024});
 if(r.error)throw Error(r.error.code==='ETIMEDOUT'?'adapter_timeout':r.error.message);
 check(r.status===0,'adapter_failed: '+(r.stderr||'').slice(0,500));const result=JSON.parse(r.stdout);check(!result.error,'adapter_error: '+JSON.stringify(result.error));return result;
}
function bound(result,request){check(result.requestHash===hash(request)&&result.receiptId&&result.capturedAt&&result.ownerId===request.ownerId,'Missing request/owner-bound service receipt');}
export function preflight(root,command,output){
 const freeze=frozen(root),config=read(path.join(root,'configuration.json'));const calls=[];
 const receipt={version:freeze.version,freezeHash:hash(freeze),configurationHash:hash(config),adapterCommandHash:hash(command),participantExecuted:false,ready:false,status:'blocked',calls,blockers:[]};
 const call=(operation,args={})=>{const req={operation,benchmarkTaskId:'JOB03',ownerId:config.ownerId,...args};const entry={request:req};calls.push(entry);try{const r=adapter(command,req,operation==='host.preflight'?300000:30000);entry.result=r;bound(r,req);return r;}catch(e){entry.error=e.message;throw e;}};
 try{
  check(command,'No actual JOB03 native/reminder adapter configured');
  check(config.ownerId&&config.readOnlyOwnerId===config.ownerId,'Dedicated native owner and read-only confirmation owner required');
  check(config.normalProductConfiguration.status!=='not_captured','Actual normal product configuration has not been captured');
  receipt.runtime=runtimeBinding(command,config);
  if(['jobs-host-v1','jobs-host-v2','jobs-host-v3'].includes(config.hostVersion)){
   const {verifyHostGates}=hostGates;
   receipt.host=verifyHostGates(root,call('host.preflight'));receipt.ready=true;receipt.status='ready';receipt.completedAt=new Date().toISOString();write(output,receipt);return receipt;
  }
  const c=call('capabilities');check(c.actual===true&&c.synthetic===false&&c.benchmarkTaskId==='JOB03'&&c.dedicated===true,'Actual dedicated service required; synthetic receipts cannot establish readiness');
  for(const k of ['native.write_readback','native.restore','native.readonly_confirmation','baseline.files','participant.sessions','actor.controlled','browser.equal','application.interruption','reminder.schedule','reminder.read','reminder.cancel','reminder.delivery','reminder.test_clock'])check(c.capabilities?.includes(k),'Missing capability: '+k);
  check(c.reminderServiceId&&c.reminderServiceId===c.baselineReminderServiceId&&c.reminderServiceId===c.lookoutReminderServiceId,'Both conditions require the same actual reminder service');
  receipt.serviceId=c.reminderServiceId;receipt.capabilities=c;
  const n=call('native.probe',{fixture:read(path.join(root,'suite/fixture.json')),restore:true});check(n.writerReadback===true&&n.readOnlyConfirmed===true&&n.restored===true&&n.unrelatedPreserved===true&&n.allowedTransitions===true&&n.interruptionRetained===true&&n.resumedWithoutDuplicate===true&&n.unsubmitted===true,'Native writer/readback/restore/transition probe incomplete');
  const key='JOB03-preflight-'+hash(freeze).slice(0,12),dueAt='2026-11-18T14:00:00Z',timeZone='America/New_York';
  let id;
  try{
   const scheduled=call('reminder.schedule',{key,applicationId:'A',dueAt,timeZone,testOnly:true});id=scheduled.reminderId;
   check(id&&scheduled.state==='scheduled'&&scheduled.dueAt===dueAt&&scheduled.timeZone===timeZone,'Scheduled receipt must confirm exact due/timezone');
   const replay=call('reminder.schedule',{key,applicationId:'A',dueAt,timeZone,testOnly:true});check(replay.reminderId===id&&replay.duplicate===true,'Schedule replay must be idempotent');
   const saved=call('reminder.read',{reminderId:id});check(saved.state==='scheduled'&&saved.dueAt===dueAt&&saved.timeZone===timeZone,'Readback mismatch');
   const early=call('reminder.delivery',{reminderId:id,now:'2026-11-18T13:59:59Z',testOnly:true});check(early.deliveryCount===0,'Early reminder delivery');
   const due=call('reminder.delivery',{reminderId:id,now:dueAt,testOnly:true});check(due.deliveryCount===1&&due.delivered===true&&due.deliveryReceiptId,'Actual test-channel delivery receipt required');
   const duplicate=call('reminder.delivery',{reminderId:id,now:dueAt,testOnly:true});check(duplicate.deliveryCount===1&&duplicate.duplicate===true,'Duplicate delivery must not notify twice');
   call('reminder.cancel',{reminderId:id,testOnly:true});
   const other=call('reminder.schedule',{key:key+'-cancel',applicationId:'C',dueAt,timeZone,testOnly:true});id=other.reminderId;check(id,'Cancellation probe reminder required');
   const cancelled=call('reminder.cancel',{reminderId:id,testOnly:true});check(cancelled.state==='cancelled','Cancellation receipt required');
   const after=call('reminder.delivery',{reminderId:id,now:dueAt,testOnly:true});check(after.deliveryCount===0&&after.state==='cancelled','Cancelled reminder was delivered');
  }finally{call('reminder.cleanup',{keyPrefix:key,testOnly:true});}
  receipt.ready=true;receipt.status='ready';
 }catch(e){receipt.blockers.push(e.message);}
 receipt.completedAt=new Date().toISOString();write(output,receipt);return receipt;
}
export function packet(spec,fixture,stage,condition,first=false){
 const orientation=condition==='lookout'?spec.configuration.lookoutOrientation:spec.configuration.baselineOrientation;
 return {version:spec.version,stage:stage.id,session:stage.session,now:stage.at,orientation,authority:spec.configuration.authority,input:{kind:stage.kind,message:stage.message,...(stage.source?{source:stage.source}:{})},...(first?{candidate:fixture.candidate,initialJobs:fixture.jobs}:{})};
}
export function actor(question,released){
 // The controlled actor cannot disclose future fixture facts or grant permissions.
 if(/send|submit|apply|approve/i.test(question))return 'No. Track and save only; do not send, submit, apply, or create approvals.';
 if(released.some(s=>s.id==='multi_update')&&/start|birch/i.test(question))return 'For Birch Database, January 19, 2027. It remains unsubmitted.';
 return 'I have no additional information yet. Preserve the uncertainty and existing state.';
}
function capture(root,command,condition,stage,operation,args={}){const config=read(path.join(root,'configuration.json'));const request={operation,benchmarkTaskId:'JOB03',ownerId:config.ownerId,condition,stage:stage.id,now:stage.at,...args};const result=adapter(command,request);bound(result,request);return result;}
export function run(root,command,preflightFile,pairId){
 const f=frozen(root),pre=read(preflightFile);check(pre.ready===true&&pre.status==='ready'&&pre.freezeHash===hash(f)&&pre.configurationHash===hash(read(path.join(root,'configuration.json')))&&pre.adapterCommandHash===hash(command)&&pre.runtime&&hash(pre.runtime)===hash(runtimeBinding(command,read(path.join(root,'configuration.json')))),'Matching successful actual-service preflight required');
 if(['jobs-host-v1','jobs-host-v2','jobs-host-v3'].includes(read(path.join(root,'configuration.json')).hostVersion))hostGates.verifyHostGates(root,pre.host);
 check(/^[A-Za-z0-9_-]+$/.test(pairId),'Safe unique pair ID required');const runs=path.join(root,'runs');check(!fs.existsSync(runs),'One attempt only: preserve errors; prepare a separately authorized campaign to rerun');fs.mkdirSync(runs);
 const spec=read(path.join(root,'suite/scenario.json')),fixture=read(path.join(root,'suite/fixture.json'));
 for(const condition of conditions){
  const dir=path.join(runs,condition);fs.mkdirSync(dir);const r={version:spec.version,pairId,condition,startedAt:new Date().toISOString(),status:'completed',checkpoints:[]};
  try{
   write(path.join(dir,'setup.json'),capture(root,command,condition,{id:'setup',at:spec.stages[0].at},'condition.setup'));
   for(const [i,stage]of spec.stages.entries()){
    const cp=path.join(dir,stage.id);fs.mkdirSync(cp);let started=null;const entry={stage:stage.id,prescribedPrompts:1,scriptedInitiations:Number(stage.id!=='multi_update'),participantAttempted:false,status:'completed',eventAt:stage.at,session:stage.session};r.checkpoints.push(entry);
    try{
     write(path.join(cp,'before.json'),capture(root,command,condition,stage,'snapshot'));
     const request=packet(spec,fixture,stage,condition,i===0);write(path.join(cp,'input.json'),request);
     // Host delivers due reminders through the actual shared service; the participant receives only current notifications.
     let controlledFailure=null;if(stage.failure){controlledFailure=capture(root,command,condition,stage,'application.arm_failure',{failure:stage.failure});write(path.join(cp,'failure.json'),controlledFailure);check(controlledFailure.armed===true&&controlledFailure.eventKey===stage.failure.eventKey,'One controlled preparation failure must be armed');}
     let notification=null;if(stage.kind==='reminder'){notification=capture(root,command,condition,stage,'reminder.wake');write(path.join(cp,'wake.json'),notification);}
     entry.participantAttempted=true;started=performance.now();const result=adapter(command,{operation:'participant.turn',benchmarkTaskId:'JOB03',ownerId:read(path.join(root,'configuration.json')).ownerId,condition,packet:request,notification,controlledFailure,budgetSeconds:spec.budgetSeconds,actor:{policy:'released-only-v1',released:spec.stages.slice(0,i+1).filter(x=>x.kind==='user').map(x=>({id:x.id,message:x.message})),delaySeconds:spec.actorDelaySeconds}},(spec.budgetSeconds+45)*1000);
     entry.adapterSeconds=(performance.now()-started)/1000;entry.executionSeconds=result.timing?.valid===false?null:result.executionSeconds??entry.adapterSeconds;entry.executionWallSeconds=result.timing?.wallSeconds??entry.adapterSeconds;entry.containerStartupSeconds=result.containerStartupSeconds??null;entry.mcpDiagnostics=result.mcpDiagnostics??null;started=null;
     write(path.join(cp,'response.json'),result);if(result.hostControlFailed)r.hostControlFailed=true;check(['completed','timed_out','execution_failed'].includes(result.status),'Participant terminal status required');entry.status=result.status;
     check(Array.isArray(result.interactions),'Captured interactions required');const ids=new Set();for(const x of result.interactions){check(x.id&&!ids.has(x.id)&&typeof x.answered==='boolean'&&Array.isArray(x.categories),'Unique interaction evidence required');ids.add(x.id);}entry.uniqueTurns=ids.size;entry.answeredTurns=result.interactions.filter(x=>x.answered).length;
    }catch(e){entry.status=e.message==='adapter_timeout'?'timed_out':'harness_failed';entry.error=e.message;write(path.join(cp,'error.json'),{error:e.message});}
    finally{if(started!==null){entry.executionWallSeconds=(performance.now()-started)/1000;entry.executionSeconds=null;}try{write(path.join(cp,'after.json'),r.hostControlFailed?{status:'unavailable',reason:'container_stop_unconfirmed'}:capture(root,command,condition,stage,'snapshot'));}catch(e){entry.status='harness_failed';entry.captureError=e.message;}}
    if(entry.status!=='completed'){r.status=entry.status;break;}
   }
  }catch(e){r.status='harness_failed';r.error=e.message;}
  r.endedAt=new Date().toISOString();r.cost=costForRun(root,dir,r);write(path.join(dir,'cost.json'),r.cost);write(path.join(dir,'run.json'),r);
  if(r.hostControlFailed){const halted={status:'host_control_failed',condition,unattemptedConditions:conditions.slice(conditions.indexOf(condition)+1),gradingBlocked:true,participantRetry:false};write(path.join(root,'pair-halted.json'),halted);return halted;}
  // These read-only terminal receipts are outside measured execution and never affect the other condition.
  try{write(path.join(dir,'terminal-confirmation.json'),capture(root,command,condition,{id:'terminal'},condition==='lookout'?'native.readonly_confirmation':'baseline.final_files'));}catch(e){write(path.join(dir,'terminal-confirmation.json'),{status:'failed',error:e.message});}
  const files={};const walk=p=>{for(const e of fs.readdirSync(p,{withFileTypes:true})){const q=path.join(p,e.name);if(e.isDirectory())walk(q);else files[path.relative(dir,q)]=hash(fs.readFileSync(q,'utf8'));}};walk(dir);write(path.join(dir,'evidence-hashes.json'),files);
 }
 return handoff(root);
}
export function handoff(root){
 const f=frozen(root),spec=read(path.join(root,'suite/scenario.json'));const runs=conditions.map(c=>{const dir=path.join(root,'runs',c),run=read(path.join(dir,'run.json'));check(run.condition===c&&run.version===spec.version&&['completed','timed_out','execution_failed','harness_failed'].includes(run.status),'Terminal pair required');return {condition:c,runHash:hash(run),manifest:read(path.join(dir,'evidence-hashes.json'))};});check(read(path.join(root,'runs/baseline/run.json')).pairId===read(path.join(root,'runs/lookout/run.json')).pairId,'Matching pair required');
 const h={version:spec.version,freezeHash:hash(f),scenarioHash:hash(spec),runs,dispatch:'Launch an independent fresh grader with fork_turns:none after both attempts. Exclude implementers, coordinators, operators and participants. No credentials. Shell does not launch agents.'};fs.mkdirSync(path.join(root,'grading'));write(path.join(root,'grading/handoff.json'),h);return h;
}
export function assign(h,reviewer,excluded){check(reviewer&&['implementers','coordinators','operators','participants'].every(k=>Array.isArray(excluded[k])&&excluded[k].length),'Explicit exclusion roster required');check(!Object.values(excluded).flat().includes(reviewer),'Reviewer must be independent');return {handoffHash:hash(h),reviewer,excluded,forkTurns:'none'};}
export function costForRun(root,dir,r){return summarizeCost(r.checkpoints.map(c=>{const file=c.stage+'/response.json',p=path.join(dir,file);return {stage:c.stage,attempted:c.participantAttempted,usage:fs.existsSync(p)?read(p).usage:null,evidenceFile:fs.existsSync(p)?file:null};}),read(path.join(root,'configuration.json')).costPolicy);}
export function compareState(expected,actual){
 const mismatches=[];
 for(const [id,want]of Object.entries(expected))for(const [field,value]of Object.entries(want)){
  const got=actual?.[id]?.[field];if(JSON.stringify(got)!==JSON.stringify(value))mismatches.push({applicationId:id,field,expected:value,actual:got??null});
 }
 return {pass:mismatches.length===0,mismatches};
}
export function additionalInteractions(r,review,manifest,dir){
 check(review.interactionReviewComplete===true&&Array.isArray(review.additionalInteractions),'Independent review of all visible user demands required');
 const ids=new Set();let answered=0;
 for(const x of review.additionalInteractions){
  const cp=r.checkpoints.find(c=>c.stage===x.stage);
  check(cp&&x.id&&!ids.has(x.id)&&typeof x.answered==='boolean'&&x.reason?.trim()&&Array.isArray(x.evidenceFiles)&&x.evidenceFiles.length&&x.evidenceFiles.every(p=>p in manifest),'Unique cited additional demand required');
  const response=path.join(dir,cp.stage,'response.json');
  check(!fs.existsSync(response)||!read(response).interactions?.some(y=>y.id===x.id),'Do not count a captured interaction twice');
  ids.add(x.id);answered+=Number(x.answered);
 }
 return {turns:ids.size,answered};
}
export function finalize(root,submission){
 // Completed evidence review binds frozen inputs/runs, not today's adapter bytes.
 const f=frozen(root,{reviewOnly:true}),spec=read(path.join(root,'suite/scenario.json')),h=read(path.join(root,'grading/handoff.json')),a=read(path.join(root,'grading/assignment.json')),at=submission.attestation;
 check(h.freezeHash===hash(f)&&h.scenarioHash===hash(spec)&&a.handoffHash===hash(h)&&a.forkTurns==='none','Changed frozen grading inputs');check(at?.reviewer===a.reviewer&&at.assignmentHash===hash(a)&&at.freshContext===true&&['didImplement','didOperate','didParticipate','didCoordinate'].every(k=>at[k]===false),'Fresh independent grader attestation required');
 const grades={};for(const condition of conditions){const dir=path.join(root,'runs',condition),r=read(path.join(dir,'run.json')),binding=h.runs.find(x=>x.condition===condition),manifest=read(path.join(dir,'evidence-hashes.json'));check(hash(r)===binding.runHash&&hash(manifest)===hash(binding.manifest),'Evidence manifest changed');for(const [p,digest]of Object.entries(manifest))check(hash(fs.readFileSync(path.join(dir,p),'utf8'))===digest,'Frozen evidence changed');
  const review=submission.conditions?.[condition];check(review?.reviewer===a.reviewer,'Assigned reviewer required');const checks=[],stateChecks={};check(r.checkpoints.length<=spec.stages.length&&r.checkpoints.every((c,i)=>c.stage===spec.stages[i].id),'Invalid checkpoint order/duplicate');const complete=r.status==='completed'&&r.checkpoints.length===spec.stages.length&&r.checkpoints.every(c=>c.status==='completed'&&!c.captureError&&Number.isFinite(c.executionSeconds)&&Number.isInteger(c.uniqueTurns)&&Number.isInteger(c.answeredTurns));
  const unverifiable=[];
  for(const cp of r.checkpoints){
   if(!(cp.stage+'/after.json' in manifest)){
    check(cp.captureError&&cp.status==='harness_failed','Missing after-state without recorded capture failure');
    unverifiable.push(cp.stage);stateChecks[cp.stage]={pass:null,status:'unverifiable_capture_failure',captureError:cp.captureError};continue;
   }
   const extraction=review.extraction?.[cp.stage];check(extraction?.jobs&&Array.isArray(extraction.evidenceFiles)&&extraction.evidenceFiles.includes(cp.stage+'/after.json')&&extraction.evidenceFiles.every(p=>p in manifest),'Independent per-job extraction with durable evidence required');stateChecks[cp.stage]=compareState(spec.expected[cp.stage],extraction.jobs);const ratings=review.checkpoints?.[cp.stage];for(const key of spec.stageQuality?.[cp.stage]??spec.quality){const c=ratings?.[key];check(c&&[0,1,2].includes(c.rating)&&c.reason&&Array.isArray(c.evidenceFiles)&&c.evidenceFiles.length&&c.evidenceFiles.every(p=>p in manifest),'Complete rubric with frozen citations required');check(c.evidenceFiles.some(p=>p===cp.stage+'/after.json'),'Checkpoint saved-state citation required');checks.push(c.rating);}}
  check('terminal-confirmation.json' in manifest,'Terminal confirmation attempt required');
  if(condition==='lookout')for(const key of spec.adherence){const c=review.adherence?.[key];check(['met','unmet','unreached'].includes(c?.status)&&Array.isArray(c.evidenceFiles)&&c.evidenceFiles.length&&c.evidenceFiles.every(p=>p in manifest),'Separate native adherence review required');}
  const extra=additionalInteractions(r,review,manifest,dir);
  const cost=costForRun(root,dir,r);if(r.cost)check(hash(cost)===hash(r.cost),'Executor cost evidence mismatch');
  grades[condition]={cost,prescribedPrompts:r.checkpoints.length,scriptedInitiations:r.checkpoints.reduce((n,c)=>n+(c.scriptedInitiations??0),0),proactiveEffortMeasured:false,status:complete?'reviewed':'partial_review',unverifiableStages:unverifiable,qualityFraction:complete&&checks.length?checks.reduce((x,y)=>x+y,0)/(checks.length*2):null,observedQualityFraction:checks.length?checks.reduce((x,y)=>x+y,0)/(checks.length*2):null,stateChecks,strictPass:complete&&checks.every(x=>x===2)&&Object.values(stateChecks).every(x=>x.pass),executionSeconds:r.checkpoints.every(c=>Number.isFinite(c.executionSeconds))?r.checkpoints.reduce((x,y)=>x+y.executionSeconds,0):null,uniqueInteractionTurns:r.checkpoints.every(c=>Number.isInteger(c.uniqueTurns))?r.checkpoints.reduce((x,y)=>x+y.uniqueTurns,0)+extra.turns:null,effortComplete:r.checkpoints.every(c=>Number.isInteger(c.uniqueTurns)),simulatedWaitingSeconds:r.checkpoints.every(c=>Number.isInteger(c.answeredTurns))?r.checkpoints.reduce((x,y)=>x+y.answeredTurns*spec.actorDelaySeconds,0)+extra.answered*spec.actorDelaySeconds:null,unreachedStages:spec.stages.filter(s=>!r.checkpoints.some(c=>c.stage===s.id)).map(s=>s.id),adherence:condition==='lookout'?review.adherence:null,review};
 }
 const out={version:spec.version,graderVersion:spec.graderVersion,handoffHash:hash(h),assignment:a,attestation:at,grades};write(path.join(root,'grading/final.json'),out);return out;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))try{
 const {values:v}=parseArgs({options:{action:{type:'string'},root:{type:'string'},configuration:{type:'string'},adapter:{type:'string'},output:{type:'string'},preflight:{type:'string'},pair:{type:'string'},reviewer:{type:'string'},excluded:{type:'string'},submission:{type:'string'},execute:{type:'boolean'}}});let result;
 if(v.action==='prepare')result=prepare(v.root,read(v.configuration));else if(v.action==='preflight')result=preflight(v.root,v.adapter?read(v.adapter):null,v.output);else if(v.action==='run'){check(v.execute===true,'Participant execution requires explicit --execute');result=run(v.root,read(v.adapter),v.preflight,v.pair);}else if(v.action==='assign'){result=assign(read(path.join(v.root,'grading/handoff.json')),v.reviewer,read(v.excluded));write(path.join(v.root,'grading/assignment.json'),result);}else if(v.action==='finalize')result=finalize(v.root,read(v.submission));else throw Error('Unknown action');console.log(JSON.stringify(result));
}catch(e){console.error(e.message);process.exitCode=1;}
