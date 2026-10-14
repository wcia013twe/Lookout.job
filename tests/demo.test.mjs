import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoWorkspace, createDemoServices } from '../next-app/lib/muse-demo-fixtures.mjs';
import { canUseDemo, createMemoryStore, demoFixtures } from '../next-app/lib/demo.mjs';
import { buildSubmissionRecord } from '../submission-record.mjs';
import { createDemoStore } from '../next-app/lib/demo-store.mjs';
const now = '2026-10-14T12:00:00Z';
function memory(state) { return { get(path) { return path ? path.split('.').reduce((value, key) => value?.[key], state) : state; }, set(path, value) { const keys=path.split('.'),last=keys.pop(); const parent=keys.reduce((value,key)=>value[key] ||= {},state); parent[last]=value; } }; }
test('demo fixtures reset deterministically and include confirmed and uncertain states', () => {
 const first=createDemoWorkspace(now), second=createDemoWorkspace(now);
 assert.deepEqual(first,second);
 first.workflow.profile.name='Changed'; assert.notEqual(second.workflow.profile.name,first.workflow.profile.name);
 assert.equal(first.demo.fictional,true);
 assert.equal(first.workflow.searchPreferences.quietMode.cadence,'weekly');
 const plans=first.workflow.preparationPlans;
 assert.equal(plans['demo-interview'].deadline.status,'confirmed');
 assert.ok(plans['demo-interview'].tasks.some(task=>task.completed));
 assert.equal(plans['demo-ambiguous'].deadline.status,'needs_confirmation');
 assert.ok(plans['demo-ambiguous'].tasks.every(task=>task.dueDate===null));
 assert.ok(first.demo.selectionDecisions.some(row=>row.certainty==='exclusion'));
 assert.ok(first.demo.selectionDecisions.some(row=>row.certainty==='uncertain'));
});
test('demo confirmation and attempt snapshots remain separate from edited current drafts', async () => {
 const state=createDemoWorkspace(now), service=createDemoServices(memory(state));
 state.workflow.applications['demo-confirmed'].questions[0].answer='Edited draft answer';
 const record=await service.readSubmissionRecord('demo-confirmed');
 const mapped=buildSubmissionRecord(record.application,record.attempts);
 assert.equal(mapped.attempts[0].confirmed,true);
 assert.notEqual(mapped.attempts[0].questions[0].answer,'Edited draft answer');
 record.attempts[0].receipt.message='Mutated response';
 assert.notEqual((await service.readSubmissionRecord('demo-confirmed')).attempts[0].receipt.message,'Mutated response');
 const uncertain=await service.readSubmissionRecord('demo-uncertain');
 assert.equal(buildSubmissionRecord(uncertain.application,uncertain.attempts).attempts[0].confirmed,false);
 assert.equal(uncertain.attempts[0].receipt,null);
 assert.ok(!mapped.attempts[0].resume.objectPath);
});
test('demo preparation uses optimistic versions and never changes another application', async () => {
 const state=createDemoWorkspace(now), service=createDemoServices(memory(state));
 const row=await service.readPreparation('demo-interview');
 row.plan.tasks[1].completed=true;
 const saved=await service.savePreparation('demo-interview',1,row.plan);
 assert.equal(saved.version,2);
 assert.equal((await service.readPreparation('demo-interview')).plan.tasks[1].completed,true);
 await assert.rejects(()=>service.savePreparation('demo-interview',1,row.plan),/Reload/);
 await assert.rejects(()=>service.savePreparation('demo-ambiguous',1,row.plan),/valid plan/);
 await assert.rejects(()=>service.readPreparation('real-account-id'),/not found/);
});
test('selection reconsideration mutates demo memory only and fixture resets restore it', async () => {
 const state=createDemoWorkspace(now), service=createDemoServices(memory(state));
 const decisions=await service.readSelectionDecisions(); decisions[0].reason='Response edit';
 assert.notEqual((await service.readSelectionDecisions())[0].reason,'Response edit');
 const changed=await service.reconsiderSelection('demo-decision-location');
 assert.ok(changed.reconsidered_at);
 assert.equal(createDemoWorkspace(now).demo.selectionDecisions[0].reconsidered_at,null);
 assert.throws(()=>createDemoServices(memory({})),/isolated/);
});
test('fictional fixture URLs use reserved example.com and no downloadable object path', () => {
 const state=createDemoWorkspace(now);
 const urls=JSON.stringify(state).match(/https:\/\/[^"\s]+/g) || [];
 assert.ok(urls.length);
 assert.ok(urls.every(url=>new URL(url).hostname==='example.com'));
 assert.ok(!JSON.stringify(state).includes('object_path'));
});
test('quiet mode demo service preserves preference extras, increments versions and rejects stale writes', async () => {
 const store=createDemoStore(createDemoWorkspace(now)),service=createDemoServices(store);
 const initial=await service.readQuietMode();
 assert.equal(initial.personalVersion,1);
 const extras=store.get('workflow.searchPreferences.reviewPolicy');
 const changed=await service.saveQuietMode({...initial.settings,cadence:'daily'},1);
 assert.equal(changed.personalVersion,2);
 assert.equal(changed.settings.cadence,'daily');
 assert.deepEqual(store.get('workflow.searchPreferences.reviewPolicy'),extras);
 await assert.rejects(()=>service.saveQuietMode(initial.settings,1),/Reload/);
 await assert.rejects(()=>service.saveQuietMode({...changed.settings,digestHour:30},2),/valid/);
 assert.equal((await service.readQuietMode()).personalVersion,2);
 assert.equal(createDemoWorkspace(now).demo.personalVersion,1);
});
test('demo memory store notifies subscribers and never touches real browser storage or accounts', async () => {
 const prior=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('Real localStorage must not be used in the demo.');}});
 try {
  const state=createDemoWorkspace(now),store=createDemoStore(state),service=createDemoServices(store);
  let notifications=0; const unsubscribe=store.subscribe('workflow',()=>notifications++);
  await service.reconsiderSelection('demo-decision-location');
  assert.ok(notifications>0);
  assert.equal(state.demo.selectionDecisions[0].reconsidered_at,null);
  assert.equal(store.switchAccount,undefined);
  store.reset(createDemoWorkspace(now));
  assert.equal(store.get('demo.selectionDecisions.0.reconsidered_at'),null);
  assert.equal(store.get('demo.date'),'2026-10-14');
  unsubscribe();
 } finally { if(prior)Object.defineProperty(globalThis,'localStorage',prior);else delete globalThis.localStorage; }
});

