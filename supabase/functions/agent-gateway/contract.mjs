export const EMPLOYER_FIELDS = ['company','title','employmentType','location','locations','category','postedDate','discoveredDate','description','compensation','source','sourceFreshness','applicationUrl','eligibility','deadline'];
// Shared validation is runtime-independent so Node tests cover the deployed contract.
export const SCOPES = ['workspace:read', 'resumes:read', 'batches:write', 'drafts:write', 'activity:write', 'approvals:read'];
export const OPERATIONS = ['connections.issue', 'connections.list', 'connections.revoke', 'workspace.read', 'credentials.verify', 'resumes.read', 'batches.publish', 'drafts.prepare', 'activity.append', 'approvals.read'];
export function validateRequest(input) {
  if (!input || !OPERATIONS.includes(input.operation)) throw new Error('Unknown operation');
  const p = input.payload ?? {};
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('Payload must be an object');
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
