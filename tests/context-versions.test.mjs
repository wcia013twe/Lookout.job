import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contextResponse } from '../supabase/functions/agent-gateway/context.mjs';
import { refreshAgentContext } from '../mcp/context-cache.mjs';
import { validateRequest } from '../supabase/functions/agent-gateway/contract.mjs';

const versions = { personalVersion: 12, developerVersion: 4 };
const cache = { connectionKey: 'connection-a', ...versions };
function fixture() {
  const calls = [];
  const call = async operation => {
    calls.push(operation);
    if (operation === 'context.versions') return versions;
    if (operation === 'context.personal') return { personalVersion: versions.personalVersion, settings: { preferences: {} } };
    return { developerVersion: versions.developerVersion, instructions: ['Use personal settings'] };
  };
  return { call, calls };
}

test('unchanged retained context costs one small version request', async () => {
  const { call, calls } = fixture();
  const result = await refreshAgentContext({ call, cache, connectionKey: cache.connectionKey });
  assert.deepEqual(calls, ['context.versions']); assert.deepEqual(result.updates, {});
  assert.deepEqual(result.cache, cache);
});
test('personal and developer changes fetch only their own section', async () => {
  for (const section of ['personal', 'developer']) {
    const { call, calls } = fixture();
    const result = await refreshAgentContext({ call, cache: { ...cache, [`${section}Version`]: 1 }, connectionKey: cache.connectionKey });
    assert.deepEqual(calls, ['context.versions', `context.${section}`]);
    assert.deepEqual(Object.keys(result.updates), [section]);
  }
});
test('bootstrap, account switch and lost context force both reads', async () => {
  for (const options of [{}, { cache, connectionKey: 'another-connection' }, { cache, hasContext: false }]) {
    const { call, calls } = fixture();
    await refreshAgentContext({ call, connectionKey: cache.connectionKey, ...options });
    assert.deepEqual(calls, ['context.versions', 'context.personal', 'context.developer']);
  }
});
test('failed refresh cannot acknowledge updates and invalid versions reject', async () => {
  const original = structuredClone(cache);
  await assert.rejects(refreshAgentContext({ call: async operation => operation === 'context.versions' ? versions : Promise.reject(new Error('Offline')), cache: { ...cache, developerVersion: 1 }, connectionKey: cache.connectionKey }), /Offline/);
  assert.deepEqual(cache, original);
  await assert.rejects(refreshAgentContext({ call: async () => ({ personalVersion: 0, developerVersion: 1 }), connectionKey: 'a' }), /Invalid/);
});
test('version response contains exactly two values and developer config is isolated', () => {
  assert.deepEqual(Object.keys(contextResponse('context.versions', { personalVersion: 2, secret: 'never return' })), ['personalVersion', 'developerVersion']);
  const first = contextResponse('context.developer', {}); first.instructions.push('mutated');
  assert.ok(!contextResponse('context.developer', {}).instructions.includes('mutated'));
  assert.equal(contextResponse('context.developer', {}).capabilities.automaticSubmission, 'supported-greenhouse-native-forms');
  for (const operation of ['context.versions', 'context.personal', 'context.developer']) {
    assert.equal(validateRequest({ operation }).operation, operation);
    assert.throws(() => validateRequest({ operation, payload: { userId: 'other' } }), /arguments/);
  }
});
