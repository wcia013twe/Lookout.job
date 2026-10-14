import test from 'node:test';
import assert from 'node:assert/strict';
import { museFeatureDispatch, notificationAdvice, selectionExplanation } from '../supabase/functions/agent-gateway/muse-features.mjs';
const now = new Date('2026-10-14T12:00:00Z');
const context = { application: { id: 'application', job_id: 'job', draft: {} }, job: { employer: { company: 'Example', title: 'Backend engineer', employmentType: 'FT' } }, preparation: { version: 2, plan: { applicationId: 'job', deadline: { date: '2026-10-20' }, tasks: [{ id: 'job:application', completed: true, completedAt: '2026-10-13T12:00:00Z' }] } } };
function mock(data = context) {
 const calls = [];
 return { calls, rpc: async (operation, payload) => { calls.push({ operation, payload }); return { data, error: null }; } };
}
test('stale preparation version stops before writing', async () => {
 const { rpc, calls } = mock();
 const result = await museFeatureDispatch({ operation: 'preparation.update', payload: { applicationId: 'application', expectedVersion: 1 }, rpc, now });
 assert.equal(result.error.code, '40001');
 assert.deepEqual(calls.map(c => c.operation), ['preparation.read']);
});
test('replanning retains completed work and only forwards scoped application arguments', async () => {
 const { rpc, calls } = mock();
 await museFeatureDispatch({ operation: 'preparation.update', payload: { applicationId: 'application', expectedVersion: 2, userId: 'foreign', ownerId: 'foreign', deadline: { date: '2026-10-22', confirmed: true } }, rpc, now });
 assert.deepEqual(calls[0].payload, { applicationId: 'application' });
 const saved = calls[1].payload;
 assert.deepEqual(Object.keys(saved).sort(), ['applicationId', 'expectedVersion', 'plan']);
 assert.equal(saved.plan.tasks.find(t => t.id === 'job:application').completed, true);
 assert.equal(saved.plan.tasks.find(t => t.id === 'job:application').completedAt, '2026-10-13T12:00:00Z');
 assert.equal(saved.plan.previousDeadline, '2026-10-20');
});
test('completion changes only requested task, propagates read authorization errors', async () => {
 const { rpc, calls } = mock();
 await museFeatureDispatch({ operation: 'preparation.complete', payload: { applicationId: 'application', expectedVersion: 2, taskId: 'job:application', completed: false }, rpc, now });
 assert.equal(calls[1].payload.plan.tasks[0].completed, false);
 assert.equal(calls[1].payload.plan.tasks[0].completedAt, null);
 const denied = { error: { code: '42501' } };
 let count = 0;
 assert.equal(await museFeatureDispatch({ operation: 'preparation.update', payload: {}, rpc: async () => { count++; return denied; }, now }), denied);
 assert.equal(count, 1);
});
test('firm selection explanation derives from stored policy rather than claimed reason', () => {
 const job = { company: 'Example', title: 'Engineer', employmentType: 'FT' };
 const result = selectionExplanation({ preferences: { search: { excludedCompanies: ['Example'] } }, job, payload: { reason: 'Invented', preference: 'fit', certainty: 'uncertain' } });
 assert.equal(result.certainty, 'exclusion');
 assert.equal(result.preference, 'excludedCompanies');
 assert.match(result.reason, /excluded by your settings/);
 assert.match(result.evidence, /Example/);
 assert.throws(() => selectionExplanation({ preferences: {}, job, payload: { preference: 'fit', certainty: 'exclusion' } }), /must be uncertain/);
 const uncertain = { preference: 'fit', certainty: 'uncertain', reason: 'Team scope unclear' };
 assert.deepEqual(selectionExplanation({ preferences: {}, job, payload: uncertain }), uncertain);
});
test('selection dispatch loads owned preferences and canonical employer job', async () => {
 const calls = [], loaded = [];
 await museFeatureDispatch({ operation: 'selection.record', payload: { jobId: 'job', preference: 'fit', certainty: 'uncertain', reason: 'Unclear' }, rpc: async (operation, payload) => { calls.push({ operation, payload }); return { data: { settings: { preferences: { search: { employmentTypes: ['Internship'] } } } } }; }, loadJob: async id => { loaded.push(id); return context.job; } });
 assert.deepEqual(calls[0], { operation: 'context.personal', payload: {} });
 assert.deepEqual(loaded, ['job']);
 assert.equal(calls[1].payload.certainty, 'exclusion');
 assert.equal(calls[1].payload.preference, 'employmentTypes');
});
test('notification read ignores arbitrary owner payload, emits current decision IDs, and suppresses acknowledged IDs', async () => {
 const bundle = { settings: { cadence: 'immediate' }, applications: [{ id: 'application', revision: 3, status: 'Awaiting approval' }], plans: [{ application_id: 'application', version: 4, plan: { deadline: { status: 'confirmed', date: '2026-10-20', stage: 'Interview' }, tasks: [{ completed: false }] } }] };
 const { rpc, calls } = mock(bundle);
 const result = await museFeatureDispatch({ operation: 'notifications.read', payload: { userId: 'foreign' }, rpc, now });
 assert.deepEqual(calls, [{ operation: 'notifications.read', payload: {} }]);
 assert.equal(result.data.events[0].id, 'decision:application:3');
 assert.equal(result.data.pendingCount, 2);
 assert.equal(result.data.acknowledgeOnlyAfterDelivery, true);
 const acknowledged = notificationAdvice({ ...bundle, deliveries: [{ event_ids: ['decision:application:3', 'deadline:application:4'] }] }, now);
 assert.equal(acknowledged.pendingCount, 0);
 assert.deepEqual(acknowledged.events, []);
});
test('notification acknowledgment delegates exact event IDs for database ownership validation', async () => {
 const { rpc, calls } = mock();
 const payload = { eventKey: 'delivered-pack', kind: 'immediate', eventIds: ['decision:application:3'] };
 await museFeatureDispatch({ operation: 'notifications.ack', payload, rpc, now });
 assert.deepEqual(calls, [{ operation: 'notifications.ack', payload }]);
});
