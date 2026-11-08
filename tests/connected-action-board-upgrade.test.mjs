import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
test('upgrade links only a unique confirmed date and preserves legacy tasks and session credit',async()=>{
 let unique,ambiguous,round;
 const db=await createTestDatabase({beforeMigration:async(db,name)=>{
  if(!name.endsWith('_connected_action_board.sql'))return;
  const u='11111111-1111-1111-1111-111111111111';
  for(const job of ['legacy-unique','legacy-ambiguous']){
   await db.query('insert into public.jobs(id,canonical_url,employer) values($1,$2,$3)',[job,'https://example.com/'+job,{company:'Fictional migration fixture'}]);
   const {rows:[app]}=await db.query('insert into public.applications(user_id,job_id) values($1,$2) returning id',[u,job]);
   if(job==='legacy-unique')unique=app.id;else ambiguous=app.id;
   await db.query('insert into public.preparation_plans(user_id,application_id,plan) values($1,$2,$3)',[u,app.id,{applicationId:job,deadline:{date:'2026-11-10',status:'confirmed',stage:'Unrelated display label'},tasks:[{id:'old-completed',key:'practice',title:'Existing practice',minutes:30,completed:true,completedAt:'2026-11-06T12:00:00Z'},{id:'old-partial',title:'Partial work',minutes:30,completed:false}]}]);
   await db.query('insert into public.preparation_sessions(id,user_id,minutes,targets) values(gen_random_uuid(),$1,15,$2)',[u,[{applicationId:app.id,taskId:'old-partial',expectedVersion:1}]]);
   for(let i=0;i<(job==='legacy-unique'?1:2);i++){
    const {rows:[m]}=await db.query("insert into public.application_milestones(user_id,application_id,event_key,kind,label,phase,occurred_at,source) values($1,$2,$3,'interview','Same label','scheduled','2026-11-10T17:00:00Z',$4) returning id",[u,app.id,job+i,{kind:'user',timestampConfirmed:true}]);
    if(job==='legacy-unique')round=m.id;
   }
  }
 }});
 try{
  const {rows:[a]}=await db.query('select plan from public.preparation_plans where application_id=$1',[unique]);
  assert.equal(a.plan.tasks.length,2);assert(a.plan.tasks.every(t=>t.roundId===round));assert.equal(a.plan.tasks[0].completed,true);assert.equal(a.plan.tasks[0].completedAt,'2026-11-06T12:00:00Z');
  const {rows:[b]}=await db.query('select plan from public.preparation_plans where application_id=$1',[ambiguous]);
  assert(b.plan.tasks.filter(t=>t.id.startsWith('old-')).every(t=>!t.roundId));
  assert.equal(new Set(b.plan.tasks.map(t=>t.roundId).filter(Boolean)).size,2);
  const {rows}=await db.query('select minutes,targets from public.preparation_sessions order by id');
  assert.equal(rows.length,2);assert(rows.every(r=>r.minutes===15&&r.targets[0].taskId==='old-partial'));
 }finally{await db.close();}
});
