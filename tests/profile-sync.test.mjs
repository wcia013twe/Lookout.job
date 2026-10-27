import test from 'node:test';
import assert from 'node:assert/strict';
import {profileChanges,reconcileProfileChanges} from '../lib/profile-sync.mjs';
import {demoFixtures,createMemoryStore,createDemoServices} from '../next-app/lib/demo.mjs';
test('profile patches omit verification and unchanged arrays; conflict resolution preserves unrelated agent additions',()=>{
 const before={phone:'old',workExperience:[{company:'Original'}],verified:true};const local={...before,phone:'new',verified:false};
 assert.deepEqual(profileChanges(before,local),{phone:'new'});
 const latest={...before,workExperience:[...before.workExperience,{company:'Added by Muse'}]};
 const result=reconcileProfileChanges(before,local,latest);assert.equal(result.conflicts.length,0);assert.equal(result.profile.phone,'new');assert.equal(result.profile.workExperience.length,2);assert.equal(result.profile.verified,false);
});
test('demo conflict recovery uses fictional memory only and resets without account services',async()=>{
 const fixture=demoFixtures('2026-10-26'),before=fixture.state.workflow.profile;
 fixture.state.demo.profileConflict={before:structuredClone(before),latest:{...before,location:'Fictional agent city',verified:false}};
 fixture.state.workflow.profile={...before,location:'Fictional local city',phone:'Keep local phone'};fixture.state.ui.profileConflict={fields:[]};
 const store=createMemoryStore(fixture.state),service=createDemoServices(store);assert.equal(await service.resolveProfileConflict(),false);assert.deepEqual(store.get('ui.profileConflict.fields'),['location']);assert.equal(await service.resolveProfileConflict('latest'),true);assert.equal(store.get('workflow.profile.location'),'Fictional agent city');assert.equal(store.get('workflow.profile.phone'),'Keep local phone');assert.equal(store.get('workflow.profile.verified'),false);assert.equal(store.get('ui.profileConflict'),null);
 assert.notEqual(demoFixtures('2026-10-26').state.workflow.profile.location,'Fictional agent city');
});
