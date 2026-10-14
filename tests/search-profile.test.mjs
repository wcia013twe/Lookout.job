import test from 'node:test';
import assert from 'node:assert/strict';
import { initialPrompt, readField, updateField } from '../lib/search-profile.mjs';
test('adjustments preserve prose and other sections, parse direct edits, and clear constraints', () => {
  const original = initialPrompt({ categories: ['Any industry'], locations: ['US'] }) + '\n## Additional Context\nRemote might be nice.\n';
  const edited = updateField(original, 'Search Filters', 'Work arrangement', 'Remote required');
  assert.equal(readField(edited, 'Search Filters', 'Work arrangement').value, 'Remote required');
  assert.ok(edited.includes('Remote might be nice.'));
  assert.ok(edited.includes('Any industry'));
  assert.equal(updateField(edited, 'Search Filters', 'Work arrangement', ''), original);
  assert.equal(readField(edited.replace('Remote required', 'Hybrid'), 'Search Filters', 'Work arrangement').value, 'Hybrid');
});
test('duplicate labels require clarification and cannot be overwritten', () => {
  const prompt = '## Search Filters\n- Location: US\n- Location: Canada';
  assert.equal(readField(prompt, 'Search Filters', 'Location').conflict, true);
  assert.throws(() => updateField(prompt, 'Search Filters', 'Location', 'UK'), /duplicate/);
});
test('priorities remain separate from filters and missing headings are appended', () => {
  const prompt = updateField('My custom prose', 'How to Evaluate Opportunities', 'Pay', 'Important');
  assert.equal(readField(prompt, 'Search Filters', 'Pay').value, '');
  assert.equal(readField(prompt, 'How to Evaluate Opportunities', 'Pay').value, 'Important');
  assert.ok(prompt.startsWith('My custom prose'));
});

test('structured profile round trip preserves prose without storing a competing prompt', async () => {
  const { profileFromPrompt, promptFromProfile } = await import('../lib/search-profile.mjs');
  let prompt = initialPrompt({ categories: ['Any industry'] });
  prompt = updateField(prompt, 'Search Filters', 'Work arrangement', 'Remote required');
  prompt = updateField(prompt, 'How to Evaluate Opportunities', 'Stability', 'Very important');
  const profile = profileFromPrompt(prompt);
  assert.equal(profile.filters['Work arrangement'], 'Remote required');
  assert.equal(profile.priorities.Stability, 'Very important');
  assert.ok(profile.instructions.includes('Any industry'));
  assert.ok(!profile.instructions.includes('- Work arrangement:'));
  assert.deepEqual(profileFromPrompt(promptFromProfile(profile)), profile);
});

test('MCP profile writes reject policy changes and invalid versions', async () => {
  const { validateRequest } = await import('../supabase/functions/agent-gateway/contract.mjs');
  const profile = { id:'general',name:'General',active:true,filters:{},priorities:{},instructions:'Anything suitable' };
  assert.equal(validateRequest({operation:'preferences.profile.save',payload:{expectedVersion:0,profile}}).payload.profile,profile);
  assert.throws(() => validateRequest({operation:'preferences.profile.save',payload:{expectedVersion:0,profile:{...profile,autoSubmitApproved:true}}}));
  assert.throws(() => validateRequest({operation:'preferences.profile.save',payload:{expectedVersion:-1,profile}}));
});

test('extended preferences and multiline career goals survive the existing profile contract', async () => {
  const { profileFromPrompt, promptFromProfile } = await import('../lib/search-profile.mjs');
  let prompt = 'Custom context must stay.\n\n## Avoid\nNo generic support work.';
  for (const [heading, key, value] of [
    ['Role preferences','Roles','Software engineering, ML engineering'],
    ['Priority & flexibility','Roles','Preferred'],
    ['Work-life balance & benefits','Work-life balance','Predictable hours; limited on-call'],
    ['Work-life balance & benefits','Employer benefits','Health insurance, retirement match'],
    ['Priority & flexibility','Employer benefits','Required'],
    ['Career goals & tradeoffs','Career goals','Deepen systems experience.\nOwn reliability and performance.'],
    ['Career goals & tradeoffs','Tradeoffs','Relocate for strong mentorship.'],
    ['Company priorities','Tier list ID','owned-list'],
  ]) prompt = updateField(prompt, heading, key, value);
  const profile = profileFromPrompt(prompt, { id:'internships',name:'Internships',active:true });
  const restored = promptFromProfile(profile);
  assert.equal(readField(restored,'Career goals & tradeoffs','Career goals').value, 'Deepen systems experience.\nOwn reliability and performance.');
  assert.equal(readField(restored,'Company priorities','Tier list ID').value,'owned-list');
  assert.equal(readField(restored,'Work-life balance & benefits','Work-life balance').value,'Predictable hours; limited on-call');
  assert.equal(readField(restored,'Work-life balance & benefits','Employer benefits').value,'Health insurance, retirement match');
  assert.equal(readField(restored,'Priority & flexibility','Employer benefits').value,'Required');
  assert.equal(readField(restored,'Priority & flexibility','Roles').value,'Preferred');
  assert.ok(restored.includes('Custom context must stay.'));
  assert.deepEqual(profileFromPrompt(restored, profile), profile);
  const {validateRequest} = await import('../supabase/functions/agent-gateway/contract.mjs');
  assert.equal(validateRequest({operation:'preferences.profile.save',payload:{expectedVersion:0,profile}}).payload.profile,profile);
});
test('multiline edits replace and clear the full field without losing neighboring prose', () => {
  let prompt = updateField('Keep me', 'Career goals & tradeoffs', 'Tradeoffs', 'First line\nSecond line');
  prompt = updateField(prompt, 'Career goals & tradeoffs', 'Tradeoffs', 'Replacement');
  assert.ok(!prompt.includes('Second line'));
  assert.ok(prompt.startsWith('Keep me'));
  prompt = updateField(prompt, 'Career goals & tradeoffs', 'Tradeoffs', '');
  assert.equal(readField(prompt,'Career goals & tradeoffs','Tradeoffs').value,'');
});
test('duplicate and invalid priority instructions require resolution', async () => {
  const {profileFromPrompt} = await import('../lib/search-profile.mjs');
  assert.throws(() => profileFromPrompt('## Priority & flexibility\n- Roles: Required\n- Roles: Flexible'), /Required, Preferred/);
  assert.throws(() => profileFromPrompt('## Priority & flexibility\n- Roles: Definitely'), /Required, Preferred/);
});
test('demo search strategies have isolated, resettable goals and tier-list associations', async () => {
  const {demoFixtures, createMemoryStore} = await import('../next-app/lib/demo.mjs');
  const initial = demoFixtures('2026-10-14');
  const store = createMemoryStore(initial.state);
  const profiles = store.get('workflow.searchPreferences.profiles');
  const {promptFromProfile} = await import('../lib/search-profile.mjs');
  assert.equal(profiles.length,2);
  const ids = profiles.map(profile => readField(promptFromProfile(profile),'Company priorities','Tier list ID').value);
  assert.notEqual(ids[0],ids[1]);
  assert.ok(ids.every(id => initial.state.workflow.tierLists.some(list => list.id === id)));
  store.set('workflow.searchPreferences.profiles',[]);
  assert.equal(demoFixtures('2026-10-14').state.workflow.searchPreferences.profiles.length,2);
});
