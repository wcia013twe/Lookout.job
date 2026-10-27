import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createTestDatabase} from './helpers/database.mjs';
import {searchCandidates} from './fixtures/intelligence-search.mjs';
import {databaseStore} from '../backend/intelligence/store.ts';
import {ingest} from '../backend/intelligence/pipeline.ts';
import {ingestionService,httpServer} from '../backend/intelligence/service.ts';
import {SEARCH_TOOL} from '../backend/intelligence/contract.ts';
import {backendClient,mcpHandler} from '../backend/intelligence/mcp.ts';
const A='11111111-1111-1111-1111-111111111111',B='22222222-2222-2222-2222-222222222222';
const vector=n=>Array.from({length:1536},(_,i)=>i===n?1:0);

test('semantic search ranks current same-model owned reports and shares HTTP/MCP validation',async()=>{
 const db=await createTestDatabase();let server;
 try{
  const query=(s,v)=>db.query(s,v),target={kind:'account',ownerId:A};
  const store=databaseStore(query,target);
  let sources=structuredClone(searchCandidates),calls=0;
  const provider={model:'test-search',async embed(text){calls++;return vector(text.includes('unrelated')?2:text.includes('coding')?1:0);}};
  await ingest(store,provider,sources.slice(0,2));
  await ingest(store,undefined,[sources[2]]); // Pending is not searchable.
  await ingest(store,{...provider,model:'other-model'},[sources[3]]);
  await ingest(databaseStore(query,{kind:'account',ownerId:B}),provider,[sources[4]]);
  const call=ingestionService({query},provider,async()=>sources,target);
  let result=await call(SEARCH_TOOL,{query:'database preparation',limit:1});
  assert.equal(result.items.length,1);assert.equal(result.items[0].source_id,'search-database');
  assert.equal(result.items[0].similarity,1);assert(!('embedding' in result.items[0]));assert(!('embedding_text' in result.items[0]));
  assert.equal((await call(SEARCH_TOOL,{query:'unrelated'})).items.length,0);
  // Revision changes and withdrawal hide records before applying the limit.
  sources[0].observation.sourceRevision++;
  assert.equal((await call(SEARCH_TOOL,{query:'database preparation'})).items.length,0);
  sources=sources.filter(c=>c.observation.sourceId!=='search-coding');
  assert.equal((await call(SEARCH_TOOL,{query:'coding'})).items.length,0);
  const before=calls;
  for(const args of [{query:''},{query:'   '},{query:'x'.repeat(1001)},{query:'ok',limit:21},{query:'ok',ownerId:B},{query:'ok',mode:'invalid'}])await assert.rejects(()=>call(SEARCH_TOOL,args));
  assert.equal(calls,before);
  await assert.rejects(()=>ingestionService({query},undefined,async()=>sources,target)(SEARCH_TOOL,{query:'test'}),/EMBEDDING_PROVIDER_REQUIRED/);
  await assert.rejects(()=>ingestionService({query},{model:'test-search',async embed(){return [];}},async()=>sources,target)(SEARCH_TOOL,{query:'test'}),/INVALID_VECTOR/);
  await assert.rejects(()=>ingestionService({query},{model:'test-search',async embed(){throw Error('EMBEDDING_PROVIDER_FAILED');}},async()=>sources,target)(SEARCH_TOOL,{query:'test'}),/EMBEDDING_PROVIDER_FAILED/);
  // A source withdrawn while the embedding request is in flight must not return.
  sources=structuredClone(searchCandidates);
  const revoke={model:'test-search',async embed(){sources=[];return vector(0);}};
  assert.equal((await ingestionService({query},revoke,async()=>sources,target)(SEARCH_TOOL,{query:'test'})).items.length,0);
  sources=structuredClone(searchCandidates);
  server=httpServer(call);server.listen(0,'127.0.0.1');await once(server,'listening');
  const client=backendClient(`http://127.0.0.1:${server.address().port}`),mcp=mcpHandler(client);
  const tools=await mcp({jsonrpc:'2.0',id:1,method:'tools/list'});
  assert(tools.result.tools.some(t=>t.name===SEARCH_TOOL));
  for(const mode of ['vector','hybrid']){
   const args={query:'database preparation',limit:1,mode};
   const reply=await mcp({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:SEARCH_TOOL,arguments:args}});
   assert.deepEqual(JSON.parse(reply.result.content[0].text),JSON.parse(JSON.stringify(await call(SEARCH_TOOL,args))));
  }
  const invalid=await mcp({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:SEARCH_TOOL,arguments:{query:' '}}});
  assert.equal(invalid.result.isError,true);
 }finally{if(server)await new Promise(resolve=>server.close(resolve));await db.close();}
});

test('hybrid adds keyword-only matches while retaining owner, freshness and model boundaries',async()=>{
 const db=await createTestDatabase();
 try{
  const query=(s,v)=>db.query(s,v),target={kind:'account',ownerId:A};
  let sources=structuredClone(searchCandidates);
  const store=databaseStore(query,target),provider={model:'test-hybrid',async embed(){return vector(0);}};
  await ingest(store,provider,sources.slice(0,2));
  await ingest(store,undefined,[sources[2]]);
  await ingest(store,{...provider,model:'other'},[sources[3]]);
  await ingest(databaseStore(query,{kind:'account',ownerId:B}),provider,[sources[4]]);
  const call=ingestionService({query},{...provider,async embed(){return vector(1);}},async()=>sources,target);
  assert.equal((await call(SEARCH_TOOL,{query:'hash maps',mode:'vector'})).items.length,0);
  const result=await call(SEARCH_TOOL,{query:'hash maps',mode:'hybrid'});
  assert.equal(result.items.length,1);assert.equal(result.items[0].source_id,'search-coding');
  assert.equal(result.items[0].semantic_rank,null);assert.equal(result.items[0].keyword_rank,1);
  assert.equal(result.items[0].similarity,0);assert(result.items[0].fusion_score>0);
  assert(!('embedding' in result.items[0]));assert(!('embedding_text' in result.items[0]));
  for(const q of ['referral','replicated','behavioral','the and of','" ) | & : *'])assert.equal((await call(SEARCH_TOOL,{query:q,mode:'hybrid'})).items.length,0);
  sources[1].observation.sourceRevision++;
  assert.equal((await call(SEARCH_TOOL,{query:'hash maps',mode:'hybrid'})).items.length,0);
  sources=[];
  assert.equal((await call(SEARCH_TOOL,{query:'SQL',mode:'hybrid'})).items.length,0);
 }finally{await db.close();}
});
