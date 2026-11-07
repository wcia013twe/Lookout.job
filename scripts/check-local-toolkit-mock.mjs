// Local Node MCP -> Edge -> Postgres proof. Fixtures are removed in finally.
// No retained account/connection, real interview, calendar or worker is changed.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const origin=new URL(process.env.LOOKOUT_LOCAL_API_URL||'http://127.0.0.1:8080');
assert(origin.protocol==='http:'&&['127.0.0.1','localhost'].includes(origin.hostname),'Loopback local API only');
const sql=query=>{
 try{return execFileSync('docker',['exec','-i','supabase_db_lookout-local','psql','-U','postgres','-d','postgres','-X','-A','-t','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
 catch{throw Error('Local proof SQL failed; inspect locally without logging credentials.');}
};
assert.equal(sql("select to_regprocedure('private.mock_interview_owned(uuid,text,jsonb)') is not null;"),'t','Apply local migration 20261107201448 before evaluating mock saves');
const owner=randomUUID(),session=randomUUID(),token='jb_agent_'+randomBytes(32).toString('hex');
const hash=createHash('sha256').update(token).digest('hex');
const profile='FICTIONAL_PRIVATE_INTERVIEWER_'+randomUUID();
const payload={artifact:{id:session,expectedVersion:0,title:'Fictional local mock proof',purpose:'Verify mock persistence, not a real interview',kind:'mock_interview',format:'markdown',body:'Fictional logistics only. No event or call.',weekOf:'2026-11-09',scheduledAt:'2026-11-09T15:00:00-05:00',timeZone:'America/New_York',durationMinutes:45,sessionStatus:'scheduled',sources:[],links:[]},interviewerProfile:profile};
async function call(name,args){
 const response=await fetch(new URL('/mcp',origin),{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}}),signal:AbortSignal.timeout(20000)});
 const body=await response.json();
 if(!response.ok||body.error)throw Error('Local MCP transport rejected the proof; no private response printed.');
 const text=body.result?.content?.find(block=>block.type==='text')?.text;
 const result=JSON.parse(text);
 if(body.result?.isError)throw Error(`Local mock proof rejected: status ${result.status||'unknown'}; ${typeof result.error==='string'?result.error:'operation failed'}`);
 return result;
}
let created=false;
try{
 sql(`begin; insert into auth.users(id) values('${owner}'); insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values('${owner}','Fictional local mock proof','${hash}',array['workspace:read','drafts:write'],now()+interval '10 minutes'); commit;`);created=true;
 const saved=await call('call_discovered_tool',{name:'save_mock_interview',arguments:payload});
 assert.equal(saved.artifact.id,session);assert.equal(saved.artifact.version,1);
 const replay=await call('call_discovered_tool',{name:'save_mock_interview',arguments:payload});assert.equal(replay.artifact.version,1);
 const internal=await call('call_discovered_tool',{name:'read_mock_interview',arguments:{id:session}});assert.equal(internal.interviewerProfile,profile);
 const visible=await call('call_discovered_tool',{name:'read_artifact',arguments:{id:session}});assert(!JSON.stringify(visible).includes(profile));
 assert.equal(visible.content.durationMinutes,45);assert.equal(visible.content.timeZone,'America/New_York');
 console.log('Passed: local Node MCP -> Edge -> SQL mock save/read/retry; hidden profile stays out of ordinary artifact reads.');
}finally{
 if(created){sql(`delete from auth.users where id='${owner}';`);assert.equal(sql(`select (select count(*) from auth.users where id='${owner}')+(select count(*) from public.career_artifacts where id='${session}')+(select count(*) from private.mock_interview_profiles where artifact_id='${session}')+(select count(*) from private.agent_connections where user_id='${owner}');`),'0');console.log('Fictional proof account, connection, artifact and profile removed.');}
}
