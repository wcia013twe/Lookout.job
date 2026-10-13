import { randomUUID } from 'node:crypto';
import { assertApproval } from './prepare.mjs';

// One deterministic attempt, then at most one host-provided agent recovery.
// Recovery is for pre-submit controls only. Uncertain side effects never retry.
export async function runApplicationAttempt({ applicationId, loadCurrentContext,
  playwrightAttempt, agentRecovery, reportFailure, attemptId = randomUUID() }) {
  if (![loadCurrentContext, playwrightAttempt, reportFailure].every(fn => typeof fn === 'function')) {
    throw new Error('Trusted context, Playwright attempt and failure reporter required');
  }
  let context, stage = 'approval';
  const attempts = [];
  const run = async (callback, engine) => {
    stage = 'approval';
    const current = await loadCurrentContext(applicationId);
    if (current?.application?.id !== applicationId) throw new Error('Application mismatch');
    if (!context) context = current;
    assertApproval(current);
    if (context && (current.application.revision !== context.application.revision
      || current.approval.id !== context.approval.id)) throw new Error('Approval changed');
    context = current;
    stage = engine;
    // Host must keep recovery tools pre-submit and respect approval constraints.
    const result = await callback({ applicationId, context: current, allowSubmit: false });
    const status = result?.status;
    const uncertain = result?.submissionStarted === true || ['Submitted', 'Unknown'].includes(status);
    attempts.push({ stage: engine, status: status === 'Prepared' && !uncertain ? 'prepared' : uncertain ? 'uncertain' : 'failed' });
    return { prepared: status === 'Prepared' && !uncertain, uncertain };
  };
  let outcome;
  try { outcome = await run(playwrightAttempt, 'playwright'); }
  catch { attempts.push({ stage, status: 'failed' }); }
  if (outcome?.prepared) return { status: 'Prepared', applicationId, attempts, submission: 'manual-handoff' };
  // Approval errors and missing current context require human review, not recovery.
  if (!outcome?.uncertain && stage === 'playwright' && context && typeof agentRecovery === 'function') {
    try {
      const recovered = await run(agentRecovery, 'agent');
      if (recovered.prepared) {
        // Independently rerun deterministic validation/fill; never trust an agent's "done".
        outcome = await run(playwrightAttempt, 'playwright');
        if (outcome.prepared) return { status: 'Prepared', applicationId, attempts, submission: 'manual-handoff' };
      } else outcome = recovered;
    } catch { attempts.push({ stage, status: 'failed' }); }
  }
  const uncertain = outcome?.uncertain === true;
  const failure = {
    applicationId, eventKey: `runner-failure:${applicationId}:${attemptId}`,
    expectedRevision: context?.application?.revision,
    stage: uncertain ? 'submission' : stage,
    outcome: uncertain ? 'uncertain' : 'blocked',
    reason: uncertain ? 'Submission may have started; automatic retry is paused.'
      : stage === 'approval' ? 'Current approval could not be verified.'
      : typeof agentRecovery === 'function' ? 'Playwright could not complete prefill and agent recovery did not resolve it.'
      : 'Playwright could not complete prefill; agent recovery is unavailable.',
    nextAction: uncertain ? 'Check the employer portal or confirmation email before attempting again.'
      : 'Open the employer form, resolve the blocker, then review and approve the current application again.',
    attempts,
  };
  // No raw exception, filled values, signed URLs or credentials in the failure record.
  if (!Number.isInteger(failure.expectedRevision)) return { status: 'Needs you', reported: false, pendingReport: failure };
  try {
    const saved = await reportFailure(failure);
    if (saved?.application?.status && saved.application.status !== 'Blocked') {
      return { status: 'Resolved', reported: true, applicationId, applicationStatus: saved.application.status };
    }
    return { status: 'Needs you', reported: true, applicationId, failure };
  } catch {
    return { status: 'Needs you', reported: false, applicationId, pendingReport: failure };
  }
}
