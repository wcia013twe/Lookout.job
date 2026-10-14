const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const role = { id: 'role-1', company: 'Example', title: 'Engineer', applicationUrl: 'https://example.com/job' };
const profile = { name: 'Applicant', email: 'applicant@example.com', verified: true };
const resume = { id: 'resume-1', name: 'Backend', url: 'https://example.com/resume.pdf' };
function model() {
  const context = { window: { JB: {} }, Date };
  vm.runInNewContext(fs.readFileSync('lib/workflow-model.js', 'utf8'), context);
  return context.window.JB.workflowModel;
}
function ready(m) {
  return m.edit(m.create(role), { resumeId: resume.id, questionsReviewed: true, questions: [{ id: 'q1', question: 'Why this role?', answer: 'Relevant backend experience.' }], blocker: '' });
}
test('queueing does not claim submission and approval captures an exact snapshot', () => {
  const m = model(); assert.equal(m.create(role).status, 'Queued');
  const d = ready(m); const approved = m.approve(d, resume, profile);
  assert.equal(approved.status, 'Approved'); assert.equal(approved.approved.revision, d.revision);
  approved.questions[0].answer = 'Changed';
  assert.equal(approved.approved.questions[0].answer, 'Relevant backend experience.');
});
test('editing an approved answer invalidates approval and increments the revision', () => {
  const m = model(); const approved = m.approve(ready(m), resume, profile);
  const updated = m.edit(approved, { questions: [{ id: 'q1', question: 'Why this role?', answer: 'A different answer.' }] });
  assert.equal(updated.approved, null); assert.equal(updated.status, 'Awaiting approval');
  assert.equal(updated.revision, approved.revision + 1);
});
test('approval rejects unknown questions, unanswered questions and unresolved blockers', () => {
  const m = model(); const d = ready(m);
  assert.throws(() => m.approve({ ...d, questionsReviewed: false }, resume, profile), /question list/);
  assert.throws(() => m.approve({ ...d, questions: [{ question: 'Question', answer: '' }] }, resume, profile), /needs an answer/);
  assert.throws(() => m.approve({ ...d, blocker: 'Login' }, resume, profile), /blocker/);
  assert.throws(() => m.approve(d, resume, { ...profile, verified: false }), /factual profile/);
});
test('saving unchanged fields preserves the approved revision', () => {
  const m = model(); const approved = m.approve(ready(m), resume, profile);
  const unchanged = m.edit(approved, { resumeId: resume.id });
  assert.equal(unchanged.status, 'Approved'); assert.equal(unchanged.revision, approved.revision);
});
test('new workflow state survives reload without dropping existing tracker data', () => {
  const data = new Map([['job-signal-state-v1', JSON.stringify({ tracker: { ids: ['old-role'], items: {} }, progress: { xp: 50 } })]]);
  const load = () => {
    const context = { window: { addEventListener() {} }, document: { addEventListener() {} }, setTimeout: () => 1, clearTimeout() {}, localStorage: {
      getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key), length: 0,
    } };
    vm.runInNewContext(fs.readFileSync('lib/store.js', 'utf8'), context); return context.window.JB.store;
  };
  const s = load(); s.set('workflow.applications', { 'role-1': model().create(role) }); s.set('workflow.profile', profile); s.set('workflow.tierLists', [{ id: 'preferences', name: 'My companies', placements: { S: ['nvidia'] } }]); s.set('workflow.activeTierListId', 'preferences'); s.set('workflow.savedAnswers', [{id:'a',question:'Common question',answer:'My answer',policy:'ask'}]); s._flush();
  const reloaded = load(); assert.equal(reloaded.get('workflow.applications')['role-1'].status, 'Queued');
  assert.equal(reloaded.get('workflow.profile').email, profile.email);
  assert.equal(reloaded.get('workflow.tierLists')[0].placements.S[0], 'nvidia');
  assert.equal(reloaded.get('workflow.activeTierListId'), 'preferences'); assert.equal(reloaded.get('workflow.savedAnswers')[0].answer,'My answer');
  assert.equal(reloaded.get('tracker.ids')[0], 'old-role'); assert.equal(reloaded.get('progress.xp'), 50);
});
test('manual submission is an explicit user report and does not fabricate a receipt', () => {
  const m = model(), draft = ready(m);
  assert.throws(() => m.recordStage(draft, 'Submitted', ''), /note/);
  const submitted = m.recordStage(draft, 'Submitted', 'Submitted on the employer website.');
  assert.equal(submitted.status, 'Submitted');
  assert.ok(submitted.submittedAt);
  assert.equal(submitted.receipt, undefined);
  assert.match(submitted.activity.at(-1).text, /You reported Submitted/);
  assert.equal(submitted.revision, draft.revision);
  assert.throws(() => m.edit(submitted, { questions: [] }), /cannot be edited/);
  assert.throws(() => m.approve(submitted, resume, profile), /already in tracking/);
});
test('outcome tracking requires submission, while withdrawal or rejection can close any application', () => {
  const m = model(), draft = m.create(role);
  assert.throws(() => m.recordStage(draft, 'Approved', 'Approved'), /tracking stage/);
  assert.throws(() => m.recordStage(draft, 'Interview', 'Recruiter replied'), /Record submission/);
  const submitted = m.recordStage(draft, 'Submitted', 'Submitted manually');
  const interview = m.recordStage(submitted, 'Interview', 'Recruiter screen scheduled');
  assert.equal(m.recordStage(interview, 'Offer', 'Written offer received').status, 'Offer');
  assert.equal(m.recordStage(draft, 'Withdrawn', 'Role no longer fits').status, 'Withdrawn');
  assert.equal(m.recordStage(draft, 'Rejected', 'Employer closed role').status, 'Rejected');
  assert.equal(m.recordStage(submitted, 'Submitted', '').activity.length, submitted.activity.length);
});
test('changing resume clears obsolete file hash and preserves employer mapping metadata', () => {
  const m = model();
  const draft = { ...ready(m), resumeSha256: 'old-file-hash', formFingerprint: 'employer-form' };
  draft.questions[0] = { ...draft.questions[0], fieldId: 'why_role', type: 'textarea', required: true };
  const updated = m.edit(draft, { resumeId: 'resume-2' });
  assert.equal(updated.resumeSha256, undefined);
  assert.equal(updated.formFingerprint, 'employer-form');
  assert.equal(updated.questions[0].fieldId, 'why_role');
  assert.equal(updated.questions[0].required, true);
});

test('agent questions keep stable review identifiers even when only employer field IDs are supplied', () => {
  const m = model();
  assert.equal(m.questionId({fieldId:'first_name'}), 'first_name');
  assert.notEqual(m.questionId({},0),m.questionId({},1));
  assert.equal(m.questionId({id:123,fieldId:'employer'}),'123');
});
