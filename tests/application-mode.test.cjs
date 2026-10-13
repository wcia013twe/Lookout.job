const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup(initial = {}) {
  let preferences = initial;
  const events = {}, nodes = new Map();
  const element = id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', checked: false, addEventListener(event, fn) { this[event] = fn; } });
    return nodes.get(id);
  };
  const form = element('#search-preferences-form');
  form.elements = Object.fromEntries(['locations','categories','excludedCompanies','fullTime','internship','targetYear'].map(name => [name, element(name)]));
  vm.runInNewContext(fs.readFileSync('profile-preferences.js', 'utf8'), {
    document: { querySelector: element, addEventListener: (event, fn) => events[event] = fn },
    JB: { auth: { userId: 'one' }, store: { get: () => preferences, set: (_key, value) => preferences = value } },
  });
  return { element, events, get: () => preferences, replace: value => preferences = value };
}
test('auto-submit defaults off and immediate changes preserve personal settings', () => {
  const f = setup({ locations: ['SF'], resumeRules: [{ resumeId: 'mine' }] });
  const toggle = f.element('#auto-submit-approved');
  assert.equal(toggle.checked, false);
  toggle.checked = true; toggle.change();
  assert.equal(f.get().autoSubmitApproved, true); assert.equal(f.get().locations[0], 'SF'); assert.equal(f.get().resumeRules[0].resumeId, 'mine');
  toggle.checked = false; toggle.change(); assert.equal(f.get().autoSubmitApproved, false);
});
test('hydration and account changes use only strict true, without retaining another account choice', () => {
  const f = setup({ autoSubmitApproved: true }); const toggle = f.element('#auto-submit-approved'); assert.equal(toggle.checked, true);
  f.replace({}); f.events['workspace:account'](); assert.equal(toggle.checked, false);
  f.replace({ autoSubmitApproved: 'true' }); f.events['workspace:hydrated'](); assert.equal(toggle.checked, false);
  f.replace({ autoSubmitApproved: true }); f.events['workspace:hydrated'](); assert.equal(toggle.checked, true);
});
test('Muse contract maps the choice without advertising automatic submission', async () => {
  const contract = JSON.parse(fs.readFileSync('supabase/functions/agent-gateway/instructions.json'));
  assert.equal(contract.personalSettingsPaths.autoSubmitApproved, 'preferences.search.autoSubmitApproved');
  assert.equal(contract.capabilities.automaticSubmission, false);
  const { fromCloud } = await import('../cloud-model.mjs');
  const workspace = fromCloud({ profiles: [], preferences: [{ search: { autoSubmitApproved: true } }], resumes: [], answer_library: [], applications: [] });
  assert.equal(workspace.searchPreferences.autoSubmitApproved, true);
});
