import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
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
  assert.equal(contextResponse('context.developer', {}).capabilities.automaticSubmission, false);
  for (const operation of ['context.versions', 'context.personal', 'context.developer']) {
    assert.equal(validateRequest({ operation }).operation, operation);
    assert.throws(() => validateRequest({ operation, payload: { userId: 'other' } }), /arguments/);
  }
});
test('database versions advance on settings changes, isolate owners and keep scoped reads private', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
      grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security;
      create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
      grant usage on schema storage to authenticated; grant all on storage.objects to authenticated;`);
    const dir = new URL('../supabase/migrations/', import.meta.url);
    for (const name of (await readdir(dir)).filter(n => n.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(name, dir), 'utf8'));
    await db.exec(await readFile(new URL('./context-versions-check.sql', import.meta.url), 'utf8'));
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from private.agent_settings_versions'));
    await assert.rejects(db.query("select public.agent_dispatch('test','context.versions','{}')"));
    await db.exec('set role anon');
    await assert.rejects(db.query("select public.agent_dispatch('test','context.versions','{}')"));
  } finally { await db.close(); }
});
