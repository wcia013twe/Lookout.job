import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfileReview } from '../lib/profile-review.mjs';
test('changed scalar and nested facts invalidate their prior human review', () => {
  const review = createProfileReview();
  const facts = { name: 'One', workExperience: [{ title: 'Engineer' }] };
  review.reset(facts, true);
  assert.equal(review.isReviewed(facts), true);
  assert.equal(review.isReviewed({ ...facts, name: 'Imported' }), false);
  facts.workExperience[0].title = 'Changed';
  assert.equal(review.isReviewed(facts), false);
  review.check(facts, true, true);
  assert.equal(review.isReviewed(facts), true);
  review.invalidate();
  assert.equal(review.isReviewed(facts), false);
});
test('untrusted checks and account hydration cannot reuse verification', () => {
  const review = createProfileReview(), facts = { name: 'One' };
  review.check(facts, true, false);
  assert.equal(review.isReviewed(facts), false);
  review.check(facts, true, true);
  review.reset({ name: 'Other' }, false);
  assert.equal(review.isReviewed(facts), false);
  review.reset(facts, 'true');
  assert.equal(review.isReviewed(facts), false);
  review.check(facts, true, true);
  review.check(facts, false, true);
  assert.equal(review.isReviewed(facts), false);
});
