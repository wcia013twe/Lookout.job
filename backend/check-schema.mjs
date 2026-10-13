import { readFile, readdir } from "node:fs/promises";
import { checkApplicationPipeline } from "../tests/pipeline-check.mjs";
import assert from "node:assert/strict";
const { PGlite } = await import(
  process.env.PGLITE_MODULE_PATH || "@electric-sql/pglite"
);
const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
    grant usage on schema storage to authenticated; grant all on storage.objects to authenticated;
    insert into auth.users values('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222');`);
  const migrationDir = new URL("../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(migrationDir))
    .filter((name) => name.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(new URL(name, migrationDir), "utf8"));
  const one = "11111111-1111-1111-1111-111111111111",
    two = "22222222-2222-2222-2222-222222222222";
  await db.exec(
    `insert into public.jobs(id,canonical_url,employer) values('job','https://example.com/job','{}'); set role authenticated; set test.uid='${one}';`,
  );
  await db.query(
    "insert into public.profiles(user_id,facts,verified_at) values($1,$2,now())",
    [one, { name: "Test", email: "test@example.com" }],
  );
  const resume = (
    await db.query(
      "insert into public.resumes(user_id,name,reference_url) values($1,$2,$3) returning id",
      [one, "Master", "https://example.com/resume.pdf"],
    )
  ).rows[0].id;
  const draft = {
    resumeId: resume,
    questionsReviewed: true,
    questions: [{ question: "Why?", answer: "Because." }],
  };
  const app = (
    await db.query(
      "insert into public.applications(user_id,job_id,draft) values($1,$2,$3) returning id",
      [one, "job", draft],
    )
  ).rows[0].id;
  const approved = (
    await db.query("select public.approve_application($1,0) id", [app])
  ).rows[0].id;
  assert.equal(
    (await db.query("select public.approve_application($1,0) id", [app]))
      .rows[0].id,
    approved,
  );
  await assert.rejects(
    db.query("update public.approvals set snapshot='{}' where id=$1", [
      approved,
    ]),
  );
  await db.query("update public.applications set draft=$1 where id=$2", [
    { ...draft, questions: [{ question: "Why?", answer: "Edited." }] },
    app,
  ]);
  const edited = (
    await db.query(
      "select revision,status from public.applications where id=$1",
      [app],
    )
  ).rows[0];
  assert.equal(edited.revision, 1);
  assert.equal(edited.status, "Awaiting approval");
  await assert.rejects(
    db.query("select public.approve_application($1,0)", [app]),
  );
  assert.equal(
    (
      await db.query("select snapshot from public.approvals where id=$1", [
        approved,
      ])
    ).rows[0].snapshot.draft.questions[0].answer,
    "Because.",
  );
  await db.exec(`set test.uid='${two}';`);
  assert.equal(
    (await db.query("select * from public.profiles")).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select * from public.applications")).rows.length,
    0,
  );
  await assert.rejects(
    db.query("insert into public.profiles(user_id) values($1)", [one]),
  );
  await assert.rejects(
    db.query("select public.approve_application($1,1)", [app]),
  );
  await assert.rejects(db.query("select * from private.agent_connections"));
  await assert.rejects(
    db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
      "resumes",
      `${one}/file.pdf`,
    ]),
  );
  await db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
    "resumes",
    `${two}/file.pdf`,
  ]);
  await db.query(
    "select public.set_leaderboard_preferences($1,$2)",
    ["Player", false],
  );
  await assert.rejects(
    db.query("update public.leaderboard_entries set xp=100 where user_id=$1", [
      two,
    ]),
  );
  await checkApplicationPipeline(db, one, two);
  await db.exec("reset role");
  await db.exec(await readFile(new URL("../tests/runner-failure-check.sql", import.meta.url), "utf8"));
  console.log(
    "PASS: schema, owner isolation, immutable/idempotent approvals, revision invalidation, private credentials/storage, leaderboard metric protection",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
