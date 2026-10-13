import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('server leaderboard deduplicates approvals, isolates owners, and exposes only opted-in metrics', async () => {
  const db = new PGlite();
  const one = '11111111-1111-1111-1111-111111111111', two = '22222222-2222-2222-2222-222222222222';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
      grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security;
      create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
      grant usage on schema storage to authenticated; grant all on storage.objects to authenticated;
      insert into auth.users values('${one}'),('${two}');`);
    const directory = new URL('../supabase/migrations/', import.meta.url);
    for (const name of (await readdir(directory)).filter(n => n.endsWith('.sql')).sort()) {
      await db.exec(await readFile(new URL(name, directory), 'utf8'));
    }
    await db.exec(`insert into public.jobs(id,canonical_url,employer) values('rank-a','https://example.com/rank-a','{}'),('rank-b','https://example.com/rank-b','{}');
      insert into public.applications(user_id,job_id,created_at,submitted_at) values
      ('${one}','rank-a',now()-interval '1 day',now()),('${one}','rank-b',now()-interval '1 day',null);
      insert into public.approvals(user_id,application_id,revision,snapshot) select '${one}',id,0,'{}' from public.applications where job_id='rank-a';
      insert into public.approvals(user_id,application_id,revision,snapshot) select '${one}',id,1,'{}' from public.applications where job_id='rank-a';
      set role authenticated; set test.uid='${one}';`);
    const refresh = async () => (await db.query('select * from public.refresh_leaderboard()')).rows[0];
    const first = await refresh();
    assert.equal(Number(first.xp), 35);
    assert.equal(first.applications_count, 1);
    assert.equal(first.streak, 2);
    assert.equal(first.opted_in, false);
    assert.equal(Number((await refresh()).xp), 35);
    await assert.rejects(db.query('update public.leaderboard_entries set xp=99999'));
    await assert.rejects(db.query('select user_id from public.leaderboard_entries'));
    await db.exec(`set test.uid='${two}'`);
    assert.equal((await db.query('select alias from public.leaderboard_entries')).rows.length, 0);
    assert.equal(Number((await refresh()).xp), 0);
    await db.exec(`set test.uid='${one}'`);
    await db.query('select public.set_leaderboard_preferences($1,true)', ['Player One']);
    await db.exec(`set test.uid='${two}'`);
    assert.equal((await db.query('select alias,xp from public.leaderboard_entries where opted_in')).rows[0].alias, 'Player One');
    await db.query('select public.set_leaderboard_preferences($1,true)', ['Player Two']);
    await db.exec(`set test.uid='${one}'`);
    await db.query('select public.set_leaderboard_preferences($1,false)', ['Player One']);
    await db.exec(`set test.uid='${two}'`);
    assert.equal((await db.query('select alias from public.leaderboard_entries where opted_in')).rows.length, 1);
    await assert.rejects(db.query('select public.set_leaderboard_preferences($1,true)', ['   ']));
    await db.exec(`set test.uid='';`);
    await assert.rejects(refresh(), /Sign in required/);
    await db.exec('set role anon');
    await assert.rejects(refresh());
    await assert.rejects(db.query('select alias from public.leaderboard_entries'));
  } finally { await db.close(); }
});
