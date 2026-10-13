import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { collectApplicationControls } from '../runner/vendor/application-controls.mjs';
import { identifyJob, formResult } from '../runner/forms.mjs';
import { prepareApprovedFields } from '../runner/prepare.mjs';
import { prefillApprovedForm, prefillCurrentApplication } from '../runner/browser.mjs';
import { openApplicationForm } from '../runner/ats.mjs';
import { selectResume } from '../runner/resume-selection.mjs';
import { createApplicationTools } from '../runner/agent-tools.mjs';

const url = 'https://jobs.ashbyhq.com/example/job-123';
const question = (id, type, options = [], required = true) => ({ id, question: id, required, fields: [{ id, type, options }] });
function fixture(questions, answers) {
  const form = formResult(identifyJob(url), questions);
  const resumeBytes = Buffer.from('%PDF-fixture');
  const resume = { id: 'resume-1', user_id: 'user-1', version: 1 };
  const draft = { url, resumeId: resume.id, resumeSha256: createHash('sha256').update(resumeBytes).digest('hex'),
    questionsReviewed: true, formFingerprint: form.formFingerprint,
    questions: questions.flatMap(q => q.fields.map(f => ({ fieldId: f.id, question: q.question, answer: answers[f.id] }))) };
  const context = { application: { id: 'app-1', job_id: 'job-1', user_id: 'user-1', status: 'Approved', revision: 3, draft },
    approval: { id: 'approval-1', application_id: 'app-1', user_id: 'user-1', revision: 3,
      snapshot: { draft: structuredClone(draft), resume: structuredClone(resume) } },
    job: { id: 'job-1', canonical_url: url }, resume, resumeBytes };
  return { form, context };
}

test('native reviewed radios and checkboxes use exact choices, never inferred consent', () => {
  const questions = [question('authorization', 'radio', [{ value: '0', label: 'No' }, { value: '1', label: 'Yes' }]), question('consent', 'checkbox')];
  const valid = fixture(questions, { authorization: '1', consent: 'true' });
  assert.equal(prepareApprovedFields(valid.context, valid.form).status, 'Prepared');
  for (const answers of [{ authorization: 'Yes', consent: 'true' }, { authorization: '1', consent: 'yes' }, { authorization: '1', consent: 'false' }]) {
    const { form, context } = fixture(questions, answers);
    assert.equal(prepareApprovedFields(context, form).status, 'Blocked');
  }
  const optional = fixture([question('contact', 'checkbox', [], false)], { contact: 'false' });
  assert.equal(prepareApprovedFields(optional.context, optional.form).fields[0].value, 'false');
});

test('multi-field required questions and duplicate approved answers cannot silently skip fields', () => {
  const q = { id: 'name', question: 'Name', required: true, fields: [{ id: 'first', type: 'text' }, { id: 'last', type: 'text' }] };
  const { form, context } = fixture([q], { first: 'Test' });
  assert.equal(prepareApprovedFields(context, form).status, 'Blocked');
  context.application.draft.questions[1].answer = 'Candidate';
  context.application.draft.questions.push(structuredClone(context.application.draft.questions[0]));
  context.approval.snapshot.draft = structuredClone(context.application.draft);
  assert.match(prepareApprovedFields(context, form).blockers[0], /Duplicate/);
});

test('browser preflights all bindings before writes, then checks after each deterministic action', async () => {
  const { form, context } = fixture([question('email', 'email'), question('agree', 'checkbox')], { email: 'test@example.com', agree: 'true' });
  let writes = 0, counts = 0;
  const page = { url: () => url, evaluate: async () => ({ questions: form.questions, blockers: [] }),
    locator: () => ({ count: async () => ++counts === 2 ? 2 : 1, fill: async () => writes++, setChecked: async () => writes++ }) };
  assert.equal((await prefillApprovedForm(page, context)).status, 'Blocked');
  assert.equal(writes, 0);
  const actions = [];
  page.locator = selector => ({ count: async () => 1, fill: async value => actions.push([selector, value]), setChecked: async value => actions.push([selector, value]) });
  assert.equal((await prefillApprovedForm(page, context)).status, 'Prepared');
  assert.equal(actions[1][1], true);
});

test('current-context loader rejects stale server approval and another application', async () => {
  const { context } = fixture([question('email', 'email')], { email: 'test@example.com' });
  await assert.rejects(prefillCurrentApplication({}, 'other-app', async () => context), /mismatch/);
  context.application.revision++;
  const page = { url: () => url, evaluate: async () => ({ questions: [], blockers: [] }) };
  await assert.rejects(prefillCurrentApplication(page, 'app-1', async () => context), /revision/);
});

