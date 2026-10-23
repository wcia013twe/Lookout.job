import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createTestDatabase } from '../../tests/helpers/database.mjs';
import { createHandler } from '../../supabase/functions/agent-mcp/protocol.mjs';
import { validateRequest } from '../../supabase/functions/agent-gateway/contract.mjs';
import { museFeatureDispatch } from '../../supabase/functions/agent-gateway/muse-features.mjs';

// Local integration experiment, not model-generated code or a hosted gateway.
const token = 'jb_agent_' + 'b'.repeat(64);
const hash = createHash('sha256').update(token).digest('hex');
const owner = '11111111-1111-1111-1111-111111111111';
const other = '22222222-2222-2222-2222-222222222222';
const appId = i => `33333333-3333-4333-8333-${String(i + 1).padStart(12, '0')}`;
const foreignId = '44444444-4444-4444-8444-444444444444';
const db = await createTestDatabase();
const report = { experiment: 'database-replay-v1', modelCalls: 0, cases: [], rows: [],
  limits: ['Local PGlite with production migrations; auth/storage scaffolding from repository tests',
    'Real MCP handler, request validator, milestone dispatcher and agent_dispatch SQL',
    'Handwritten operations shared by both paths; no model inference or generated-code sandbox',
    'No hosted HTTP gateway, real mailbox, model tokens, user latency or cost measurement'] };

async function setup(size, { scopes = ['workspace:read', 'activity:write'], expired = false } = {}) {
  await db.exec('rollback; begin;');
  await db.query(`insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at)
    values($1,'Fictional code-mode experiment',$2,$3,now()+$4::interval)`,
  [owner, hash, scopes, expired ? '-1 hour' : '1 hour']);
  const jobs = [];
  for (let i = 0; i < size; i++) {
    const job = `code-mode-replay-${i}`;
    await db.query('insert into public.jobs(id,canonical_url,employer) values($1,$2,$3)',
      [job, `https://example.test/jobs/${i}`, { company: `Fictional ${i}`, title: 'Systems engineer' }]);
    await db.query("insert into public.applications(id,user_id,job_id,status,draft) values($1,$2,$3,'Submitted','{}')", [appId(i), owner, job]);
    jobs.push(job);
  }
  await db.query("insert into public.applications(id,user_id,job_id,status,draft) values($1,$2,$3,'Submitted','{}')", [foreignId, other, jobs[0]]);
  await db.query("update public.applications set status='Submitted' where job_id like 'code-mode-replay-%'");
}

function evidence(i = 0) {
  return { applicationId: appId(i), eventKey: `email:fictional-${i}:interview`,
    kind: 'technical_round', label: 'Technical interview invitation', phase: 'scheduled', occurredAt: null,
    source: { kind: 'email', messageId: `fictional-${i}`, subject: 'Next round',
      excerpt: 'We would like to invite you to a technical interview. We will confirm the time later.',
      receivedAt: '2026-10-22T12:00:00Z' } };
}

function connector({ lostResponse = false } = {}) {
  const metrics = { toolCalls: 0, sqlCalls: 0, credentialChecks: 0 };
  let loseOnce = lostResponse;
  let queue = Promise.resolve();
  function rpc(operation, payload) {
    const pending = queue.then(() => dispatchSql(operation, payload));
    queue = pending.catch(() => {});
    return pending;
  }
  async function dispatchSql(operation, payload) {
    metrics.sqlCalls++;
    if (operation === 'credentials.verify') metrics.credentialChecks++;
    await db.exec('savepoint tool_call');
    try {
      const { rows } = await db.query('select public.agent_dispatch($1,$2,$3::jsonb) as data', [hash, operation, JSON.stringify(payload)]);
      await db.exec('release savepoint tool_call');
      return { data: rows[0].data };
    } catch (error) {
      await db.exec('rollback to savepoint tool_call; release savepoint tool_call');
      return { error: { code: error.code, message: error.message } };
    }
  }
  const handler = createHandler(async (_credential, operation, payload) => {
    try { validateRequest({ operation, payload }); }
    catch { return { status: 400, error: 'Invalid request' }; }
    const result = operation === 'applications.milestone'
      ? await museFeatureDispatch({ operation, payload, rpc }) : await rpc(operation, payload);
    if (result.error) return { status: ({ '28000': 401, '42501': 403, 'P0002': 404, '40001': 409 })[result.error.code] ?? 400,
      error: result.error.code };
    if (operation === 'applications.milestone' && loseOnce) {
      loseOnce = false;
      throw Error('Synthetic response loss after committed database write');
    }
    return { status: 200, data: result.data };
  });
  async function call(name, args = {}) {
    metrics.toolCalls++;
    const response = await handler(new Request('https://fictional.test/mcp', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: metrics.toolCalls, method: 'tools/call', params: { name, arguments: args } }),
    }));
    const result = await response.json();
    if (result.error) return { error: result.error.message };
    if (result.result.isError) return { error: result.result.content[0].text };
    return { data: JSON.parse(result.result.content[0].text) };
  }
  // Both methods are just scoped MCP calls; this is the API a code runtime could expose.
  const lookout = { workspace_read: () => call('workspace_read'),
    record_application_milestone: args => call('record_application_milestone', args) };
  return { call, lookout, metrics };
}

