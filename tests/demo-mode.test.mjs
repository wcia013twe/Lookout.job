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
