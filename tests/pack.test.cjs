const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function setup() {
  const classes = {}, state = { 'progress.streakDays': [] };
  const store = { get: k => state[k], set: (k,v) => state[k] = v, update: (k, fn) => state[k] = fn(state[k]), subscribe: () => {} };
  const context = { window: { JB: { store } }, HTMLElement: class {}, customElements: { define: (n,c) => classes[n] = c }, document: { addEventListener() {} }, setTimeout() {}, Date, console };
  vm.runInNewContext(fs.readFileSync('components.js', 'utf8'), context);
  return { Pack: classes['pack-opening'], Card: classes['drop-card'], state };
}
test('incomplete packs cannot claim XP', () => {
  const { Pack, state } = setup(); const p = new Pack(); p._expected = 2; p._doneKeys.add('one'); p.claim();
  assert.equal(p._claimed, false); assert.equal(state['progress.xp'], undefined);
});
test('replaying a completed daily pack only awards XP once', () => {
  const { Pack, state } = setup();
  for (let i = 0; i < 2; i++) { const p = new Pack(); p._expected = 1; p._doneKeys.add('one'); p.querySelector = () => null; p.claim(); p.claim(); }
  assert.equal(state['progress.xp'], 25);
});
test('reveal all completes every card and splits paired cards first', () => {
  const { Pack } = setup(); const p = new Pack(); const calls = [];
  p._splitDouble = c => calls.push(c);
  p.querySelectorAll = selector => selector === '.double-combo' ? ['pair'] : [{ revealFully: () => calls.push('card') }];
  p.revealAll(); assert.deepEqual(calls, ['pair', 'card']);
});
