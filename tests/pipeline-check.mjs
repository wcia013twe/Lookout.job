import assert from 'node:assert/strict';

// Called by backend/check-schema.mjs after migrations and test users are loaded.
export async function checkApplicationPipeline(db, owner, other) {
  await db.exec("reset role; insert into public.jobs(id,canonical_url,employer) values('pipeline-job','https://example.com/pipeline-job','{}'); set role authenticated;");
  await db.query("select set_config('test.uid',$1,false)", [owner]);
  const application = (await db.query(
    'insert into public.applications(user_id,job_id,draft) values($1,$2,$3) returning id',
    [owner, 'pipeline-job', {}],
  )).rows[0].id;
  const stage = (target, note, revision = 0) => db.query(
    'select * from public.set_application_stage($1,$2,$3,$4)',
    [application, revision, target, note],
  );
  assert.equal((await db.query(
    "select count(*)::integer total from public.activity_events where application_id=$1 and kind='application_queued'",
    [application],
  )).rows[0].total, 1);
  await assert.rejects(stage('Interview', 'Screen scheduled'), /Record submission/);
  await assert.rejects(stage('Approved', 'Approved'), /tracking stage/);
  await assert.rejects(stage('Submitted', ''), /update note/);
  await assert.rejects(stage('Submitted', 'Submitted manually', 1), /changed/);
  const submitted = (await stage('Submitted', 'Submitted on employer website')).rows[0];
  assert.equal(submitted.status, 'Submitted');
  assert.ok(submitted.submitted_at);
  assert.equal(submitted.receipt, null);
  await assert.rejects(db.query(
    'update public.applications set draft=$1 where id=$2', [{edited: true}, application],
  ), /cannot be edited/);
  await stage('Interview', 'Recruiter screen scheduled');
  await stage('Offer', 'Written offer received');
  await stage('Offer', ''); // Same stage is idempotent.
  assert.equal((await db.query(
    "select count(*)::integer total from public.activity_events where application_id=$1 and kind='stage_changed'",
    [application],
  )).rows[0].total, 3);
  await db.query("select set_config('test.uid',$1,false)", [other]);
  await assert.rejects(stage('Rejected', 'Another account'), /changed/);
  assert.equal((await db.query('select * from public.activity_events where application_id=$1', [application])).rows.length, 0);
}
