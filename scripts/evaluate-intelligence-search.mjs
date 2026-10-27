// Opt-in live API evaluation; uses an ephemeral database and fictional content only.
import assert from 'node:assert/strict';
import {createTestDatabase} from '../tests/helpers/database.mjs';
import {searchCandidates,searchCases} from '../tests/fixtures/intelligence-search.mjs';
import {databaseStore} from '../backend/intelligence/store.ts';
import {ingest,openAIProvider} from '../backend/intelligence/pipeline.ts';
import {ingestionService} from '../backend/intelligence/service.ts';
import {SEARCH_TOOL} from '../backend/intelligence/contract.ts';
if(!process.env.OPENAI_API_KEY)throw Error('OPENAI_API_KEY_REQUIRED');
const db=await createTestDatabase();
try{
 const target={kind:'account',ownerId:'11111111-1111-1111-1111-111111111111'};
 const query=(s,v)=>db.query(s,v),provider=openAIProvider(process.env.OPENAI_API_KEY);
 const result=await ingest(databaseStore(query,target),provider,searchCandidates);
 assert.equal(result.failed,0,JSON.stringify(result));
 const call=ingestionService({query},provider,async()=>searchCandidates,target);
 let passed=0;
 for(const c of searchCases){
  const {items}=await call(SEARCH_TOOL,{query:c.query,limit:3});
  const ok=c.expected?items[0]?.source_id===c.expected:items.length===0;
  if(ok)passed++;
  console.log(JSON.stringify({query:c.query,expected:c.expected,pass:ok,results:items.map(r=>({source:r.source_id,similarity:Number(r.similarity.toFixed(3))}))}));
 }
 console.log(JSON.stringify({model:provider.model,passed,total:searchCases.length}));
 assert.equal(passed,searchCases.length,'Search-quality evaluation failed');
}finally{await db.close();}
