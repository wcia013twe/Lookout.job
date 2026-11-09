#!/usr/bin/env node
// JOB04 local evidence orchestration. No account credentials, shell commands or agent judge inside.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {costValues} from '../n01/cost-export.mjs';
import {verifyHostGates} from '../jobs/preflight.mjs';
export const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
export const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
export const write=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n',{flag:'wx',mode:0o600});
const repo=path.resolve(import.meta.dirname,'../..'),conditions=['baseline','lookout'];
const check=(v,m)=>{if(!v)throw Error(m);};
const digest=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const terminal=['completed','timed_out','execution_failed','harness_failed'];
const privateFile=(p)=>{check(fs.lstatSync(p).isFile()&&!fs.lstatSync(p).isSymbolicLink(),'Regular file required');return digest(p);};
export function prepare(root,configuration,candidate){
 check(!fs.existsSync(root),'Use a new preparation root; preserve prior attempts');
 check(configuration.benchmarkTaskId==='JOB04'&&configuration.dedicated===true,'Dedicated JOB04 configuration required');
 check(configuration.model==='gpt-5.6-terra'&&configuration.reasoning==='medium','Frozen model/reasoning mismatch');
 for(const n of ['profile.md','resume.pdf'])privateFile(path.join(candidate,n));
 fs.mkdirSync(root,{recursive:true,mode:0o700});for(const n of ['suite','candidate','receipts'])fs.mkdirSync(path.join(root,n),{mode:0o700});
 const lock={files:{},executables:{},createdAt:new Date().toISOString()};
 const copy=(src,dst)=>{fs.copyFileSync(src,path.join(root,dst),fs.constants.COPYFILE_EXCL);fs.chmodSync(path.join(root,dst),0o600);lock.files[dst]=digest(path.join(root,dst));};
 for(const n of ['scenario.json','evidence.json','reference.json']){
  if(n==='evidence.json'&&configuration.applicationIdMapping){
   const evidence=read(path.join(repo,'examples/job04',n)),mapping=configuration.applicationIdMapping;
   check(evidence.applications.every(a=>typeof mapping[a.id]==='string'&&/^[a-f0-9-]{36}$/.test(mapping[a.id]))&&new Set(Object.values(mapping)).size===evidence.applications.length,'Unique owner-specific application IDs required');
   const remap=x=>typeof x==='string'?(mapping[x]??x):Array.isArray(x)?x.map(remap):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,remap(v)])):x;
   write(path.join(root,'suite',n),remap(evidence));lock.files['suite/'+n]=digest(path.join(root,'suite',n));
  }else copy(path.join(repo,'examples/job04',n),'suite/'+n);
 }
 copy(path.join(repo,'scripts/job04/grader-instructions.md'),'suite/grader-instructions.md');
 for(const n of ['profile.md','resume.pdf'])copy(path.join(candidate,n),'candidate/'+n);
 copy(path.join(repo,'examples/evals/cost-policy.json'),'suite/cost-policy.json');
 for(const n of ['interview-preparation','toolkit-materials'])copy(path.join(repo,'supabase/functions/agent-gateway/skills',n+'.json'),'suite/'+n+'.json');
 write(path.join(root,'configuration.json'),configuration);lock.files['configuration.json']=digest(path.join(root,'configuration.json'));
 for(const n of ['scripts/job04/task.mjs','scripts/n01/cost.py','scripts/n01/cost-export.mjs'])lock.executables[path.join(repo,n)]=digest(path.join(repo,n));
 lock.version=read(path.join(root,'suite/scenario.json')).version;write(path.join(root,'freeze.json'),lock);return {prepared:true,version:lock.version,participantExecuted:false};
}
export function frozen(root,{reviewOnly=false}={}){
 const f=read(path.join(root,'freeze.json'));
 for(const [n,d]of Object.entries(f.files))check(privateFile(path.join(root,n))===d,'Frozen input changed: '+n);
 if(!reviewOnly)for(const [n,d]of Object.entries(f.executables))check(privateFile(n)===d,'Frozen executable changed: '+n);
 return f;
}
export function adapter(command,request,timeout=30000){
 check(Array.isArray(command)&&command.length&&command.every(x=>typeof x==='string'),'Actual adapter argv required');
 const r=spawnSync(command[0],command.slice(1),{input:JSON.stringify(request)+'\n',encoding:'utf8',timeout,maxBuffer:24*1024*1024});
 if(r.error)throw Error(r.error.code==='ETIMEDOUT'?'adapter_timeout':'adapter_process_error');
 check(r.status===0,'adapter_process_failed');const x=JSON.parse(r.stdout);check(!x.error,'adapter_response_failed');return x;
}
export function bound(x,req){check(x.requestHash===hash(req)&&typeof x.receiptId==='string'&&x.receiptId.trim()&&Number.isFinite(Date.parse(x.capturedAt))&&x.ownerId===req.ownerId,'Request/owner-bound receipt required');return x;}
export function runtimeBinding(command,configuration){
 check(Array.isArray(command)&&command.length,'Actual adapter argv required');
 const files=configuration.runtimeFiles;check(Array.isArray(files)&&files.length,'Frozen adapter/runtime files required');
 check(path.isAbsolute(command[0]),'Absolute adapter executable required');
 const bindings=Object.fromEntries([...files,...command.filter(x=>path.isAbsolute(x)&&fs.existsSync(x)&&fs.statSync(x).isFile())].map(f=>{const real=fs.realpathSync(f);return [real,privateFile(real)];}));
 // The adapter entry script/binary must be among recorded files, not an unbound command string.
 check(command.some(v=>path.isAbsolute(v)&&fs.existsSync(v)&&bindings[fs.realpathSync(v)]),'Adapter command must name a bound executable file');
 return {argv:command,files:bindings};
}
export function preflight(root,command,output,execute=adapter){
 const f=frozen(root),cfg=read(path.join(root,'configuration.json')),spec=read(path.join(root,'suite/scenario.json'));
 const receipt={version:spec.version,freezeHash:hash(f),ready:false,status:'blocked',participantExecuted:false,calls:[],blockers:[]};
 try{
  check(cfg.ownerId&&cfg.readOnlyOwnerId===cfg.ownerId&&cfg.source&&cfg.normalProductConfiguration?.captured===true,'Dedicated owner/read-only identity and actual product configuration required');
  const binding=runtimeBinding(command,cfg);receipt.runtime=binding;
  const call=(operation,args={})=>{const req={operation,benchmarkTaskId:'JOB04',ownerId:cfg.ownerId,...args};const entry={request:req};receipt.calls.push(entry);try{entry.result=bound(execute(command,req,operation==='host.preflight'?300000:30000),req);return entry.result;}catch(e){entry.error=e.message;throw e;}};
  if(['jobs-host-v1','jobs-host-v2','jobs-host-v3'].includes(cfg.hostVersion)){
   receipt.host=verifyHostGates(root,call('host.preflight'));
   receipt.ready=true;receipt.status='ready';receipt.completedAt=new Date().toISOString();write(output,receipt);return receipt;
  }
  const c=call('capabilities');check(c.actual===true&&c.synthetic===false&&c.dedicated===true&&c.model===spec.model&&c.reasoning===spec.reasoning,'Actual isolated host with matching model/reasoning required');
  for(const k of ['participant.sessions','participant.capture','actor.controlled','evidence.release_isolation','native.write_readback','native.restore','native.readonly_confirmation','baseline.files','pipeline.milestones','toolkit.artifacts','usage.counter_delta'])check(c.capabilities?.includes(k),'Missing actual capability: '+k);
  check(c.isolation?.futureEvidenceVisible===false&&c.isolation?.graderVisible===false&&c.isolation?.credentialsVisible===false&&c.isolation?.liveWebEnabled===false,'Participant isolation proof required');
  for(const n of ['interview-preparation','toolkit-materials'])check(c.guideVersions?.[n]===read(path.join(root,'suite',n+'.json')).version,'Runtime guide version mismatch');
  const parity=call('context.parity',{candidateProfileHash:digest(path.join(root,'candidate/profile.md')),resumeHash:digest(path.join(root,'candidate/resume.pdf'))});
  check(parity.equal===true&&parity.fullContextRendered===true&&parity.resumeHash===digest(path.join(root,'candidate/resume.pdf')),'Native/baseline full context and resume parity required');
  const p=call('native.probe',{testOnly:true,restore:true,fixture:read(path.join(root,'suite/evidence.json')),requiredChecks:['save_read','revise_read','exact_replay','stale_conflict','foreign_owner_denied','round_correction','debrief_link','sentinel_preserved','no_practice_credit']});
  for(const k of ['saveRead','revisionRead','exactReplay','staleConflict','foreignOwnerDenied','roundCorrection','debriefLinked','sentinelPreserved','noPracticeCredit','readOnlyConfirmed','restored'])check(p[k]===true,'Native prep probe incomplete: '+k);
  check(Array.isArray(p.readbackReceipts)&&p.readbackReceipts.length>=2,'Actual saved-artifact readback receipts required');
  const rehearsal=call('host.rehearsal',{inference:false,synthetic:true,requiredChecks:['fresh_session','resumed_session','released_only_actor','readback_failure','duplicate','closure','capture_failure','usage_missing','timeout']});
  check(rehearsal.participantExecuted===false&&rehearsal.unresolvedErrors?.length===0,'No-inference rehearsal has unresolved errors');
  for(const k of ['fresh_session','resumed_session','released_only_actor','readback_failure','duplicate','closure','capture_failure','usage_missing','timeout'])check(rehearsal.checks?.[k]===true,'Missing harness rehearsal proof: '+k);
  receipt.ready=true;receipt.status='ready';
 }catch(e){receipt.blockers.push(e.message);}
 receipt.completedAt=new Date().toISOString();write(output,receipt);return receipt;
}
export function packet(spec,evidence,stage,condition,profile){
 check(conditions.includes(condition),'Unknown condition');
 const events=stage.eventIds.map(id=>{const e=evidence.events.find(e=>e.id===id);check(e,'Unknown released evidence');return e;});
 const orientation=condition==='lookout'?'Lookout is your persistent recruiting workspace. Use its tools to retrieve relevant context and records and save meaningful pipeline updates, preparation and debriefs. Preserve unrelated information and verify saves.':'Your files in /workspace/output persist across sessions. Use them to retrieve relevant context and records and save meaningful pipeline updates, preparation and debriefs. Preserve unrelated information and verify saves.';
 return {stage:stage.id,session:stage.session,minute:stage.minute,orientation,permissions:'Read, analyze, prepare and save. Use only released evidence. Do not send, submit, contact interviewers, browse live sources or mark practice complete without user report.',prompt:stage.request??stage.baseline,events,sources:evidence.sources,...(stage.id===spec.stages[0].id?{applications:evidence.applications,...(condition==='baseline'?{onboarding:profile}:{})}:{})};
}
export function actor(question,released){
 if(/send|submit|permission|contact|schedule.*call/i.test(question))return {answer:'Read, prepare and save only; no sending, application submission or external scheduling.',category:'approval'};
 if(released.some(x=>x.id==='screen_debrief')&&/gap|migration|struggl|feedback/i.test(question))return {answer:'I struggled to explain my database migration tradeoffs. Preserve that as my reported gap; no further detail is available.',category:'clarification'};
 if(released.some(x=>x.id==='screen_debrief')&&/next|technical|confirm/i.test(question))return {answer:'The recruiter mentioned a distributed systems round; its date is unknown until an invitation is received.',category:'clarification'};
 return {answer:'No additional information is available. Preserve the uncertainty.',category:'clarification'};
}
const capture=(root,command,condition,operation,args={})=>{const cfg=read(path.join(root,'configuration.json'));const req={operation,benchmarkTaskId:'JOB04',ownerId:cfg.ownerId,condition,...args};return bound(adapter(command,req),req);};
const manifest=dir=>{const files={};const walk=p=>{for(const e of fs.readdirSync(p,{withFileTypes:true})){const q=path.join(p,e.name);check(!e.isSymbolicLink(),'Symlink evidence forbidden');if(e.isDirectory())walk(q);else files[path.relative(dir,q)]=digest(q);}};walk(dir);return files;};
export function verifiedManifest(dir,expected){
 const base=fs.realpathSync(dir)+path.sep;
 for(const [relative,d]of Object.entries(expected)){const p=path.resolve(dir,relative);check(p.startsWith(path.resolve(dir)+path.sep)&&fs.realpathSync(p).startsWith(base)&&privateFile(p)===d,'Evidence changed or escaped run');}
}
export function stageCost(c){
 const unknown={status:'unknown',tokens:null,model:null};
 if(!c||!['complete','partial'].includes(c.status)||c.source!=='codex_session_total_token_usage_delta')return unknown;
 const t=c.tokens,fields=['input_tokens','cached_input_tokens','output_tokens'];
 if(!t||!fields.every(k=>Number.isSafeInteger(t[k])&&t[k]>=0)||t.cached_input_tokens>t.input_tokens)return unknown;
 for(const k of ['reasoning_output_tokens','cache_write_input_tokens'])if(t[k]!=null&&(!Number.isSafeInteger(t[k])||t[k]<0))return unknown;
 if(t.reasoning_output_tokens>t.output_tokens)return unknown;
 return c;
}
export function run(root,command,preflightFile,pairId){
 const f=frozen(root),cfg=read(path.join(root,'configuration.json')),pre=read(preflightFile),spec=read(path.join(root,'suite/scenario.json')),evidence=read(path.join(root,'suite/evidence.json'));
 check(pre.ready===true&&pre.status==='ready'&&pre.freezeHash===hash(f)&&hash(pre.runtime)===hash(runtimeBinding(command,cfg)),'Matching successful preflight required; unresolved errors block execution');
 if(['jobs-host-v1','jobs-host-v2','jobs-host-v3'].includes(cfg.hostVersion))verifyHostGates(root,pre.host);
 check(/^[A-Za-z0-9_-]+$/.test(pairId),'Safe pair ID required');
 const runs=path.join(root,'runs');check(!fs.existsSync(runs),'One attempt only; no reset or silent retry');fs.mkdirSync(runs,{mode:0o700});
 for(const condition of conditions){
  const dir=path.join(runs,condition);fs.mkdirSync(dir,{mode:0o700});const saveProgress=()=>fs.writeFileSync(path.join(dir,'run.json'),JSON.stringify(r,null,2)+'\n',{mode:0o600});const r={version:spec.version,episodeId:pairId+'-'+condition,pairId,condition,model:spec.model,reasoning:spec.reasoning,pilot:true,synthetic:false,status:'running',checkpoints:[],startedAt:new Date().toISOString()};saveProgress();
  try{
   write(path.join(dir,'setup.json'),capture(root,command,condition,'condition.setup',{initial:evidence.applications}));
   for(const [i,stage]of spec.stages.entries()){
    const sd=path.join(dir,'stage-'+(i+1));fs.mkdirSync(sd);const cp={stage:stage.id,index:i+1,status:'running',executionSeconds:0,uniqueTurns:null,answeredTurns:null};r.checkpoints.push(cp);let start=null;
    try{
     write(path.join(sd,'before.json'),capture(root,command,condition,'snapshot',{stage:stage.id}));
     const input=packet(spec,evidence,stage,condition,fs.readFileSync(path.join(root,'candidate/profile.md'),'utf8'));write(path.join(sd,'input.json'),input);
     const req={operation:'participant.turn',benchmarkTaskId:'JOB04',ownerId:cfg.ownerId,condition,packet:input,session:stage.session,resume:i>0&&stage.session===spec.stages[i-1].session,budgetSeconds:spec.policy.stageBudgetSeconds,actor:{version:'released-only-v1',events:spec.stages.slice(0,i+1).filter(s=>s.kind==='user').map(s=>({id:s.id,request:s.request})),responseDelayMinutes:spec.policy.userResponseDelayMinutes}};
     start=performance.now();const result=bound(adapter(command,req,(spec.policy.stageBudgetSeconds+45)*1000),req);cp.adapterSeconds=(performance.now()-start)/1000;cp.executionSeconds=result.timing?.valid===false?null:result.executionSeconds??cp.adapterSeconds;cp.executionWallSeconds=result.timing?.wallSeconds??cp.adapterSeconds;cp.containerStartupSeconds=result.containerStartupSeconds??null;cp.mcpDiagnostics=result.mcpDiagnostics??null;start=null;
     write(path.join(sd,'response.json'),result);check(['completed','timed_out','execution_failed'].includes(result.status),'Participant terminal receipt required');cp.status=result.status;
     check(result.participantExecuted===true&&result.synthetic===false,'Actual participant execution receipt required');
     check(result.session===stage.session&&result.resume===req.resume,'Unexpected session continuity');
     check(result.isolation?.futureEvidenceVisible===false&&result.isolation?.graderVisible===false&&result.isolation?.credentialsVisible===false,'Participant isolation violated');
     check(Array.isArray(result.trace)&&result.trace.length>0&&Array.isArray(result.toolTrace)&&result.files&&typeof result.files==='object'&&!Array.isArray(result.files),'Trace/tool/output evidence required');
     check(Array.isArray(result.interactions),'Captured user interactions required');const ids=new Set();for(const x of result.interactions){check(x.id&&!ids.has(x.id)&&typeof x.question==='string'&&typeof x.answered==='boolean'&&Array.isArray(x.categories),'Unique evidenced interaction turns required');ids.add(x.id);}cp.uniqueTurns=ids.size;cp.answeredTurns=result.interactions.filter(x=>x.answered).length;
     cp.scriptedInitiations=Number(stage.id!=='screen_debrief');cp.prescribedPrompts=1;
     write(path.join(sd,'stage-run.json'),{status:cp.status,cost:stageCost(result.cost),durationSeconds:cp.executionSeconds});
    }catch(e){cp.status=e.message==='adapter_timeout'?'timed_out':'harness_failed';cp.error=e.message;write(path.join(sd,'failure.json'),{error:e.message});}
    finally{if(start!==null)cp.executionSeconds=(performance.now()-start)/1000;
     if(!fs.existsSync(path.join(sd,'stage-run.json')))write(path.join(sd,'stage-run.json'),{status:cp.status,durationSeconds:cp.executionSeconds,cost:{status:'unknown',tokens:null,model:null}});
     try{write(path.join(sd,'after.json'),capture(root,command,condition,'snapshot',{stage:stage.id}));}catch(e){cp.status='harness_failed';cp.captureError=e.message;}
    }
    saveProgress();if(cp.status!=='completed'){r.status=cp.status;break;}
   }
   if(r.status==='running')r.status='completed';
  }catch(e){r.status='harness_failed';r.error=e.message;}
  r.endedAt=new Date().toISOString();
  // Same cost accounting convention as other COM/JOB cases. This helper performs no inference.
  const cost=spawnSync('python3',['-B','-c',"import sys,json;sys.path.insert(0,sys.argv[1]);import cost;print(json.dumps(cost.summarize(sys.argv[2],sys.argv[3])))",path.join(repo,'scripts/n01'),dir,path.join(root,'suite/cost-policy.json')],{encoding:'utf8',timeout:15000});
  if(cost.status!==0){r.status='harness_failed';r.cost=null;r.costError='Cost summarization failed; participant evidence retained';}else{r.cost=JSON.parse(cost.stdout);costValues(r.cost);write(path.join(dir,'cost.json'),r.cost);}saveProgress();
  try{write(path.join(dir,'terminal-confirmation.json'),capture(root,command,condition,condition==='lookout'?'native.readonly_confirmation':'baseline.final_files'));}catch(e){write(path.join(dir,'terminal-confirmation.json'),{status:'failed',error:e.message});}
  write(path.join(dir,'evidence-hashes.json'),manifest(dir));
 }
 return handoff(root);
}
export function handoff(root){
 const f=frozen(root),spec=read(path.join(root,'suite/scenario.json')),runs=conditions.map(condition=>{const dir=path.join(root,'runs',condition),r=read(path.join(dir,'run.json'));check(r.condition===condition&&r.version===spec.version&&terminal.includes(r.status),'Terminal condition attempts required');const files=read(path.join(dir,'evidence-hashes.json'));verifiedManifest(dir,files);return {condition,pairId:r.pairId,manifest:files,runHash:hash(r)};});
 check(runs[0].pairId===runs[1].pairId,'Matching pair required');
 const h={version:spec.version,freezeHash:hash(f),runs,dispatch:'Coordinator must spawn a fresh final grader with fork_turns:none. Exclude implementers/coordinators/operators/participants. Shell never launches the grader.',evidence:['suite/scenario.json','suite/reference.json','suite/evidence.json','suite/grader-instructions.md','candidate/profile.md','candidate/resume.pdf','runs/baseline','runs/lookout'],neverShare:['configuration.json','credentials','adapter runtime files']};
 const dir=path.join(root,'grading');fs.mkdirSync(dir);write(path.join(dir,'handoff.json'),h);
 for(const c of conditions){const r=read(path.join(root,'runs',c,'run.json'));write(path.join(dir,c+'-template.json'),{reviewer:null,checkpoints:Object.fromEntries(r.checkpoints.map(cp=>[cp.stage,{outcomeComplete:false,extraction:{state:null,evidenceFiles:[]},ratings:Object.fromEntries(spec.stages[cp.index-1].checks.map(k=>[k,{rating:null,reason:'',evidenceFiles:[]}]))}])),additionalInteractions:[],interactionReviewComplete:false,adherence:Object.fromEntries(spec.adherence.map(k=>[k,{status:null,reason:'',evidenceFiles:[]}]))});}return h;
}
export function assign(h,reviewer,excluded){
 check(typeof reviewer==='string'&&reviewer.trim()&&['implementers','coordinators','operators','participants'].every(k=>Array.isArray(excluded?.[k])&&excluded[k].length),'Explicit independent reviewer exclusion roster required');check(!Object.values(excluded).flat().includes(reviewer),'Fresh grader cannot implement, coordinate, operate or participate');return {reviewer,excluded,handoffHash:hash(h),forkTurns:'none'};
}
export function compareState(expected,actual){return Object.fromEntries(Object.entries(expected).map(([k,v])=>[k,{pass:JSON.stringify(actual?.[k])===JSON.stringify(v),expected:v,actual:actual?.[k]??null}]));}
export function finalize(root,submission){
 // Completed evidence review binds frozen inputs/runs, not today's adapter bytes.
 const f=frozen(root,{reviewOnly:true}),h=read(path.join(root,'grading/handoff.json')),a=read(path.join(root,'grading/assignment.json')),at=submission.attestation,spec=read(path.join(root,'suite/scenario.json')),ref=read(path.join(root,'suite/reference.json'));
 check(h.freezeHash===hash(f)&&a.handoffHash===hash(h)&&a.forkTurns==='none','Frozen assignment/rubric binding changed');
 check(!Object.values(a.excluded).flat().includes(a.reviewer)&&at?.reviewer===a.reviewer&&at.assignmentHash===hash(a)&&at.freshContext===true&&['didImplement','didCoordinate','didOperate','didParticipate'].every(k=>at[k]===false),'Fresh independent grader attestation required');
 const grades={};
 for(const condition of conditions){
  const dir=path.join(root,'runs',condition),b=h.runs.find(x=>x.condition===condition),r=read(path.join(dir,'run.json')),files=read(path.join(dir,'evidence-hashes.json')),review=submission.conditions?.[condition];check(hash(r)===b.runHash&&hash(files)===hash(b.manifest),'Run/manifest binding changed');verifiedManifest(dir,files);
  check(review?.reviewer===a.reviewer&&review.interactionReviewComplete===true,'Assigned reviewer must complete interaction review');
  check(r.checkpoints.every((cp,i)=>cp.index===i+1&&cp.stage===spec.stages[i]?.id),'Noncontiguous checkpoints');
  const cite=(x,required)=>{check(x?.reason?.trim()&&Array.isArray(x.evidenceFiles)&&x.evidenceFiles.length&&x.evidenceFiles.every(p=>p in files),'Frozen evidence citation required');if(required)check(x.evidenceFiles.includes(required),'Checkpoint after-state evidence required');};
  const checkpoints={};let full=true;
  for(const cp of r.checkpoints){const stage=spec.stages[cp.index-1],x=review.checkpoints?.[cp.stage],after='stage-'+cp.index+'/after.json';
   if(!files[after]){check(cp.status!=='completed','Completed checkpoint lacks captured state');full=false;checkpoints[cp.stage]={status:'unverifiable_capture_failure'};continue;}
   check(x?.extraction?.state&&Array.isArray(x.extraction.evidenceFiles)&&x.extraction.evidenceFiles.includes(after)&&x.extraction.evidenceFiles.every(p=>p in files),'Independent saved-state extraction required');
   const state=compareState(ref.checkpoints[cp.stage],x.extraction.state),ratings={};
   for(const k of stage.checks){const v=x.ratings?.[k];cite(v,after);check([0,1,2].includes(v.rating),'0/1/2 anchored rating required');ratings[k]=v;}
   checkpoints[cp.stage]={state,ratings};
  }
  if(condition==='lookout')for(const k of spec.adherence){const x=review.adherence?.[k];cite(x);check(['used_correctly','attempted_but_failed','omitted','not_applicable'].includes(x.status),'Separate native adherence status required');}
  const extra=new Set(),extraByStage={};let extraAnswered=0;check(Array.isArray(review.additionalInteractions),'Explicit additional demands list required');
  for(const x of review.additionalInteractions){cite(x);const cp=r.checkpoints.find(c=>c.stage===x.stage);check(cp&&!extra.has(x.id)&&x.id&&typeof x.answered==='boolean','Unique cited additional interaction required');const response=read(path.join(dir,'stage-'+cp.index+'/response.json'));check(!response.interactions.some(y=>y.id===x.id),'Do not double-count captured interaction');extra.add(x.id);if(x.answered){extraAnswered++;extraByStage[x.stage]=(extraByStage[x.stage]??0)+1;}}
  for(const cp of r.checkpoints){const result=checkpoints[cp.stage];result.simulatedCompletionMinute=review.checkpoints?.[cp.stage]?.outcomeComplete===true&&cp.status==='completed'&&Number.isInteger(cp.answeredTurns)?spec.stages[cp.index-1].minute+cp.executionSeconds/60+(cp.answeredTurns+(extraByStage[cp.stage]??0))*spec.policy.userResponseDelayMinutes:null;}
  const complete=r.status==='completed'&&r.checkpoints.length===spec.stages.length&&full;
  grades[condition]={status:complete?'reviewed':'partial_review',executionSeconds:r.checkpoints.every(c=>Number.isFinite(c.executionSeconds))?r.checkpoints.reduce((n,c)=>n+c.executionSeconds,0):null,effort:{uniqueTurns:r.checkpoints.every(c=>Number.isInteger(c.uniqueTurns))?r.checkpoints.reduce((n,c)=>n+c.uniqueTurns,0)+extra.size:null,scriptedInitiations:r.checkpoints.reduce((n,c)=>n+(c.scriptedInitiations??0),0),categories:'overlapping diagnostic categories; never sum into effort'},simulatedWaitingMinutes:r.checkpoints.every(c=>Number.isInteger(c.answeredTurns))?(r.checkpoints.reduce((n,c)=>n+c.answeredTurns,0)+extraAnswered)*spec.policy.userResponseDelayMinutes:null,cost:r.cost,checkpoints,adherence:condition==='lookout'?review.adherence:null,unreachedStages:spec.stages.filter(s=>!r.checkpoints.some(c=>c.stage===s.id)).map(s=>s.id),limitations:['Specificity and factual grounding measured; usefulness and interview outcomes unmeasured.','Participant cost excludes preflight and final grading; those costs are unmeasured unless separately captured.'],review};
 }
 const comparison=Object.fromEntries(['candidate_specificity','role_specificity','round_specificity','grounding','generation_decision','debrief_adaptation'].map(k=>{const means=Object.fromEntries(conditions.map(c=>{const values=Object.values(grades[c].checkpoints).map(x=>x.ratings?.[k]?.rating).filter(Number.isFinite);return [c,grades[c].status==='reviewed'&&values.length?values.reduce((n,v)=>n+v,0)/values.length:null];}));return [k,{...means,result:means.baseline===null||means.lookout===null?'unreviewed':means.baseline===means.lookout?'tie':means.lookout>means.baseline?'lookout_higher':'baseline_higher'}];}));
 const result={version:spec.version,graderVersion:spec.graderVersion??'JOB04-grade-v1',assignment:a,attestation:at,grades,comparison,unmeasured:['usefulness','coaching effectiveness','interview outcomes','proactive user-effort savings']};write(path.join(root,'grading/final.json'),result);return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))try{
 const {values:v}=parseArgs({options:{action:{type:'string'},root:{type:'string'},configuration:{type:'string'},candidate:{type:'string'},adapter:{type:'string'},output:{type:'string'},preflight:{type:'string'},pair:{type:'string'},reviewer:{type:'string'},excluded:{type:'string'},submission:{type:'string'},execute:{type:'boolean'}}});let result;
 if(v.action==='prepare')result=prepare(v.root,read(v.configuration),v.candidate);
 else if(v.action==='preflight')result=preflight(v.root,v.adapter?read(v.adapter):null,v.output);
 else if(v.action==='run'){check(v.execute===true,'Explicit --execute required; no implicit participant run');result=run(v.root,read(v.adapter),v.preflight,v.pair);}
 else if(v.action==='assign'){result=assign(read(path.join(v.root,'grading/handoff.json')),v.reviewer,read(v.excluded));write(path.join(v.root,'grading/assignment.json'),result);}
 else if(v.action==='finalize')result=finalize(v.root,read(v.submission));else throw Error('Unknown action');
 console.log(JSON.stringify(result));
}catch(e){console.error(e.message);process.exitCode=1;}
