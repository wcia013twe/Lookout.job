import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {prepare,preflight,packet,actor,compareState,hash,assign,finalize,read,write,run} from '../scripts/job03/task.mjs';
const spec=read(new URL('../examples/job03/scenario.json',import.meta.url));
const fixture=read(new URL('../examples/job03/fixture.json',import.meta.url));
const config={benchmarkTaskId:'JOB03',fictional:true,dedicated:true,ownerId:'isolated-owner',readOnlyOwnerId:'isolated-owner',source:'synthetic test only',model:'same-pinned-model',reasoning:'medium',normalProductConfiguration:{synthetic:true}};
function workspace(t){const p=fs.mkdtempSync(path.join(os.tmpdir(),'job03-test-'));t.after(()=>fs.rmSync(p,{recursive:true,force:true}));return p;}
function setup(t){const p=path.join(workspace(t),'prepared');prepare(p,config);return p;}
function fakeAdapter(t,mode){const p=path.join(workspace(t),'adapter.mjs');fs.writeFileSync(p,`import fs from 'node:fs'; import crypto from 'node:crypto';const q=JSON.parse(fs.readFileSync(0,'utf8'));const hash=crypto.createHash('sha256').update(JSON.stringify(q)).digest('hex');const r={requestHash:hash,receiptId:'synthetic-receipt',capturedAt:'2026-11-16T14:00:00Z',ownerId:q.ownerId,benchmarkTaskId:'JOB03',dedicated:true,actual:true,synthetic:${mode==='synthetic'},capabilities:${JSON.stringify(['native.write_readback','native.restore','native.readonly_confirmation','baseline.files','participant.sessions','actor.controlled','browser.equal','application.interruption','reminder.schedule','reminder.read','reminder.cancel','reminder.delivery','reminder.test_clock'])},reminderServiceId:'test',baselineReminderServiceId:'test',lookoutReminderServiceId:'test'};if(q.operation==='native.probe')Object.assign(r,{writerReadback:true,readOnlyConfirmed:true,restored:true,unrelatedPreserved:true,allowedTransitions:true,interruptionRetained:true,resumedWithoutDuplicate:true,unsubmitted:true});if(q.operation==='reminder.schedule')Object.assign(r,{reminderId:'test-reminder',state:'scheduled',dueAt:q.dueAt,timeZone:'UTC'});if(${JSON.stringify(mode)}==='bad-binding')r.requestHash='wrong';console.log(JSON.stringify(r));`);return [process.execPath,p];}
test('portfolio freezes correct transitions, source and unchanged E at every checkpoint',()=>{
 assert.equal(spec.stages.length,8);assert.equal(new Set(spec.stages.map(s=>s.session)).size,8);
 const m=spec.expected.multi_update;assert.equal(m.A.status,'submitted');assert.equal(m.A.provenance,'user_reported');assert.equal(m.A.receipt,null);assert.equal(m.A.reminder.dueAt,'2026-11-18T14:00:00Z');assert.equal(m.A.reminder.timeZone,'America/New_York');assert.equal(m.B.answer,'2027-01-19');assert.equal(m.B.blocker,null);assert.equal(m.B.status,'unsubmitted');assert.equal(m.C.status,'withdrawn');assert.equal(m.C.reminder.state,'cancelled');
 assert.equal(spec.expected.rejection.D.status,'rejected');assert.equal(spec.expected.rejection.D.provenance,'employer_email');assert.equal(spec.expected.rejection.D.reminder.state,'cancelled');assert.deepEqual(spec.expected.duplicate,spec.expected.rejection);assert.equal(spec.expected.reminder_due.A.reminder.state,'delivered');
 for(const state of Object.values(spec.expected))assert.deepEqual(state.E,fixture.jobs.E);
 assert.equal(spec.expected.final.B.status,'unsubmitted');assert.equal(spec.expected.final.B.preparation.state,'prepared');assert.equal(spec.expected.final.B.preparation.applicationCount,1);assert.deepEqual(spec.expected.final.D.history,['D-user-report','dogwood-rejection-1']);
});
test('packets do not expose private rubric/future facts or replay onboarding',()=>{
 const first=packet(spec,fixture,spec.stages[0],'baseline',true);assert(first.initialJobs);assert(!JSON.stringify(first).includes('January 19'));assert(!('expected'in first));
 for(const c of ['lookout','baseline'])for(const s of spec.stages.slice(1)){const p=packet(spec,fixture,s,c,false);assert(!p.initialJobs);assert(!p.candidate);assert(!p.expected);assert(!p.quality);assert(p.orientation);}
 assert.equal(spec.stages.find(s=>s.id==='rejection').source.messageId,spec.stages.find(s=>s.id==='duplicate').source.messageId);
});
test('actor cannot leak a future answer or grant sending permission',()=>{
 assert(!actor('Birch start date?',spec.stages.slice(0,1)).includes('January'));
 assert(actor('Birch start date?',spec.stages.slice(0,3)).includes('January 19'));
 assert(actor('May I submit?',spec.stages).startsWith('No.'));
});
test('state comparison catches wrong entity, forged receipt, unrelated blocker and duplicate history',()=>{
 const expected=spec.expected.final;assert(compareState(expected,structuredClone(expected)).pass);
 for(const mutate of [x=>x.A.receipt='forged',x=>x.B.status='submitted',x=>x.E.blocker=null,x=>x.C.reminder.state='scheduled',x=>x.D.history.push('dogwood-rejection-1'),x=>x.A.reminder.dueAt='2026-11-18T09:00:00Z',x=>{x.A.answer=x.B.answer;x.B.answer=null;}]){const x=structuredClone(expected);mutate(x);assert(!compareState(expected,x).pass);}
});
test('absent service produces retained blocked receipt and cannot start participant',t=>{
 const root=setup(t),out=path.join(root,'preflight.json'),r=preflight(root,null,out);assert(!r.ready);assert.equal(r.participantExecuted,false);assert(r.blockers[0].includes('adapter'));assert.equal(read(out).status,'blocked');assert.throws(()=>run(root,null,out,'not-run'),/successful actual-service/);assert(!fs.existsSync(path.join(root,'runs')));
});
test('synthetic capability claims and forged service bindings cannot establish readiness',t=>{
 for(const mode of ['synthetic','bad-binding']){const root=setup(t),r=preflight(root,fakeAdapter(t,mode),path.join(root,'receipt.json'));assert(!r.ready);assert(r.calls.length===1);}
});
test('a service with wrong timezone fails before delivery and records cleanup',t=>{
 const root=setup(t),r=preflight(root,fakeAdapter(t,'wrong-timezone'),path.join(root,'receipt.json'));assert(!r.ready);assert(r.blockers[0].includes('due/timezone'));assert(r.calls.some(c=>c.request.operation==='reminder.cleanup'));assert(!r.calls.some(c=>c.request.operation==='participant.turn'));
});
test('frozen source modification blocks probes',t=>{
 const root=setup(t);fs.appendFileSync(path.join(root,'suite/scenario.json'),' ');assert.throws(()=>preflight(root,null,path.join(root,'receipt.json')),/Frozen input changed/);
});
test('fresh grader requires all exclusion rosters and forbids coordinator reuse',()=>{
 const roster={implementers:['i'],coordinators:['c'],operators:['o'],participants:['p']};assert.throws(()=>assign({},'c',roster),/independent/);assert.throws(()=>assign({},'fresh',{implementers:['i']}),/exclusion/);assert.equal(assign({},'fresh',roster).forkTurns,'none');
});
function gradedRoot(t){
 const root=setup(t),f=read(path.join(root,'freeze.json'));fs.mkdirSync(path.join(root,'runs'));const runs=[];
 for(const condition of ['baseline','lookout']){const dir=path.join(root,'runs',condition);fs.mkdirSync(dir);fs.mkdirSync(path.join(dir,'initial'));write(path.join(dir,'initial/after.json'),{jobs:fixture.jobs});write(path.join(dir,'terminal-confirmation.json'),{status:'confirmed',readOnly:true});const r={version:spec.version,condition,status:'completed',pairId:'synthetic',checkpoints:[{stage:'initial',executionSeconds:1,uniqueTurns:0,answeredTurns:0}]};write(path.join(dir,'run.json'),r);const manifest={};for(const p of ['initial/after.json','terminal-confirmation.json','run.json'])manifest[p]=hash(fs.readFileSync(path.join(dir,p),'utf8'));write(path.join(dir,'evidence-hashes.json'),manifest);runs.push({condition,runHash:hash(r),manifest});}
 fs.mkdirSync(path.join(root,'grading'));const h={freezeHash:hash(f),scenarioHash:hash(spec),runs};write(path.join(root,'grading/handoff.json'),h);const a=assign(h,'fresh',{implementers:['i'],coordinators:['c'],operators:['o'],participants:['p']});write(path.join(root,'grading/assignment.json'),a);
 const review={reviewer:'fresh',extraction:{initial:{jobs:fixture.jobs,evidenceFiles:['initial/after.json']}},checkpoints:{initial:Object.fromEntries(spec.quality.map(k=>[k,{rating:2,reason:'Synthetic preservation only',evidenceFiles:['initial/after.json']}]))},adherence:Object.fromEntries(spec.adherence.map(k=>[k,{status:'met',evidenceFiles:['initial/after.json']}]))};
 Object.assign(review,{interactionReviewComplete:true,additionalInteractions:[]});
 return {root,submission:{attestation:{reviewer:'fresh',assignmentHash:hash(a),freshContext:true,didImplement:false,didCoordinate:false,didOperate:false,didParticipate:false},conditions:{baseline:structuredClone(review),lookout:structuredClone(review)}}};
}
test('final grader binds durable extraction, ratings and artifacts; unrelated tampering fails',t=>{
 const {root,submission}=gradedRoot(t);fs.appendFileSync(path.join(root,'runs/baseline/initial/after.json'),' ');assert.throws(()=>finalize(root,submission),/Frozen evidence changed/);
});
test('missing checkpoint evidence and reused implementer attestation fail',t=>{
 const a=gradedRoot(t);a.submission.conditions.baseline.checkpoints.initial.entity_routing.evidenceFiles=['invented.json'];assert.throws(()=>finalize(a.root,a.submission),/frozen citations/);
 const b=gradedRoot(t);b.submission.attestation.didImplement=true;assert.throws(()=>finalize(b.root,b.submission),/attestation/);
});
test('partial checkpoint coverage cannot become strict pass or report complete trajectory',t=>{
 const {root,submission}=gradedRoot(t);const result=finalize(root,submission);assert.equal(result.grades.baseline.unreachedStages.length,7);assert.equal(result.grades.baseline.cost.coverage.status,'unknown');assert.equal(result.grades.baseline.cost.tokens,null);
 // A dishonest host completed marker must not bypass stage coverage.
 assert.equal(result.grades.baseline.strictPass,false);
});
function lateFailureAdapter(t,mode){
 const dir=workspace(t),script=path.join(dir,'late.mjs'),state=path.join(dir,'counter.json');
 fs.writeFileSync(script,`import fs from 'node:fs';import crypto from 'node:crypto';const q=JSON.parse(fs.readFileSync(0,'utf8')),mode=${JSON.stringify(mode)},state=${JSON.stringify(state)};let n=fs.existsSync(state)?JSON.parse(fs.readFileSync(state)):0;const r={requestHash:crypto.createHash('sha256').update(JSON.stringify(q)).digest('hex'),ownerId:q.ownerId,receiptId:'injected',capturedAt:'2026-11-16T14:00:00Z',actual:true,synthetic:false,benchmarkTaskId:'JOB03',dedicated:true,capabilities:${JSON.stringify(['native.write_readback','native.restore','native.readonly_confirmation','baseline.files','participant.sessions','actor.controlled','browser.equal','application.interruption','reminder.schedule','reminder.read','reminder.cancel','reminder.delivery','reminder.test_clock'])},reminderServiceId:'injected',baselineReminderServiceId:'injected',lookoutReminderServiceId:'injected'};
 if(q.operation==='participant.turn'&&mode==='uncontained')Object.assign(r,{status:'execution_failed',hostControlFailed:true,timing:{valid:false,wallSeconds:11},executionSeconds:null});
 if(q.operation==='native.probe')Object.assign(r,{writerReadback:true,readOnlyConfirmed:true,restored:true,unrelatedPreserved:true,allowedTransitions:true,interruptionRetained:true,resumedWithoutDuplicate:true,unsubmitted:true});
 if(q.operation==='reminder.schedule')Object.assign(r,{reminderId:q.key.endsWith('-cancel')?'cancel':'due',state:'scheduled',dueAt:q.dueAt,timeZone:q.timeZone,duplicate:true});
 if(q.operation==='reminder.read')Object.assign(r,{state:'scheduled',dueAt:'2026-11-18T14:00:00Z',timeZone:'America/New_York'});
 if(q.operation==='reminder.cancel')r.state='cancelled';
 if(q.operation==='reminder.delivery'){
  if(q.reminderId==='cancel')Object.assign(r,{state:'cancelled',deliveryCount:mode==='cancelled'?1:0});
  else if(q.now.endsWith('13:59:59Z'))r.deliveryCount=mode==='early'?1:0;
  else {n++;fs.writeFileSync(state,JSON.stringify(n));Object.assign(r,{delivered:true,deliveryReceiptId:'injected-delivery',duplicate:n>1,deliveryCount:mode==='duplicate'&&n>1?2:1});}
 }console.log(JSON.stringify(r));`);
 return [process.execPath,script];
}
test('injected early, duplicate and cancelled deliveries fail readiness and retain receipts',t=>{
 for(const [mode,error]of [['early','Early reminder'],['duplicate','Duplicate delivery'],['cancelled','Cancelled reminder']]){
  const root=setup(t),receipt=preflight(root,lateFailureAdapter(t,mode),path.join(root,'receipt.json'));assert(!receipt.ready);assert(receipt.blockers[0].includes(error),receipt.blockers[0]);assert(receipt.calls.some(c=>c.request.operation==='reminder.delivery'));assert(receipt.calls.some(c=>c.request.operation==='reminder.cleanup'));assert.equal(receipt.participantExecuted,false);
 }
});

