// Fixed comparison, no tuning: same corpus, query embeddings, limit and source permissions.
import {readFile} from 'node:fs/promises';
import {createTestDatabase} from '../tests/helpers/database.mjs';
import {bloombergCandidates,bloombergCases} from '../tests/fixtures/bloomberg-intelligence.mjs';
import {openAIProvider,ingest} from '../backend/intelligence/pipeline.ts';
import {databaseStore} from '../backend/intelligence/store.ts';
import {ingestionService} from '../backend/intelligence/service.ts';
import {SEARCH_TOOL} from '../backend/intelligence/contract.ts';
if(!process.env.OPENAI_API_KEY)throw Error('OPENAI_API_KEY_REQUIRED');
const prior=JSON.parse(await readFile(new URL('../docs/evaluations/bloomberg-search-diagnostics.json',import.meta.url)));
// New questions declared before running hybrid; still synthetic, not an independent human benchmark.
const unseen=[
 {id:'new-oa',query:'Bloomberg New Grad applicants: what was on your online assessment?',relevant:['oa-recent','oa-different'],exclude:['intern','senior']},
 {id:'new-wait',query:'I submitted my Bloomberg New Grad OA last week and the portal has not changed. Are others in the same situation?',relevant:['oa-wait'],exclude:['waiting-thread','waiting-reply','old-wait']},
 {id:'new-technical',query:'For Bloomberg New Grad, what did you solve and explain during your live coding interview?',relevant:['technical','technical-alt'],exclude:['senior','intern','recruiter']},
 {id:'new-active',query:'Looking for a current 2026 Bloomberg New Grad thread to compare how long we have waited since the technical interview.',relevant:['waiting-thread','waiting-reply'],exclude:['old-wait','oa-wait']},
 {id:'new-invite',query:'Any Bloomberg New Grad candidate with a confirmed next-round invitation following the technical round?',relevant:['next-step'],exclude:['old-wait']},
 {id:'new-unknown',query:'What exact relocation reimbursement does Bloomberg offer New Grad hires in Tokyo?',relevant:[],exclude:[]},
];
const cases=[...bloombergCases.map(c=>({...c,group:'original'})),...prior.diagnostics.map((d,i)=>({id:`paraphrase-${i}`,group:'previous-paraphrases',query:d.query,relevant:d.relevant,exclude:[]})),...unseen.map(c=>({...c,group:'unseen'}))];
const cache=new Map(),networkMs=[];let apiCalls=0;
const raw=openAIProvider(process.env.OPENAI_API_KEY);
const provider={model:raw.model,async embed(text){if(!cache.has(text)){const t=performance.now();apiCalls++;cache.set(text,await raw.embed(text));networkMs.push(performance.now()-t);}return cache.get(text);}};
const db=await createTestDatabase();
try{
 const target={kind:'account',ownerId:'11111111-1111-1111-1111-111111111111'},query=(s,v)=>db.query(s,v);
 const ingestion=await ingest(databaseStore(query,target),provider,bloombergCandidates);
 if(ingestion.failed)throw Error(JSON.stringify(ingestion));
 const call=ingestionService({query},provider,async()=>bloombergCandidates,target),results=[];
 for(const [i,c] of cases.entries()){
  const t=performance.now();await provider.embed(c.query);const embeddingMs=performance.now()-t;
  const modes={};
  for(const mode of i%2?['hybrid','vector']:['vector','hybrid']){
   const start=performance.now();const response=await call(SEARCH_TOOL,{query:c.query,limit:3,mode});
   const ids=response.items.map(r=>r.source_id),hits=ids.filter(id=>c.relevant.includes(id));
   modes[mode]={serverMs:performance.now()-start,top1Relevant:c.relevant.length?c.relevant.includes(ids[0]):null,recallAt3:c.relevant.length?hits.length/c.relevant.length:null,precisionAt3:ids.length&&c.relevant.length?hits.length/ids.length:null,wrongContext:ids.filter(id=>c.exclude.includes(id)),results:response.items.map(r=>({id:r.source_id,similarity:r.similarity,semanticRank:r.semantic_rank,keywordRank:r.keyword_rank,fusionScore:r.fusion_score}))};
  }
  results.push({...c,embeddingMs,...modes});
 }
 function summarize(rows,mode){const evidence=rows.filter(c=>c.relevant.length);return {evidenceQueries:evidence.length,top1Hits:evidence.filter(c=>c[mode].top1Relevant).length,meanRecallAt3:evidence.reduce((s,c)=>s+c[mode].recallAt3,0)/evidence.length,meanPrecisionAt3:evidence.reduce((s,c)=>s+(c[mode].precisionAt3??0),0)/evidence.length,wrongContextResults:rows.reduce((s,c)=>s+c[mode].wrongContext.length,0),unanswerableQueries:rows.filter(c=>!c.relevant.length).length,unanswerableWithRelatedResults:rows.filter(c=>!c.relevant.length&&c[mode].results.length).length,medianServerMs:rows.map(c=>c[mode].serverMs).sort((a,b)=>a-b)[Math.floor(rows.length/2)]};}
 const summary=Object.fromEntries(['all','original','previous-paraphrases','unseen'].map(group=>{const rows=group==='all'?results:results.filter(c=>c.group===group);return [group,{vector:summarize(rows,'vector'),hybrid:summarize(rows,'hybrid')}];}));
 console.log(JSON.stringify({fictional:true,runAt:new Date().toISOString(),model:provider.model,documents:bloombergCandidates.length,queries:cases.length,apiCalls,configuration:{keyword:'PostgreSQL english OR lexemes, ts_rank_cd over existing embedding_text',fusion:'equal-weight RRF, k=60, top20 per branch',vectorMinimum:.3,limit:3},summary,results,limits:['No tuning on outcomes; new paraphrases declared before execution.','Same cached real vectors feed both modes; measured server time excludes embedding API latency.','PGlite synthetic evaluation, not a production load test.','Unknown-question matches are related retrieval, not asserted answers; no Muse interpretation evaluated.','No new role/stage/date filters, graph traversal or reranking.','Labels are synthetic and same-topic candidates can be partially useful beyond the binary labels.']},null,2));
}finally{await db.close();}
