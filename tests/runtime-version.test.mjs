import {test} from 'node:test';import assert from 'node:assert/strict';
import {stampRuntimeBundle,VERSION_PATH} from '../scripts/runtime-version.mjs';
import {createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
test('deployment stamps exact source identity and refuses mismatched source',()=>{
 const sourceCommit='a'.repeat(40),files=[{name:'entry.ts',content:'source'}];
 const result=stampRuntimeBundle({files,sourceCommit,readSource:()=> 'source'});
 assert.equal(JSON.parse(result.find(f=>f.name===VERSION_PATH).content).sourceCommit,sourceCommit);
 assert.throws(()=>stampRuntimeBundle({files,sourceCommit,readSource:()=> 'different'}),/mismatch/);
});
test('MCP initializes only after credential verification and unstamped builds identify as development',async()=>{
 const request=()=>new Request('https://local.test',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+'a'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26'}})});
 const denied=createHandler(async()=>({status:401}));assert.equal((await denied(request())).status,401);
 const allowed=createHandler(async()=>({status:200,data:{scopes:[]}}));
 assert.equal((await(await allowed(request())).json()).result.serverInfo.version,'development');
});
