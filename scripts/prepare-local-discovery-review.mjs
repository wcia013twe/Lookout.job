import assert from 'node:assert/strict';
import {sourceTemplates} from '../lib/search/documents.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {writeFile,stat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
const exec=promisify(execFile);
const target=new URL('../backend/runtime/.review-session.local.json',import.meta.url);
async function main(){
 try{await stat(target);throw Error('Private local review session already exists; reuse it instead of overwriting.');}catch(error){if(error.code!=='ENOENT')throw error;}
 const {stdout}=await exec(process.env.SUPABASE_CLI||'/opt/homebrew/bin/supabase',['status','-o','json'],{maxBuffer:1024*1024});
 const status=JSON.parse(stdout),url=new URL(status.API_URL);
 assert.ok(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname),'Only local Supabase allowed');
 const api='http://127.0.0.1:8080';
 const call=async(path,{token=status.SERVICE_ROLE_KEY,key=status.ANON_KEY,body,method='POST'}={})=>{
  const response=await fetch(new URL(path,url),{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await response.json();assert.ok(response.ok,'Local review request failed (HTTP '+response.status+')');return data;
 };
 const email='alpha-review-'+randomUUID().slice(0,8)+'@example.test',password=randomUUID()+'aA!9';
 const user=await call('/auth/v1/admin/users',{key:status.SERVICE_ROLE_KEY,body:{email,password,email_confirm:true,user_metadata:{name:'Local alpha review',localReview:true}}});
 // Persist recovery credentials immediately. Never print or commit this file.
 const receipt={APIUrl:url.origin,anonKey:status.ANON_KEY,account:{id:user.id,email,password},profileIds:['systems-ft','systems-intern'],runIds:{},jobIds:{},label:'Local alpha review',localOnly:true};
 await writeFile(target,JSON.stringify(receipt,null,2)+'\n',{mode:0o600,flag:'wx'});
 const save=()=>writeFile(target,JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
 const session=await call('/auth/v1/token?grant_type=password',{body:{email,password}});receipt.session=session;await save();
 const gateway=async(operation,payload={},token=receipt.agentToken)=>(await call('/functions/v1/agent-gateway',{token,body:{operation,payload}}));
 const issued=await gateway('connections.issue',{name:'Local alpha review',scopes:['workspace:read','preferences:write','drafts:write','batches:write','profile:write','approvals:read','resumes:read'],expiresInDays:7},session.access_token);
 receipt.agentToken=issued.token;receipt.connectionId=issued.connection.id;await save();
 for(const [id,name,employment,narrative] of [
  ['systems-ft','Systems and AI infrastructure — full-time','Full-time','Prioritize backend, distributed systems, databases, AI infrastructure, retrieval/search/ranking, ML systems, inference and developer infrastructure roles with technically selective scope. Compare against an Oracle SWE return path.'],
  ['systems-intern','Systems and AI infrastructure — internships','Internship','Surface Summer 2027 internships in core inference, training infrastructure, ML systems, platform, kernels, compilers, scheduling and hardware utilization. Distinguish obvious versus potential trade-ups and verify team, conversion, compensation, scope and timing.'],
 ]){
  const content='---\nid: '+id+'\nname: '+name+'\nactive: true\nfilters: {Employment: '+employment+'}\npriorities: {Growth: Very important}\n---\n'+narrative+'\nNo candidate resume evidence is attached to this local review identity. Resume comparison is unavailable. Preserve unknown eligibility and compensation. Discovery remains unscored until a connected agent supplies evidence-backed recommendations.\n';
  await gateway('search.document.save',{kind:'profile',id,content,expectedVersion:0,eventKey:'review:profile:'+id});
 }
 await gateway('search.document.save',{kind:'portals',id:'shared',content:JSON.stringify({tracked_companies:sourceTemplates.filter(source=>['simplify-summer','simplify-newgrad'].includes(source.id)),search_queries:[]}),expectedVersion:0,eventKey:'review:portals'});
 const mcp=async(name,args={})=>{
  const response=await fetch(api+'/mcp',{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:'Bearer '+receipt.agentToken,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})});
  const body=await response.json();assert.ok(response.ok&&!body.error&&!body.result?.isError,'Local Node MCP request failed: '+name);
  return JSON.parse(body.result.content[0].text);
 };
 for(const profileId of receipt.profileIds){
  const queued=await mcp('submit_backend_job',{kind:'search_ats',input:{profileId},eventKey:'review:search:'+profileId});
  receipt.jobIds[profileId]=queued.id;receipt.jobId??=queued.id;await save();
  let completed;
  for(let attempt=0;attempt<90;attempt++){
   const current=(await mcp('read_backend_jobs',{jobId:queued.id})).jobs[0];
   if(!['queued','running'].includes(current.status)){completed=current;break;}
   await delay(1000);
  }
  assert.equal(completed?.status,'completed','Retained supported source must finish exhaustively');
  receipt.runIds[profileId]=completed.search_run_id;receipt.runId??=completed.search_run_id;await save();
 }
 console.log(JSON.stringify({label:receipt.label,accountId:receipt.account.id,profileIds:receipt.profileIds,runIds:receipt.runIds,jobIds:receipt.jobIds,privateSessionFile:'backend/runtime/.review-session.local.json',retained:true},null,2));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