test('demo delivery preview defers routine progress and interrupts important decisions without sending',async()=>{
 const service=createDemoServices(createDemoStore(createDemoWorkspace(now)));
 assert.equal((await service.readDeliveryPolicy('routine')).delivery.decision,'defer');
 assert.equal((await service.readDeliveryPolicy('decision')).delivery.decision,'due');
});
test('combined admin fixtures preserve established demo and add Muse states without resume collisions',async()=>{
 const combined=demoFixtures('2026-10-14');
 assert.equal(combined.state.workflow.profile.name,'Demo Candidate');
 assert.equal(combined.state.network.referrals.length,2);
 assert.equal(combined.state.progress.xp,275);
 assert.ok(combined.roles.some(role=>role.id==='demo-robinhood'));
 assert.ok(combined.roles.some(role=>role.id==='demo-interview'));
 const resumes=combined.state.workflow.resumes.map(resume=>resume.id);
 assert.deepEqual(resumes,['demo-resume','muse-demo-resume']);
 assert.equal(combined.state.workflow.applications['demo-robinhood'].resumeId,'demo-resume');
 assert.equal(combined.state.workflow.applications['demo-interview'].resumeId,'muse-demo-resume');
 assert.equal(combined.state.demo.date,'2026-10-14');
 const service=createDemoServices(createMemoryStore(combined.state));
 assert.equal((await service.readPreparation('demo-robinhood')).plan.applicationId,'demo-robinhood');
 assert.deepEqual((await service.readSubmissionRecord('demo-stripe')).attempts,[]);
 assert.equal((await service.readSubmissionRecord('demo-confirmed')).attempts[0].state,'confirmed');
 assert.equal(canUseDemo({id:'admin',app_metadata:{demo_preview:true}}),true);
 assert.equal(canUseDemo({id:'other',user_metadata:{demo_preview:true}}),false);
});

test('admin fixture calendar dates remain exact across local timezone conversion',()=>{
 const state=demoFixtures('2026-10-13').state;
 assert.equal(state.demo.date,'2026-10-13');
 assert.equal(state.demo.roles.find(r=>r.id==='demo-interview').discoveredDate,'2026-10-13');
});
