// Opt-in model evaluation using fictional data only. No hosted account writes.
import {once} from 'node:events';
import {createTestDatabase} from '../tests/helpers/database.mjs';
import {museCandidates,museCases} from '../tests/fixtures/muse-intelligence.mjs';
import {databaseStore} from '../backend/intelligence/store.ts';
import {ingest} from '../backend/intelligence/pipeline.ts';
import {ingestionService,httpServer} from '../backend/intelligence/service.ts';
import {MUSE_TOOL,enrichForMuse} from '../backend/intelligence/muse.ts';
import {backendClient,mcpHandler} from '../backend/intelligence/mcp.ts';
if(!process.env.OPENAI_API_KEY)throw Error('OPENAI_KEY_REQUIRED');
const model=process.env.INTELLIGENCE_EVAL_MODEL||'gpt-4.1-mini';
const db=await createTestDatabase();let server,apiCalls=0;
const schema={type:'object',properties:{status:{type:'string',enum:['useful','insufficient']},excerpts:{type:'array',items:{type:'object',properties:{id:{type:'string'},quote:{type:'string'}},required:['id','quote'],additionalProperties:false}}},required:['status','excerpts'],additionalProperties:false};
try{
 const query=(s,v)=>db.query(s,v),target={kind:'account',ownerId:'11111111-1111-1111-1111-111111111111'};
 await ingest(databaseStore(query,target),undefined,museCandidates);
 server=httpServer(ingestionService({query},undefined,async()=>museCandidates,target));
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const rpc=mcpHandler(backendClient(`http://127.0.0.1:${server.address().port}`));let id=0;
 const invoke=(method,params)=>rpc({jsonrpc:'2.0',id:++id,method,params});
 await invoke('initialize');
 if(!(await invoke('tools/list')).result.tools.some(t=>t.name===MUSE_TOOL))throw Error('MUSE_TOOL_MISSING');
 const cases=[];
 for(const c of museCases){
  const calls=[];let rawDecision=null,packet;const started=performance.now();
  let delivered;
  try{delivered=await enrichForMuse(async(name,args)=>{
   const reply=await invoke('tools/call',{name,arguments:args});
   if(reply.result.isError)throw Error('MUSE_TOOL_FAILED');
   packet=JSON.parse(reply.result.content[0].text);calls.push({name,args});return packet;
  },{scope:c.args,question:c.question,mode:c.mode},async({question,packet,instructions})=>{
   apiCalls++;
   const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:AbortSignal.timeout(60000),headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model,store:false,
    instructions:instructions+' Decide whether the supplied evidence adds a concrete insight to the question. Return useful with up to five excerpts, each an exact contiguous verbatim quote from the selected report insight and its full report node ID, or insufficient with empty excerpts. Include enough context to preserve negation, uncertainty and different experiences. Do not rewrite or paraphrase quotes. Explaining that an existing rumor explicitly lacks confirmation can be useful, without asserting whether the rumor is true. Refer to reports, never counts of people. Do not hypothesize reasons for differing experiences. The host renders quotes and clickable source references; do not write a narrative answer. Never claim a frequency or typical experience from these reports.',
    input:JSON.stringify({question,evidencePacket:packet}),
    text:{format:{type:'json_schema',name:'muse_enrichment',strict:true,schema:{...schema,properties:{...schema.properties,status:{type:'string',enum:['useful','insufficient']},excerpts:{type:'array',items:{...schema.properties.excerpts.items,properties:{id:{type:'string',enum:packet.evidence.map(r=>r.id)},quote:{type:'string'}}}}}}}},max_output_tokens:1200})});
   if(!response.ok){const failure=await response.json();throw Error(`MODEL_HTTP_${response.status}: ${failure.error?.message??'unknown'}`);}
   const result=await response.json();if(result.status!=='completed')throw Error('INCOMPLETE_MODEL_RESPONSE');
   const output=result.output.flatMap(o=>o.content??[]).filter(o=>o.type==='output_text').map(o=>o.text).join('');
   if(!output)throw Error('MODEL_REFUSED_OR_EMPTY');rawDecision=JSON.parse(output);return rawDecision;
  });
  }catch(error){cases.push({id:c.id,question:c.question,mode:c.mode,calls,packet,rawDecision,pass:false,error:error.message});console.error(`${c.id}: ERROR ${error.message}`);continue;}
  const answer={...delivered,citations:delivered.citations.map(c=>c.id)};
  const ids=packet.evidence.map(r=>r.id),cited=answer.citations;
  const checks={retrieved: calls.length>0,scope:calls.every(call=>Object.entries(c.args).every(([k,v])=>call.args[k]===v)),
   expectedStatus:answer.status===c.expected,validCitations:cited.every(id=>ids.includes(id)),
   requiredCitations:c.required.every(id=>cited.includes(`report:circle_post:${id}`)),
   silentAutomatic:c.mode!=='automatic'||c.expected==='useful'||answer.message===null,
   emptyCitations:c.expected==='useful'||cited.length===0,
   usefulMessage:c.expected!=='useful'||typeof answer.message==='string'&&answer.message.length>0,
   concepts:c.terms.every(term=>(answer.message??'').toLowerCase().includes(term))};
  cases.push({id:c.id,question:c.question,mode:c.mode,calls,packet,rawDecision,answer,checks,pass:Object.values(checks).every(Boolean),latencyMs:Math.round(performance.now()-started)});
  console.error(`${c.id}: ${cases.at(-1).pass?'PASS':'FAIL'}`);
 }
 console.log(JSON.stringify({fictional:true,runAt:new Date().toISOString(),model,apiCalls,embeddingCalls:0,summary:{passed:cases.filter(c=>c.pass).length,total:cases.length},
  limits:['Controlled host adapter with a model interpreter, not a live Muse-host session. Application scope is supplied by the host rather than guessed by the model.','PGlite and synthetic authorized sources; not production latency or global permissions.','Checks verify scope, abstention, citations and key concepts; factual entailment still needs reviewing the retained responses.','Single run, no guarantee across models/prompts.'],cases},null,2));
 globalThis.museEvaluationFailed=cases.some(c=>!c.pass);
}finally{if(server)await new Promise(r=>server.close(r));await db.close();}

if(globalThis.museEvaluationFailed)process.exitCode=1;