test('one controlled B preparation failure retains progress and fresh-session resume never submits or duplicates',()=>{
 const broken=spec.expected.interrupted_preparation.B,answered=spec.expected.multi_update.B,resumed=spec.expected.resume_preparation.B;
 assert.deepEqual(broken.preparation.completedFields,['name','email']);assert.equal(broken.preparation.failureCount,1);assert.equal(broken.blocker,'earliest-start-date');assert.equal(answered.blocker,null);assert.equal(answered.preparation.state,'interrupted');assert.equal(resumed.preparation.state,'prepared');assert.equal(resumed.preparation.failureCount,1);assert.equal(resumed.preparation.applicationCount,1);assert.equal(resumed.status,'unsubmitted');assert.equal(resumed.receipt,null);
 assert.notEqual(spec.stages.find(x=>x.id==='multi_update').session,spec.stages.find(x=>x.id==='resume_preparation').session);
 const bad=structuredClone(spec.expected.resume_preparation);bad.B.preparation.applicationCount=2;assert(!compareState(spec.expected.resume_preparation,bad).pass);
});
test('editing adapter bytes at the same path invalidates successful readiness before any participant attempt',t=>{
 const root=setup(t),command=lateFailureAdapter(t,'ok'),file=path.join(root,'ready.json');const pre=preflight(root,command,file);assert.equal(pre.ready,true,pre.blockers.join('; '));
 assert.ok(pre.runtime.files[fs.realpathSync(command[0])]);assert.ok(pre.runtime.files[fs.realpathSync(command[1])]);
 fs.appendFileSync(command[1],'\n// Changed adapter at same argv path');assert.throws(()=>run(root,command,file,'not-run'),/successful actual-service/);assert.equal(fs.existsSync(path.join(root,'runs')),false);
});
test('declared dependency changes invalidate runtime binding without changing adapter argv',async t=>{
 const {runtimeBinding}=await import('../scripts/job03/task.mjs');const command=lateFailureAdapter(t,'ok'),dependency=path.join(workspace(t),'dependency.mjs');fs.writeFileSync(dependency,'original');const cfg={...config,runtimeFiles:[dependency]};const before=runtimeBinding(command,cfg);fs.writeFileSync(dependency,'changed');assert.notEqual(hash(before),hash(runtimeBinding(command,cfg)));assert.throws(()=>runtimeBinding(['node',command[1]],cfg),/Absolute/);
});
test('missing after-state capture finalizes as unverifiable partial evidence while preserving metrics',t=>{
 const {root,submission}=gradedRoot(t);
 for(const condition of ['baseline','lookout']){
  const dir=path.join(root,'runs',condition),r=read(path.join(dir,'run.json'));r.status='harness_failed';Object.assign(r.checkpoints[0],{status:'harness_failed',captureError:'Injected snapshot failure',participantAttempted:true,executionSeconds:17,uniqueTurns:2,answeredTurns:1});
  fs.unlinkSync(path.join(dir,'initial/after.json'));fs.writeFileSync(path.join(dir,'run.json'),JSON.stringify(r));write(path.join(dir,'initial/error.json'),{error:'Injected snapshot failure'});
  const manifest={};for(const p of ['initial/error.json','terminal-confirmation.json','run.json'])manifest[p]=hash(fs.readFileSync(path.join(dir,p),'utf8'));fs.writeFileSync(path.join(dir,'evidence-hashes.json'),JSON.stringify(manifest));
  const h=read(path.join(root,'grading/handoff.json')),b=h.runs.find(x=>x.condition===condition);b.runHash=hash(r);b.manifest=manifest;fs.writeFileSync(path.join(root,'grading/handoff.json'),JSON.stringify(h));
  submission.conditions[condition].extraction={};submission.conditions[condition].checkpoints={};for(const entry of Object.values(submission.conditions[condition].adherence)){entry.status='unreached';entry.evidenceFiles=['terminal-confirmation.json'];}
 }
 const h=read(path.join(root,'grading/handoff.json')),a=assign(h,'fresh',{implementers:['i'],coordinators:['c'],operators:['o'],participants:['p']});fs.writeFileSync(path.join(root,'grading/assignment.json'),JSON.stringify(a));submission.attestation.assignmentHash=hash(a);
 const result=finalize(root,submission);for(const grade of Object.values(result.grades)){assert.equal(grade.status,'partial_review');assert.equal(grade.stateChecks.initial.pass,null);assert.deepEqual(grade.unverifiableStages,['initial']);assert.equal(grade.executionSeconds,17);assert.equal(grade.uniqueInteractionTurns,2);assert.equal(grade.qualityFraction,null);assert.equal(grade.strictPass,false);assert.equal(grade.cost.coverage.status,'unknown');}
});

