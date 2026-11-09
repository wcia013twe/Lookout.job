#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {read,write,hash,digest,files,readiness,launchGate,actorAnswer,recordError,assertFrozen,gates} from './core.mjs';
import {confirm,respond,account,scrub} from './native.mjs';
import {handoff,assignGrader,finalize} from './grade.mjs';
const lib=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(lib,'../..');
const {values:v,positionals}=parseArgs({allowPositionals:true,options:{root:{type:'string'},scenario:{type:'string'},actor:{type:'string'},reference:{type:'string'},candidate:{type:'string'},output:{type:'string'},condition:{type:'string'},run:{type:'string'},receipts:{type:'string'},reviewer:{type:'string'},coordinator:{type:'string'},excluded:{type:'string'},submission:{type:'string'},runtime:{type:'string'},'cost-policy':{type:'string'},detail:{type:'string'},'error-id':{type:'string'},receipt:{type:'string'}}});
const action=positionals[0],root=path.resolve(v.root||'.');
try{
 let result;
 if(action==='prepare'){
  if(fs.existsSync(root+'/freeze.json'))throw Error('Never overwrite a frozen JOB02 setup');account(root);
  const scenario=read(v.scenario||repo+'/examples/job02/scenario.json'),actor=read(v.actor||repo+'/examples/job02/actor.json'),runtime=read(v.runtime);
  if(runtime.model!==scenario.model||runtime.reasoning!==scenario.reasoning||runtime.networkPolicy!=='JOB01-isolated-inference'||!runtime.imageId)throw Error('Pinned runtime/explicit network policy required');
  for(const name of ['profile.md','resume.pdf']){const to=root+'/candidate/'+name;fs.mkdirSync(path.dirname(to),{recursive:true,mode:0o700});fs.copyFileSync(path.resolve(v.candidate,name),to);fs.chmodSync(to,0o600);}
  fs.copyFileSync(v['cost-policy']||repo+'/examples/evals/cost-policy.json',root+'/cost-policy.json');
  write(root+'/suite/scenario.json',scenario);write(root+'/suite/actor.private.json',actor);write(root+'/runtime.private.json',runtime);write(root+'/reference.private.json',read(v.reference));
  fs.copyFileSync(lib+'/grader-instructions.md',root+'/suite/grader-instructions.md');
  const inputs={};for(const folder of [root+'/candidate',root+'/suite'])for(const p of Object.keys(files(folder)))inputs[path.relative(root,path.join(folder,p))]=digest(path.join(folder,p));
  for(const p of ['account.private.json','runtime.private.json','reference.private.json','cost-policy.json'])inputs[p]=digest(root+'/'+p);
  for(const folder of [lib,repo+'/scripts/n01',repo+'/scripts/job01',repo+'/scripts/evals',repo+'/scripts/communication'])for(const p of fs.readdirSync(folder))if(/\.(mjs|py|md)$/.test(p))inputs[path.relative(root,path.join(folder,p))]=digest(path.join(folder,p));
  inputs[path.relative(root,repo+'/package-lock.json')]=digest(repo+'/package-lock.json');
  write(root+'/freeze.json',{taskId:'JOB02',version:scenario.version,files:inputs,imageId:runtime.imageId,model:scenario.model,reasoning:scenario.reasoning});result={prepared:true,inferenceExecuted:false,ready:false};
 }else if(action==='preflight'){
  const receipts=v.receipts?read(v.receipts):{};result=readiness(root,receipts);write(v.output||root+'/readiness.json',result);write(root+'/receipts.json',receipts);
  if(!result.ready)process.exitCode=1;
 }else if(action==='record-error'){result=recordError(root,new Error(v.detail||'Recorded harness failure'));
 }else if(action==='resolve-error'){const ledger=read(root+'/errors.json'),receipt=read(v.receipt),entry=ledger.find(e=>e.id===v['error-id']);if(!entry||receipt.status!=='passed'||receipt.freezeHash!==digest(root+'/freeze.json')||!receipt.errorIds?.includes(entry.id))throw Error('Passing bound receipt must explicitly resolve error ID');entry.resolvedBy=receipt.id;fs.writeFileSync(root+'/errors.json',JSON.stringify(ledger,null,2)+'\n',{mode:0o600});result={resolved:entry.id,receipt:receipt.id};
 }else if(action==='check-freeze'){result={valid:!!assertFrozen(root),inferenceExecuted:false};
 }else if(action==='check-launch'){
  const f=launchGate(root),runtime=read(root+'/runtime.private.json');const image=execFileSync('docker',['image','inspect','lookout-benchmark:0.164.0','--format','{{.Id}}'],{encoding:'utf8'}).trim();
  if(image!==f.imageId||runtime.imageId!==image)throw Error('Actual participant image changed');result={ready:true,inferenceExecuted:false};
 }else if(action==='snapshot'){
  account(root);execFileSync('node',[lib+'/account.mjs','snapshot',root,v.output],{stdio:'pipe'});result={captured:true};
 }else if(action==='respond'){
  assertFrozen(root);const run=path.resolve(v.run),actor=read(root+'/suite/actor.private.json'),spec=read(root+'/suite/scenario.json');
  if(!['baseline','lookout'].includes(v.condition)||run!==root+'/runs/'+v.condition)throw Error('Exact condition run required');
  const questions=fs.existsSync(run+'/questions.jsonl')?fs.readFileSync(run+'/questions.jsonl','utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
  const responses=questions.map(q=>({...q,...actorAnswer(actor,q.targetId,q.question)}));
  if(v.condition==='lookout')write(run+'/human-response-receipt.json',await respond(root,actor,spec));
  write(run+'/released-responses.json',responses);result={releasedResponses:responses.length};
 }else if(action==='handoff')result=handoff(root);
 else if(action==='confirm'){
  const h=read(root+'/grading/handoff.json');
  // Current owned IDs are read under dedicated human RLS, never supplied by model or arbitrary grader.
  const temp=root+'/grading/confirmation-state.json';try{execFileSync('node',[lib+'/account.mjs','snapshot',root,temp],{stdio:'pipe'});const ids=read(temp).tables.applications.map(x=>x.id);
  result={...await confirm(root,ids),handoffHash:hash(h)};}catch(e){result={status:'failed',handoffHash:hash(h),errorType:e.name,error:'Native confirmation failed; retain diagnostics separately'};}
  write(root+'/grading/native-confirmation.json',result);
 }else if(action==='assign')result=assignGrader(root,v.reviewer,v.coordinator,read(v.excluded));
 else if(action==='finalize')result=finalize(root,read(v.submission));
 else throw Error('Actions: prepare, preflight, check-launch, snapshot, respond, handoff, confirm, assign, finalize');
 console.log(JSON.stringify(scrub(result)));
}catch(e){console.error(JSON.stringify({status:'blocked',action,error:e.message,inferenceExecuted:false}));process.exitCode=1;}
