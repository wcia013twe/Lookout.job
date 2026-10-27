// Opt-in Node benchmark. All inputs fictional; no DB/global writes or exposed endpoint.
import {readFile} from 'node:fs/promises';
import {clean} from '../backend/intelligence/clean.ts';
import {openAIProvider} from '../backend/intelligence/pipeline.ts';
import {librarySearchEvaluation} from '../backend/intelligence/library-search-evaluation.ts';
import {bloombergCandidates} from '../tests/fixtures/bloomberg-intelligence.mjs';
if(!process.env.OPENAI_API_KEY)throw Error('OPENAI_API_KEY_REQUIRED');
const prior=JSON.parse(await readFile(new URL('../docs/evaluations/bloomberg-hybrid-comparison.json',import.meta.url)));
const cases=prior.results.map(({id,group,query,relevant,exclude})=>({id,group,query,relevant,exclude}));
const provider=openAIProvider(process.env.OPENAI_API_KEY),cache=new Map();let apiCalls=0;
async function embed(text){if(!cache.has(text)){apiCalls++;cache.set(text,await provider.embed(text));}return cache.get(text);}
const scope=process.argv.includes('--company-role')?{company:'Bloomberg',role:'New Grad Software Engineer'}:undefined;
const records=[];
for(const c of bloombergCandidates){const r=clean(c.observation,provider.model,c.identities);records.push({id:r.sourceId,text:r.embeddingText,company:r.company??'',role:r.role??'',embedding:await embed(r.embeddingText)});}
const start=performance.now(),run=await librarySearchEvaluation(records),indexMs=performance.now()-start;
const modes=['bm25','vector','hybrid'],results=[],scopedResults=[];
for(const [i,c] of cases.entries()){
 const t=performance.now(),vector=await embed(c.query),embeddingMs=performance.now()-t;
 for(const currentScope of scope?[undefined,scope]:[undefined]){
 const result={...c,embeddingMs};
 for(const mode of [...modes.slice(i%3),...modes.slice(0,i%3)]){
  const t=performance.now(),hits=await run(mode,c.query,mode==='bm25'?undefined:vector,3,currentScope),searchMs=performance.now()-t;
  const matched=hits.filter(h=>c.relevant.includes(h.id));
  result[mode]={searchMs,top1Relevant:c.relevant.length?c.relevant.includes(hits[0]?.id):null,recallAt3:c.relevant.length?matched.length/c.relevant.length:null,precisionAt3:c.relevant.length&&hits.length?matched.length/hits.length:null,wrongContext:hits.filter(h=>c.exclude.includes(h.id)).map(h=>h.id),results:hits};
 }
 (currentScope?scopedResults:results).push(result);
 }
}
function summary(rows,mode){const e=rows.filter(c=>c.relevant.length);return {evidenceQueries:e.length,top1Hits:e.filter(c=>c[mode].top1Relevant).length,meanRecallAt3:e.reduce((s,c)=>s+c[mode].recallAt3,0)/e.length,meanPrecisionAt3:e.reduce((s,c)=>s+(c[mode].precisionAt3??0),0)/e.length,wrongContextResults:rows.reduce((s,c)=>s+c[mode].wrongContext.length,0),unanswerableWithRelatedResults:rows.filter(c=>!c.relevant.length&&c[mode].results.length).length,medianSearchMs:rows.map(c=>c[mode].searchMs).sort((a,b)=>a-b)[Math.floor(rows.length/2)]};}
console.log(JSON.stringify({fictional:true,runAt:new Date().toISOString(),engine:'@orama/orama@3.1.18',stopwords:'@orama/stopwords@3.1.18',model:provider.model,documents:records.length,queries:cases.length,apiCalls,indexMs,scope,scopedDocuments:scope?records.filter(r=>r.company===scope.company&&r.role===scope.role).length:undefined,scopedSummary:scope?Object.fromEntries(modes.map(m=>[m,summary(scopedResults,m)])):undefined,scopedResults:scope?scopedResults:undefined,configuration:{keyword:'Orama BM25 implementation k=1.2 b=.75 d=.5; English stemming + supplied English stopwords plus missing article a; normal token/prefix matching; threshold=1 (OR)',vector:'Orama cosine, minimum .30',hybrid:'Orama built-in normalized score fusion, text=.5 vector=.5',text:'Existing production clean().embeddingText unchanged',limit:3},summary:Object.fromEntries(['all','original','previous-paraphrases','unseen'].map(g=>[g,Object.fromEntries(modes.map(m=>[m,summary(g==='all'?results:results.filter(c=>c.group===g),m)]))])),results,limits:['All search scoring delegated to pinned Orama library, not Elasticsearch/Lucene.','All 35 questions were established before this experiment; unseen denotes the six-question group introduced in the previous benchmark, not a new holdout.','Identical cached vectors feed vector/hybrid; BM25 calls no embedding API at query time.','In-memory Node timing excludes network latency and is not a load test.','Pre-authorized synthetic corpus only; no production authorization/sync integration is claimed.','Optional --company-role adds only exact library enum filters; no stage/date filter, reranker, graph, answer generation, field tuning or parameter tuning. Both conditions retain identical full-index BM25 statistics.','Orama BM25 variant/tokenization and hybrid normalization differ from PostgreSQL FTS/RRF; a result change cannot be attributed to BM25 alone.']},null,2));
