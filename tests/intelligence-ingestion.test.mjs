import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {once} from 'node:events';
import {PGlite} from '@electric-sql/pglite';
import {vector} from '@electric-sql/pglite/vector';
import {clean,redact} from '../backend/intelligence/clean.ts';
import {demoCandidates,fixtureProvider} from './fixtures/intelligence.mts';
import {circleObservation,applicationObservations} from '../backend/intelligence/sources.ts';
import {ingest,openAIProvider} from '../backend/intelligence/pipeline.ts';
import {databaseStore,localPool,lockedIngest} from '../backend/intelligence/store.ts';
import {httpServer,ingestionService} from '../backend/intelligence/service.ts';
import {backendClient,mcpHandler} from '../backend/intelligence/mcp.ts';
import {scheduleIngestion,nextFourHourDelay} from '../backend/intelligence/schedule.ts';
const fixture=()=>structuredClone(demoCandidates());
const v=()=>Array.from({length:1536},(_,i)=>i===0?1:0);
async function database(){const db=new PGlite({extensions:{vector}});await db.exec('create role anon;create role authenticated;');await db.exec(await readFile(new URL('../supabase/migrations/20261026174035_intelligence_demo_store.sql',import.meta.url),'utf8'));return db;}
test('source adapters retain permitted observations, exact process links and unknown dates',()=>{
 const rows=fixture();assert.equal(rows.length,6);assert.equal(rows.filter(c=>c.observation.sourceType==='circle_post').length,2);
 const cleaned=rows.map(c=>clean(c.observation,'fixture',c.identities));
 const text=JSON.stringify(cleaned);
 for(const privateText of ['Alex Example','Morgan Example','Taylor Example','alex@example','private-email-id','Private subject','Private notes','private-thread','Private candidate introduction'])assert(!text.includes(privateText),privateText);
 assert.equal(cleaned.find(r=>r.sourceId==='demo-milestone-002').experienceDate,null);
 assert.equal(cleaned.find(r=>r.sourceId==='demo-circle-002').experienceDate,null);
 assert.match(cleaned[0].insight,/\[person\].*\[email\].*\[phone\].*\[link\]/);
 assert.throws(()=>circleObservation({state:'draft'}),/SOURCE_NOT_PUBLISHED/);
 const application={id:'a',company:'Example',title:'Engineer',url:'https://example.com/job'};
 const contact={id:'c',company:'Example',tags:['application:other'],jobUrl:application.url,notes:JSON.stringify({format:'lookout-conversation-v1',notes:'',url:'',messages:[{id:'m',direction:'received',channel:'Email',date:'2026-10-20',body:'Wrong application'}]})};
 assert.deepEqual(applicationObservations(application,[],[contact]),[]);
});
test('cleaner rejects malformed input and redacts known names literally',()=>{
 const c=fixture()[0];for(const change of [{experienceDate:'2026-02-30'},{sourceRevision:0},{sourceId:'bad/path'},{sourceId:undefined},{provenance:'verified_by_ai'},{insight:''},{insight:'x'.repeat(4001)}])assert.throws(()=>clean({...c.observation,...change},'fixture'));
 assert.equal(redact('Dr. A+B says hi',['Dr. A+B']),'[person] says hi');
 assert.throws(()=>clean({...c.observation,insight:'alex@example.com'},'fixture'),/EMPTY_INSIGHT/);
});
test('pgvector store inserts atomically, skips exact retries, updates revisions and preserves rows on failures',async()=>{
 const db=await database();try{
 const store=databaseStore((sql,args)=>db.query(sql,args));let calls=0;const provider={model:'fixture-vector-v1',async embed(){calls++;return v();}};
 assert.equal((await ingest(store,provider,fixture())).inserted,6);assert.equal(calls,6);
 assert.equal((await ingest(store,provider,fixture())).skipped,6);assert.equal(calls,6);
 const row=fixture()[0];row.observation.sourceRevision=2;row.observation.insight='Changed concurrency discussion';
 assert.equal((await ingest(store,provider,[row])).updated,1);
 assert.equal((await ingest(store,provider,fixture())).skipped,6);
 row.observation.insight='Different content at same revision';assert.equal((await ingest(store,provider,[row])).errors[0].code,'SOURCE_REVISION_CONFLICT');
 row.observation.sourceRevision=3;
 assert.equal((await ingest(store,{model:provider.model,async embed(){throw Error('PROVIDER_FAILED');}},[row])).failed,1);
 assert.equal((await store.list(20)).find(r=>r.source_id===row.observation.sourceId).source_revision,2);
 assert.equal((await ingest(store,{model:'broken',async embed(){return [0];}},[row])).errors[0].code,'INVALID_VECTOR');
 const listed=await store.list(20);assert.equal(listed.length,6);assert.equal(listed[0].embedding_dimensions,1536);assert(!('embedding' in listed[0]));assert(!('embedding_text' in listed[0]));
 await db.exec('set role authenticated');await assert.rejects(()=>db.query('select * from intelligence_demo.intelligence_reports'),/permission denied/);await db.exec('reset role');
 const ranks=await db.query('select source_id from intelligence_demo.intelligence_reports order by embedding OPERATOR(extensions.<=>) $1::extensions.vector limit 1',[JSON.stringify(v())]);assert.equal(ranks.rows.length,1);
 }finally{await db.close();}
});
test('provider contracts keep real embeddings separate from synthetic fixtures',async()=>{
 await assert.rejects(()=>openAIProvider(undefined).embed('test'),/OPENAI_KEY_MISSING/);
 let body;const real=openAIProvider('test-key',async(url,options)=>{body=JSON.parse(options.body);return new Response(JSON.stringify({data:[{embedding:v()}]}));});
 assert.equal((await real.embed('sanitized text')).length,1536);assert.equal(body.input,'sanitized text');assert.equal(body.dimensions,1536);
 assert.equal(fixtureProvider().model,'fixture-vector-v1');
 await assert.rejects(()=>openAIProvider('test',async()=>new Response('{}',{status:429})).embed('test'),/EMBEDDING_PROVIDER_FAILED/);
});
test('MCP calls the Node HTTP backend and validates tools without SQL or raw-vector access',async()=>{
 const db=await database(),store=databaseStore((sql,args)=>db.query(sql,args));
 const pool={
  query:(sql,args)=>db.query(sql,args),
  async connect(){
   return {async query(sql,args){if(sql.includes('advisory'))return {rows:[{locked:true}]};return db.query(sql,args);},release(){}};
  }
 };
 const server=httpServer(ingestionService(pool,fixtureProvider(),fixture));
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
 const address=server.address(),client=backendClient(`http://127.0.0.1:${address.port}`),handle=mcpHandler(client);
 const rpc=(method,params)=>handle({jsonrpc:'2.0',id:1,method,params});
 const discovery=await rpc('tools/list');assert.equal(discovery.result.tools.length,2);
 const result=await rpc('tools/call',{name:'ingest_demo_intelligence'});assert.equal(JSON.parse(result.result.content[0].text).inserted,6);
 const inspected=await rpc('tools/call',{name:'list_demo_intelligence_reports',arguments:{limit:2}});assert.equal(JSON.parse(inspected.result.content[0].text).items.length,2);
 assert((await rpc('tools/call',{name:'ingest_demo_intelligence',arguments:{sql:'select 1'}})).result.isError);
 assert((await rpc('tools/call',{name:'list_demo_intelligence_reports',arguments:{limit:100}})).result.isError);
 assert.throws(()=>backendClient('https://production.example'),/LOCAL_DEMO_BACKEND_REQUIRED/);
 const malformed=await fetch(`http://127.0.0.1:${address.port}/demo/intelligence`,{method:'POST',body:'{'});assert.equal(malformed.status,400);assert.equal((await malformed.json()).error,'INVALID_REQUEST');
 const invalidLimit=await fetch(`http://127.0.0.1:${address.port}/demo/intelligence`,{method:'POST',body:JSON.stringify({operation:'list_demo_intelligence_reports',arguments:{limit:null}})});assert.equal((await invalidLimit.json()).error,'INVALID_LIMIT');
 const response=await fetch(`http://127.0.0.1:${address.port}/demo/intelligence`,{method:'POST',headers:{Origin:'https://example.com'},body:'{}'});assert.equal(response.status,400);
 }finally{await new Promise(resolve=>server.close(resolve));await db.close();}
});
test('advisory lock excludes overlapping ingestion and releases after failure',async()=>{
 let locked=false,releases=0;const pool={async connect(){return {async query(sql){if(sql.includes('try_advisory')){const available=!locked;if(available)locked=true;return {rows:[{locked:available}]};}if(sql.includes('advisory_unlock'))locked=false;return {rows:[]};},release(){releases++;}};}};
 let finish;const first=lockedIngest(pool,()=>new Promise(resolve=>{finish=resolve;}));await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(await lockedIngest(pool,async()=>assert.fail('overlap')),{status:'already_running'});finish('done');assert.equal(await first,'done');
 await assert.rejects(()=>lockedIngest(pool,async()=>{throw Error('failed');}));assert.equal(locked,false);assert.equal(releases,3);
 assert.throws(()=>localPool('postgresql://localhost/production'),/LOCAL_DEMO_DATABASE_REQUIRED/);
});
test('four-hour UTC scheduler actually fires and stops',async()=>{
 assert.equal(nextFourHourDelay(new Date('2026-10-26T03:59:59Z')),1000);assert.equal(nextFourHourDelay(new Date('2026-10-26T04:00:00Z')),14400000);
 let calls=0,report;const done=new Promise(resolve=>{report=resolve;});const stop=scheduleIngestion(async()=>({count:++calls}),report,()=>10);
 assert.deepEqual(await done,{count:1});stop();await new Promise(resolve=>setTimeout(resolve,25));assert.equal(calls,1);
});

test('service processes an injected source rather than loading built-in demo records',async()=>{
 const db=await database();
 try{
  const pool={query:(sql,args)=>db.query(sql,args),async connect(){return {async query(sql,args){if(sql.includes('advisory'))return {rows:[{locked:true}]};return db.query(sql,args);},release(){}};}};
  let loaded=0;
  const source=circleObservation({id:'injected-circle-post',state:'published',revision:2,published_revision:2,content:{company:'Injected source company',insight:'A source supplied independently of the demo dataset.',provenance:'unknown'}});
  const call=ingestionService(pool,fixtureProvider(),async()=>{loaded++;return [source];});
  assert.equal((await call('ingest_demo_intelligence')).inserted,1);
  const result=await call('list_demo_intelligence_reports');
  assert.equal(loaded,1);assert.equal(result.items.length,1);assert.equal(result.items[0].source_id,'injected-circle-post');assert.equal(result.items[0].company,'Injected source company');
  assert.equal((await call('ingest_demo_intelligence')).skipped,1);
  await assert.rejects(()=>call('ingest_demo_intelligence',{records:[]}),/UNKNOWN_ARGUMENT/);assert.equal(loaded,2);
 }finally{await db.close();}
});
