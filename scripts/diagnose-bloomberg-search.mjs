// Diagnostic only: real embeddings of fictional records, no production retrieval changes.
import assert from 'node:assert/strict';
import {clean} from '../backend/intelligence/clean.ts';
import {openAIProvider,ingest} from '../backend/intelligence/pipeline.ts';
import {bloombergCandidates,bloombergCases} from '../tests/fixtures/bloomberg-intelligence.mjs';
import {createTestDatabase} from '../tests/helpers/database.mjs';
import {databaseStore} from '../backend/intelligence/store.ts';
import {ingestionService} from '../backend/intelligence/service.ts';
import {SEARCH_TOOL} from '../backend/intelligence/contract.ts';
if(!process.env.OPENAI_API_KEY)throw Error('OPENAI_API_KEY_REQUIRED');
const provider=openAIProvider(process.env.OPENAI_API_KEY),cache=new Map();let calls=0;
async function embed(text){if(!cache.has(text)){calls++;cache.set(text,await provider.embed(text));}return cache.get(text);}
const cosine=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0)/Math.sqrt(a.reduce((s,v)=>s+v*v,0)*b.reduce((s,v)=>s+v*v,0));
const reports=bloombergCandidates.map(c=>clean(c.observation,provider.model,c.identities));
const oa=['oa-recent','oa-different','oa-wait'],after=['waiting-thread','waiting-reply','next-step','rumor'];
const intents=[
 {id:'oa-format',relevant:['oa-recent','oa-different'],eligible:oa,queries:['What was the Bloomberg New Grad online assessment format like?','What tasks did people actually get in the Bloomberg New Grad OA?','How was the timed test structured for Bloomberg graduate applicants?']},
 {id:'oa-wait',relevant:['oa-wait'],eligible:oa,queries:['Who is still waiting after submitting the Bloomberg New Grad OA?','Has anyone else had no reply after the Bloomberg graduate coding test?','Where are candidates comparing delays after completing the Bloomberg assessment?']},
 {id:'technical-format',relevant:['technical','technical-alt'],eligible:['technical','technical-alt'],queries:['What did candidates actually do during the Bloomberg New Grad live technical interview?','What activities and problems were reported in Bloomberg graduate technical rounds?','What was asked while candidates were speaking with a Bloomberg technical interviewer?']},
 {id:'technical-wait',relevant:['waiting-thread','waiting-reply'],eligible:after,queries:['Where can I join Bloomberg New Grad candidates still waiting after the technical round in October 2026?','I finished the Bloomberg graduate technical interview and have no update. Is anyone else waiting now?','Find an active October 2026 discussion comparing silence after Bloomberg New Grad technical interviews.']},
 {id:'next-step',relevant:['next-step'],eligible:after,queries:['Who actually received an invitation after the Bloomberg New Grad technical interview?','Has a Bloomberg graduate candidate heard back with a next-round invite?','Find a reported next step after Bloomberg New Grad technical, rather than people still waiting.']},
 {id:'unanswerable',relevant:[],eligible:reports.filter(r=>r.company==='Bloomberg'&&r.role==='New Grad Software Engineer'&&r.experienceDate>='2026-01-01').map(r=>r.sourceId),queries:['What is the exact Bloomberg New Grad Tokyo offer acceptance deadline?','How many days does Bloomberg give Tokyo graduate hires to accept their offer?','When must a Tokyo new grad candidate sign their Bloomberg offer?']},
];
const variants={baseline:[],withoutSharedUncertainty:[],withExplicitDate:[]};
for(const r of reports){
 const texts={baseline:r.embeddingText,withoutSharedUncertainty:r.embeddingText.replace(` | ${r.uncertainty}`,''),withExplicitDate:`Experience date: ${r.experienceDate??'unknown'} | ${r.embeddingText}`};
 for(const [name,text] of Object.entries(texts))variants[name].push({id:r.sourceId,vector:await embed(text)});
}
function rank(vector,variant,eligible){return variants[variant].filter(r=>!eligible||eligible.includes(r.id)).map(r=>({id:r.id,score:cosine(vector,r.vector)})).sort((a,b)=>b.score-a.score);}
function outcome(ranking,relevant){const top=ranking.filter(r=>r.score>=.3).slice(0,3);return {top1:top[0]?.id??null,top1Relevant:relevant.length?relevant.includes(top[0]?.id):null,recallAt3:relevant.length?top.filter(r=>relevant.includes(r.id)).length/relevant.length:null,returned:top.map(r=>({id:r.id,score:+r.score.toFixed(4)}))};}
const diagnostics=[];
for(const intent of intents)for(const query of intent.queries){const v=await embed(query);diagnostics.push({intent:intent.id,query,relevant:intent.relevant,eligible:intent.eligible,baseline:outcome(rank(v,'baseline'),intent.relevant),sameContext:outcome(rank(v,'baseline',intent.eligible),intent.relevant),withoutSharedUncertainty:outcome(rank(v,'withoutSharedUncertainty'),intent.relevant),withExplicitDate:outcome(rank(v,'withExplicitDate'),intent.relevant)});}
const baselineCases=[];
for(const c of bloombergCases){const v=await embed(c.query);baselineCases.push({id:c.id,...outcome(rank(v,'baseline'),c.relevant)});}
const selfMatches=reports.filter(r=>rank(cache.get(r.embeddingText),'baseline')[0].id===r.sourceId).length;
const repeated=await provider.embed(intents[0].queries[0]);calls++;
const original=cache.get(intents[0].queries[0]);
const repeat={cosine:cosine(original,repeated),maxCoordinateDifference:Math.max(...original.map((x,i)=>Math.abs(x-repeated[i])))};
// Independently check JS ranking against the real processor + pgvector SQL path.
const db=await createTestDatabase();let sqlAgreement=0;
try{
 const target={kind:'account',ownerId:'11111111-1111-1111-1111-111111111111'},query=(s,v)=>db.query(s,v);
 const cachedProvider={model:provider.model,embed};
 assert.equal((await ingest(databaseStore(query,target),cachedProvider,bloombergCandidates)).failed,0);
 const call=ingestionService({query},cachedProvider,async()=>bloombergCandidates,target);
 for(const c of bloombergCases){const {items}=await call(SEARCH_TOOL,{query:c.query,limit:3});const expected=rank(await embed(c.query),'baseline').filter(r=>r.score>=.3).slice(0,3);assert.deepEqual(items.map(r=>r.source_id),expected.map(r=>r.id));assert(items.every((r,i)=>Math.abs(r.similarity-expected[i].score)<1e-5));sqlAgreement++;}
}finally{await db.close();}
const relevant=diagnostics.filter(d=>d.relevant.length);
const summary=Object.fromEntries(Object.keys(variants).concat('sameContext').map(name=>[name,{top1Hits:relevant.filter(d=>d[name].top1Relevant).length,total:relevant.length,meanRecallAt3:relevant.reduce((s,d)=>s+d[name].recallAt3,0)/relevant.length,unanswerableReturned:diagnostics.filter(d=>!d.relevant.length&&d[name].returned.length).length}]));
console.log(JSON.stringify({fictional:true,runAt:new Date().toISOString(),model:provider.model,apiCalls:calls,selfMatches,totalDocuments:reports.length,sqlAgreement,totalSqlCases:bloombergCases.length,repeat,summary,embeddedTextAudit:reports.map(r=>({id:r.sourceId,experienceDate:r.experienceDate,embeddingText:r.embeddingText})),baselineCases,diagnostics,limits:['Diagnostic subsets use hand-labeled context; no production filter was added.','Technical-format subset contains only two relevant records and is an easy test.','Variants evaluated on the same tiny dataset; no held-out evidence or production-readiness claim.','Embeddings recomputed rather than reused from the prior benchmark.']},null,2));