async function snapshot() {
  const { rows: milestones } = await db.query(`select application_id,event_key,kind,label,occurred_at,phase,source
    from public.application_milestones order by event_key`);
  const { rows: applications } = await db.query('select id,user_id,status,receipt,revision from public.applications order by id');
  const { rows: approvals } = await db.query('select id from public.approvals');
  return { milestones, applications, approvals };
}

async function run(mode, size, options = {}) {
  await setup(size, options);
  const { call, lookout, metrics } = connector(options);
  const started = performance.now();
  const initial = await (mode === 'code' ? lookout.workspace_read() : call('workspace_read'));
  assert.equal(initial.data.applications.length, size);
  const outcomes = [];
  const send = payload => mode === 'code' ? lookout.record_application_milestone(payload) : call('record_application_milestone', payload);
  if (mode === 'direct-parallel') outcomes.push(...await Promise.all(Array.from({ length: size }, (_, i) => send(evidence(i)))));
  else for (let i = 0; i < size; i++) outcomes.push(await send(evidence(i)));
  const elapsed = performance.now() - started;
  const state = await snapshot();
  assert.equal(state.milestones.length, size);
  assert.ok(state.milestones.every(m => m.occurred_at === null && m.source.kind === 'email'));
  assert.ok(state.applications.every(a => a.status === 'Submitted' && a.receipt === null), JSON.stringify(state.applications));
  assert.equal(state.approvals.length, 0);
  assert.ok(outcomes.every(r => r.data));
  assert.equal(metrics.credentialChecks, size + 1);
  return { mode, size, ...metrics, localDatabaseReplayMs: elapsed, state };
}

try {
  for (const size of [1, 10, 50]) {
    let baseline;
    for (const mode of ['direct', 'direct-parallel', 'code']) {
      const samples = [];
      for (let repeat = 0; repeat < 3; repeat++) {
        const result = await run(mode, size);
        if (!baseline) baseline = result.state;
        assert.deepEqual(result.state, baseline);
        samples.push(result);
      }
      const { state: _state, ...row } = samples[0];
      row.localDatabaseReplayMs = samples.map(s => s.localDatabaseReplayMs).sort((a,b) => a-b)[1];
      report.rows.push(row);
    }
  }
  for (const mode of ['direct', 'code']) {
    for (const name of ['retry', 'changed-evidence', 'foreign-owner', 'missing-scope', 'expired', 'revoked-mid-run', 'unconfirmed-date', 'missing-provenance', 'lost-response']) {
      await setup(1, { scopes: name === 'missing-scope' ? ['workspace:read'] : undefined, expired: name === 'expired' });
      const { call, lookout } = connector({ lostResponse: name === 'lost-response' });
      const send = payload => mode === 'code' ? lookout.record_application_milestone(payload) : call('record_application_milestone', payload);
      const payload = evidence();
      if (name === 'foreign-owner') payload.applicationId = foreignId;
      if (name === 'unconfirmed-date') payload.occurredAt = '2026-10-24T12:00:00Z';
      if (name === 'missing-provenance') delete payload.source.messageId;
      if (name === 'revoked-mid-run') {
        assert.ok((await call('workspace_read')).data);
        await db.query('update private.agent_connections set revoked_at=now() where token_hash=$1', [hash]);
      }
      const first = await send(payload);
      if (['retry', 'changed-evidence', 'lost-response'].includes(name)) {
        if (name === 'changed-evidence') payload.label = 'Conflicting evidence';
        const second = await send(payload);
        assert.equal(Boolean(second.error), name === 'changed-evidence');
        assert.equal((await snapshot()).milestones.length, 1);
        if (name === 'lost-response') assert.ok(first.error);
      } else {
        assert.ok(first.error, `${mode} ${name} must reject`);
        assert.equal((await snapshot()).milestones.length, 0);
      }
      const final = await snapshot();
      assert.ok(final.applications.every(a => a.status === 'Submitted' && a.receipt === null));
      assert.equal(final.approvals.length, 0);
      report.cases.push({ mode, name, passed: true });
    }
  }
  report.repetitions = 3;
  console.log(JSON.stringify(report, null, 2));
} finally { await db.close(); }
