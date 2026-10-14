import test from 'node:test';
import assert from 'node:assert/strict';
import { PLATFORM_TOOLS } from '../supabase/functions/agent-gateway/platform-tools.mjs';
import { DEPLOYED_COMPAT_TOOLS } from '../supabase/functions/agent-gateway/deployed-compat/tools.mjs';
import { validateRequest } from '../supabase/functions/agent-gateway/contract.mjs';
import { createHandler, TOOLS } from '../supabase/functions/agent-mcp/protocol.mjs';
const token = 'jb_agent_' + 'a'.repeat(64); // Synthetic, never valid in production.
const scopes = TOOLS.map(tool => tool.scope);
function request(message, extra = {}) {
  return new Request('https://example.test/mcp', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...extra }, body: JSON.stringify(message) });
}
const rpc = (method, params, id = 1) => ({ jsonrpc: '2.0', id, method, params });
const handler = (calls = [], allowed = scopes) => createHandler(async (credential, operation, payload) => {
  assert.equal(credential, token); calls.push({ operation, payload });
  return { status: 200, data: operation === 'credentials.verify' ? { scopes: allowed } : { ok: true } };
});
test('initialize negotiates supported versions and initialized notification returns empty 202', async () => {
  const handle = handler();
  const response = await handle(request(rpc('initialize', { protocolVersion: '2025-11-25' })));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).result.protocolVersion, '2025-11-25');
  const notification = await handle(request({ jsonrpc: '2.0', method: 'notifications/initialized' }));
  assert.equal(notification.status, 202); assert.equal(await notification.text(), '');
});
test('missing, malformed, expired credentials and forbidden origins reject discovery', async () => {
  assert.equal((await handler()(request(rpc('tools/list'), { Authorization: '' }))).status, 401);
  assert.equal((await handler()(request(rpc('tools/list'), { Authorization: 'Bearer not-agent' }))).status, 401);
  assert.equal((await createHandler(async () => ({ status: 401 }))(request(rpc('tools/list')))).status, 401);
  assert.equal((await handler()(request(rpc('tools/list'), { Origin: 'https://attacker.test' }))).status, 403);
});
test('scope-filtered discovery exposes only bounded workspace tools', async () => {
  const body = await (await handler([], ['approvals:read'])(request(rpc('tools/list')))).json();
  assert.deepEqual(body.result.tools.map(tool => tool.name), ['read_approval']);
  assert.ok(!TOOLS.some(tool => /browser|shell|sql|submit|approve|issue|revoke/.test(tool.name)));
});
test('context discovery and calls use workspace scope and accept no owner injection', async () => {
  const calls = [], handle = handler(calls, ['workspace:read']);
  const list = await (await handle(request(rpc('tools/list')))).json();
  assert.deepEqual(list.result.tools.map(tool => tool.name), TOOLS.filter(tool=>tool.scope==='workspace:read').map(tool=>tool.name));
  await handle(request(rpc('tools/call', { name: 'check_context_versions', arguments: {} })));
  assert.deepEqual(calls.at(-1), { operation: 'context.versions', payload: {} });
  const invalid = await handle(request(rpc('tools/call', { name: 'read_personal_context', arguments: { userId: 'other' } })));
  assert.equal((await invalid.json()).error.code, -32602);
});
test('tool calls map only to fixed gateway operations, reject missing scope and unknown arguments', async () => {
  const calls = []; const handle = handler(calls);
  const response = await handle(request(rpc('tools/call', { name: 'read_approval', arguments: { applicationId: 'app' } })));
  assert.equal((await response.json()).result.content[0].text, '{"ok":true}');
  assert.deepEqual(calls.at(-1), { operation: 'approvals.read', payload: { applicationId: 'app' } });
  const invalid = await handle(request(rpc('tools/call', { name: 'workspace_read', arguments: { url: 'https://attacker.test' } })));
  assert.equal((await invalid.json()).error.code, -32602);
});
test('HTTP transport rejects unsupported versions, batch messages, methods and oversized bodies', async () => {
  const handle = handler();
  assert.equal((await handle(request(rpc('ping'), { 'MCP-Protocol-Version': 'bad' }))).status, 400);
  assert.equal((await handle(request([rpc('ping')]))).status, 400);
  assert.equal((await handle(new Request('https://example.test/mcp', { headers: { Authorization: 'Bearer ' + token } }))).status, 405);
  assert.equal((await handle(request(rpc('ping', { x: 'x'.repeat(262144) })))).status, 413);
});
test('gateway conflicts become MCP tool errors, infrastructure errors never echo secrets', async () => {
  const conflict = createHandler(async (_token, op) => op === 'credentials.verify' ? { status: 200, data: { scopes } } : { status: 409, error: 'Draft changed' });
  const response = await conflict(request(rpc('tools/call', { name: 'prepare_draft', arguments: { jobId: 'job', expectedRevision: 2, draft: {} } })));
  assert.equal((await response.json()).result.isError, true);
  const failing = createHandler(async () => { throw new Error(token); });
  const failed = await failing(request(rpc('initialize', { protocolVersion: '2025-11-25' })));
  assert.equal(failed.status, 502); assert.ok(!(await failed.text()).includes(token));
});

test('product and compatibility tools register once with distinct variant operations', () => {
  for (const tool of PLATFORM_TOOLS) {
    assert.equal(TOOLS.filter(t => t.operation === tool.operation).length, 1, tool.name);
    assert.ok(tool.scope, tool.name);
    assert.equal(tool.inputSchema.additionalProperties, false, tool.name);
  }
  for (const tool of DEPLOYED_COMPAT_TOOLS) {
    assert.equal(TOOLS.filter(t => t.name === tool.name).length, 1, tool.name);
  }
  assert.equal(TOOLS.find(t => t.name === 'reconsider_skipped_opportunity').operation, 'selection.reconsider');
  assert.equal(TOOLS.find(t => t.name === 'reconsider_opportunity').operation, 'selection.reconsider.simple');
  assert.equal(validateRequest({ operation: 'guides.read', payload: { id: 'cold-outreach' } }).operation, 'guides.read');
  assert.throws(() => validateRequest({ operation: 'guides.read', payload: { id: 'cold-outreach', userId: 'foreign' } }));
});

test('every registered tool rejects missing scope before forwarding an action', async () => {
  for (const tool of TOOLS) {
    const calls = [];
    const response = await handler(calls, [])(request(rpc('tools/call', { name: tool.name, arguments: {} })));
    assert.equal((await response.json()).result.isError, true, tool.name);
    assert.deepEqual(calls, [{ operation: 'credentials.verify', payload: {} }], tool.name);
  }
});
