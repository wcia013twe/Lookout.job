import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPreparationPlan, preparationDate, selectPreparationGuides, setPreparationTaskCompletion } from '../preparation-model.mjs';
const application = { id: 'app-1', title: 'Backend Engineer', company: 'Acme', description: 'PostgreSQL SQL database systems' };
const deadline = { date: '2026-10-23', stage: 'Technical interview', confirmed: true, source: { kind: 'email', messageId: 'message-1', excerpt: 'Your technical interview is October 23, 2026.', subject: 'Interview' } };
const build = extra => createPreparationPlan({ application, deadline, now: '2026-10-14', ...extra });
test('ambiguous or impossible dates never invent task deadlines', () => {
  for (const value of ['next Friday', '2026-02-30', '2026-13-01']) assert.equal(preparationDate(value), null);
  const plan = build({ deadline: { ...deadline, date: 'next Friday', confirmed: false } });
  assert.equal(plan.deadline.status, 'needs_confirmation');
  assert.ok(plan.tasks.every(task => task.dueDate === null));
  assert.ok(plan.warnings.length);
});
test('email evidence is required and unsafe source links are removed', () => {
  const plan = build({ deadline: { ...deadline, source: { kind: 'email', url: 'javascript:alert(1)' } } });
  assert.equal(plan.deadline.status, 'needs_confirmation');
  assert.equal(plan.deadline.source.url, '');
  assert.ok(plan.tasks.every(task => !task.dueDate));
});
test('role matching selects relevant safe resources and schedules before deadline', () => {
  const plan = build();
  assert.deepEqual(plan.guides.map(guide => guide.id), ['postgres']);
  assert.ok(plan.tasks.every(task => task.dueDate >= '2026-10-14' && task.dueDate < deadline.date));
  assert.match(plan.tasks[0].title, /Backend Engineer/);
  assert.match(plan.tasks.find(task => task.key === 'questions').title, /Acme/);
  assert.equal(selectPreparationGuides(application, [{ id:'bad',topics:['backend'],url:'javascript:alert(1)' }]).length, 0);
});
test('deadline updates reschedule unfinished tasks and preserve completed work', () => {
  const original = build();
  const completed = setPreparationTaskCompletion(original, original.tasks[0].id, true, '2026-10-14T15:00:00Z');
  const changed = build({ previousPlan: completed, deadline: { ...deadline, date: '2026-10-19' } });
  assert.equal(changed.scheduleChanged, true);
  assert.equal(changed.previousDeadline, '2026-10-23');
  assert.deepEqual(changed.tasks[0], completed.tasks[0]);
  assert.ok(changed.tasks.slice(1).every(task => task.dueDate < '2026-10-19'));
  assert.equal(original.tasks[0].completed, false);
});
test('plans cannot borrow completion from another application; tight deadlines flag capacity', () => {
  const original = build();
  const previousPlan = setPreparationTaskCompletion(original, original.tasks[0].id, true);
  const next = build({ application: { ...application, id:'app-2' }, previousPlan, deadline: { ...deadline, date: '2026-10-14' }, dailyMinutes: 15 });
  assert.ok(next.tasks.every(task => !task.completed));
  assert.ok(next.warnings.some(warning => /time budget/.test(warning)));
});
test('completed resource work survives changes in role details and deadline uncertainty', () => {
  const original = build();
  const resource = original.tasks.find(task => task.guideId === 'postgres');
  const previousPlan = setPreparationTaskCompletion(original, resource.id, true, '2026-10-14T12:00:00Z');
  const next = build({ application: { ...application, title: 'Recruiter', description: '' }, previousPlan, deadline: { ...deadline, date: 'Friday', confirmed: false } });
  assert.equal(next.guides.length, 0);
  assert.deepEqual(next.tasks.find(task => task.id === resource.id), previousPlan.tasks.find(task => task.id === resource.id));
  assert.ok(next.tasks.filter(task => !task.completed).every(task => task.dueDate === null));
});
test('unknown task updates fail and past deadlines are explicitly flagged', () => {
  const plan = build({ deadline: { ...deadline, date: '2026-10-13' } });
  assert.ok(plan.warnings.some(warning => /has passed/.test(warning)));
  assert.throws(() => setPreparationTaskCompletion(plan, 'not-a-task', true), /not found/);
  assert.throws(() => build({ application: {} }), /saved application/);
});
test('company-specific guides require company identity and outrank language resources', () => {
  const company = { ...application, company: 'Amazon, Inc.', description: 'JavaScript Python PostgreSQL backend database' };
  const guides = selectPreparationGuides(company);
  assert.equal(guides[0].id, 'amazon-interview');
  assert.equal(guides.length, 3);
  assert.ok(!selectPreparationGuides({ ...application, description: 'Integrate Amazon and Microsoft APIs' }).some(guide => guide.companyMatch));
  assert.equal(selectPreparationGuides({ ...application, company: 'Microsoft Corporation' })[0].id, 'microsoft-interview');
});
test('review tasks quote actual saved questions and identify actual resume version', () => {
  const plan = build({ application: { ...application, questions: [{ question: 'Why our database team?', answer: 'Existing answer' }], approved: { resume: { name: 'Database resume', version: 3 }, questions: [{ question: 'What system did you build?', answer: 'Existing answer' }] } } });
  assert.match(plan.tasks[0].detail, /Saved resume: Database resume/);
  assert.match(plan.tasks[0].detail, /Resume version: 3/);
  assert.match(plan.tasks[0].detail, /“What system did you build\?”/);
  assert.doesNotMatch(plan.tasks[0].detail, /Why our database team/);
  assert.doesNotMatch(build().tasks[0].detail, /Resume version:/);
});
test('custom resource library matches role topics and rejects unsafe or malformed guides', () => {
  const plan = build({ guides: [null, { id: 'unsafe', title: 'Bad', topics: ['backend'], url: 'javascript:alert(1)' }, { id: 'company', title: 'Company interview guide', companies: ['Acme'], url: 'https://example.com/interviews' }, { id: 'systems', title: 'Systems guide', topics: ['backend'], url: 'https://example.com/systems', minutes: 25 }] });
  assert.deepEqual(plan.guides.map(guide => guide.id), ['company', 'systems']);
  assert.equal(plan.tasks.find(task => task.guideId === 'systems').minutes, 25);
});
