import { validateProfileSetup } from './profile-setup.mjs';
export const EMPLOYER_FIELDS = ['company','title','employmentType','location','locations','category','postedDate','discoveredDate','description','compensation','source','sourceFreshness','applicationUrl','eligibility','deadline'];
// Shared validation is runtime-independent so Node tests cover the deployed contract.
export const SCOPES = ['workspace:read', 'profile:write', 'resumes:read', 'batches:write', 'drafts:write', 'activity:write', 'approvals:read'];
export const OPERATIONS = ['connections.profile_setup','profile.import','resumes.begin_upload','resumes.complete_upload','connections.issue', 'connections.list', 'connections.revoke', 'workspace.read', 'credentials.verify', 'resumes.read', 'batches.publish', 'drafts.prepare', 'activity.append', 'approvals.read', 'context.versions', 'context.personal', 'context.developer', 'runner.report_failure', 'applications.policy','submission.context','submission.claim','submission.start','submission.finish'];
export function validateRequest(input) {
  if (!input || !OPERATIONS.includes(input.operation)) throw new Error('Unknown operation');
  const p = input.payload ?? {};
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('Payload must be an object');
  validateProfileSetup(input.operation, p);
  if (input.operation.startsWith('submission.')) {
    const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
    const op = input.operation.slice(11);
    const keys = {context:['applicationId'],claim:['applicationId','attemptId','expectedRevision','expectedPersonalVersion'],start:['applicationId','claimId','expectedRevision','expectedPersonalVersion'],finish:['applicationId','claimId','outcome','receipt']}[op];
    if (!keys || Object.keys(p).some(key => !keys.includes(key)) || !uuid(p.applicationId)) throw new Error('Invalid submission payload');
    if (['claim','start'].includes(op) && (!Number.isInteger(p.expectedRevision) || p.expectedRevision<0 || !Number.isSafeInteger(p.expectedPersonalVersion) || p.expectedPersonalVersion<1)) throw new Error('Current revision and settings version required');
    if (op==='claim' && !/^[a-zA-Z0-9_-]{1,80}$/.test(p.attemptId || '')) throw new Error('Stable attempt ID required');
    if (['start','finish'].includes(op) && !uuid(p.claimId)) throw new Error('Claim ID required');
    if (op==='finish') {
      if (!['confirmed','uncertain','cancelled'].includes(p.outcome)) throw new Error('Outcome required');
      if (p.outcome==='confirmed') {
        const r=p.receipt;
        if(!r || Object.keys(r).some(key=>!['source','jobUrl','observedUrl','marker','message'].includes(key)) || r.source!=='runner-observed-greenhouse-confirmation'
          || typeof r.jobUrl!=='string' || typeof r.observedUrl!=='string' || r.jobUrl.length>2048 || r.observedUrl.length>2048
          || !['#confirmation','#application_confirmation','[data-testid="application-confirmation"]'].includes(r.marker)
          || typeof r.message!=='string' || !/thank you for applying|application (?:has been |was )?submitted|application (?:has been |was )?received/i.test(r.message) || r.message.length>1000) throw new Error('Observed employer confirmation required');
        const expected=new URL(r.jobUrl), observed=new URL(r.observedUrl);
        if(expected.origin!==observed.origin || ![expected.pathname,expected.pathname+'/confirmation'].includes(observed.pathname) || observed.search || observed.hash || observed.username || observed.password) throw new Error('Confirmation URL mismatch');
      } else if(p.receipt!==undefined) throw new Error('Receipt not allowed without confirmation');
    }
  }
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
