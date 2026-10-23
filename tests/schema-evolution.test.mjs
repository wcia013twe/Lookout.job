import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
test('schema evolution backfills existing leads without publishing private evidence',async()=>{
 const owner='11111111-1111-1111-1111-111111111111';
 const db=await createTestDatabase({beforeMigration:async(db,name)=>{
  if(!name.endsWith('_evolve_existing_data_model.sql'))return;
  await db.query("insert into public.jobs(id,canonical_url,employer) values('existing-public-job','https://example.com/existing','{}')");
  await db.query("insert into public.search_listings(user_id,identity,canonical_url,company,title,match_key) values($1,'existing-private-lead','https://example.com/existing','Example','Engineer','example-engineer'),($1,'still-private','https://example.com/private','Private lead','Engineer','private-engineer')",[owner]);
 }});
 try{
  const {rows}=await db.query('select identity,job_id from public.search_listings order by identity');
  assert.deepEqual(rows,[{identity:'existing-private-lead',job_id:'existing-public-job'},{identity:'still-private',job_id:null}]);
  assert.equal((await db.query('select count(*)::int n from public.jobs')).rows[0].n,1);
  const security=await db.query("select has_function_privilege('authenticated','private.link_search_listing_job()','execute') as listing,has_function_privilege('anon','private.link_published_job_listings()','execute') as job");
  assert.deepEqual(security.rows,[{listing:false,job:false}]);
 }finally{await db.close();}
});