test('prospective storage instructions require saving and verification in both conditions',()=>{
 const scenario=JSON.parse(fs.readFileSync(new URL('../examples/job03/scenario.json',import.meta.url),'utf8'));
 for(const key of ['lookoutOrientation','baselineOrientation']){assert.match(scenario.configuration[key],/save material updates/);assert.match(scenario.configuration[key],/verify writes/);assert.doesNotMatch(scenario.configuration[key],/you may save/);}
});

test('unconfirmed JOB03 container stop preserves unknown timing and halts pair',t=>{
 const root=setup(t),command=lateFailureAdapter(t,'uncontained'),receipt=path.join(root,'preflight.json');assert.equal(preflight(root,command,receipt).ready,true);
 const halted=run(root,command,receipt,'uncontained-fixture');assert.equal(halted.gradingBlocked,true);assert.deepEqual(halted.unattemptedConditions,['lookout']);assert.equal(fs.existsSync(path.join(root,'runs/lookout')),false);assert.equal(fs.existsSync(path.join(root,'grading/handoff.json')),false);
 const r=read(path.join(root,'runs/baseline/run.json'));assert.equal(r.checkpoints[0].executionSeconds,null);assert.equal(r.checkpoints[0].executionWallSeconds,11);assert.equal(r.hostControlFailed,true);
 assert.equal(read(path.join(root,'runs/baseline/initial/after.json')).reason,'container_stop_unconfirmed');
});
