export const EMPLOYER_FIELDS = ['company','title','employmentType','location','locations','category','postedDate','discoveredDate','description','compensation','source','sourceFreshness','applicationUrl','eligibility','deadline'];
// Shared validation is runtime-independent so Node tests cover the deployed contract.
export const SCOPES = ['workspace:read', 'resumes:read', 'batches:write', 'drafts:write', 'activity:write', 'approvals:read'];
export const OPERATIONS = ['connections.issue', 'connections.list', 'connections.revoke', 'workspace.read', 'credentials.verify', 'resumes.read', 'batches.publish', 'drafts.prepare', 'activity.append', 'approvals.read', 'context.versions', 'context.personal', 'context.developer', 'runner.report_failure', 'applications.policy'];
export function validateRequest(input) {
  if (!input || !OPERATIONS.includes(input.operation)) throw new Error('Unknown operation');
  const p = input.payload ?? {};
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('Payload must be an object');
  if (input.operation === 'applications.policy' && (Object.keys(p).length !== 1 || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(p.jobId || ''))) throw new Error('Job ID required');
  if (input.operation.startsWith('context.') && Object.keys(p).length) throw new Error('No context arguments allowed');
  if (input.operation === 'runner.report_failure') {
    const keys = ['applicationId','eventKey','expectedRevision','stage','outcome','reason','nextAction','attempts'];
    if (Object.keys(p).some(key => !keys.includes(key)) || typeof p.applicationId !== 'string'
      || !Number.isInteger(p.expectedRevision) || p.expectedRevision < 0
      || !['approval','playwright','agent','submission'].includes(p.stage)
      || !['blocked','uncertain'].includes(p.outcome)
      || !['eventKey','reason','nextAction'].every(key => typeof p[key] === 'string' && p[key].trim() && p[key].length <= (key === 'eventKey' ? 200 : 500))
      || !Array.isArray(p.attempts) || p.attempts.length > 3
      || p.attempts.some(attempt => !attempt || Object.keys(attempt).some(key => !['stage','status'].includes(key))
        || !['approval','playwright','agent'].includes(attempt.stage) || !['failed','prepared','uncertain'].includes(attempt.status))) throw new Error('Invalid runner failure');
  }
  if (input.operation === 'connections.issue') {
    if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 80) throw new Error('Name required (1–80 characters)');
    if (!Array.isArray(p.scopes) || !p.scopes.length || p.scopes.some(s => !SCOPES.includes(s))) throw new Error('Choose valid scopes');
    if (p.expiresInDays !== undefined && (!Number.isInteger(p.expiresInDays) || p.expiresInDays < 1 || p.expiresInDays > 90)) throw new Error('Expiry must be 1–90 days');
  }
  if (input.operation === 'batches.publish' && Array.isArray(p.jobs)) {
    for (const job of p.jobs) {
      if (!job.jobId && (!job.employer || Object.keys(job.employer).some(key => !EMPLOYER_FIELDS.includes(key)))) throw new Error('Only public employer facts may be published');
    }
  }
  return { operation: input.operation, payload: p };
}
export function generateToken(cryptoApi = globalThis.crypto) {
  const bytes = cryptoApi.getRandomValues(new Uint8Array(32));
  return 'jb_agent_' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
export async function hashToken(token, cryptoApi = globalThis.crypto) {
  const hash = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}
