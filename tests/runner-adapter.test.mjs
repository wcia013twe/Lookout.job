import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { identifyJob, greenhouseForm, inspectPublicForm, formResult } from '../runner/forms.mjs';
import { assertApproval, prepareApprovedFields } from '../runner/prepare.mjs';
import { prefillApprovedForm } from '../runner/browser.mjs';

const url = 'https://job-boards.greenhouse.io/example/jobs/123';
const payload = { id: 123, questions: [
  { label: 'Email', required: true, fields: [{ name: 'email', type: 'input_text' }] },
  { label: 'Work authorization', required: true, fields: [{ name: 'authorization', type: 'multi_value_single_select', values: [{ value: 0, label: 'No' }, { value: 1, label: 'Yes' }] }] },
] };
function fixture() {
  const form = greenhouseForm(payload, url);
  const resumeBytes = Buffer.from('%PDF-fixture');
  const resume = { id: 'r1', user_id: 'u1', object_path: 'u1/resume.pdf', version: 1 };
  const draft = { url, resumeId: resume.id, resumeSha256: createHash('sha256').update(resumeBytes).digest('hex'), formFingerprint: form.formFingerprint,
    questionsReviewed: true, questions: [{ fieldId: 'email', question: 'Email', answer: 'user@example.com' }, { fieldId: 'authorization', question: 'Work authorization', answer: '1' }] };
  const context = { application: { id: 'a1', job_id: 'j1', user_id: 'u1', revision: 2, status: 'Approved', draft },
    approval: { id: 'approval1', application_id: 'a1', user_id: 'u1', revision: 2, snapshot: { draft: structuredClone(draft), profile: {}, resume: structuredClone(resume) } },
    job: { id: 'j1', canonical_url: url }, resume, resumeBytes };
  return { context, form };
}

test('only supported public ATS job URLs can be inspected', () => {
  assert.equal(identifyJob(`${url}?source=referral#app`).url, url);
  assert.equal(identifyJob('https://jobs.ashbyhq.com/example/abcd-123').ats, 'ashby');
  for (const bad of ['http://localhost/jobs/1', 'https://job-boards.greenhouse.io.evil.test/example/jobs/123', 'https://user:password@job-boards.greenhouse.io/example/jobs/123', 'https://workday.example.com/job/1']) assert.throws(() => identifyJob(bad));
});
test('Greenhouse inspector preserves exact choices and flags invisible/consent fields', () => {
  const form = greenhouseForm({ ...payload, location_questions: [{ label: 'Latitude', required: true, fields: [{ name: 'latitude', type: 'input_hidden' }] }], data_compliance: [{ requires_processing_consent: true }] }, url);
  assert.equal(form.questions[1].fields[0].options[0].value, '0');
  assert.equal(form.complete, false);
  assert.equal(form.blockers.length, 2);
  assert.throws(() => greenhouseForm({ ...payload, id: 999 }, url), /does not match/);
  assert.throws(() => greenhouseForm({ id: 123 }, url), /unavailable/);
});
test('public inspection makes only an allowlisted GET and Ashby needs a browser handoff', async () => {
  let requested;
  const form = await inspectPublicForm(url, async (endpoint, options) => { requested = endpoint; assert.equal(options.redirect, 'error'); return { ok: true, json: async () => payload }; });
  assert.equal(requested, 'https://boards-api.greenhouse.io/v1/boards/example/jobs/123?questions=true');
  assert.equal(form.questions.length, 2);
  const ashby = await inspectPublicForm('https://jobs.ashbyhq.com/example/abc', () => { throw new Error('Must not call private API'); });
  assert.equal(ashby.blockers.length, 1);
});
test('exact current human approval prepares fields without claiming submission', () => {
  const { context, form } = fixture();
  const plan = prepareApprovedFields(context, form);
  assert.equal(plan.status, 'Prepared'); assert.equal(plan.submission, 'manual-handoff');
  assert.deepEqual(plan.fields.map(field => field.value), ['user@example.com', '1']);
});
test('runner rejects stale revision, owner, job, draft, resume and file bytes', () => {
  const mutations = [
    c => c.application.revision++, c => c.approval.user_id = 'other', c => c.job.id = 'other',
    c => c.application.draft.questions[0].answer = 'changed', c => c.resume.version++,
    c => c.resumeBytes = Buffer.from('different file'), c => { delete c.approval.snapshot.draft.resumeSha256; delete c.application.draft.resumeSha256; },
    c => c.application.status = 'Submitted', c => c.application.blocker = 'CAPTCHA',
    c => c.job.canonical_url = 'https://job-boards.greenhouse.io/example/jobs/456',
  ];
  for (const mutate of mutations) { const { context } = fixture(); mutate(context); assert.throws(() => assertApproval(context)); }
});
test('changed form and unapproved or invalid choices require review', () => {
  const { context, form } = fixture();
  assert.throws(() => prepareApprovedFields(context, { ...form, formFingerprint: 'changed' }), /fingerprint/);
  const tampered = structuredClone(form); tampered.questions[0].fields[0].id = 'another';
  assert.throws(() => prepareApprovedFields(context, tampered), /fingerprint/);
  const blank = fixture(); blank.context.application.draft.questions.splice(0, 1); blank.context.approval.snapshot.draft = structuredClone(blank.context.application.draft);
  assert.equal(prepareApprovedFields(blank.context, blank.form).status, 'Blocked');
  const invalid = fixture(); invalid.context.application.draft.questions[1].answer = 'yes'; invalid.context.approval.snapshot.draft = structuredClone(invalid.context.application.draft);
  assert.match(prepareApprovedFields(invalid.context, invalid.form).blockers[0], /Unrecognized choice/);
});

test('browser prefill reports newly exposed conditional questions and never submits', async () => {
  const { context, form } = fixture();
  const browserForm = formResult(identifyJob(url), form.questions);
  context.application.draft.formFingerprint = browserForm.formFingerprint;
  context.approval.snapshot.draft = structuredClone(context.application.draft);
  let passes = 0; const filled = [];
  const page = {
    url: () => url,
    evaluate: async () => ({ questions: passes++ === 0 ? browserForm.questions : [...browserForm.questions, { id: 'new', question: 'Explain authorization', required: true, fields: [{ id: 'new', type: 'text', options: [] }] }], blockers: [] }),
    locator: selector => ({ count: async () => 1, fill: async value => filled.push([selector, value]), selectOption: async value => filled.push([selector, value]) }),
    click: () => { throw new Error('Must never submit'); },
  };
  const plan = await prefillApprovedForm(page, context);
  assert.equal(filled.length, 2); assert.equal(plan.status, 'Blocked');
  assert.match(plan.blockers[0], /Conditional/);
});

test('browser prefill fails closed before filling when employer control becomes ambiguous', async () => {
  const { context, form } = fixture();
  const browserForm = formResult(identifyJob(url), form.questions);
  context.application.draft.formFingerprint = browserForm.formFingerprint;
  context.approval.snapshot.draft = structuredClone(context.application.draft);
  const page = { url: () => url, evaluate: async () => ({ questions: browserForm.questions, blockers: [] }),
    locator: () => ({ count: async () => 2, fill: () => { throw new Error('Must not fill ambiguous control'); } }) };
  assert.equal((await prefillApprovedForm(page, context)).status, 'Blocked');
});
