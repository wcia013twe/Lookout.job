import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {once} from 'node:events';
import {PGlite} from '@electric-sql/pglite';
import {vector} from '@electric-sql/pglite/vector';
import {createCircleKnowledgeDemo} from '../lib/circle-knowledge-demo.mjs';
import {clean,redact} from '../backend/intelligence/clean.ts';
import {demoCandidates,resourceCandidates,taggedCandidates,fixtureProvider} from './fixtures/intelligence.mts';
import {circleObservation,applicationObservations} from '../backend/intelligence/sources.ts';
import {ingest,openAIProvider} from '../backend/intelligence/pipeline.ts';
import {databaseStore,localPool,lockedIngest} from '../backend/intelligence/store.ts';
import {httpServer,ingestionService} from '../backend/intelligence/service.ts';
import {backendClient,mcpHandler} from '../backend/intelligence/mcp.ts';
import {scheduleIngestion,nextFourHourDelay} from '../backend/intelligence/schedule.ts';
const fixture=()=>structuredClone(demoCandidates());
const v=()=>Array.from({length:1536},(_,i)=>i===0?1:0);
async function database(){const db=new PGlite({extensions:{vector}});await db.exec('create role anon;create role authenticated;');await db.exec(await readFile(new URL('../supabase/migrations/20261026174035_intelligence_demo_store.sql',import.meta.url),'utf8'));await db.exec(await readFile(new URL('../supabase/migrations/20261026184924_intelligence_resource_metadata.sql',import.meta.url),'utf8'));await db.exec(await readFile(new URL('../supabase/migrations/20261026191243_intelligence_post_references.sql',import.meta.url),'utf8'));return db;}
test('source adapters retain permitted observations, exact process links and unknown dates',()=>{
 const rows=fixture();assert.equal(rows.length,9);assert.equal(rows.filter(c=>c.observation.sourceType==='circle_post').length,5);
 const cleaned=rows.map(c=>clean(c.observation,'fixture',c.identities));
 const text=JSON.stringify(cleaned);
 for(const privateText of ['Alex Example','Morgan Example','Taylor Example','alex@example','private-email-id','Private subject','Private notes excluded','private-thread','Private candidate introduction'])assert(!text.includes(privateText),privateText);
 assert.equal(cleaned.find(r=>r.sourceId==='demo-milestone-002').experienceDate,null);
 assert.equal(cleaned.find(r=>r.sourceId==='demo-circle-002').experienceDate,null);
 assert.match(cleaned[0].insight,/\[person\].*\[email\].*\[phone\].*\[link\]/);
 assert.throws(()=>circleObservation({state:'draft'}),/SOURCE_NOT_PUBLISHED/);
 const application={id:'a',company:'Example',title:'Engineer',url:'https://example.com/job'};
 const contact={id:'c',company:'Example',tags:['application:other'],jobUrl:application.url,notes:JSON.stringify({format:'lookout-conversation-v1',notes:'',url:'',messages:[{id:'m',direction:'received',channel:'Email',date:'2026-10-20',body:'Wrong application'}]})};
 assert.deepEqual(applicationObservations(application,[],[contact]),[]);
});
test('cleaner rejects malformed input and redacts known names literally',()=>{
 const c=fixture()[0];for(const change of [{experienceDate:'2026-02-30'},{sourceRevision:0},{sourceId:'bad/path'},{sourceId:undefined},{provenance:'verified_by_ai'},{insight:''},{insight:'x'.repeat(16001)}])assert.throws(()=>clean({...c.observation,...change},'fixture'));
 assert.equal(redact('Dr. A+B says hi',['Dr. A+B']),'[person] says hi');
 assert.throws(()=>clean({...c.observation,insight:'alex@example.com'},'fixture'),/EMPTY_INSIGHT/);
});
test('pgvector store inserts atomically, skips exact retries, updates revisions and preserves rows on failures',async()=>{
 const db=await database();try{
 const store=databaseStore((sql,args)=>db.query(sql,args),{kind:'demo'});let calls=0;const provider={model:'fixture-vector-v1',async embed(){calls++;return v();}};
 assert.equal((await ingest(store,provider,fixture())).inserted,9);assert.equal(calls,9);
 assert.equal((await ingest(store,provider,fixture())).skipped,9);assert.equal(calls,9);
 const row=fixture()[0];row.observation.sourceRevision=2;row.observation.insight='Changed concurrency discussion';
 assert.equal((await ingest(store,provider,[row])).updated,1);
 assert.equal((await ingest(store,provider,fixture())).skipped,9);
 row.observation.insight='Different content at same revision';assert.equal((await ingest(store,provider,[row])).errors[0].code,'SOURCE_REVISION_CONFLICT');
 row.observation.sourceRevision=3;
 assert.equal((await ingest(store,{model:provider.model,async embed(){throw Error('PROVIDER_FAILED');}},[row])).failed,1);
 assert.equal((await store.list(20)).find(r=>r.source_id===row.observation.sourceId).source_revision,2);
 assert.equal((await ingest(store,{model:'broken',async embed(){return [0];}},[row])).errors[0].code,'INVALID_VECTOR');
 const listed=await store.list(20);assert.equal(listed.length,9);assert.equal(listed[0].embedding_dimensions,1536);assert(!('embedding' in listed[0]));assert(!('embedding_text' in listed[0]));
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
 const db=await database(),store=databaseStore((sql,args)=>db.query(sql,args),{kind:'demo'});
 const pool={
  query:(sql,args)=>db.query(sql,args),
  async connect(){
   return {async query(sql,args){if(sql.includes('advisory'))return {rows:[{locked:true}]};return db.query(sql,args);},release(){}};
  }
 };
 const server=httpServer(ingestionService(pool,fixtureProvider(),fixture,{kind:'demo'}));
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
 const address=server.address(),client=backendClient(`http://127.0.0.1:${address.port}`),handle=mcpHandler(client);
 const rpc=(method,params)=>handle({jsonrpc:'2.0',id:1,method,params});
 const discovery=await rpc('tools/list');assert.equal(discovery.result.tools.length,4);
 const result=await rpc('tools/call',{name:'ingest_demo_intelligence'});assert.equal(JSON.parse(result.result.content[0].text).inserted,9);
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
 let finish;const first=lockedIngest(pool,()=>new Promise(resolve=>{finish=resolve;}),{kind:'demo'});await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(await lockedIngest(pool,async()=>assert.fail('overlap'),{kind:'demo'}),{status:'already_running'});finish('done');assert.equal(await first,'done');
 await assert.rejects(()=>lockedIngest(pool,async()=>{throw Error('failed');},{kind:'demo'}));assert.equal(locked,false);assert.equal(releases,3);
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
  const call=ingestionService(pool,fixtureProvider(),async()=>{loaded++;return [source];},{kind:'demo'});
  assert.equal((await call('ingest_demo_intelligence')).inserted,1);
  const result=await call('list_demo_intelligence_reports');
  assert.equal(loaded,1);assert.equal(result.items.length,1);assert.equal(result.items[0].source_id,'injected-circle-post');assert.equal(result.items[0].company,'Injected source company');
  assert.equal((await call('ingest_demo_intelligence')).skipped,1);
  await assert.rejects(()=>call('ingest_demo_intelligence',{records:[]}),/UNKNOWN_ARGUMENT/);assert.equal(loaded,2);
 }finally{await db.close();}
});

