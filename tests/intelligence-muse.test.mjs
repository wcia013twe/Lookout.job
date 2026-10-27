import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createTestDatabase} from './helpers/database.mjs';
import {museCandidates,museCases} from './fixtures/muse-intelligence.mjs';
import {databaseStore} from '../backend/intelligence/store.ts';
import {ingest} from '../backend/intelligence/pipeline.ts';
import {ingestionService,httpServer} from '../backend/intelligence/service.ts';
import {MUSE_TOOL,MUSE_INSTRUCTIONS,presentMuseInsight,enrichForMuse} from '../backend/intelligence/muse.ts';
import {backendClient,mcpHandler} from '../backend/intelligence/mcp.ts';

test('Muse packet scopes discussions before limits, preserves evidence, abstains on empty and uses shared MCP transport',async()=>{
 const db=await createTestDatabase();let server;
 try{
  const query=(s,v)=>db.query(s,v),target={kind:'account',ownerId:'11111111-1111-1111-1111-111111111111'};
  let sources=structuredClone(museCandidates),loads=0;
  const app=structuredClone(sources[0]);app.observation.sourceType='application_update';app.observation.sourceId='private-progress';app.observation.experienceDate='2026-10-27';sources.push(app);
  await ingest(databaseStore(query,target),undefined,sources);
  const call=ingestionService({query},undefined,async()=>{loads++;return sources;},target);
  let packet=await call(MUSE_TOOL,{jobId:'bloomberg-ny-2026',stage:'OA',limit:1});
  assert.equal(packet.status,'evidence_available');assert.equal(packet.evidence.length,1);assert.equal(packet.evidence[0].sourceId,'oa-recent');
  assert.equal(packet.automaticAction,'assess_usefulness');assert.equal(packet.coverage.possiblyMore,true);
  assert.deepEqual(packet.links,[]);assert.deepEqual(packet.resources,[]);assert.equal(loads,2,'disabled expansion must not resolve linked reports');
  assert.equal(packet.evidence[0].sourceRevision,1);assert.equal(packet.evidence[0].source.path,'/circles/?circle=fictional-bloomberg&thread=oa-recent');assert.match(packet.evidence[0].uncertainty,/Fictional/);
  for(const field of ['embedding_text','post_references','owner_id','private-progress'])assert(!JSON.stringify(packet).includes(field));
  packet=await call(MUSE_TOOL,{jobId:'bloomberg-ny-2026',stage:'OA',limit:1,expandLinks:true});
  assert(packet.links.some(e=>e.kind==='references_post'));assert(packet.evidence.some(r=>r.sourceId==='oa-wait'));
  for(const c of museCases){
   const result=await call(MUSE_TOOL,c.args),ids=result.evidence.map(r=>r.sourceId);
   assert.equal(result.status,c.expected==='no_discussions'?'no_discussions':'evidence_available',c.id);
   for(const id of c.required)assert(ids.includes(id),c.id+': '+id);
   for(const id of c.forbidden??[])assert(!ids.includes(id));
   if(c.expected==='no_discussions'){assert.deepEqual(result.evidence,[]);assert.deepEqual(result.seedIds,[]);assert.equal(result.automaticAction,'suppress');}
  }
  for(const args of [{},{jobId:'x',ownerId:'anything'},{jobId:'x',limit:11},{jobId:'x',expandLinks:'yes'}])await assert.rejects(()=>call(MUSE_TOOL,args));
  server=httpServer(call);server.listen(0,'127.0.0.1');await once(server,'listening');
  const rpc=mcpHandler(backendClient(`http://127.0.0.1:${server.address().port}`));
  assert.equal((await rpc({jsonrpc:'2.0',id:1,method:'initialize'})).result.instructions,MUSE_INSTRUCTIONS);
  const args={jobId:'bloomberg-ny-2026',stage:'OA'};
  const reply=await rpc({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:MUSE_TOOL,arguments:args}});
  assert.deepEqual(JSON.parse(reply.result.content[0].text),JSON.parse(JSON.stringify(await call(MUSE_TOOL,args))));
  sources=[app];packet=await call(MUSE_TOOL,args);assert.equal(packet.status,'no_discussions');assert.deepEqual(packet.evidence,[]);
  sources=structuredClone(museCandidates);for(const c of sources)c.observation.sourceRevision++;
  assert.equal((await call(MUSE_TOOL,args)).status,'no_discussions','stale staged reports cannot enrich Muse');
  const unavailable=ingestionService({query},undefined,async()=>{throw Error('SOURCE_UNAVAILABLE');},target);
  await assert.rejects(()=>unavailable(MUSE_TOOL,args),/SOURCE_UNAVAILABLE/);
 }finally{if(server)await new Promise(r=>server.close(r));await db.close();}
});

test('Muse host adapter enforces silence and source identities independently of model wording',async()=>{
 let modelCalls=0;
 const empty={status:'no_discussions',evidence:[]};
 const result=await enrichForMuse(async()=>empty,{scope:{jobId:'empty'},mode:'automatic',question:'Any useful interview reports?'},async()=>{modelCalls++;throw Error('MUST_NOT_RUN');});
 assert.equal(modelCalls,0);assert.equal(result.message,null);assert.deepEqual(result.citations,[]);
 const packet={status:'evidence_available',evidence:[{kind:'report',id:'r1',sourceType:'circle_post',sourceId:'one',sourceRevision:2,insight:'I solved a coding task.'}]};
 const request={scope:{jobId:'test'},mode:'automatic',question:'When is my offer deadline?'};
 const insufficient=await enrichForMuse(async()=>packet,request,async()=>({status:'insufficient',message:'Unwanted noise',citations:['r1']}));
 assert.equal(insufficient.message,null);assert.deepEqual(insufficient.citations,[]);
 assert.equal(presentMuseInsight(packet,{status:'no_discussions'},'direct').status,'insufficient');
 const useful=presentMuseInsight(packet,{status:'useful',excerpts:[{id:'r1',quote:'I solved a coding task.'}]},'direct');
 assert.equal(useful.citations[0].sourceRevision,2);assert.match(useful.message,/I solved a coding task/);
 assert.throws(()=>presentMuseInsight(packet,{status:'useful',excerpts:[{id:'r1',quote:'Hiring is paused.'}]},'direct'),/UNSUPPORTED_MUSE_EXCERPT/);
 assert.throws(()=>presentMuseInsight(packet,{status:'useful',excerpts:[{id:'missing',quote:'Fabricated source.'}]},'direct'),/INVALID_MUSE_CITATION/);
 await assert.rejects(()=>enrichForMuse(async()=>{throw Error('UNAVAILABLE');},request,async()=>null),/UNAVAILABLE/);
});
