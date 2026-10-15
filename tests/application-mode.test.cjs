const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
test('Muse contract maps the choice advertises only the supported submission adapter', async () => {
  const contract = JSON.parse(fs.readFileSync('supabase/functions/agent-gateway/instructions.json'));
  assert.equal(contract.personalSettingsPaths.autoSubmitApproved, 'preferences.search.autoSubmitApproved');
  assert.equal(contract.capabilities.automaticSubmission, 'supported-greenhouse-native-forms');
  const { fromCloud } = await import('../lib/cloud-model.mjs');
  const workspace = fromCloud({ profiles: [], preferences: [{ search: { autoSubmitApproved: true } }], resumes: [], answer_library: [], applications: [] });
  assert.equal(workspace.searchPreferences.autoSubmitApproved, true);
});