test('Circle resource metadata survives cleaning without a company, and attachments stay aligned',()=>{
 const general=resourceCandidates()[0],r=clean(general.observation,'fixture',general.identities);
 assert.equal(r.contentKind,'resource');assert.equal(r.company,null);assert.equal(r.title,"[person]'s concurrency study guide");
 assert.deepEqual(r.resourceLinks,[{url:'https://example.com/prep/concurrency',label:'Concurrency preparation guide'},{url:'https://example.com/prep/locking',label:"[person]'s locking notes"}]);
 assert.match(r.insight,/\[person\].*\[email\].*\[phone\].*\[link\]/);assert(!r.embeddingText.includes('https://'));assert(!JSON.stringify(r).includes('Alex Example'));
 const linked=resourceCandidates()[1],report=clean(linked.observation,'fixture',linked.identities);
 assert.equal(report.company,'Cedar Systems (demo)');assert.equal(report.role,'Backend Engineer');assert.equal(report.stage,'technical');
 assert.equal(report.contexts[0].jobId,'DEMO-BACKEND-2027');assert.match(report.embeddingText,/Backend reliability reading list/);
 const multiple=circleObservation({id:'multiple-contexts',state:'published',revision:1,published_revision:1,content:{type:'resource',title:'Shared guide',body:'Compare these two processes.',provenance:'unknown',contexts:[{kind:'application',label:'A',company:'Company A',role:'Role A'},{kind:'application',label:'B',company:'Company B',stage:'onsite'}]}});
 const m=clean(multiple.observation,'fixture');assert.equal(m.company,null);assert.equal(m.contexts.length,2);assert.equal(m.role,null);assert.equal(m.stage,null);
});

