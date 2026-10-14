import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSubmissionRecord } from '../submission-record.mjs';
const receipt = { source: 'runner-observed-greenhouse-confirmation', marker: '#confirmation', message: 'Application received', jobUrl: 'https://example.com/job' };
const attempt = { id: 'one', application_id: 'app', state: 'confirmed', receipt, context_snapshot: { application: { draft: { questions: [{ question: 'Why?', answer: 'Original' }] } }, resume: { id: 'resume', name: 'Original résumé', content_hash: 'hash' }, job: { canonical_url: receipt.jobUrl } } };
test('historical materials never use current draft or unrelated answer library', () => {
  const result = buildSubmissionRecord({ id: 'app', draft: { questions: [{ answer: 'Changed' }] } }, [attempt]);
  assert.equal(result.attempts[0].questions[0].answer, 'Original');
  assert.equal(result.attempts[0].resume.name, 'Original résumé');
  assert.equal(result.attempts[0].confirmed, true);
});
test('separate attempts and missing snapshots remain honest', () => {
  const result = buildSubmissionRecord({ id: 'app', draft: { questions: [{ answer: 'Changed' }] } }, [attempt, { id: 'two', application_id: 'app', state: 'uncertain' }, { ...attempt, application_id: 'other' }]);
  assert.equal(result.attempts.length, 2);
  assert.equal(result.attempts[1].label, 'Confirmation unavailable');
  assert.deepEqual(result.attempts[1].questions, []);
  assert.equal(result.attempts[1].resume, null);
});
test('user-reported progress and invalid evidence are not observed confirmation', () => {
  assert.equal(buildSubmissionRecord({ id: 'app', status: 'Submitted', receipt: { source: 'user' } }).userReported, true);
  const result = buildSubmissionRecord({ id: 'app' }, [{ ...attempt, receipt: { ...receipt, jobUrl: 'wrong' } }]);
  assert.equal(result.attempts[0].confirmed, false);
  assert.equal(result.attempts[0].receipt, null);
  assert.equal(result.attempts[0].label, 'Confirmation evidence unavailable');
});
