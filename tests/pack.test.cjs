const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function setup() {
  const classes = {}, state = { 'progress.streakDays': [] };
  const store = { get: k => state[k], set: (k,v) => state[k] = v, update: (k, fn) => state[k] = fn(state[k]), subscribe: () => {} };
  const context = { window: { JB: { store } }, HTMLElement: class {}, customElements: { define: (n,c) => classes[n] = c }, document: { addEventListener() {} }, setTimeout() {}, Date, console, clearTimeout() {}, matchMedia: () => ({matches:false}), CustomEvent: class {constructor(type, options) {this.type=type; this.detail=options?.detail;} } };
  vm.runInNewContext(fs.readFileSync('legacy/components.js', 'utf8'), context);
  return { Pack: classes['pack-opening'], Card: classes['drop-card'], compensationTag: context.window.JB.compensationTag, state };
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

test('pack seal opens once and prevents repeated tear dispatch', () => {
  const { Pack } = setup(); const p = new Pack(); const events = [];
  p.classList = { add() {} }; p.querySelector = () => null; p.dispatchEvent = e => events.push(e.type);
  p.openSeal(); p.openSeal(); assert.equal(p._sealOpen, true); assert.deepEqual(events, ['pack:tear']);
});
test('closed packs cannot reopen the seal', () => {
  const { Pack } = setup(); const p = new Pack(); p._closed = true; p.openSeal(); assert.equal(p._sealOpen, undefined);
});

test('navigation keeps exactly one visible card and clamps at the edges', () => {
  const { Pack } = setup(); const p = new Pack(); const cards = [{}, {}, {}];
  const label = {}, previous = {}, next = {};
  p.querySelectorAll = () => cards; p.dispatchEvent = () => {};
  p.querySelector = s => s === '.pack-nav span' ? label : s.includes('-1') ? previous : next;
  p.setActiveCard(1); assert.deepEqual(cards.map(c => c.hidden), [true, false, true]); assert.equal(label.textContent, 'Card 2 of 3');
  p.setActiveCard(99); assert.deepEqual(cards.map(c => c.hidden), [true, true, false]); assert.equal(next.disabled, true);
  p.setActiveCard(-99); assert.equal(previous.disabled, true); assert.equal(cards[0].hidden, false);
});
test('a single tap starts revealing and later taps upgrade without a speed requirement', () => {
  const { Card } = setup(); const c = new Card(); c._stage = 'mystery'; c._trueTier = 'rare';
  c._unlock = () => { c._stage = 'back'; }; c._pop = () => {}; c._checkDone = () => {};
  c._tap(); assert.equal(c._stage, 'common'); c._tap(); assert.equal(c._stage, 'rare');
});

test('compensation tags distinguish base, TC, hourly pay, and missing pay', () => {
  const { compensationTag: tag } = setup();
  assert.equal(tag('Base $108K-$178.25K (Level 1) + equity.'), 'Base $108K-$178.25K');
  assert.equal(tag('$150k–$160k base plus equity.'), 'Base $150k–$160k');
  assert.equal(tag('Total compensation: $200K-$250K.'), 'TC $200K-$250K');
  assert.equal(tag('Internship at $45-$60/hr.'), 'Comp $45-$60/hr');
  assert.equal(tag('Compensation not disclosed.'), 'Comp not listed');
});
