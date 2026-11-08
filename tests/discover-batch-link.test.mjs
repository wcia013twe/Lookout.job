import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
test('published and replayed batch links use the current Pages path without changing existing employer facts',async()=>{
 const db=await createTestDatabase();
 try {
 await db.exec(`insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values('11111111-1111-1111-1111-111111111111','fictional','batch-link-test',array['workspace:read','batches:write'],now()+interval '1 hour');`);
 const request={eventKey:'batch-link-test',label:'Fictional test',jobs:[{canonicalUrl:'https://example.com/discover-link-test',employer:{company:'Fictional',title:'Engineer',deadline:'2026-11-12'}}]};
 const call=async p=>(await db.query("select public.agent_dispatch('batch-link-test','batches.publish',$1::jsonb) as result",[JSON.stringify(p)])).rows[0].result;
 const first=await call(request);assert.equal(first.url,'https://wcia013twe.github.io/Lookout.job/?batch='+first.batch.id);assert.deepEqual(await call(request),first);
 await call({...request,eventKey:'new-observation',jobs:[{...request.jobs[0],employer:{...request.jobs[0].employer,deadline:'2026-11-13'}}]});
 assert.equal((await db.query("select employer->>'deadline' as deadline from public.jobs where canonical_url='https://example.com/discover-link-test'")).rows[0].deadline,'2026-11-12','Existing canonical employer facts are deliberately not overwritten by publishing');
 const acl=(await db.query("select has_function_privilege('anon','private.agent_dispatch_core(text,text,jsonb)','EXECUTE') as anon,has_function_privilege('authenticated','private.agent_dispatch_core(text,text,jsonb)','EXECUTE') as authenticated")).rows[0];assert.deepEqual(acl,{anon:false,authenticated:false});
 } finally {await db.close();}
});
