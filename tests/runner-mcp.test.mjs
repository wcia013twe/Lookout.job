import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { createGatewayClient, PROJECT_URL } from '../runner/gateway-client.mjs';
import { createLocalRuntime } from '../runner/runtime.mjs';
import { serveStdio } from '../runner/mcp-server.mjs';
import { formResult, identifyJob } from '../runner/forms.mjs';
const token = 'jb_agent_' + 'a'.repeat(64);
const aid = '00000000-0000-4000-8000-000000000001';
const rid = '00000000-0000-4000-8000-000000000002';
const jid = '00000000-0000-4000-8000-000000000003';
const scopes = ['workspace:read','drafts:write','approvals:read','resumes:read'];
const url = 'https://job-boards.greenhouse.io/example/jobs/123';
const bytes = Buffer.from('%PDF-test');
const resume = { id: rid, user_id: 'owner', object_path: 'owner/resume.pdf' };
function fixture() {
  const questions = [{ question: 'Email', required: true, fields: [{ id: 'email', type: 'email', options: [] }] }];
  const form = formResult(identifyJob(url), questions, []);
  const draft = { url, resumeId: rid, resumeSha256: createHash('sha256').update(bytes).digest('hex'), questionsReviewed: true, formFingerprint: form.formFingerprint, questions: [{ fieldId: 'email', question: 'Email', answer: 'test@example.com' }] };
  const context = { application: { id: aid, job_id: jid, user_id: 'owner', status: 'Approved', revision: 1, draft }, approval: { id: 'approval', application_id: aid, user_id: 'owner', revision: 1, snapshot: { draft, resume } }, resume, resumeBytes: bytes, job: { id: jid, canonical_url: url } };
  const reports = [], fills = [], visits = [];
  const gateway = { forward: async () => ({ status: 200, data: { scopes } }), call: async (op, payload) => op === 'credentials.verify' ? { scopes } : (reports.push(payload), { application: { status: 'Blocked' } }), loadCurrentContext: async () => context };
  const page = { goto: async value => visits.push(value), url: () => url, evaluate: async () => ({ questions, blockers: [] }), locator: selector => ({ count: async () => 1, fill: async value => fills.push(value) }) };
  return { context, reports, fills, visits, gateway, page };
}
test('stdio discovery and approved prefill traverse the concrete runtime', async () => {
  const f = fixture(); const runtime = createLocalRuntime({ gateway: f.gateway, getPage: async () => f.page });
  const messages = [ { id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } }, { method: 'notifications/initialized' }, { id: 2, method: 'tools/list' }, { id: 3, method: 'tools/call', params: { name: 'try_application', arguments: { applicationId: aid, attemptId: 'run1' } } } ].map(m => JSON.stringify({ jsonrpc: '2.0', ...m })+'\n');
  const output = []; await serveStdio({ input: Readable.from(messages), output: { write: s => output.push(s) }, token, runtime });
  const replies = output.map(s => JSON.parse(s)); assert.equal(replies.length, 3);
  assert.ok(replies[1].result.tools.some(t => t.name === 'try_application'));
  const result = JSON.parse(replies[2].result.content[0].text);
  assert.equal(result.status, 'Prepared'); assert.equal(result.submission, 'manual-handoff');
  assert.deepEqual(f.fills, ['test@example.com']); assert.deepEqual(f.visits, [url]); assert.equal(f.reports.length, 0);
  assert.ok(!JSON.stringify(replies).includes('test@example.com'));
});
test('browser failure becomes Needs you through gateway without leaking error text', async () => {
  const f = fixture(); const runtime = createLocalRuntime({ gateway: f.gateway, getPage: async () => { throw Error('private-secret'); } });
  const result = await runtime.forward(token, 'local.try', { applicationId: aid, attemptId: 'run1' });
  assert.equal(result.data.status, 'Needs you'); assert.equal(result.data.reported, true);
  assert.equal(f.reports[0].expectedRevision, 1); assert.ok(!JSON.stringify(result).includes('private-secret'));
});
test('private input scopes are required before any browser access', async () => {
  const f = fixture(); f.gateway.call = async () => ({ scopes: ['drafts:write'] });
  const runtime = createLocalRuntime({ gateway: f.gateway, getPage: () => { throw Error('Must not open'); } });
  assert.equal((await runtime.forward(token, 'local.try', { applicationId: aid, attemptId: 'run1' })).status, 403);
});
test('gateway loader derives job and resume from authenticated records, never caller URLs', async () => {
  const f = fixture(); const requests = [];
  const client = createGatewayClient({ token, fetchImpl: async (value, options) => {
    requests.push({ value, options });
    if (value.endsWith('/agent-gateway')) {
      const { operation } = JSON.parse(options.body);
      return Response.json({ data: operation === 'approvals.read' ? { application: f.context.application, approval: f.context.approval } : { resume, url: `${PROJECT_URL}/storage/v1/object/sign/resumes/owner/resume.pdf?token=secret` } });
    }
    if (value.includes('/rest/v1/jobs')) return Response.json([f.context.job]);
    return new Response(bytes);
  } });
  const loaded = await client.loadCurrentContext(aid);
  assert.equal(loaded.job.id, jid); assert.deepEqual(loaded.resumeBytes, bytes);
  assert.equal(requests.length, 4); assert.ok(requests.every(r => r.options.redirect === 'error'));
  assert.ok(!requests.at(-1).options.headers?.Authorization);
});
test('external resume URLs and oversized files are refused', async () => {
  for (const external of [true, false]) {
    let downloads = 0;
    const client = createGatewayClient({ token, fetchImpl: async value => {
      if (value.endsWith('/agent-gateway')) return Response.json({ data: { resume, url: external ? 'https://evil.test/resume.pdf' : `${PROJECT_URL}/storage/v1/object/sign/resumes/owner/resume.pdf?token=x` } });
      downloads++; return new Response(bytes, { headers: { 'Content-Length': '10485761' } });
    } });
    await assert.rejects(client.loadResume(rid)); assert.equal(downloads, external ? 0 : 1);
  }
});
test('unavailable file preserves application revision for failure reporting', async () => {
  const f = fixture(); const client = createGatewayClient({ token, fetchImpl: async (value, options) => {
    const { operation } = JSON.parse(options.body);
    return operation === 'approvals.read' ? Response.json({ data: { application: f.context.application, approval: f.context.approval } }) : Response.json({ error: 'unavailable' }, { status: 404 });
  } });
  const result = await client.loadCurrentContext(aid); assert.equal(result.application.revision, 1); assert.equal(result.resumeBytes, undefined);
});
