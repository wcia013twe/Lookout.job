import test from 'node:test';
import assert from 'node:assert/strict';
import { initialPrompt, readField, updateField } from '../search-profile.mjs';
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
  const { profileFromPrompt, promptFromProfile } = await import('../search-profile.mjs');
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
