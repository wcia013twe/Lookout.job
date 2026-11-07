import test from 'node:test';
import assert from 'node:assert/strict';
import {companySizeOptions, readCompanySizes, writeCompanySizes} from '../lib/company-size.mjs';
import {profileFromPrompt, promptFromProfile, readField, updateField} from '../lib/search-profile.mjs';

test('recognizes employee ranges without splitting thousands, preserving custom preferences', () => {
 const result = readCompanySizes('11-50 employees, 1,001-5,000 employees, Open to larger teams');
 assert.deepEqual(result, {selected:['11–50', '1,001–5,000'],other:'Open to larger teams'});
 assert.equal(writeCompanySizes(result.selected,result.other),'11–50, 1,001–5,000, Open to larger teams');
});
test('all, none, and subset selections survive the existing website/MCP profile boundary', () => {
 for (const sizes of [companySizeOptions, [], ['501–1,000', '10,001+']]) {
  const prompt = updateField('Custom instructions stay here.','Company preferences','Company size',writeCompanySizes(sizes));
  const restored = promptFromProfile(profileFromPrompt(prompt));
  assert.deepEqual(readCompanySizes(readField(restored,'Company preferences','Company size').value).selected, sizes);
  assert.match(restored,/Custom instructions stay here/);
 }
});
