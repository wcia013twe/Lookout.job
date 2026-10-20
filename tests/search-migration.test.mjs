import {test} from 'node:test';import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
import {parseDocument} from '../lib/search/documents.mjs';
test('existing Lookout context migrates without local files or loss of custom prose/provider configuration',async()=>{
 const owner='11111111-1111-1111-1111-111111111111';
 const db=await createTestDatabase({beforeMigration:async(db,name)=>{
  if(!name.endsWith('_search_context_sweeps.sql'))return;
  await db.query('insert into public.preferences(user_id,search) values($1,$2)',[owner,{profiles:[{id:'systems',name:'Systems',active:true,version:4,filters:{Location:'US'},priorities:{Growth:'Important'},instructions:'## Team exceptions\nKeep these words exactly.\n- Tier list ID: owned-list'}],targets:[{id:'example',name:'Example',kind:'careers',address:'https://example.com/careers'}],targetsVersion:3,defaultResumeId:'keep'}]);
  await db.query("insert into public.career_toolkit_results(user_id,kind,event_key,result) values($1,'source_config','provider',$2)",[owner,{targetId:'example',provider:'greenhouse',options:{api:'https://boards-api.greenhouse.io/v1/boards/example/jobs'}}]);
 }});
 try{
 const {rows}=await db.query('select kind,content,projection,version from public.search_documents where user_id=$1',[owner]);assert.equal(rows.length,3);
 const profile=rows.find(r=>r.kind==='profile');assert.equal(profile.version,4);assert.match(profile.projection.instructions,/Keep these words exactly/);assert.deepEqual(parseDocument('profile',profile.content).projection,profile.projection);
 const portals=rows.find(r=>r.kind==='portals');assert.equal(portals.projection.tracked_companies[0].provider,'greenhouse');assert.equal(portals.projection.tracked_companies[0].api,'https://boards-api.greenhouse.io/v1/boards/example/jobs');
 const {rows:p}=await db.query('select search from public.preferences where user_id=$1',[owner]);assert.equal(p[0].search.targetsVersion,3);assert.equal(p[0].search.defaultResumeId,'keep');
 assert.equal((await db.query('select count(*)::int n from public.search_runs')).rows[0].n,0);
 }finally{await db.close();}
});
