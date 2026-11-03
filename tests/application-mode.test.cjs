const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
test('Muse contract maps the choice advertises only the supported submission adapter', async () => {
  const contract = JSON.parse(fs.readFileSync('supabase/functions/agent-gateway/instructions.json'));
  const {readGuide} = await import('../supabase/functions/agent-gateway/guides.mjs');
  assert.equal(readGuide('workspace-maintenance').personalSettingsPaths.autoSubmitApproved, 'preferences.search.autoSubmitApproved');
  assert.equal(readGuide('application-workspace').capabilities.automaticSubmission, 'supported-greenhouse-ashby-lever-native-forms');
  assert.deepEqual(Object.keys(contract), ['developerVersion','instructions']);
  const { fromCloud } = await import('../lib/cloud-model.mjs');
  const workspace = fromCloud({ profiles: [], preferences: [{ search: { autoSubmitApproved: true } }], resumes: [], answer_library: [], applications: [] });
  assert.equal(workspace.searchPreferences.autoSubmitApproved, true);
});
