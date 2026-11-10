import {test} from 'node:test';import assert from 'node:assert/strict';
import {createMemoryStore,demoFixtures} from '../next-app/lib/demo.mjs';
test('mock edits never mutate the input or a separate real-account snapshot',()=>{
 const initial=demoFixtures('2026-10-13').state;let change;const store=createMemoryStore(initial,s=>change=s);
 store.set('workflow.profile.name','Edited demo');assert.equal(initial.workflow.profile.name,'Demo Candidate');assert.equal(change.workflow.profile.name,'Edited demo');
 const fetched=store.get();fetched.workflow.profile.name='Mutated copy';assert.equal(store.get('workflow.profile.name'),'Edited demo');
 store.update('network.referrals',rows=>rows.slice(0,1));assert.equal(initial.network.referrals.length,2);assert.equal(store.get('network.referrals').length,1);
 store.set('workflow.theme.pack','lagoon');assert.equal(change.workflow.theme.pack,'lagoon');assert.equal(initial.workflow.theme.pack,'base');
 assert.equal(demoFixtures('2026-10-13').state.network.referrals.length,2);
 assert.equal(demoFixtures('2026-10-13').state.workflow.theme.pack,'base');
});


test('onboarding catalog preview uses a resettable fictional reference without creating tracked work',async()=>{
 const {chooseOnboardingPreview}=await import('../next-app/lib/onboarding-catalog.mjs');
 const {promptFromProfile,readField}=await import('../lib/search-profile.mjs');
 const fixtures=demoFixtures('2026-10-28'),profile=fixtures.state.workflow.searchPreferences.profiles[0];
 const prompt=promptFromProfile(profile),preferences={work:'Software engineering',employment:'Full-time',location:'United States'};
 const preview=chooseOnboardingPreview(fixtures.roles,preferences,{prompt,demo:true});
 assert.equal(preview.role.id,'demo-onboarding-backend');assert.equal(preview.role.company,'Example Systems (demo)');
 assert.equal(readField(prompt,'First opportunity','Selected at').value,'2026-10-28T12:00:00Z');
 assert.equal(fixtures.state.tracker.items[preview.role.id],undefined);
 const store=createMemoryStore(fixtures.state);store.set('workflow.searchPreferences.profiles',[]);
 assert.equal(demoFixtures('2026-10-28').state.workflow.searchPreferences.profiles[0].id,'general');
});


test('demo shows a saved auto-apply preference blocked by account authorization and resets edits',async()=>{
 const {accountAutomationSettings,profileAutomationSettings}=await import('../lib/application-policy.mjs');
 const {applicationPolicy}=await import('../supabase/functions/agent-gateway/application-policy.mjs');
 const initial=demoFixtures('2026-11-06').state,search=initial.workflow.searchPreferences;
 const profile=search.profiles.find(p=>p.id==='general');
 assert.equal(profileAutomationSettings(profile,search).enabled,true);
 assert.equal(accountAutomationSettings(search).enabled,false);
 const decide=search=>applicationPolicy({preferences:{search},profileId:'general',job:{company:'Example Systems (demo)',employmentType:'FT'}});
 assert.equal(decide(search).code,'account_auto_apply_disabled');
 const store=createMemoryStore(initial);store.set('workflow.searchPreferences.autoSubmitApproved',true);
 assert.equal(decide(store.get('workflow.searchPreferences')).mode,'auto-apply');
 assert.equal(decide(demoFixtures('2026-11-06').state.workflow.searchPreferences).code,'account_auto_apply_disabled');
});


test('demo recovery rereads a terminal uncertain request without claiming again or marking applied',async()=>{
 const {createDemoServices}=await import('../next-app/lib/demo.mjs');
 const initial=demoFixtures('2026-11-08').state,store=createMemoryStore(initial),api=createDemoServices(store);
 const queued=await api.queueApplicationJob({posting:{id:'demo-recovery-role',url:'https://example.com/fictional-recovery',company:'Example Recovery (demo)',title:'Fictional Engineer',employmentType:'FT',location:'Remote'},expectedRevision:0,eventKey:'recovery-queue'});
 await api.claimApplicationRequest({jobId:queued.job.id,expectedVersion:1,expectedRevision:0,eventKey:'recovery-claim'});
 await api.reportApplicationRequest({jobId:queued.job.id,expectedVersion:2,expectedRevision:0,eventKey:'recovery-report',outcome:'uncertain',summary:'Fictional confirmation is unavailable; verify before any further employer action.'});
 const resumed=createDemoServices(store),saved=(await resumed.backendJobs.read({jobId:queued.job.id})).jobs[0];
 assert.equal(saved.status,'partial');assert.equal(saved.result.outcome,'uncertain');assert.equal(saved.result.verifiedSubmission,false);
 await assert.rejects(resumed.claimApplicationRequest({jobId:saved.id,expectedVersion:saved.version,expectedRevision:0,eventKey:'recovery-must-not-reclaim'}),/cannot continue/);
 assert.equal(store.get('workflow.applications.demo-recovery-role').status,'Queued');
 const reread=(await resumed.backendJobs.read({jobId:saved.id})).jobs;
 assert.equal(reread.length,1);assert.deepEqual(reread[0],saved);
 assert.equal(initial.workflow.applications['demo-recovery-role'],undefined);
 assert.equal(createMemoryStore(demoFixtures('2026-11-08').state).get('workflow.applications.demo-recovery-role'),undefined);
});
