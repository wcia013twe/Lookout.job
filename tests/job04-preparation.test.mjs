import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {prepare,frozen,preflight,packet,actor,hash,read,write,run,handoff,assign,finalize,verifiedManifest,stageCost} from '../scripts/job04/task.mjs';
import {costValues} from '../scripts/n01/cost-export.mjs';
const spec=read(new URL('../examples/job04/scenario.json',import.meta.url)),evidence=read(new URL('../examples/job04/evidence.json',import.meta.url)),ref=read(new URL('../examples/job04/reference.json',import.meta.url));
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'job04-test-'));
function setup(){const parent=temp(),candidate=path.join(parent,'candidate');fs.mkdirSync(candidate);fs.writeFileSync(path.join(candidate,'profile.md'),'Fixture candidate with saved preferences.');fs.writeFileSync(path.join(candidate,'resume.pdf'),'%PDF fictional test bytes, never upload');const adapter=path.join(parent,'adapter.mjs');fs.writeFileSync(adapter,'// synthetic unit fixture; no runtime or inference\n');const config={benchmarkTaskId:'JOB04',dedicated:true,ownerId:'fictional-owner',readOnlyOwnerId:'fictional-owner',source:'synthetic unit test only',model:spec.model,reasoning:spec.reasoning,normalProductConfiguration:{captured:true},runtimeFiles:[adapter]};const root=path.join(parent,'prepared');prepare(root,config,candidate);return {root,command:[process.execPath,adapter],parent,config};}
function service(command,req){let data={};switch(req.operation){
 case 'capabilities':data={actual:true,synthetic:false,dedicated:true,model:spec.model,reasoning:spec.reasoning,capabilities:['participant.sessions','participant.capture','actor.controlled','evidence.release_isolation','native.write_readback','native.restore','native.readonly_confirmation','baseline.files','pipeline.milestones','toolkit.artifacts','usage.counter_delta'],isolation:{futureEvidenceVisible:false,graderVisible:false,credentialsVisible:false,liveWebEnabled:false},guideVersions:{'interview-preparation':10,'toolkit-materials':3}};break;
 case 'context.parity':data={equal:true,fullContextRendered:true,resumeHash:req.resumeHash};break;
 case 'native.probe':data=Object.fromEntries(['saveRead','revisionRead','exactReplay','staleConflict','foreignOwnerDenied','roundCorrection','debriefLinked','sentinelPreserved','noPracticeCredit','readOnlyConfirmed','restored'].map(k=>[k,true]));data.readbackReceipts=['fixture-read-1','fixture-read-2'];break;
 case 'host.rehearsal':data={participantExecuted:false,unresolvedErrors:[],checks:Object.fromEntries(req.requiredChecks.map(k=>[k,true]))};break;
 default:throw Error('Unknown fixture request');}
 return {requestHash:hash(req),receiptId:'fixture-'+req.operation,capturedAt:'2026-11-09T15:00:00Z',ownerId:req.ownerId,...data};
}
test('packets release only current evidence; baseline context appears once, Lookout gets standard orientation',()=>{
 for(const condition of ['baseline','lookout'])for(const s of spec.stages){const p=packet(spec,evidence,s,condition,'PRIVATE FIXTURE PROFILE');assert.deepEqual(p.events.map(x=>x.id),s.eventIds);assert.equal('onboarding'in p,condition==='baseline'&&s.id==='submitted');assert.doesNotMatch(JSON.stringify(p),/qualityScale|candidate_specificity|checkpoints|database migration tradeoffs.*rejection-a/);assert.equal(p.sources.length,2);}
 assert.match(packet(spec,evidence,spec.stages[0],'lookout','').orientation,/Use its tools/);
});
test('debrief cannot advance a scheduled technical round; duplicate/logistics and closure avoid new packs',()=>{
 assert.equal(ref.checkpoints.screen_debrief.nextRound,'expected_unconfirmed');assert.equal(ref.checkpoints.screen_debrief.roundStatus,'completed_user_reported');assert.equal(ref.checkpoints.technical_invitation.roundStatus,'scheduled');assert.equal(ref.checkpoints.logistics_duplicate.duplicatePrep,false);assert.equal(ref.checkpoints.rejection.keepHistory,true);assert.equal(ref.checkpoints.rejection.activePrep,false);assert.equal(evidence.events.filter(x=>x.id==='technical-a').length,1);
 assert.equal(ref.sentinelUnchanged,true);assert.equal(spec.stages[3].session,spec.stages[4].session);
});
test('controlled actor does not disclose future debriefs or authorize sends',()=>{
 assert.doesNotMatch(actor('What did I struggle with?',[]).answer,/migration/);assert.match(actor('What migration gap?',spec.stages.slice(0,3)).answer,/migration/);assert.match(actor('Can I submit?',[]).answer,/no sending/);
});
test('preparation is immutable and missing native configuration blocks readiness without inference',()=>{
 const {root,command}=setup(),out=path.join(root,'receipts/blocked.json');const p=preflight(root,null,out);assert.equal(p.ready,false);assert.equal(p.participantExecuted,false);assert.match(p.blockers[0],/adapter/);assert.throws(()=>run(root,command,out,'unit-pair'),/preflight/);assert.equal(fs.existsSync(path.join(root,'runs')),false);
 fs.appendFileSync(path.join(root,'suite/grader-instructions.md'),'changed');assert.throws(()=>frozen(root),/Frozen input changed/);
});
test('preflight validates all receipts and failure injection gates; fixture success is not a live verification claim',()=>{
 const mutations=[r=>({...r,ownerId:'other'}),r=>({...r,requestHash:'wrong'}),r=>({...r,synthetic:true,actual:false}),r=>({...r,capabilities:[]}),r=>({...r,guideVersions:{}})];
 for(const [i,m]of mutations.entries()){const {root,command}=setup();const p=preflight(root,command,path.join(root,'receipts/bad.json'),(c,q)=>q.operation==='capabilities'?m(service(c,q)):service(c,q));assert.equal(p.ready,false,'mutation '+i);}
 const {root,command}=setup();const p=preflight(root,command,path.join(root,'receipts/unit-success.json'),service);assert.equal(p.ready,true);assert.equal(p.participantExecuted,false);
 fs.appendFileSync(command[1],'// changed runtime');assert.throws(()=>run(root,command,path.join(root,'receipts/unit-success.json'),'test-pair'),/preflight/);
});
test('readback, restoration, context mismatch and capture rehearsal failures keep launch blocked',()=>{
 for(const op of ['context.parity','native.probe','host.rehearsal']){const {root,command}=setup();const p=preflight(root,command,path.join(root,'receipts/failure.json'),(c,q)=>{const r=service(c,q);if(q.operation===op){r.equal=false;r.restored=false;r.checks={};r.unresolvedErrors=['retained fixture failure'];}return r;});assert.equal(p.ready,false);assert.equal(p.blockers.length,1);}
});
test('raw usage must be valid delta evidence; missing/partial counters cannot become full zero cost',()=>{
 assert.deepEqual(stageCost(),{status:'unknown',tokens:null,model:null});const valid={status:'complete',source:'codex_session_total_token_usage_delta',model:spec.model,tokens:{input_tokens:100,cached_input_tokens:30,output_tokens:20,reasoning_output_tokens:10}};assert.equal(stageCost(valid),valid);assert.equal(stageCost({...valid,tokens:{...valid.tokens,cached_input_tokens:101}}).status,'unknown');assert.equal(stageCost({...valid,tokens:{...valid.tokens,reasoning_output_tokens:21}}).status,'unknown');
 const dir=temp();fs.mkdirSync(path.join(dir,'stage-1'));write(path.join(dir,'stage-1/stage-run.json'),{cost:stageCost()});const py="import sys,json;sys.path.insert(0,sys.argv[1]);import cost;print(json.dumps(cost.summarize(sys.argv[2])))";const c=JSON.parse(execFileSync('python3',['-B','-c',py,path.resolve('scripts/n01'),dir],{encoding:'utf8'}));assert.equal(c.coverage.status,'unknown');assert.equal(c.tokens,null);assert.equal(c.estimatedTotalUsd,null);costValues(c);
});
function pair(root,failed=false){
 const runs=path.join(root,'runs');fs.mkdirSync(runs);for(const condition of ['baseline','lookout']){const dir=path.join(runs,condition);fs.mkdirSync(dir);const checkpoints=[];for(const [i,s]of spec.stages.entries()){const sd=path.join(dir,'stage-'+(i+1));fs.mkdirSync(sd);write(path.join(sd,'after.json'),{fixture:true,state:ref.checkpoints[s.id]});write(path.join(sd,'response.json'),{trace:[],interactions:[],files:{}});checkpoints.push({stage:s.id,index:i+1,status:'completed',executionSeconds:1,uniqueTurns:0,answeredTurns:0,scriptedInitiations:Number(condition==='baseline'&&s.kind==='email')});if(failed)break;}
 write(path.join(dir,'terminal-confirmation.json'),{status:'confirmed',testFixture:true});const r={version:spec.version,episodeId:'fixture-'+condition,pairId:'fixture-pair',condition,status:failed?'timed_out':'completed',checkpoints,cost:null};write(path.join(dir,'run.json'),r);const files={};for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(entry.isDirectory())for(const f of fs.readdirSync(path.join(dir,entry.name)))files[entry.name+'/'+f]=hash(fs.readFileSync(path.join(dir,entry.name,f),'utf8'));else files[entry.name]=hash(fs.readFileSync(path.join(dir,entry.name),'utf8'));}write(path.join(dir,'evidence-hashes.json'),files);}
 const h=handoff(root),a=assign(h,'fresh-grader',{implementers:['fixture-implementer'],coordinators:['fixture-coordinator'],operators:['fixture-operator'],participants:['fixture-baseline','fixture-lookout']});write(path.join(root,'grading/assignment.json'),a);const submission={attestation:{reviewer:a.reviewer,assignmentHash:hash(a),freshContext:true,didImplement:false,didCoordinate:false,didOperate:false,didParticipate:false},conditions:{}};
 for(const condition of ['baseline','lookout']){const r=read(path.join(runs,condition,'run.json'));submission.conditions[condition]={reviewer:a.reviewer,interactionReviewComplete:true,additionalInteractions:[],checkpoints:Object.fromEntries(r.checkpoints.map(cp=>{const f='stage-'+cp.index+'/after.json';return [cp.stage,{extraction:{state:ref.checkpoints[cp.stage],evidenceFiles:[f]},ratings:Object.fromEntries(spec.stages[cp.index-1].checks.map(k=>[k,{rating:2,reason:'Synthetic grading-boundary fixture only',evidenceFiles:[f]}]))}];})),adherence:Object.fromEntries(spec.adherence.map(k=>[k,{status:'not_applicable',reason:'Synthetic boundary fixture',evidenceFiles:['terminal-confirmation.json']}]))};}
 return {h,a,submission};
}
test('fresh grader assignment excludes every execution role and binds final results',()=>{
 const {root}=setup(),{h,a,submission}=pair(root);assert.throws(()=>assign(h,'fixture-operator',a.excluded),/Fresh grader/);const result=finalize(root,submission);assert.equal(result.grades.baseline.status,'reviewed');assert.equal(result.grades.lookout.status,'reviewed');assert.equal(result.grades.baseline.effort.uniqueTurns,0);assert.equal(result.grades.baseline.checkpoints.screen_debrief.state.nextRound.pass,true);assert.throws(()=>finalize(root,submission),/EEXIST/);
});
test('stale/forged review and nonexistent citations cannot finalize',()=>{
 for(const mutate of [s=>{s.attestation.didOperate=true;},s=>{s.attestation.assignmentHash='stale';},s=>{s.conditions.baseline.checkpoints.submitted.ratings.pipeline_accuracy.evidenceFiles=['missing.json'];},s=>{s.conditions.baseline.interactionReviewComplete=false;}]){const {root}=setup(),{submission}=pair(root);mutate(submission);assert.throws(()=>finalize(root,submission));assert.equal(fs.existsSync(path.join(root,'grading/final.json')),false);}
});
test('changed saved evidence and symlink escape are rejected',()=>{
 const {root}=setup(),{submission}=pair(root);fs.appendFileSync(path.join(root,'runs/lookout/stage-1/after.json'),' ');assert.throws(()=>finalize(root,submission),/Evidence changed/);
 const d=temp(),outside=path.join(d,'outside');fs.writeFileSync(outside,'sensitive fixture');fs.mkdirSync(path.join(d,'run'));fs.symlinkSync(outside,path.join(d,'run/link'));assert.throws(()=>verifiedManifest(path.join(d,'run'),{link:hash('sensitive fixture')}));
});
test('timeouts remain partial with unreached stages, not a successful whole-trajectory grade',()=>{
 const {root}=setup(),{submission}=pair(root,true),result=finalize(root,submission);assert.equal(result.grades.lookout.status,'partial_review');assert.equal(result.grades.lookout.unreachedStages.length,spec.stages.length-1);
});
test('bound scripted execution exercises session routing, terminal capture and no-retry without model calls',()=>{
 const {root,command,config}=setup();
 fs.writeFileSync(command[1],`import fs from 'node:fs';import{createHash}from'node:crypto';const q=JSON.parse(fs.readFileSync(0,'utf8'));const h=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');let r={requestHash:h(q),receiptId:'synthetic-fixture-only',ownerId:q.ownerId,capturedAt:'2026-11-09T15:00:00Z',testFixture:true};if(q.operation==='participant.turn')Object.assign(r,{participantExecuted:true,synthetic:false,status:'completed',session:q.session,resume:q.resume,isolation:{futureEvidenceVisible:false,graderVisible:false,credentialsVisible:false},trace:[{type:'synthetic_test_event'}],toolTrace:[],files:{},interactions:[]});else Object.assign(r,{status:'confirmed',snapshot:{}});console.log(JSON.stringify(r));`);
 // In-memory fake receipts are a harness test, never actual host readiness evidence.
 const receipt=path.join(root,'receipts/fixture-only.json');assert.equal(preflight(root,command,receipt,service).ready,true);
 const h=run(root,command,receipt,'synthetic-boundary');assert.equal(h.runs.length,2);const a=read(path.join(root,'runs/lookout/run.json'));assert.equal(a.status,'completed');assert.equal(a.cost.coverage.status,'unknown');assert.equal(a.cost.tokens,null);assert.equal(a.checkpoints.length,spec.stages.length);
 const response=read(path.join(root,'runs/lookout/stage-5/response.json'));assert.equal(response.resume,true);assert.equal(response.session,4);assert.throws(()=>run(root,command,receipt,'again'),/One attempt/);
});
test('specificity comparison and simulated time use complete independently reviewed outcomes only',()=>{
 const {root}=setup(),{submission}=pair(root);submission.conditions.lookout.checkpoints.screen_invitation.ratings.candidate_specificity.rating=1;submission.conditions.baseline.checkpoints.submitted.outcomeComplete=true;const result=finalize(root,submission);assert.equal(result.comparison.candidate_specificity.result,'baseline_higher');assert.equal(result.comparison.role_specificity.result,'tie');assert.equal(result.grades.baseline.checkpoints.submitted.simulatedCompletionMinute,1/60);assert.equal(result.grades.lookout.checkpoints.submitted.simulatedCompletionMinute,null);assert.ok(result.unmeasured.includes('usefulness'));
});
test('complete usage preserves cached subset without inventing monetary costs',()=>{
 const dir=temp();fs.mkdirSync(path.join(dir,'stage-1'));write(path.join(dir,'stage-1/stage-run.json'),{cost:stageCost({status:'complete',source:'codex_session_total_token_usage_delta',model:spec.model,tokens:{input_tokens:100,cached_input_tokens:30,output_tokens:20}})});const py="import sys,json;sys.path.insert(0,sys.argv[1]);import cost;print(json.dumps(cost.summarize(sys.argv[2])))";const c=JSON.parse(execFileSync('python3',['-B','-c',py,path.resolve('scripts/n01'),dir],{encoding:'utf8'}));assert.equal(c.coverage.status,'complete');assert.equal(c.tokens.cached_input_tokens,30);assert.equal(c.tokens.input_tokens,100);assert.equal(c.estimatedModelUsd,null);assert.equal(c.billedUsd,null);costValues(c);
});

