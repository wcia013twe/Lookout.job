import test from 'node:test';
import assert from 'node:assert/strict';
import { compensationTag as tag } from '../next-app/lib/role-display.js';
test('compensation tags distinguish base, TC, hourly pay, and missing pay', () => {
  assert.equal(tag('Base $108K-$178.25K (Level 1) + equity.'), 'Base $108K-$178.25K');
  assert.equal(tag('$150k–$160k base plus equity.'), 'Base $150k–$160k');
  assert.equal(tag('Total compensation: $200K-$250K.'), 'TC $200K-$250K');
  assert.equal(tag('Internship at $45-$60/hr.'), 'Comp $45-$60/hr');
  assert.equal(tag('Compensation not disclosed.'), 'Comp not listed');
});
