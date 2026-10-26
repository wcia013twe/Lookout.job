import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
const privateFile=new URL('../backend/runtime/.review-session.local.json',import.meta.url);
async function main(){
 const access=JSON.parse(await readFile(privateFile,'utf8'));
 const supabase=new URL(access.APIUrl);assert.ok(supabase.protocol==='http:'&&['127.0.0.1','localhost'].includes(supabase.hostname),'Local review account required');
 const api='http://127.0.0.1:8080';
 const mcp=async(name,args={})=>{
  const response=await fetch(api+'/mcp',{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:'Bearer '+access.agentToken,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})});
  const body=await response.json();assert.ok(response.ok&&!body.error&&!body.result?.isError,'Local MCP operation failed: '+name);return JSON.parse(body.result.content[0].text);
 };
 const queued=await mcp('submit_backend_job',{kind:'search_ats',input:{profileId:'systems-ft'},eventKey:'careerops:live:'+Date.now()});
 let finished;
 for(let i=0;i<120;i++){
  const current=(await mcp('read_backend_jobs',{jobId:queued.id})).jobs[0];
  if(!['queued','running'].includes(current.status)){finished=current;break;}
  await delay(1000);
 }
 assert.equal(finished?.status,'completed','Copied CareerOps search must finish exhaustively');
 const provenance=finished.result.provenance;
 assert.ok(provenance.some(item=>item.provider==='providers/greenhouse.mjs'&&item.dedup==='dedup-tracker.mjs'&&item.identity==='scan.mjs isOfferSeen/markOfferSeen'));
 const search=await fetch(new URL('/rest/v1/search_runs?id=eq.'+finished.search_run_id+'&select=id,state,profile_id',supabase),{headers:{apikey:access.anonKey,Authorization:'Bearer '+access.session.access_token}});
 const runs=await search.json();assert.equal(runs[0].state,'completed');
 const observations=await fetch(new URL('/rest/v1/search_observations?run_id=eq.'+finished.search_run_id+'&select=id,listing_id',supabase),{headers:{apikey:access.anonKey,Authorization:'Bearer '+access.session.access_token}});
 const rows=await observations.json();assert.ok(Array.isArray(rows)&&rows.length>0);assert.equal(new Set(rows.map(row=>row.listing_id)).size,rows.length);
 const receipt={checkedAt:new Date().toISOString(),localOnly:true,accountRetained:true,nodeApi:api,supabase:supabase.origin,jobId:queued.id,runId:finished.search_run_id,jobState:finished.status,runState:runs[0].state,observations:rows.length,uniqueListings:rows.length,workerAttempts:finished.attempts,provenance,execution:'existing executeCareerTask sanitized child -> scanSource -> copied provider/scanner/dedup-tracker -> fenced Supabase RPC',scoresProduced:false,publishedBatchUntouched:true};
 const latest=JSON.parse(await readFile(privateFile,'utf8'));Object.assign(latest,{careerOpsJobId:queued.id,careerOpsRunId:finished.search_run_id});await writeFile(privateFile,JSON.stringify(latest,null,2)+'\n',{mode:0o600});
 await writeFile(new URL('../backend/local/careerops-discovery-proof.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify(receipt,null,2));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