test('resource cleaning rejects credential links and private attachments; link-only and long descriptions work',()=>{
 const input=resourceCandidates()[0].observation;
 for(const url of ['http://example.com/a','https://user:secret@example.com/a','https://example.com/a?token=fake','https://example.com/a?utm_source=circle&%74oken=fake','https://example.com/storage/v1/object/sign/file','https://mail.google.com/mail/u/0/','https://127.0.0.1/a','https://example.com/a?X-Amz-Credential=fake','https://example.com/a?email=alex@example.com'])assert.throws(()=>clean({...input,resourceLinks:[{url,label:'Unsafe'}]},'fixture'),/INVALID_RESOURCE_URL/);
 assert.throws(()=>clean({...input,title:null},'fixture'),/RESOURCE_TITLE_REQUIRED/);
 assert.throws(()=>clean({...input,contexts:[{label:'Private',contact:'Person'}]},'fixture'),/INVALID_CONTEXTS/);
 assert.equal(clean({...input,insight:'',resourceLinks:[{url:'https://example.com/guide',label:'Guide'}]},'fixture').insight,'');
 assert.throws(()=>clean({...input,insight:'',resourceLinks:[]},'fixture'),/EMPTY_INSIGHT/);
 assert.equal(clean({...input,insight:'x'.repeat(16000)},'fixture').insight.length,16000);
 assert.throws(()=>clean({...input,insight:'x'.repeat(16001)},'fixture'),/INVALID_TEXT/);
 assert.equal(clean({...fixture()[0].observation,company:null},'fixture').company,null);
 assert.throws(()=>clean({...fixture()[0].observation,sourceType:'application_update',company:null},'fixture'),/INVALID_TEXT/);
});

test('resource rows persist and metadata edits update only with a new source revision',async()=>{
 const db=await database();try{
  const store=databaseStore((sql,args)=>db.query(sql,args),{kind:'demo'}),provider=fixtureProvider(),candidates=resourceCandidates();
  assert.equal((await ingest(store,provider,candidates)).inserted,2);
  const rows=await store.list(20),general=rows.find(r=>r.source_id==='demo-resource-general');
  assert.equal(general.company,null);assert.equal(general.content_kind,'resource');assert.equal(general.resource_links.length,2);assert.equal(general.title,"[person]'s concurrency study guide");assert.equal(general.sharing_status,'demo_only');
  const changed=structuredClone(candidates[0]);changed.observation.resourceLinks[0].label='Updated guide label';
  assert.equal((await ingest(store,provider,[changed])).errors[0].code,'SOURCE_REVISION_CONFLICT');
  changed.observation.sourceRevision++;
  assert.equal((await ingest(store,provider,[changed])).updated,1);assert.equal((await ingest(store,provider,[changed])).skipped,1);
 }finally{await db.close();}
});