test('historical review survives retired runtime bytes while execution remains hash-bound',()=>{
 const {root,parent}=setup(),retired=path.join(parent,'retired-runtime');fs.writeFileSync(retired,'old runtime bytes');
 const freeze=read(path.join(root,'freeze.json'));freeze.executables[retired]=hash('old runtime bytes');fs.writeFileSync(path.join(root,'freeze.json'),JSON.stringify(freeze));
 const {submission}=pair(root);fs.unlinkSync(retired);
 assert.throws(()=>frozen(root));assert.equal(finalize(root,submission).grades.baseline.status,'reviewed');
});

test('invalid execution timing stays unknown in a partial final review',()=>{
 const {root}=setup(),{submission}=pair(root,true),dir=path.join(root,'runs/lookout');
 const run=read(path.join(dir,'run.json'));run.checkpoints[0].executionSeconds=null;fs.writeFileSync(path.join(dir,'run.json'),JSON.stringify(run,null,2)+'\n');
 const files=read(path.join(dir,'evidence-hashes.json'));files['run.json']=hash(fs.readFileSync(path.join(dir,'run.json'),'utf8'));fs.writeFileSync(path.join(dir,'evidence-hashes.json'),JSON.stringify(files));
 const h=read(path.join(root,'grading/handoff.json'));const item=h.runs.find(x=>x.condition==='lookout');item.runHash=hash(run);item.manifest=files;fs.writeFileSync(path.join(root,'grading/handoff.json'),JSON.stringify(h));
 const a=read(path.join(root,'grading/assignment.json'));a.handoffHash=hash(h);fs.writeFileSync(path.join(root,'grading/assignment.json'),JSON.stringify(a));submission.attestation.assignmentHash=hash(a);
 assert.equal(finalize(root,submission).grades.lookout.executionSeconds,null);
});

