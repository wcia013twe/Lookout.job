import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
import {createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
const owner='11111111-1111-1111-1111-111111111111',other='22222222-2222-2222-2222-222222222222';
const hash='a'.repeat(64),foreign='b'.repeat(64),readonly='c'.repeat(64);
const migration='20261108235459_clear_superseded_application_blockers.sql';
async function app(db,key,blocker='Select a resume and finish preparing the employer form.') {
 await db.query('insert into public.jobs(id,canonical_url,employer) values($1,$2,$3)',[key,'https://example.test/'+key,{company:'Example (fictional)',title:'Engineer'}]);
 return (await db.query('insert into public.applications(user_id,job_id,draft,blocker) values($1,$2,$3,$4) returning *',[owner,key,{resumeId:'',questions:[],questionsReviewed:false,custom:{preserve:true}},blocker])).rows[0];
}
async function attempt(db,a,state) {
 return (await db.query("insert into public.submission_attempts(user_id,application_id,attempt_key,revision,state,context_snapshot,authorization_snapshot,started_at) values($1,$2,$3,$4,$3,'{}','{}',now()) returning *",[owner,a.id,state,a.revision])).rows[0];
}
async function connections(db) {
 for(const [token,user,scopes] of [[hash,owner,['tracking:write','workspace:read']],[foreign,other,['tracking:write','workspace:read']],[readonly,owner,['workspace:read']]])
  await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Fictional progress test',$2,$3,now()+interval '1 day')",[user,token,scopes]);
}
function mcpClient(db) {
 const handler=createHandler(async(token,operation,payload)=>{
  try{return {status:200,data:(await db.query('select public.agent_dispatch($1,$2,$3) data',[token.slice('jb_agent_'.length),operation,payload])).rows[0].data};}
  catch(e){return {status:400,error:e.message};}
 });
 return async(args,token=hash)=>{
  const response=await handler(new Request('http://localhost/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'record_application_progress',arguments:args}})}));
  const body=await response.json();if(body.error||body.result?.isError)throw Error(JSON.stringify(body));
  return JSON.parse(body.result.content[0].text);
 };
}

test('website and MCP submission reporting clear stale preparation blockers without editing draft or forging evidence',async()=>{
 const db=await createTestDatabase();
 try {
  await connections(db);const mcp=mcpClient(db);
  for(const channel of ['website','mcp']) {
   const a=await app(db,'progress-'+channel);
   assert.equal(a.status,'Blocked');
   assert.equal((await db.query('select kind from public.action_inbox where application_id=$1 and resolved_at is null',[a.id])).rows[0].kind,'resolve_blocker');
   const request={applicationId:a.id,expectedRevision:a.revision,status:'Submitted',note:'User reported completing the application on the employer site.',eventKey:'reported-'+channel};
   let result;
   if(channel==='website') {
    await db.query("select set_config('test.uid',$1,false)",[other]);await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from public.set_application_stage($1,$2,$3,$4)',[a.id,a.revision,'Submitted',request.note]),/changed/);
    await db.query("select set_config('test.uid',$1,false)",[owner]);
    await assert.rejects(db.query('select * from public.set_application_stage($1,$2,$3,$4)',[a.id,a.revision+1,'Submitted',request.note]),/changed/);
    await assert.rejects(db.query('select * from public.set_application_stage($1,$2,$3,$4)',[a.id,a.revision,'Submitted','']),/note/);
    result=(await db.query('select * from public.set_application_stage($1,$2,$3,$4)',[a.id,a.revision,'Submitted',request.note])).rows[0];
    await assert.rejects(db.query('update public.applications set draft=$1 where id=$2',[{edited:true},a.id]),/cannot be edited/);
    await db.exec('reset role');
   } else {
    await assert.rejects(mcp(request,foreign),/Owned application/);
    await assert.rejects(mcp(request,readonly),/scope/i);
    await assert.rejects(mcp({...request,expectedRevision:a.revision+1}),/changed/);
    const saved=await mcp(request);result=saved.application;
    assert.equal(saved.confirmed,false);assert.equal(saved.source,'user-reported-through-agent');
    assert.deepEqual(await mcp(request),saved,'Identical replay returns original result');
    await assert.rejects(mcp({...request,note:'Changed retry'}),/conflict/);
   }
   assert.equal(result.status,'Submitted');assert.equal(result.blocker,null);assert.equal(result.revision,a.revision);
   assert.deepEqual(result.draft,a.draft);assert.ok(result.submitted_at);assert.equal(result.receipt,null);
   assert.equal((await db.query('select count(*)::int n from public.submission_attempts where application_id=$1',[a.id])).rows[0].n,0);
   assert.equal((await db.query('select count(*)::int n from public.approvals where application_id=$1',[a.id])).rows[0].n,0);
   assert.equal((await db.query('select count(*)::int n from public.action_inbox where application_id=$1 and resolved_at is null',[a.id])).rows[0].n,0);
   assert.equal((await db.query("select count(*)::int n from public.activity_events where application_id=$1 and kind='preparation_blocker_cleared'",[a.id])).rows[0].n,1);
   assert.equal((await db.query("select count(*)::int n from public.activity_events where application_id=$1 and kind='draft_updated'",[a.id])).rows[0].n,0);
  }
 } finally {await db.close();}
});

test('progress cleanup preserves active/uncertain attempts and retains human recovery and draft locks',async()=>{
 const db=await createTestDatabase();
 try {
  await connections(db);const mcp=mcpClient(db);
  for(const state of ['claimed','started','uncertain']) {
   const a=await app(db,'guard-'+state,'Verify submission before retrying.');const t=await attempt(db,a,state);
   const request={applicationId:a.id,expectedRevision:a.revision,status:'Submitted',note:'Reported progress',eventKey:'guard-'+state};
   await assert.rejects(mcp(request),/human recovery/);
   // The existing human writer may record progress, but unresolved evidence and
   // retry protection must survive. No automatic blocker cleanup in this case.
   await db.query("select set_config('test.uid',$1,false)",[owner]);await db.exec('set role authenticated');
   const saved=(await db.query('select * from public.set_application_stage($1,$2,$3,$4)',[a.id,a.revision,'Submitted','Checked employer portal'])).rows[0];
   assert.equal(saved.blocker,a.blocker);assert.equal(saved.receipt,null);
   await assert.rejects(db.query('update public.applications set blocker=null where id=$1',[a.id]),/in progress|cannot be edited/);
   await db.exec('reset role');
   assert.deepEqual((await db.query('select * from public.submission_attempts where id=$1',[t.id])).rows[0],t);
  }
 }finally{await db.close();}
});

test('migration reconciles legacy tracked blockers without changing status, draft, revision, timestamp or evidence',async()=>{
 let legacy;
 const db=await createTestDatabase({beforeMigration:async(db,name)=>{
  if(name!==migration)return;
  legacy=[];
  for(const status of ['Submitted','Interview','Offer','Rejected','Withdrawn']) {
   const a=await app(db,'legacy-'+status);await db.query("update public.applications set status=$2,submitted_at='2026-10-30T12:00:00Z',receipt=$3 where id=$1",[a.id,status,{source:'fictional-existing-evidence'}]);
   legacy.push((await db.query('select * from public.applications where id=$1',[a.id])).rows[0]);
  }
  const a=await app(db,'legacy-uncertain','Submission outcome uncertain');await attempt(db,a,'uncertain');
  await db.query("update public.applications set status='Submitted' where id=$1",[a.id]);
 }});
 try {
  for(const before of legacy) {
   const after=(await db.query('select * from public.applications where id=$1',[before.id])).rows[0];
   assert.ok(before.blocker);assert.equal(after.blocker,null);
   for(const key of Object.keys(before).filter(k=>!['blocker','updated_at'].includes(k)))assert.deepEqual(after[key],before[key],key);
  }
  const uncertain=(await db.query("select * from public.applications where job_id='legacy-uncertain'")).rows[0];
  assert.equal(uncertain.blocker,'Submission outcome uncertain');
  assert.equal((await db.query("select count(*)::int n from public.action_inbox where application_id=$1 and kind='check_submission' and resolved_at is null",[uncertain.id])).rows[0].n,1);
 }finally{await db.close();}
});


test('detached demo reports submission after a preparation failure, retains history and resets independently',async()=>{
 const {demoFixtures,createMemoryStore,createDemoServices}=await import('../next-app/lib/demo.mjs');
 const fixture=demoFixtures('2026-11-08'),store=createMemoryStore(fixture.state),api=createDemoServices(store);
 const before=store.get('workflow.applications.demo-stripe');assert.equal(before.status,'Blocked');assert.ok(before.blocker);
 const request={applicationId:before.backendId,expectedRevision:before.backendRevision||0,status:'Submitted',note:'Fictional user reported completing the form.',eventKey:'demo-reported-submission'};
 const result=await api.recordApplicationProgress(request),after=result.application;
 assert.equal(after.status,'Submitted');assert.equal(after.blocker,null);assert.equal(result.confirmed,false);
 assert.deepEqual(after.executionJob,before.executionJob);assert.deepEqual(after.questions,before.questions);assert.equal(after.resumeId,before.resumeId);
 assert.deepEqual(await api.recordApplicationProgress(request),result);
 await assert.rejects(api.recordApplicationProgress({...request,note:'Changed retry'}),/conflict/);
 const uncertain=store.get('workflow.applications.demo-uncertain');
 await assert.rejects(api.recordApplicationProgress({...request,applicationId:uncertain.backendId,expectedRevision:uncertain.backendRevision||0,eventKey:'demo-uncertain'}),/human recovery/);
 const reset=createMemoryStore(demoFixtures('2026-11-08').state);assert.equal(reset.get('workflow.applications.demo-stripe').status,'Blocked');
 assert.equal(fixture.state.workflow.applications['demo-stripe'].status,'Blocked');
});
