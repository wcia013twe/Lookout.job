import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { runApplicationAttempt } from '../runner/attempt.mjs';
import { validateRequest } from '../supabase/functions/agent-gateway/contract.mjs';

function fixture() {
  const resumeBytes = Buffer.from('%PDF-test');
  const resume = { id: 'r1', user_id: 'u1', version: 1 };
  const draft = { url: 'https://job-boards.greenhouse.io/example/jobs/123', resumeId: 'r1',
    resumeSha256: createHash('sha256').update(resumeBytes).digest('hex'), questionsReviewed: true, questions: [] };
  const context = { application: { id: 'a1', job_id: 'j1', user_id: 'u1', revision: 0, status: 'Approved', draft },
    approval: { id: 'approval1', application_id: 'a1', user_id: 'u1', revision: 0, snapshot: { draft: structuredClone(draft), resume: structuredClone(resume) } },
    job: { id: 'j1', canonical_url: draft.url }, resume, resumeBytes };
  const reports = [];
  return { context, reports, options: { applicationId: 'a1', attemptId: 'attempt1',
    loadCurrentContext: async () => context, reportFailure: async failure => reports.push(failure) } };
}
test('Playwright success does not invoke agent recovery or report submission', async () => {
  const { options, reports } = fixture();
  const result = await runApplicationAttempt({ ...options, playwrightAttempt: async () => ({ status: 'Prepared' }), agentRecovery: () => { throw Error('Must not call agent'); } });
  assert.equal(result.status, 'Prepared'); assert.equal(result.submission, 'manual-handoff'); assert.equal(reports.length, 0);
});
test('agent recovery is limited to one attempt and must pass independent Playwright validation', async () => {
  const { options, reports } = fixture(); let calls = 0, recoveries = 0;
  const result = await runApplicationAttempt({ ...options, playwrightAttempt: async () => ({ status: ++calls === 1 ? 'Blocked' : 'Prepared' }),
    agentRecovery: async ({ allowSubmit }) => { assert.equal(allowSubmit, false); recoveries++; return { status: 'Prepared' }; } });
  assert.equal(result.status, 'Prepared'); assert.equal(calls, 2); assert.equal(recoveries, 1); assert.equal(reports.length, 0);
});
test('both failures report Needs you without leaking exception text or approved answers', async () => {
  const { options, reports } = fixture(); let recoveries = 0;
  const result = await runApplicationAttempt({ ...options, playwrightAttempt: async () => { throw Error('secret@example.com'); }, agentRecovery: async () => { recoveries++; throw Error('private-resume-url'); } });
  assert.equal(result.status, 'Needs you'); assert.equal(result.reported, true); assert.equal(recoveries, 1);
  assert.equal(reports[0].stage, 'agent'); assert.equal(reports[0].expectedRevision, 0);
  assert.ok(!JSON.stringify(reports).includes('secret@example.com')); assert.ok(!JSON.stringify(reports).includes('private-resume-url'));
  assert.doesNotThrow(() => validateRequest({ operation: 'runner.report_failure', payload: reports[0] }));
});
test('uncertain submission is escalated immediately without recovery or another click', async () => {
  const { options, reports } = fixture();
  const result = await runApplicationAttempt({ ...options, playwrightAttempt: async () => ({ status: 'Unknown', submissionStarted: true }), agentRecovery: () => { throw Error('Must not retry'); } });
  assert.equal(result.status, 'Needs you'); assert.equal(reports[0].outcome, 'uncertain'); assert.match(reports[0].nextAction, /confirmation/);
});
test('an agent claiming success cannot bypass failed deterministic validation', async () => {
  const { options, reports } = fixture();
  const result = await runApplicationAttempt({ ...options, playwrightAttempt: async () => ({ status: 'Blocked' }), agentRecovery: async () => ({ status: 'Prepared' }) });
  assert.equal(result.status, 'Needs you'); assert.equal(reports[0].attempts.length, 3);
});
test('failed reporting retains an idempotent pending payload instead of claiming website success', async () => {
  const { options } = fixture();
  const result = await runApplicationAttempt({ ...options, playwrightAttempt: async () => ({ status: 'Blocked' }), reportFailure: async () => { throw Error('Offline'); } });
  assert.equal(result.reported, false); assert.equal(result.pendingReport.eventKey, 'runner-failure:a1:attempt1');
});
test('changed approval stops recovery and stale reporting cannot overwrite current records', async () => {
  const { options, context, reports } = fixture(); let loads = 0;
  const result = await runApplicationAttempt({ ...options, loadCurrentContext: async () => { if (++loads > 1) { const changed = structuredClone(context); changed.application.revision++; return changed; } return context; },
    playwrightAttempt: async () => ({ status: 'Blocked' }), agentRecovery: () => { throw Error('Must not execute'); } });
  assert.equal(result.status, 'Needs you'); assert.equal(reports[0].expectedRevision, 0);
});
test('replayed reporting does not send a resolved application back to Needs you', async () => {
  const { options } = fixture();
  const result = await runApplicationAttempt({ ...options, playwrightAttempt: async () => ({ status: 'Blocked' }),
    reportFailure: async () => ({ application: { status: 'Submitted' }, replayed: true }) });
  assert.equal(result.status, 'Resolved'); assert.equal(result.applicationStatus, 'Submitted');
});