test('unconfirmed container termination halts pair before other condition or grading',()=>{
 const {root,command}=setup();
 fs.writeFileSync(command[1],`import fs from 'node:fs';import{createHash}from'node:crypto';const q=JSON.parse(fs.readFileSync(0,'utf8'));let r={requestHash:createHash('sha256').update(JSON.stringify(q)).digest('hex'),receiptId:'fixture',ownerId:q.ownerId,capturedAt:'2026-11-09T15:00:00Z'};if(q.operation==='participant.turn')Object.assign(r,{status:'execution_failed',hostControlFailed:true,timing:{valid:false,wallSeconds:11},executionSeconds:null});else r.status='confirmed';console.log(JSON.stringify(r));`);
 const receipt=path.join(root,'receipts/fixture.json');assert.equal(preflight(root,command,receipt,service).ready,true);
 const halted=run(root,command,receipt,'uncontained-fixture');assert.equal(halted.gradingBlocked,true);assert.deepEqual(halted.unattemptedConditions,['lookout']);assert.equal(fs.existsSync(path.join(root,'runs/lookout')),false);assert.equal(fs.existsSync(path.join(root,'grading/handoff.json')),false);
 const r=read(path.join(root,'runs/baseline/run.json'));assert.equal(r.checkpoints[0].executionSeconds,null);assert.equal(r.checkpoints[0].executionWallSeconds,11);assert.equal(r.hostControlFailed,true);
 assert.equal(read(path.join(root,'runs/baseline/stage-1/after.json')).reason,'container_stop_unconfirmed');
});
