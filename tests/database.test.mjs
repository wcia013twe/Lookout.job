import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTestDatabase } from './helpers/database.mjs';
import { checkSchema } from './helpers/schema-check.mjs';
import { checkLeaderboard } from './helpers/leaderboard-check.mjs';
import { checkApplicationPipeline } from './pipeline-check.mjs';

// Apply migrations once. SQL scenarios roll back their fixtures; reset role and
// owner before every scenario so a previous check cannot lend its privileges.
let db;
before(async () => { db = await createTestDatabase(); });
after(async () => { await db?.close(); });
beforeEach(async () => { await db.exec("reset role; set test.uid='';"); });

test('schema enforces owner isolation, immutable approvals and private storage', async () => {
  await checkSchema(db);
});
test('application pipeline requires submission and deduplicates stage events', async () => {
  await checkApplicationPipeline(db, '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
});
test('leaderboard derives scores, deduplicates refreshes and exposes only opted-in metrics', async () => {
  await checkLeaderboard(db);
});

for (const [file, behavior] of [
  ['onboarding', 'onboarding verifies first value, isolates owners, and never manufactures submission authority'],
  ['context-versions', 'settings versions advance only for the owner and remain scope-gated'],
  ['runner-failure', 'failure reports preserve drafts, reject stale writes and replay once'],
  ['submission', 'submission claims permit one click and retain observed evidence'],
  ['muse-parity', 'quiet settings and human handoffs retain scoped ownership and versions'],
  ['milestones', 'process milestones preserve evidence, ownership, and unknown dates'],
  ['muse-features', 'preparation, selection and notification records enforce ownership and versions'],
  ['search-profile', 'search profile UI and MCP writes share version and permission checks'],
  ['search-targets', 'target edits validate addresses and survive workspace autosync'],
  ['platform-tools', 'profile, answer and preference actions cannot forge consent'],
  ['platform-extended', 'contacts, resume intents and manual progress use bounded transitions'],
  ['platform-coverage', 'batch, resume, selection and browser actions enforce their contracts'],
]) {
  test(behavior, async () => {
    try {
      await db.exec(await readFile(new URL(`./${file}-check.sql`, import.meta.url), 'utf8'));
    } finally {
      await db.exec('rollback; reset role');
    }
  });
}
test('browser and anonymous roles cannot invoke trusted context dispatch', async () => {
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from private.agent_settings_versions'));
  await assert.rejects(db.query("select public.agent_dispatch('test','context.versions','{}')"));
  await db.exec('set role anon');
  await assert.rejects(db.query("select public.agent_dispatch('test','context.versions','{}')"));
});
