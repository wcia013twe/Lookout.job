import { createHash } from 'node:crypto';

// Fixed project endpoints: never send an agent credential to caller-supplied URLs.
export const PROJECT_URL = 'https://umhqfqzpwmszhcknwtrs.supabase.co';
const PUBLIC_KEY = 'sb_publishable_hWhdwxwVfWS_0zd5VvoFzA_DvfV6jp5';
const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export function createGatewayClient({ token, fetchImpl = fetch, projectUrl = PROJECT_URL }) {
  const configured=new URL(projectUrl);
  if(configured.username||configured.password||configured.pathname!=='/'||configured.search||configured.hash||!(configured.protocol==='https:'||(configured.protocol==='http:'&&['localhost','127.0.0.1','kong','host.docker.internal'].includes(configured.hostname))))throw Error('Trusted configured backend URL required');
  const backendUrl=configured.origin;
  if (!/^jb_agent_[a-f0-9]{64}$/.test(token || '')) throw new Error('JOB_BOARD_AGENT_TOKEN required');
  async function request(url, options = {}) {
    return fetchImpl(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(30000) });
  }
  async function forward(_token, operation, payload) {
    const response = await request(`${backendUrl}/functions/v1/agent-gateway`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation, payload }),
    });
    const body = await response.json();
    return { status: response.status, data: body.data, error: body.error };
  }
  async function call(operation, payload = {}) {
    const result = await forward(token, operation, payload);
    if (result.status !== 200) throw new Error(`Gateway operation rejected (${result.status})`);
    return result.data;
  }
  async function loadResume(resumeId) {
    if (!uuid(resumeId)) throw new Error('Resume ID required');
    const { resume, url } = await call('resumes.read', { resumeId });
    if (resume?.id !== resumeId || !resume.object_path) throw new Error('Upload the resume to private board Storage first');
    const target = new URL(url);
    const expectedPath = `/storage/v1/object/sign/resumes/${resume.object_path}`;
    if (target.origin !== backendUrl || decodeURIComponent(target.pathname) !== expectedPath
      || target.username || target.password || target.hash || !target.searchParams.has('token')) throw new Error('Invalid private resume URL');
    const response = await request(target.href);
    if (!response.ok || !response.body || Number(response.headers.get('Content-Length') || 0) > MAX_RESUME_BYTES) throw new Error('Resume download unavailable');
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > MAX_RESUME_BYTES) throw new Error('Resume exceeds runner limit');
      chunks.push(Buffer.from(chunk));
    }
    const resumeBytes = Buffer.concat(chunks);
    return { resume, resumeBytes, sha256: createHash('sha256').update(resumeBytes).digest('hex') };
  }
  async function loadCurrentContext(applicationId) {
    if (!uuid(applicationId)) throw new Error('Application ID required');
    const context = await call('approvals.read', { applicationId });
    if (context.application?.id !== applicationId || !uuid(context.application.job_id)) throw new Error('Owned application unavailable');
    if (!context.approval) return context; // Orchestrator can still report the current revision.
    let resumeData;
    try { resumeData = await loadResume(context.application.draft?.resumeId); }
    catch { return context; } // Preserve revision for reporting missing/unavailable files.
    const response = await request(`${backendUrl}/rest/v1/jobs?id=eq.${context.application.job_id}&select=id,canonical_url,employer`, { headers: { apikey: PUBLIC_KEY } });
    if (!response.ok) throw new Error('Canonical job unavailable');
    const jobs = await response.json();
    if (!Array.isArray(jobs) || jobs.length !== 1 || jobs[0].id !== context.application.job_id) throw new Error('Canonical job unavailable');
    return { ...context, job: jobs[0], resume: resumeData.resume, resumeBytes: resumeData.resumeBytes };
  }
  async function loadSubmissionContext(applicationId) {
    if (!uuid(applicationId)) throw new Error('Application ID required');
    const context = await call('submission.context', {applicationId});
    if (context.application?.id !== applicationId) throw new Error('Application mismatch');
    if (!context.allowed) return context;
    const file=await loadResume(context.application.draft.resumeId);
    return {...context,resumeBytes:file.resumeBytes};
  }
  return { forward, call, loadResume, loadCurrentContext, loadSubmissionContext };
}
