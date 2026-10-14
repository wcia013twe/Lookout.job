import assert from "node:assert/strict";

export async function checkSchema(db) {
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
}
