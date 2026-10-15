import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmedDeadlines, dueLabel, preparationReminders, unconfirmedDeadlineCount } from '../next-app/lib/action-board.mjs';

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
