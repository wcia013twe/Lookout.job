import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';

const owner='11111111-1111-1111-1111-111111111111', peer='22222222-2222-2222-2222-222222222222';
test('Circle progress requires human consent and never exposes application details',async()=>{
 const db=await createTestDatabase();let sequence=0;
 async function human(actor,operation,payload={}){await db.query("select set_config('test.uid',$1,false)",[actor]);await db.exec('set role authenticated');try{return (await db.query('select public.knowledge_action($1,$2::jsonb) result',[operation,JSON.stringify(payload)])).rows[0].result;}finally{await db.exec('reset role');}}
 const write=(actor,operation,payload)=>human(actor,operation,{eventKey:`progress-${++sequence}`,...payload});
 try{
  await db.exec('update private.knowledge_config set enabled=true');
  const {circleId}=await write(owner,'circles.create',{name:'Progress',alias:'Owner'});
  const invite=await write(owner,'circles.invite',{circleId});await write(peer,'circles.join',{token:invite.token,alias:'Peer'});
  const other=(await write(peer,'circles.create',{name:'Private',alias:'Peer'})).circleId;
  await db.query("insert into public.jobs(id,canonical_url,employer) values('secret-job','https://example.com/secret','{\"company\":\"Secret Company\"}')");
  const application=(await db.query("insert into public.applications(user_id,job_id,submitted_at) values($1,'secret-job',now()) returning id",[peer])).rows[0].id;
  await db.query("insert into public.application_milestones(user_id,application_id,event_key,kind,label,occurred_at,phase,source) values($1,$2,'round','technical_round','Secret Company',now(),'completed','{}'),($1,$2,'planned','interview','Secret Company',now(),'scheduled','{}'),($1,$2,'unknown','interview','Secret Company',null,'completed','{}')",[peer,application]);
  await db.query("insert into public.application_milestones(user_id,application_id,event_key,kind,label,occurred_at,phase,source) values($1,$2,'old','interview','Old',date_trunc('week',now() at time zone 'UTC') at time zone 'UTC' - interval '1 second','completed','{}')",[peer,application]);
  let read=await human(owner,'circles.read',{circleId});assert.equal(read.members.find(member=>member.id===peer).progress,null);
  const settings={circleId,shared:true,careerStage:'applying',expectedRevision:0,eventKey:'share-on'};
  assert.deepEqual(await human(peer,'circles.progress',settings),{revision:1});assert.deepEqual(await human(peer,'circles.progress',settings),{revision:1});
  await assert.rejects(()=>human(peer,'circles.progress',{...settings,careerStage:'exploring'}),/Idempotency key changed/);
  await assert.rejects(()=>write(peer,'circles.progress',{circleId,shared:true,careerStage:'applying',expectedRevision:0}),/changed/);
  await assert.rejects(()=>write(peer,'circles.progress',{circleId,shared:true,careerStage:'Secret Company',expectedRevision:1}),/Invalid/);
  read=await human(owner,'circles.read',{circleId});assert.deepEqual(read.members.find(member=>member.id===peer).progress,{careerStage:'applying',applications:1,interviews:1});assert(!JSON.stringify(read).includes('Secret Company'));assert(!JSON.stringify(read).includes('secret-job'));
  assert.equal((await human(peer,'circles.read',{circleId:other})).members[0].progress,null);
  const connection=(await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'reader',$2,$3,now()+interval '1 day') returning id",[peer,'f'.repeat(64),['knowledge:read','knowledge:write']])).rows[0].id;
  await assert.rejects(()=>db.query('select private.knowledge_action($1,$2,$3::jsonb,$4)',[peer,'circles.progress',JSON.stringify(settings),connection]),/Human sharing/);
  assert.throws(()=>validateRequest({operation:'circles.progress',payload:settings}));
  const agent=(await db.query('select public.agent_dispatch($1,$2,$3::jsonb) result',['f'.repeat(64),'circles.read',JSON.stringify({circleId})])).rows[0].result;assert.deepEqual(agent.members.find(member=>member.id===peer).progress,read.members.find(member=>member.id===peer).progress);
  await write(peer,'circles.progress',{circleId,shared:false,expectedRevision:1});assert.equal((await human(owner,'circles.read',{circleId})).members.find(member=>member.id===peer).progress,null);
  await assert.rejects(()=>human(peer,'circles.progress',settings),/changed/);
  await write(peer,'circles.progress',{circleId,shared:true,expectedRevision:2});await write(owner,'circles.remove',{circleId,memberId:peer});
  await assert.rejects(()=>human(peer,'circles.read',{circleId}),/unavailable/);const newInvite=await write(owner,'circles.invite',{circleId});await write(peer,'circles.join',{token:newInvite.token,alias:'Peer'});
  read=await human(owner,'circles.read',{circleId});assert.equal(read.members.find(member=>member.id===peer).progress,null);
 }finally{await db.close();}
});
