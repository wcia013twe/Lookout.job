import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTestDatabase} from './helpers/database.mjs';
import {accountEmbeddingProvider} from '../backend/intelligence/account.ts';
import {accountSourceLoader} from '../backend/intelligence/account-sources.ts';
import {databaseStore} from '../backend/intelligence/store.ts';
import {ingest} from '../backend/intelligence/pipeline.ts';
const A='11111111-1111-1111-1111-111111111111',B='22222222-2222-2222-2222-222222222222';

test('account-backed source records clean and stage privately without fixtures or embeddings',async()=>{
 const db=await createTestDatabase();
 try{
  await db.exec("update private.knowledge_config set enabled=true; insert into public.jobs(id,canonical_url,employer) values('account-role','https://example.com/jobs/account-role','{\"company\":\"Account-backed company\",\"title\":\"Backend Engineer\"}');");
  const app=(await db.query('insert into public.applications(user_id,job_id) values($1,$2) returning id',[A,'account-role'])).rows[0].id;
  await db.query('insert into public.profiles(user_id,facts) values($1,$2::jsonb)',[A,JSON.stringify({name:'Casey Test'})]);
  const circle=(await db.query('insert into private.circles(name,owner_id) values($1,$2) returning id',['Account-source test',A])).rows[0].id;
  await db.query("insert into private.circle_members(circle_id,user_id,alias) values($1,$2,'Casey Test'),($1,$3,'Another member')",[circle,A,B]);
  async function post(owner,state,revision,published,body){
   const id=(await db.query('insert into private.knowledge_posts(circle_id,author_id,state,current_revision,published_revision) values($1,$2,$3,$4,$5) returning id',[circle,owner,state,revision,published])).rows[0].id;
   for(let r=1;r<=revision;r++)await db.query('insert into private.knowledge_revisions(post_id,revision,content) values($1,$2,$3::jsonb)',[id,r,JSON.stringify({type:'resource',title:'Database guide',body:r===published?body:'Private unshared draft',provenance:'unknown',sources:[{url:'https://example.com/database-guide',label:'Database guide'}]})]);
   return id;
  }
  const sourceId=await post(A,'published',2,1,'Casey Test found this guide useful. Contact casey@example.com.');
  await post(A,'draft',1,null,'Private draft');await post(B,'published',1,1,'Other contributor');
  await db.query("insert into public.application_milestones(user_id,application_id,event_key,kind,label,phase,source) values($1,$2,'account-test','technical_round','Reported technical round','received','{\"kind\":\"user\"}')",[A,app]);
  const notes=JSON.stringify({format:'lookout-conversation-v1',notes:'Private contact notes',url:'',messages:[{id:'provider/<received>@mail',direction:'received',channel:'Email',date:'2026-10-20',body:'Casey Test, prepare a project discussion. Morgan Contact, morgan@example.com.'}]});
  await db.query("insert into public.outreach_contacts(user_id,id,record) values($1,'contact',$2::jsonb),($3,'foreign-contact',$2::jsonb)",[A,JSON.stringify({contact:'Morgan Contact',company:'Account-backed company',tags:[`application:${app}`],notes}),B]);
  const query=(sql,args)=>db.query(sql,args),loader=accountSourceLoader(query,A),candidates=await loader();
  assert.equal(candidates.length,3);assert(candidates.some(c=>c.observation.sourceId.startsWith('communication:')));assert(candidates.some(c=>c.observation.sourceId===sourceId));
  assert(!JSON.stringify(candidates).includes('Private unshared draft'));assert(!JSON.stringify(candidates).includes('Other contributor'));
  const store=databaseStore(query,{kind:'account',ownerId:A});
  const result=await ingest(store,undefined,candidates);assert.equal(result.failed,0,JSON.stringify(result));assert.equal(result.inserted,3);assert.equal(result.pendingEmbeddings,3);assert.equal(result.failed,0);
  const saved=await store.list(20);assert.equal(saved.length,3);assert(saved.every(row=>row.sharing_status==='private_draft'&&row.embedding_status==='pending'&&row.embedding_model===null&&row.embedding_dimensions===null));
  assert(!JSON.stringify(saved).includes('casey@example.com'));assert(!JSON.stringify(saved).includes('Casey Test'));assert(!JSON.stringify(saved).includes('Morgan Contact'));assert(!JSON.stringify(saved).includes('Private contact notes'));
  const repeat=await ingest(store,undefined,await loader());assert.equal(repeat.skipped,3);assert.equal(repeat.pendingEmbeddings,3);
  const other=databaseStore(query,{kind:'account',ownerId:B});assert.equal((await other.list(20)).length,0);
  assert.equal((await ingest(other,undefined,[candidates[0]])).inserted,1);assert.equal((await store.list(20)).length,3);assert.equal((await other.list(20)).length,1);
  const vector=Array.from({length:1536},(_,i)=>i===0?1:0);
  const rejected=await ingest(store,{model:'fixture-vector-v1',async embed(){return vector;}},[candidates[0]]);assert.equal(rejected.errors[0].code,'FIXTURE_EMBEDDINGS_NOT_ALLOWED');
  const embedded=await ingest(store,{model:'test-provider',async embed(){return vector;}},[candidates[0]]);assert.equal(embedded.updated,1);assert.equal((await store.list(20)).find(row=>row.source_id===sourceId).embedding_status,'ready');
  const withoutProvider=await ingest(store,undefined,[candidates[0]]);assert.equal(withoutProvider.skipped,1);assert.equal(withoutProvider.pendingEmbeddings,0);assert.equal((await store.list(20)).find(row=>row.source_id===sourceId).embedding_model,'test-provider');
  const changed=structuredClone(candidates[0]);changed.observation.sourceRevision++;changed.observation.insight='Changed source text requires a new vector.';const pending=await ingest(store,undefined,[changed]);assert.equal(pending.updated,1);assert.equal(pending.pendingEmbeddings,1);assert.equal((await store.list(20)).find(row=>row.source_id===sourceId).embedding_status,'pending');
  await db.query('update private.circle_members set active=false where circle_id=$1 and user_id=$2',[circle,A]);assert.equal((await loader()).length,2);
  await db.exec('set role authenticated');await assert.rejects(()=>db.query('select * from private.intelligence_reports'),/permission denied/);await db.exec('reset role');
 }finally{await db.close();}
});

test('account entrypoint and source loader have no dependency on demo data or synthetic providers',async()=>{
 for(const name of ['account.ts','account-sources.ts','service.ts','store.ts','pipeline.ts']){
  const text=await readFile(new URL(`../backend/intelligence/${name}`,import.meta.url),'utf8');
  assert(!text.includes('tests/fixtures'),name);assert(!text.includes('demoCandidates'),name);assert(!text.includes('fixtureProvider'),name);
 }
 assert.throws(()=>accountSourceLoader(async()=>({rows:[]}),'not-an-owner'),/INVALID_OWNER/);
});

test('pending mode never selects a model, even when a server API key exists',()=>{
 assert.equal(accountEmbeddingProvider('pending','configured-key'),undefined);
 assert.throws(()=>accountEmbeddingProvider('fixture'),/FIXTURE_EMBEDDINGS_NOT_ALLOWED/);
 assert.throws(()=>accountEmbeddingProvider('openai'),/OPENAI_KEY_REQUIRED/);
 assert.throws(()=>accountEmbeddingProvider('unknown'),/INVALID_EMBEDDING_MODE/);
 assert.equal(accountEmbeddingProvider('openai','configured-key').model,'text-embedding-3-small');
});
