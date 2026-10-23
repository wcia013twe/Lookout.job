import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
test('assessment migration preserves historical sparse and malformed legacy research without synthesizing scores',async()=>{
 let seeded=false;
 const db=await createTestDatabase({beforeMigration:async(db,name)=>{
  if(!name.endsWith('_dynamic_job_assessments.sql'))return;
  seeded=true;
  await db.exec(`insert into public.jobs(id,canonical_url,employer) values('legacy-research','https://example.com/legacy-research','{}');
   insert into public.job_batches(id,user_id,label,batch_date,source_event_id) values('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','Historical','2026-10-20','legacy-research');
   insert into public.batch_items(user_id,batch_id,job_id,position,recommendation) values('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333','legacy-research',0,'{"whyItFits":"Original research","matchAssessment":{"percent":900}}');`);
 }});
 try {
  assert.equal(seeded,true);
  const row=(await db.query("select recommendation from public.batch_items where job_id='legacy-research'")).rows[0];
  assert.deepEqual(row.recommendation,{whyItFits:'Original research',matchAssessment:{percent:900}});
 }finally{await db.close();}
});
