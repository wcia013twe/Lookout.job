// A review belongs to one exact set of facts, never to an account or form forever.
export function createProfileReview() {
  let reviewed = null;
  return {
    reset(facts, verified) { reviewed = verified === true ? JSON.stringify(facts) : null; },
    invalidate() { reviewed = null; },
    check(facts, checked, trusted) { reviewed = checked && trusted ? JSON.stringify(facts) : null; },
    isReviewed(facts) { return reviewed !== null && reviewed === JSON.stringify(facts); },
  };
}
