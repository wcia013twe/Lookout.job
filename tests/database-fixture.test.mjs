import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';

test('database fixtures isolate rows and session roles; custom histories bypass the shared baseline',async()=>{
  const first=await createTestDatabase();
  let second,custom;
  try {
    second=await createTestDatabase();
    await first.exec("insert into public.jobs(id,canonical_url,employer) values('fixture-isolation','https://example.test/jobs/fixture','{}');set role authenticated;set test.uid='11111111-1111-1111-1111-111111111111';");
    assert.equal((await second.query("select count(*)::int as count from public.jobs where id='fixture-isolation'")).rows[0].count,0);
    assert.notEqual((await second.query('select current_user as role')).rows[0].role,'authenticated');
    assert.equal((await second.query('select auth.uid() as owner')).rows[0].owner,null);
    custom=await createTestDatabase({migrationFiles:[]});
    assert.equal((await custom.query("select to_regclass('public.jobs') as jobs")).rows[0].jobs,null);
  } finally { await first.close();await second?.close();await custom?.close(); }
});
