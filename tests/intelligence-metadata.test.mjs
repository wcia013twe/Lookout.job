import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createTestDatabase} from './helpers/database.mjs';
import {databaseStore} from '../backend/intelligence/store.ts';
import {ingest} from '../backend/intelligence/pipeline.ts';
import {ingestionService,httpServer} from '../backend/intelligence/service.ts';
import {METADATA_TOOL,validateMetadataArgs} from '../backend/intelligence/metadata.ts';
import {backendClient,mcpHandler} from '../backend/intelligence/mcp.ts';
import {applicationObservations} from '../backend/intelligence/sources.ts';
import {clean} from '../backend/intelligence/clean.ts';
const A='11111111-1111-1111-1111-111111111111',B='22222222-2222-2222-2222-222222222222';
const job='12345678-1234-1234-1234-123456789012';
function candidate(id,date,jobId=job,stage='OA'){
 return {identities:[],observation:{sourceType:'circle_post',sourceId:id,sourceRevision:1,company:'Bloomberg',role:'New Grad Software Engineer',stage,insight:'Fictional candidate report about the recruiting process.',experienceDate:date,provenance:'unknown',uncertainty:'Fictional report, not verified policy.',contexts:[{label:'Fictional Bloomberg posting',jobId,company:'Bloomberg',role:'New Grad Software Engineer'}]}};
}
test('metadata search scopes exact postings, stage and dates before limits, works without embeddings and shares MCP validation',async()=>{
 const db=await createTestDatabase();let server;
 try{
  const query=(s,v)=>db.query(s,v),target={kind:'account',ownerId:A};
  let sources=[candidate('old','2026-10-20'),candidate('new','2026-10-26'),candidate('unknown',null),candidate('different-job','2026-10-27','another-posting'),candidate('technical','2026-10-25',job,'technical')];
  const crossed=candidate('crossed','2026-10-27','another-posting');
  crossed.observation.company=null;crossed.observation.role=null;crossed.observation.stage=null;
  crossed.observation.contexts=[{label:'one',company:'Bloomberg',role:'Intern',jobId:'a',stage:'OA'},{label:'two',company:'Cedar',role:'New Grad Software Engineer',jobId:'b',stage:'technical'}];sources.push(crossed);
  await ingest(databaseStore(query,target),undefined,sources);
  const foreign=candidate('foreign','2026-10-28');sources.push(foreign);
  await ingest(databaseStore(query,{kind:'account',ownerId:B}),undefined,[foreign]);
  let embeddingCalls=0;
  const call=ingestionService({query},{model:'must-not-run',async embed(){embeddingCalls++;throw Error('UNEXPECTED_EMBEDDING');}},async()=>sources,target);
  const args={jobId:job,stage:'oa'};
  let result=await call(METADATA_TOOL,args);
  assert.deepEqual(result.items.map(r=>r.source_id),['new','old','unknown']);assert(result.items.every(r=>r.embedding_status==='pending'));
  assert.equal(result.items[0].contexts[0].jobId,job);assert.equal(embeddingCalls,0);
  assert.deepEqual((await call(METADATA_TOOL,{...args,limit:1})).items.map(r=>r.source_id),['new']);
  assert.deepEqual((await call(METADATA_TOOL,{...args,fromDate:'2026-10-21',toDate:'2026-10-26'})).items.map(r=>r.source_id),['new']);
  const company=await call(METADATA_TOOL,{company:' bloomberg ',role:'New   Grad Software Engineer'});
  assert.equal(company.items.length,5);assert(!company.items.some(r=>r.source_id==='crossed'));
  assert.equal((await call(METADATA_TOOL,{jobId:'missing'})).items.length,0);
  for(const bad of [{},{company:'Bloomberg'},{role:'New Grad'},{jobId:job,fromDate:'2026-02-30'},{jobId:job,fromDate:'2026-10-26',toDate:'2026-10-20'},{jobId:job,limit:51},{jobId:job,ownerId:B}])await assert.rejects(()=>call(METADATA_TOOL,bad));
  sources.find(c=>c.observation.sourceId==='new').observation.sourceRevision++;
  assert.deepEqual((await call(METADATA_TOOL,args)).items.map(r=>r.source_id),['old','unknown']);
  sources=sources.filter(c=>c.observation.sourceId!=='old');
  assert.deepEqual((await call(METADATA_TOOL,args)).items.map(r=>r.source_id),['unknown']);
  server=httpServer(call);server.listen(0,'127.0.0.1');await once(server,'listening');
  const mcp=mcpHandler(backendClient(`http://127.0.0.1:${server.address().port}`));
  const response=await mcp({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:METADATA_TOOL,arguments:args}});
  assert.deepEqual(JSON.parse(response.result.content[0].text),JSON.parse(JSON.stringify(await call(METADATA_TOOL,args))));
  assert.equal((await mcp({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:METADATA_TOOL,arguments:{company:'Bloomberg'}}})).result.isError,true);
  assert.equal(embeddingCalls,0);
 }finally{if(server)await new Promise(resolve=>server.close(resolve));await db.close();}
});
test('canonical posting IDs survive application-source cleaning without mistaking them for phone numbers',()=>{
 const candidates=applicationObservations({id:'app',jobId:job,company:'Bloomberg',title:'New Grad'},[{id:'milestone',application_id:'app',kind:'oa',phase:'received',label:'Assessment received',occurred_at:null}],[]);
 assert.equal(clean(candidates[0].observation,null,[]).contexts[0].jobId,job);
 assert.throws(()=>validateMetadataArgs({jobId:'bad id'}),/INVALID_JOB_ID/);
});
