import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTestDatabase} from './helpers/database.mjs';
import {buildResetSQL} from '../scripts/com2/reset.mjs';
import {buildSnapshotSQL} from '../scripts/com2/snapshot.mjs';
const fixture=JSON.parse(readFileSync(new URL('../examples/com2/fixture.json',import.meta.url)));
const owner='11111111-1111-1111-1111-111111111111',other='22222222-2222-2222-2222-222222222222';
const account={status:'verified',benchmarkTaskId:'COM2',apiUrl:'http://127.0.0.1:54321',email:'com2@example.test',userId:owner};
const initial={profileFacts:{name:'Fictional Person'},contacts:fixture.contacts,applications:[fixture.application,fixture.sentinelApplication]};
test('COM2 reset and complete snapshot stay in a dedicated fictional owner; reschedule provenance supported',async()=>{
 const db=await createTestDatabase();
 try{
  await db.exec("alter table auth.users add column email text; alter table auth.users add column raw_app_meta_data jsonb;");
  await db.query("update auth.users set email=$2,raw_app_meta_data='{\"benchmarkTaskId\":\"COM2\"}' where id=$1",[owner,account.email]);
  await db.query("insert into public.profiles(user_id,facts) values($1,'{}') on conflict(user_id) do nothing",[owner]);
  await db.query("insert into public.outreach_contacts(user_id,id,record) values($1,'foreign','{\"contact\":\"Other Person\"}')",[other]);
  await db.exec(buildResetSQL(account,initial));
  const apps=(await db.query('select id,status,receipt,draft from public.applications where user_id=$1',[owner])).rows;
  assert.equal(apps.length,2);assert.ok(apps.every(a=>a.status==='Submitted'&&a.receipt===null));
  for(const app of apps)assert.deepEqual(app.draft,initial.applications.find(x=>x.id===app.id).draft);
  // Exercise source and supersession using the existing owned writer, not a new fixture API.
  const source={kind:'email',messageId:'m1',subject:'Confirmed',excerpt:'November 17 at 2:30 PM Eastern',receivedAt:'2026-11-16T16:10:00Z',timestampConfirmed:true};
  const payload={eventKey:'com2-round-a',kind:'recruiter_call',label:'Recruiter screen',phase:'scheduled',occurredAt:'2026-11-17T14:30:00-05:00',timeZone:'America/New_York',source};
  const call=async p=>(await db.query('select to_jsonb(private.record_application_milestone_owned($1,$2,$3,$4)) as data',[owner,fixture.application.id,p,p.source.kind])).rows[0].data;
  const first=await call(payload);
  const replacement=await call({...payload,eventKey:'com2-round-b',occurredAt:'2026-11-18T10:30:00-05:00',supersedesId:first.id,source:{...source,messageId:'m2',excerpt:'Replacement time November 18 at 10:30 AM Eastern'}});
  assert.equal(replacement.supersedes_id,first.id);
  const done=await call({eventKey:'com2-completed',kind:'recruiter_call',label:'User reported finishing screen',phase:'completed',occurredAt:null,supersedesId:replacement.id,source:{kind:'user_reported',note:'I finished the Alder recruiter screen this morning.'}});
  assert.equal(done.source.kind,'user_reported');assert.equal(done.occurred_at,null);
  const rejected=await call({eventKey:'com2-rejected',kind:'rejected',label:'Recruiter confirmed rejection',phase:'received',occurredAt:null,source:{...source,messageId:'terminal',excerpt:'We rejected your application and cancelled your technical interview.'}});
  assert.equal(rejected.kind,'rejected');
  const snapshots=await db.exec(buildSnapshotSQL(account));
  const snap=snapshots.at(-1).rows[0].jsonb_build_object;
  assert.equal(snap.tables.application_milestones.length,4);assert.equal(snap.tables.applications.length,2);
  assert.ok(snap.tables.applications.every(a=>a.receipt===null));
  await db.exec(buildResetSQL(account,initial));
  assert.equal((await db.query('select count(*)::int as n from public.application_milestones where user_id=$1',[owner])).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int as n from public.outreach_contacts where user_id=$1',[other])).rows[0].n,1);
  await db.query("update auth.users set raw_app_meta_data='{\"benchmarkTaskId\":\"COM1\"}' where id=$1",[owner]);
  await assert.rejects(db.exec(buildResetSQL(account,initial)),/assignment mismatch/);
  await db.exec('ROLLBACK');
  assert.equal((await db.query('select count(*)::int as n from public.applications where user_id=$1',[owner])).rows[0].n,2);
 }finally{await db.close();}
});
test('COM2 refuses nonlocal or other-case receipts before SQL',()=>{
 assert.throws(()=>buildResetSQL({...account,benchmarkTaskId:'COM1'},initial),/Dedicated/);
 assert.throws(()=>buildSnapshotSQL({...account,apiUrl:'https://example.supabase.co'}),/Dedicated/);
});