test('existing Circle demo Resources content uses the same resource adapter',()=>{
 const demo=createCircleKnowledgeDemo(),post=demo.action('knowledge.read',{circleId:'demo-circle',postId:'demo-general-resource'}).post;
 const candidate=circleObservation({id:post.id,state:post.state,revision:post.revision,published_revision:post.publishedRevision,authorName:post.author,content:post.content});
 const report=clean(candidate.observation,'fixture',candidate.identities);
 assert.equal(report.company,null);assert.equal(report.contentKind,'resource');assert.equal(report.resourceLinks.length,2);assert.match(report.title,/Concurrency/);
});

test('tagged posts retain typed pointers without resolving or copying target content',async()=>{
 const candidate=taggedCandidates()[0],report=clean(candidate.observation,'fixture',candidate.identities);
 assert.deepEqual(report.postReferences,[{circleId:'demo-circle',postId:'demo-resource-general',revision:null,label:'Concurrency study guide'}]);
 assert(!report.insight.includes('?circle='));assert(!report.embeddingText.includes('demo-resource-general'));assert.match(report.insight,/Fictional preparation discussion/);assert.match(report.insight,/@Concurrency study guide/);
 assert.equal(report.resourceLinks.length,1);assert.equal(report.contexts.length,1);
 assert(!report.insight.includes('Alex Example')); // Referenced resource body is not traversed/copied.
 const db=await database();try{
  const store=databaseStore((sql,args)=>db.query(sql,args),{kind:'demo'});assert.equal((await ingest(store,fixtureProvider(),[candidate])).inserted,1);
  const savedRows=await store.list(20);assert.equal(savedRows.length,1);const [saved]=savedRows;assert.deepEqual(saved.references.map(reference=>reference.kind),['application_context','resource','post']);
  assert.equal(saved.references[2].revision,null);assert.equal(saved.references[2].resolved,false);assert(!JSON.stringify(saved.references).includes('applicationId'));
 }finally{await db.close();}
});

test('unversioned pointers deduplicate; invalid pointers reject before persistence',()=>{
 const candidate=taggedCandidates()[0],input=candidate.observation;
 const duplicate=clean({...input,postReferences:[...input.postReferences,...input.postReferences]},'fixture');assert.equal(duplicate.postReferences.length,1);
 for(const reference of [{...input.postReferences[0],revision:0},{...input.postReferences[0],postId:'../private'},{...input.postReferences[0],body:'private target content'}])assert.throws(()=>clean({...input,postReferences:[reference]},'fixture'),/INVALID_POST_REFERENCES/);
 assert.equal(redact('See [@a post](?circle=private-circle&thread=private-post)'),'See @a post');
 const noContext=circleObservation({id:'general-discussion',state:'published',revision:1,published_revision:1,content:{type:'discussion',title:'General preparation',body:'Practice explaining tradeoffs.',provenance:'unknown'}});
 assert.equal(clean(noContext.observation,'fixture').company,null);
});

test('the existing Circle chat post mention is preserved as an unpinned reference',()=>{
 const demo=createCircleKnowledgeDemo(),post=demo.action('knowledge.read',{circleId:'demo-circle',postId:'demo-own-chat'}).post;
 const candidate=circleObservation({id:post.id,state:post.state,revision:post.revision,published_revision:post.publishedRevision,content:post.content,authorName:post.author});
 const report=clean(candidate.observation,'fixture',candidate.identities);
 assert.equal(report.company,null);assert.equal(report.postReferences[0].postId,'demo-final-round');assert.equal(report.postReferences[0].revision,null);assert(!report.embeddingText.includes('?circle='));
});
