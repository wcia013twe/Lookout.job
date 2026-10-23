import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { createHandler, TOOLS } from '../../supabase/functions/agent-mcp/protocol.mjs';
import { validateRequest } from '../../supabase/functions/agent-gateway/contract.mjs';

// Offline orchestration experiment, NOT a model benchmark or a production sandbox.
// Both arms use identical handwritten decisions and the real MCP framing/validator.
// Persistence, mail, identity and revisions below are explicitly test doubles.
const credential = 'jb_agent_' + 'a'.repeat(64);
const bytes = value => Buffer.byteLength(JSON.stringify(value));
export function fixture(size) {
  const applications = Array.from({ length: size }, (_, i) => ({
    id: `app-${i}`, company: `Fictional ${i}`, revision: 1, status: 'Submitted',
  }));
  const messages = applications.map((app, i) => ({
    id: `mail-${i}`, applicationId: app.id,
    subject: i % 2 ? 'Application update' : 'Interview invitation',
    body: i % 2 ? 'We will not be moving forward with your application.' : 'Please select a time for your technical interview.',
    footer: 'Fictional newsletter content. '.repeat(100),
  }));
  return { applications, messages, events: [] };
}

export function environment(input, { writeScope = true, conflict = false, failAt = null } = {}) {
  const state = structuredClone(input);
  const scopes = ['workspace:read', ...(writeScope ? ['tracking:write'] : [])];
  const metrics = { calls: 0, credentialChecks: 0, writes: 0, toolResultBytes: 0 };
  let conflicted = false;
  const handle = createHandler(async (_token, operation, payload) => {
    if (operation === 'credentials.verify') {
      metrics.credentialChecks++;
      return { status: 200, data: { scopes } };
    }
    validateRequest({ operation, payload });
    if (operation === 'workspace.read') return { status: 200, data: { applications: state.applications } };
    if (operation !== 'applications.progress') throw Error('Unexpected operation');
    const app = state.applications.find(a => a.id === payload.applicationId);
    if (!app) return { status: 404, error: 'Owned application not found' };
    const previous = state.events.find(e => e.eventKey === payload.eventKey);
    if (previous) return { status: 200, data: previous };
    if (failAt === payload.applicationId) return { status: 503, error: 'Synthetic transient failure' };
    if (conflict && !conflicted) { app.revision++; conflicted = true; }
    if (app.revision !== payload.expectedRevision) return { status: 409, error: 'Revision conflict' };
    app.status = payload.status; app.revision++;
    state.events.push(structuredClone(payload)); metrics.writes++;
    return { status: 200, data: { application: app, source: 'agent observation' } };
  });
  async function call(name, args = {}) {
    metrics.calls++;
    const response = await handle(new Request('https://fictional.test/mcp', {
      method: 'POST', headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: metrics.calls, method: 'tools/call', params: { name, arguments: args } }),
    }));
    const result = await response.json();
    metrics.toolResultBytes += bytes(result);
    if (result.error || result.result?.isError) return { error: result.error?.message ?? result.result.content[0].text };
    return JSON.parse(result.result.content[0].text);
  }
  return { state, metrics, call };
}

// Deliberately conservative fixture-only interpreter. No claim about natural
// language understanding, thread matching, spoof detection or prompt injection.
function interpret(message, applications) {
  const matches = applications.filter(a => a.id === message.applicationId);
  if (matches.length !== 1) return null;
  const status = message.body === 'Please select a time for your technical interview.' ? 'Interview'
    : message.body === 'We will not be moving forward with your application.' ? 'Rejected' : null;
  return status ? { applicationId: matches[0].id, expectedRevision: matches[0].revision,
    status, note: `Email evidence: ${message.id}`, eventKey: `email:${message.id}` } : null;
}

