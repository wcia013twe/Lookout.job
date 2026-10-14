import assert from "node:assert/strict";

export async function checkLeaderboard(db) {
  const one = "33333333-3333-4333-8333-333333333333", two = "44444444-4444-4444-8444-444444444444";
  await db.query("insert into auth.users(id) values($1),($2)", [one, two]);
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
}
