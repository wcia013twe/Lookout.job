import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmedDeadlines, dueLabel, preparationReminders, unconfirmedDeadlineCount, subscribePreparationRefresh } from '../next-app/lib/action-board.mjs';
import { createDemoWorkspace, createDemoServices } from '../next-app/lib/muse-demo-fixtures.mjs';
import { createMemoryStore } from '../next-app/lib/demo.mjs';

const applications = {
  later: { company: 'Later Systems', title: 'Backend Engineer' },
  soon: { company: 'Soon Data', title: 'Database Engineer' },
  uncertain: { company: 'Maybe AI', title: 'ML Engineer' },
};

test('action board keeps only active preparation reminders and orders them by due date', () => {
  const plans = {
    later: { deadline: { date: '2026-10-25', stage: 'Interview', status: 'confirmed', source: { kind: 'manual' } }, tasks: [{ id: 'done', title: 'Done', completed: true, minutes: 10, dueDate: '2026-10-18' }, { id: 'later', title: 'Practice systems', detail: 'Review tradeoffs', completed: false, minutes: 30, dueDate: '2026-10-22' }] },
    soon: { deadline: { date: '2026-10-20', stage: 'Screen', status: 'confirmed', source: { kind: 'email' } }, tasks: [{ id: 'soon', title: 'Review SQL', detail: 'Practice joins', completed: false, minutes: 20, dueDate: '2026-10-17' }] },
    uncertain: { deadline: { date: null, stage: 'Interview', status: 'needs_confirmation', source: { kind: 'email' } }, tasks: [{ id: 'uncertain', title: 'Do not schedule yet', completed: false, minutes: 20, dueDate: null }] },
  };
  const reminders = preparationReminders(plans, applications);
  assert.deepEqual(reminders.map(item => item.taskId), ['soon', 'later']);
  assert.equal(reminders[0].company, 'Soon Data');
  assert.equal(reminders.some(item => item.taskId === 'done'), false);
  assert.equal(reminders.some(item => item.taskId === 'uncertain'), false);
  assert.deepEqual(confirmedDeadlines(plans, applications).map(item => item.applicationId), ['soon', 'later']);
});

test('action board labels relative dates and counts deadlines needing confirmation', () => {
  assert.equal(dueLabel('2026-10-15', '2026-10-15'), 'Due today');
  assert.equal(dueLabel('2026-10-16', '2026-10-15'), 'Due tomorrow');
  assert.equal(dueLabel('2026-10-13', '2026-10-15'), '2d overdue');
  assert.equal(dueLabel(null, '2026-10-15'), 'No date yet');
  assert.equal(unconfirmedDeadlineCount({ one: { deadline: { status: 'needs_confirmation' } }, two: { deadline: { status: 'confirmed' } } }), 1);
});

test('planner refresh accepts its account, reconnect and focus, and removes listeners on unmount', () => {
  const document = new EventTarget(), window = new EventTarget();
  let reads = 0;
  const stop = subscribePreparationRefresh(document, window, 'owner', () => reads++);
  function cloud(userId) {
    const event = new Event('workspace:cloud-ready');
    event.detail = { userId };
    document.dispatchEvent(event);
  }
  cloud('other'); cloud(null);
  assert.equal(reads, 0);
  cloud('owner');
  window.dispatchEvent(new Event('focus'));
  window.dispatchEvent(new Event('online'));
  assert.equal(reads, 3);
  stop();
  cloud('owner'); window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('online'));
  assert.equal(reads, 3);
});

test('fictional agent edits become visible on refresh without new application IDs or real storage', async () => {
  const fixture = createDemoWorkspace('2026-10-22T12:00:00Z');
  const store = createMemoryStore(fixture), service = createDemoServices(store);
  const document = new EventTarget(), window = new EventTarget();
  let snapshot = await service.readPreparationPlanner(), pending;
  const originalIds = Object.keys(snapshot.applications);
  const stop = subscribePreparationRefresh(document, window, 'demo', () => {
    pending = service.readPreparationPlanner().then(value => { snapshot = value; });
  });
  await service.savePreparationBudget(30, snapshot.settings.version);
  const row = await service.readPreparation('demo-interview');
  const task = row.plan.tasks.find(task => !task.completed);
  task.completed = true;
  await service.savePreparation('demo-interview', row.version, row.plan);
  window.dispatchEvent(new Event('focus')); await pending;
  assert.equal(snapshot.settings.dailyMinutes, 30);
  assert.equal(snapshot.plans.find(row => row.application_id === 'demo-interview').plan.tasks.find(t => t.id === task.id).completed, true);
  assert.deepEqual(Object.keys(snapshot.applications), originalIds);
  assert.deepEqual(fixture.demo.plannerSettings, { dailyMinutes: 45, version: 0 }, 'demo interaction only changes disposable memory');
  assert.equal(createDemoWorkspace('2026-10-22T12:00:00Z').demo.preparationRows['demo-interview'].version, 1);
  stop();
});
