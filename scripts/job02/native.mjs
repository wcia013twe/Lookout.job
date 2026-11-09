import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {read,hash,actorAnswer} from './core.mjs';
export function account(root){const a=read(root+'/account.private.json');if(a.apiUrl!=='http://127.0.0.1:54321'||a.mcpUrl!=='http://127.0.0.1:8080/mcp'||!/^job02-pilot-[a-f0-9-]+@example.test$/.test(a.email)||a.status!=='verified')throw Error('Dedicated verified local JOB02 account required');return a;}
export function scrub(x){if(Array.isArray(x))return x.map(scrub);if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).filter(([k])=>!/token|password|secret|signed.?url|download.?url/i.test(k)).map(([k,v])=>[k,scrub(v)]));if(typeof x==='string'&&/jb_agent_|[?&]token=/.test(x))return '[REDACTED]';return x;}
export async function mcp(a,name,args={}){
 const r=await fetch(a.mcpUrl,{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream',authorization:'Bearer '+a.token},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}}),signal:AbortSignal.timeout(30000)});
 let body=await r.text();if(body.trimStart().startsWith('data:'))body=body.split('\n').find(l=>l.startsWith('data: {')).slice(6);const v=JSON.parse(body);
 if(!r.ok||v.error||v.result?.isError)throw Error('Native operation failed: '+name);
 const data=v.result.structuredContent??JSON.parse(v.result.content.find(c=>c.type==='text').text);return data.data??data;
}
export async function confirm(root,ids){
 const a=account(root),calls=[];
 for(const [name,args]of [['read_personal_context',{}],['read_action_board',{}],...ids.map(applicationId=>['read_application_record',{applicationId}])])calls.push({name,arguments:args,result:scrub(await mcp(a,name,args))});
 return {status:'confirmed',semanticMatchReviewed:false,accountUserId:a.userId,capturedAt:new Date().toISOString(),purpose:'read-only grader confirmation; excluded from participant metrics',calls};
}
export function responsePayload(item,targetId,actor){
 if(item.kind!=='resolve_blocker'||!item.applicationId||!item.key||!Array.isArray(item.questions))return null;
 const resolved=[];const answers=item.questions.map(q=>{
  if(typeof q.answer==='string'&&q.answer.trim()&&!/^ask me$/i.test(q.answer.trim()))return q.answer;
  const result=actorAnswer(actor,targetId,q.question);resolved.push({fieldId:q.fieldId,question:q.question,...result});
  return result.factId?result.answer:(q.answer||'');
 });
 if(!resolved.some(r=>r.factId))return null;
 const complete=item.questions.every((q,i)=>q.required===false||q.fieldType==='hidden'||answers[i].trim()&& !/^ask me$/i.test(answers[i].trim()));
 return {payload:{key:item.key,response:complete?'accept':'save',eventKey:randomUUID(),input:{answers,...(complete?{confirmed:true}:{})}},resolved,eventExpected:complete};
}
export const matchesSavedResponse=(event,payload)=>event.savedResponse?.eventKey===payload.eventKey&&event.savedResponse?.key===payload.key&&isDeepStrictEqual(event.savedResponse,payload);
export async function respond(root,actor,spec){
 const a=account(root);if(!a.anonKey||!a.password)throw Error('Separate controlled-human sign-in unavailable');
 const client=createClient(a.apiUrl,a.anonKey,{auth:{persistSession:false,autoRefreshToken:false}}),login=await client.auth.signInWithPassword({email:a.email,password:a.password});
 if(login.error||login.data.user?.id!==a.userId)throw Error('Controlled-human owner authentication failed');
 try{
  const before=await mcp(a,'read_action_board'),records=[];
  for(const item of before.items||[]){
   if(!item.applicationId||!item.questions?.length)continue;
   const current=await mcp(a,'read_application_record',{applicationId:item.applicationId});
   const application=current.application??current;
   const jobResult=await client.from('jobs').select('canonical_url').eq('id',application.job_id).single();if(jobResult.error)throw Error('Owned application job lookup failed');
   const url=jobResult.data.canonical_url;
   const target=spec.targets.find(t=>t.url===url);if(!target||target.kind==='workday')continue;
   const result=responsePayload(item,target.id,actor);if(!result)continue;
   const r=await client.rpc('respond_action_board',{payload:result.payload});if(r.error)throw Error('Authenticated-human response rejected: '+r.error.code);
   records.push({applicationId:item.applicationId,targetId:target.id,sourceKey:item.key,sourceVersion:item.version,...result,result:scrub(r.data)});
  }
  const after=await mcp(a,'read_action_board'),events=await mcp(a,'read_muse_changes',{limit:50});
  const listed=events.items??events.events??events.changes??[];
  for(const record of records){const event=listed.find(e=>matchesSavedResponse(e,record.payload));if(record.eventExpected&&!event)throw Error('Exact saved human response event missing');}
  return {status:'responded',synthetic:false,actorHash:hash(actor),at:new Date().toISOString(),records,before:scrub(before),after:scrub(after),events:scrub(events)};
 }finally{await client.auth.signOut();}
}
