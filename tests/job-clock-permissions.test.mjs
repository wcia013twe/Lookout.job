import test from 'node:test';import assert from 'node:assert/strict';import {createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';import {isScopeDenial,isOwnershipDenial} from '../scripts/jobs/isolated_endpoint.mjs';
test('permission evidence distinguishes protocol, scope, ownership and transport failures',async()=>{
 const handler=createHandler(async(_token,op)=>op==='credentials.verify'?{status:200,data:{scopes:['workspace:read']}}:{status:404,error:'Owned record not found'});
 const request=(name,accept)=>new Request('http://localhost/mcp',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer jb_agent_'+'a'.repeat(64),...(accept?{Accept:'application/json, text/event-stream'}:{})},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:{applicationId:'11111111-1111-4111-8111-111111111111'}}})});
 const protocol=await handler(request('save_artifact',false));assert.equal(protocol.status,406);assert.equal(isScopeDenial(await protocol.json()),false);
 const scope=await handler(request('save_artifact',true));assert.equal(isScopeDenial(await scope.json()),true);
 const foreign=await handler(request('read_application_record',true));assert.equal(isOwnershipDenial(await foreign.json()),true);
 for(const status of [400,409,500,503]){const reply={result:{isError:true,content:[{type:'text',text:JSON.stringify({status,error:'Fixture rejection'})}]}};assert.equal(isScopeDenial(reply),false);assert.equal(isOwnershipDenial(reply),false);}
});
