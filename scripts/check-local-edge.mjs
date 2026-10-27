import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';

// Disposable fictional accounts only. Refuse hosted endpoints before any request.
export async function checkLocalEdge({url,anonKey,serviceKey,request=fetch,log=console.log}) {
  const base=new URL(url);
  if(base.protocol!=='http:' || !['127.0.0.1','localhost','[::1]'].includes(base.hostname) || base.pathname!=='/' || base.username || base.password || base.search || base.hash) throw Error('Only a loopback local Supabase origin is allowed');
  if(!anonKey || !serviceKey)throw Error('Local anon and service-role keys required');
  const users=[];
  const send=async(path,{token=serviceKey,method='POST',body,key=anonKey}={})=>{
    const response=await request(new URL(path,base),{
      method,redirect:'error',signal:AbortSignal.timeout(30000),
      headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},
      ...(body===undefined?{}:{body:JSON.stringify(body)}),
    });
    const text=await response.text();
    let data;try{data=text ? JSON.parse(text) : null;}catch{throw Error('Non-JSON response from '+path+' (HTTP '+response.status+')');}
    return {status:response.status,data};
  };
  const gateway=(token,operation,payload={})=>send('/functions/v1/agent-gateway',{token,body:{operation,payload}});
  const mcp=(token,method,params={})=>send('/functions/v1/agent-mcp',{token,body:{jsonrpc:'2.0',id:1,method,params}});
  let failure;
  try {
    const unauth=await gateway('invalid','context.versions');
    assert.equal(unauth.status,401,'Gateway must deny missing/invalid credentials');
    for(let index=0;index<2;index++) {
      const email='local-edge-'+randomUUID()+'@example.test';
      const password=randomUUID()+'aA!9';
      const created=await send('/auth/v1/admin/users',{key:serviceKey,body:{email,password,email_confirm:true,user_metadata:{name:'Fictional local edge check'}}});
      assert.equal(created.status,200,'Local auth fixture creation failed');
      const user={id:created.data.id};users.push(user);
      const login=await send('/auth/v1/token?grant_type=password',{body:{email,password}});
      assert.equal(login.status,200,'Local auth sign-in failed');
      user.session=login.data.access_token;
      const issued=await gateway(user.session,'connections.issue',{name:'Fictional local edge check',scopes:['workspace:read'],expiresInDays:1});
      assert.equal(issued.status,200,'Human-owned gateway connection issuance failed');
      user.token=issued.data.token;user.connection=issued.data.connection;
      assert.match(user.token,/^jb_agent_[a-f0-9]{64}$/);
      assert.equal(user.connection.user_id,user.id,'Connection has wrong owner');
      const own=await gateway(user.session,'connections.list');
      assert.equal(own.status,200);
      assert.deepEqual(own.data.data.map(row=>row.id),[user.connection.id],'Connection list leaked or omitted records');
    }
    const [first,second]=users;
    const foreign=await gateway(second.session,'connections.revoke',{id:first.connection.id});
    assert.notEqual(foreign.status,200,'Foreign connection revocation must be rejected');
    const versions=await gateway(first.token,'context.versions');
    assert.equal(versions.status,200,'Gateway database dispatch failed');
    assert.ok(Number.isSafeInteger(versions.data.data.personalVersion));
    assert.ok(Number.isSafeInteger(versions.data.data.developerVersion));
    const denied=await gateway(first.token,'resumes.read',{resumeId:randomUUID()});
    assert.equal(denied.status,403,'Missing resume scope must be denied');
    const init=await mcp(first.token,'initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'local-check',version:'1'}});
    assert.equal(init.status,200,'MCP could not reach gateway');
    assert.equal(init.data.result.serverInfo.name,'job-board');
    const tools=await mcp(first.token,'tools/list');
    assert.equal(tools.status,200);
    assert.ok(tools.data.result.tools.some(tool=>tool.name==='read_personal_context'));
    assert.ok(!tools.data.result.tools.some(tool=>tool.name==='publish_batch'),'MCP exposed a tool outside credential scopes');
    const personal=await mcp(first.token,'tools/call',{name:'read_personal_context',arguments:{}});
    assert.equal(personal.status,200);
    assert.notEqual(personal.data.result.isError,true,'MCP personal context read failed');
    assert.equal(JSON.parse(personal.data.result.content[0].text).personalVersion,versions.data.data.personalVersion);
    const revoked=await gateway(first.session,'connections.revoke',{id:first.connection.id});
    assert.equal(revoked.status,200);
    assert.equal((await gateway(first.token,'context.versions')).status,401,'Revoked gateway credential accepted');
    assert.equal((await mcp(first.token,'tools/list')).status,401,'Revoked MCP credential accepted');
    log('Local Edge checks passed: real Auth sessions, gateway issuance/read/scopes/owner isolation/revocation, MCP forwarding/discovery/context/revocation.');
  } catch(error) {failure=error;}
  finally {
    for(const user of users) {
      // Delete fixtures even if assertions fail. Never print tokens or response data.
      try {
        if(user.session && user.connection)await gateway(user.session,'connections.revoke',{id:user.connection.id});
        const deleted=await send('/auth/v1/admin/users/'+user.id,{method:'DELETE',key:serviceKey});
        if(![200,204].includes(deleted.status))throw Error('Fixture account cleanup failed');
      } catch(error) {failure??=error;}
    }
  }
  if(failure)throw failure;
  log('Fictional local auth accounts and their private records removed.');
}

async function main() {
  let env=process.env;
  if(!env.SUPABASE_SERVICE_ROLE_KEY || !env.SUPABASE_ANON_KEY) {
    const {stdout}=await promisify(execFile)(process.env.SUPABASE_CLI || 'supabase',['status','-o','env'],{maxBuffer:1024*1024});
    const local=Object.fromEntries(stdout.split('\n').map(line=>line.match(/^([A-Z_]+)="(.*)"$/)).filter(Boolean).map(([,key,value])=>[key,value]));
    env={...local,...env};
  }
  await checkLocalEdge({url:env.SUPABASE_URL || env.API_URL || 'http://127.0.0.1:54321',anonKey:env.SUPABASE_ANON_KEY || env.ANON_KEY,serviceKey:env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY});
}
if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1])main().catch(error=>{console.error(error.message);process.exitCode=1;});
