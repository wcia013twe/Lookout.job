const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function model() {
  const c = { window: { JB: { normCompany: name => name.toLowerCase().replaceAll(' ', '-') } }, Date, Math };
  vm.runInNewContext(fs.readFileSync('tierlist-model.js', 'utf8'), c);
  return c.window.JB.tierlistModel;
}
test('companies start unranked with no assigned priorities', () => {
  const m = model(), list = m.create('My list');
  assert.equal(list.companies.length, 26); assert.equal(list.placements.unranked.length, 26);
  assert.equal(list.placements.S.length, 0);
});
test('moving repeatedly leaves one company tile and does not mutate the original', () => {
  const m = model(), original = m.create('My list');
  let next = m.move(original, 'nvidia', 'S'); next = m.move(next, 'nvidia', 'A');
  assert.equal(Object.values(next.placements).flat().filter(id => id === 'nvidia').length, 1);
  assert.equal(next.placements.A[0], 'nvidia'); assert.equal(original.placements.S.length, 0);
  assert.ok(original.placements.unranked.includes('nvidia'));
});
test('profiles duplicate independently including labels and ordering', () => {
  const m = model(), first = m.move(m.create('Infra'), 'nvidia', 'S');
  const second = m.duplicate(first, 'AI'); second.tiers[0].label = 'Dream';
  const updated = m.move(second, 'nvidia', 'B');
  assert.equal(first.tiers[0].label, 'S'); assert.equal(first.placements.S[0], 'nvidia');
  assert.equal(updated.placements.B[0], 'nvidia'); assert.notEqual(first.id, updated.id);
});
test('a company can reorder within a tier and return to unranked', () => {
  const m = model(); let list = m.move(m.create('My list'), 'nvidia', 'S');
  list = m.move(list, 'google', 'S', 'nvidia'); assert.equal(list.placements.S.join(','), 'google,nvidia');
  list = m.move(list, 'google', 'unranked'); assert.equal(list.placements.S.join(','), 'nvidia');
});
test('custom companies are unranked and invalid moves cannot alter a list', () => {
  const m = model(), list = m.addCompany(m.create('My list'), 'Example Tech');
  assert.equal(list.companies.at(-1).name, 'Example Tech');
  assert.ok(list.placements.unranked.includes(list.companies.at(-1).id));
  assert.throws(() => m.addCompany(list, ' example tech '), /already/);
  assert.throws(() => m.move(list, 'nvidia', 'missing'), /Unknown tier/);
  assert.throws(() => m.move(list, 'missing-company', 'S'), /Unknown company/);
});
