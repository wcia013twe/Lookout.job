import test from 'node:test';
import assert from 'node:assert/strict';
import {demoFixtures} from '../next-app/lib/demo.mjs';
import {withApplicationProfileDemo} from '../next-app/lib/application-profile-demo.mjs';
import {discoverPreviewRoles} from '../next-app/lib/discover-preview-demo.mjs';
import {demoOutreachContacts} from '../next-app/lib/outreach-demo.mjs';
import {createDemoWorkspace} from '../next-app/lib/muse-demo-fixtures.mjs';
import {searchDemo} from '../lib/search/demo.mjs';

// Check independence across the whole graph instead of snapshotting particular
// company names, counts, prose or scores in each feature's tests.
function mutate(value) {
  for(const key of Object.keys(value)) {
    if(value[key] && typeof value[key]==='object')mutate(value[key]);
    else value[key]='test mutation';
  }
}
test('all demo fixture factories reset independently after nested edits',()=>{
  const date='2026-11-07';
  for(const factory of [()=>createDemoWorkspace(date),()=>demoFixtures(date),()=>withApplicationProfileDemo(demoFixtures(date)),()=>discoverPreviewRoles(date),()=>demoOutreachContacts(date),()=>searchDemo()]) {
    const first=factory(),second=factory(),original=structuredClone(second);
    assert.deepEqual(first,original);
    mutate(first);
    assert.deepEqual(second,original);
    assert.deepEqual(factory(),original);
  }
});

test('Discover demo includes explicit hourly, monthly and undisclosed employer pay',()=>{
 const roles=discoverPreviewRoles('2026-11-07');
 assert(roles.some(r=>r.compensation?.includes('/hr')));assert(roles.some(r=>r.compensation?.includes('/month')));assert(roles.some(r=>!r.compensation));
});

test('Discover demo covers unchecked forms alongside recorded partial questions',()=>{
 const roles=discoverPreviewRoles('2026-11-08');
 assert(roles.some(r=>r.reviewPreview.length===0));
 assert(roles.some(r=>r.reviewPreview.some(q=>q.required&&q.answer==='')));
});
