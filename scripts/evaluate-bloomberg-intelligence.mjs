// Opt-in real embeddings, fictional data, ephemeral database. No account/global writes.
import {createTestDatabase} from '../tests/helpers/database.mjs';
import {bloombergCandidates,bloombergCases} from '../tests/fixtures/bloomberg-intelligence.mjs';
import {databaseStore} from '../backend/intelligence/store.ts';
import {ingest,openAIProvider} from '../backend/intelligence/pipeline.ts';
import {ingestionService} from '../backend/intelligence/service.ts';
import {SEARCH_TOOL} from '../backend/intelligence/contract.ts';
if(!process.env.OPENAI_API_KEY)throw Error('OPENAI_API_KEY_REQUIRED');
const db=await createTestDatabase();
try{
 let apiCalls=0,embeddingMs=0,sqlMs=0;
 const raw=openAIProvider(process.env.OPENAI_API_KEY);
 const provider={model:raw.model,async embed(text){const t=performance.now();apiCalls++;try{return await raw.embed(text);}finally{embeddingMs+=performance.now()-t;}}};
 const query=async(s,v)=>{const t=performance.now();try{return await db.query(s,v);}finally{sqlMs+=performance.now()-t;}};
 const target={kind:'account',ownerId:'11111111-1111-1111-1111-111111111111'};
 const start=performance.now(),ingestion=await ingest(databaseStore(query,target),provider,bloombergCandidates);
 if(ingestion.failed)throw Error(JSON.stringify(ingestion));
 const ingestMs=performance.now()-start;
 const call=ingestionService({query},provider,async()=>bloombergCandidates,target),cases=[];
 for(const c of bloombergCases){
  const t=performance.now(),e=embeddingMs,s=sqlMs;
  const {items}=await call(SEARCH_TOOL,{query:c.query,limit:3});
  const ids=items.map(r=>r.source_id),hits=ids.filter(id=>c.relevant.includes(id));
  const forbidden=ids.filter(id=>c.exclude.includes(id));
  const pass=c.relevant.length?hits.length===c.relevant.length&&forbidden.length===0:ids.length===0;
  cases.push({...c,pass,recallAt3:c.relevant.length?hits.length/c.relevant.length:null,precisionAt3:ids.length?hits.length/ids.length:null,top1Relevant:c.relevant.length?c.relevant.includes(ids[0]):null,
   latencyMs:Math.round(performance.now()-t),embeddingMs:Math.round(embeddingMs-e),sqlMs:Math.round(sqlMs-s),forbidden,
   results:items.map(r=>({id:r.source_id,title:r.title,similarity:Number(r.similarity.toFixed(4)),experienceDate:r.experience_date,references:r.references}))});
 }
 const answerable=cases.filter(c=>c.relevant.length),latencies=cases.map(c=>c.latencyMs).sort((a,b)=>a-b);
 console.log(JSON.stringify({fictional:true,runAt:new Date().toISOString(),model:provider.model,documents:bloombergCandidates.length,limit:3,apiCalls,ingestMs:Math.round(ingestMs),
  summary:{passed:cases.filter(c=>c.pass).length,total:cases.length,top1Rate:answerable.filter(c=>c.top1Relevant).length/answerable.length,meanRecallAt3:answerable.reduce((s,c)=>s+c.recallAt3,0)/answerable.length,meanPrecisionAt3:answerable.reduce((s,c)=>s+(c.precisionAt3??0),0)/answerable.length,medianLatencyMs:latencies[Math.floor(latencies.length/2)],p95LatencyMs:latencies[Math.ceil(latencies.length*.95)-1]},
  limits:['Single sequential run; not a load test.','PGlite in-memory SQL timing, not production PostgreSQL latency.','Pre-authorized synthetic reports bypass actual source loading and sharing.','Reply is injected as a report: existing account loader excludes replies; discussion navigation is not implemented.','Retrieval only: no synthesis, factual verification or automatic Muse trigger.'],cases},null,2));
 // Successful benchmark execution is distinct from relevance passing; inspect summary/cases.
}finally{await db.close();}