export async function runArm(mode, input, options = {}) {
  const env = environment(input, options);
  const started = performance.now();
  const { applications } = await env.call('workspace_read');
  const seen = new Set(); const updates = []; const unresolved = [];
  for (const message of input.messages) {
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    const update = interpret(message, applications);
    if (update) updates.push(update); else unresolved.push(message.id);
  }
  const results = [];
  async function write(update) {
    const result = await env.call('record_application_progress', update);
    results.push({ messageId: update.eventKey.slice(6), ok: !result.error, ...(result.error ? { error: result.error } : {}) });
    return result;
  }
  if (mode === 'direct-parallel') await Promise.all(updates.map(write));
  else for (const update of updates) await write(update);
  const summary = { results: results.sort((a,b) => a.messageId.localeCompare(b.messageId)), unresolved };
  // These are explicit protocol-shape estimates, not observed model rounds or tokens.
  const decisionEvidence = input.messages.map(({ id, applicationId, subject, body }) => ({ id, applicationId, subject, body }));
  const modeledResultBytes = mode === 'code' ? bytes({ applications, messages: decisionEvidence }) + bytes(summary)
    : bytes(input.messages) + env.metrics.toolResultBytes;
  return { mode, size: input.applications.length, ...env.metrics,
    localHarnessMs: performance.now() - started,
    modeledModelBoundBytes: modeledResultBytes,
    modeledResultHandoffs: mode === 'code' ? 2 : mode === 'direct-parallel' ? 2 : 2 + updates.length,
    summary, state: env.state };
}

export async function verify() {
  let checks = 0;
  for (const options of [{}, { writeScope: false }, { conflict: true }, { failAt: 'app-1' }]) {
    const input = fixture(3);
    input.messages.push(input.messages[0], { id: 'ambiguous', body: 'Let us discuss other opportunities.' },
      { id: 'foreign', applicationId: 'other-owner', body: input.messages[0].body });
    const arms = await Promise.all(['direct', 'direct-parallel', 'code'].map(mode => runArm(mode, input, options)));
    for (const arm of arms) {
      assert.deepEqual(arm.state, arms[0].state);
      assert.deepEqual(arm.summary, arms[0].summary);
      assert.deepEqual(arm.summary.unresolved, ['ambiguous', 'foreign']);
      assert.equal(arm.credentialChecks, arm.calls);
      if (options.writeScope === false) assert.equal(arm.writes, 0);
      else assert.equal(arm.writes, options.conflict || options.failAt ? 2 : 3);
      checks++;
    }
  }
  const env = environment(fixture(1));
  const payload = interpret(env.state.messages[0], env.state.applications);
  await env.call('record_application_progress', payload);
  await env.call('record_application_progress', payload);
  assert.equal(env.metrics.writes, 1); checks++;
  const denied = await env.call('record_application_progress', { ...payload, userId: 'other' });
  assert.ok(denied.error); assert.equal(env.metrics.writes, 1); checks++;
  return checks;
}

export async function benchmark() {
  const checks = await verify();
  const rows = [];
  for (const size of [1, 10, 50]) for (const mode of ['direct', 'direct-parallel', 'code']) {
    const samples = [];
    for (let repeat = 0; repeat < 10; repeat++) samples.push(await runArm(mode, fixture(size)));
    const sample = samples[0];
    const timings = samples.map(s => s.localHarnessMs).sort((a,b) => a-b);
    rows.push(Object.fromEntries(Object.entries({ ...sample, localHarnessMs: timings[5] })
      .filter(([key]) => !['state','summary'].includes(key))));
  }
  return { experiment: 'offline-orchestration-v1', checks, repetitions: 10,
    toolCatalogCount: TOOLS.length,
    limits: ['No model calls or real email access', 'Handwritten identical decisions in all arms',
      'Real MCP framing and request validation; mock persistence and identity',
      'Code arm is a trusted local program, not a production sandbox',
      'Model-bound bytes and handoffs are modeled, not token or latency measurements',
      'No hosted gateway, database authorization, semantic accuracy, or runtime compatibility claims',
      'Direct-parallel assumes mail and workspace reads in one round and independent writes in a second',
      'Code estimates two rounds: gather evidence for model interpretation, then write and summarize',
      'Synthetic emails contain 2800 bytes of removable footer; direct projections could remove it too',
      'Email connector network calls, schema tokens, generated code tokens, and model reasoning are not measured'], rows };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await benchmark(), null, 2));
}