test('explicit resume rules never cross accounts or silently resolve overlaps', () => {
  const base = { userId: 'u1', job: { title: 'ML infrastructure engineer' }, resumes: [{ id: 'ml', user_id: 'u1' }, { id: 'backend', user_id: 'u1' }, { id: 'foreign', user_id: 'u2' }] };
  const match = selectResume({ ...base, preferences: { resumeRules: [{ keywords: ['ML'], resumeId: 'ml' }] } });
  assert.equal(match.resumeId, 'ml'); assert.equal(match.requiresApproval, true);
  assert.equal(selectResume(base).status, 'Needs selection');
  assert.equal(selectResume({ ...base, preferences: { defaultResumeId: 'foreign' } }).status, 'Needs selection');
  assert.equal(selectResume({ ...base, preferences: { resumeRules: [{ keywords: ['ML'], resumeId: 'ml' }, { keywords: ['engineer'], resumeId: 'backend' }] } }).status, 'Needs selection');
  assert.equal(selectResume({ ...base, preferences: { defaultResumeId: 'backend' } }).resumeId, 'backend');
});

test('ATS entry excludes submit-like controls and ambiguous Apply buttons', async () => {
  let clicks = 0, opened = false;
  const trigger = info => ({ isVisible: async () => true, isEnabled: async () => true, evaluate: async () => info, click: async () => { clicks++; opened = true; } });
  let list = [trigger({ label: 'Apply', tag: 'BUTTON', type: 'submit', inForm: true })];
  const page = { url: () => `${url}/application`, locator: selector => selector === 'form:visible'
    ? { count: async () => opened ? 1 : 0 } : { count: async () => list.length, nth: i => list[i] } };
  assert.equal((await openApplicationForm(page)).status, 'Blocked'); assert.equal(clicks, 0);
  const valid = { label: 'Apply now', tag: 'BUTTON', type: 'button', inForm: false };
  list = [trigger(valid), trigger(valid)];
  assert.equal((await openApplicationForm(page)).status, 'Blocked'); assert.equal(clicks, 0);
  list = [trigger(valid)];
  assert.equal((await openApplicationForm(page)).status, 'Ready'); assert.equal(clicks, 1);
  assert.throws(() => identifyJob(`${url}/unrelated`));
});

test('borrowed collector preserves full labels, hidden upload and grouped radio choices without returning values', () => {
  const rect = { width: 200, height: 30 };
  const group = { querySelector: () => ({ innerText: 'Work authorization' }), getAttribute: () => null, labels: [] };
  const makeInput = ({ id, name = id, type = 'text', label, hidden = false, value = '' }) => ({ tagName: 'INPUT', id, name, type, value,
    labels: [{ innerText: label, getBoundingClientRect: () => rect }], required: true,
    getBoundingClientRect: () => hidden ? { width: 0, height: 0 } : rect,
    getAttribute: () => null, closest: () => type === 'radio' ? group : null });
  const label = 'Describe a project involving distributed systems and explain what you personally implemented'.repeat(2);
  const inputs = [makeInput({ id: 'essay', label, value: 'Private draft' }), makeInput({ id: 'resume', type: 'file', label: 'Resume', hidden: true }),
    makeInput({ id: 'yes', name: 'auth', type: 'radio', label: 'Yes', value: '1' }), makeInput({ id: 'no', name: 'auth', type: 'radio', label: 'No', value: '0' })];
  const form = { getBoundingClientRect: () => rect, querySelectorAll: () => inputs, querySelector: () => null };
  const result = runInNewContext(`(${collectApplicationControls.toString()})()`, {
    document: { querySelectorAll: () => [form], querySelector: () => null, getElementById: () => null },
    getComputedStyle: () => ({ visibility: 'visible', display: 'block', opacity: '1' }) });
  assert.equal(result.blockers.length, 0); assert.equal(result.questions[0].question, label);
  assert.equal(result.questions[1].fields[0].type, 'file');
  assert.equal(result.questions[2].fields[0].options[1].value, '0');
  assert.ok(!JSON.stringify(result).includes('Private draft'));
});

test('local tools require trusted host capabilities and have no model or submission operation', () => {
  assert.throws(() => createApplicationTools({}), /required/);
  const tools = createApplicationTools({ getPage: async () => ({}), loadCurrentContext: async () => ({}) });
  assert.deepEqual(Object.keys(tools), ['inspect_application', 'prefill_application', 'select_resume']);
});
