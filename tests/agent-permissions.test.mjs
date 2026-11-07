import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {PERMISSIONS_HANDOFF_TOOL,permissionHandoff} from '../supabase/functions/agent-gateway/connection-permissions.mjs';
import {TOOLS,createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {createConnectionDemo} from '../lib/agent-connections-demo.mjs';
const id='11111111-1111-4111-8111-111111111111';
test('scope edits accept only an owned identifier and exact old/new permission sets',()=>{
 const payload={id,expectedScopes:['workspace:read'],scopes:['workspace:read','network:write']};
 assert.doesNotThrow(()=>validateRequest({operation:'connections.permissions',payload}));
 for(const patch of [{id:'bad'},{scopes:[]},{scopes:['admin:all']},{scopes:['workspace:read','workspace:read']},{expectedScopes:[]},{expiresInDays:90},{tokenHash:'hidden'},{owner_id:id}])assert.throws(()=>validateRequest({operation:'connections.permissions',payload:{...payload,...patch}}));
});
test('agents only get a scoped human handoff, never a permission writer',async()=>{
 assert(!TOOLS.some(t=>t.operation==='connections.permissions'));
 assert.equal(TOOLS.find(t=>t.name==='open_agent_permissions').scope,'workspace:read');
 for(const error of [{code:'28000'},{code:'42501'}])assert.deepEqual(await permissionHandoff(async()=>({error})),{error});
 assert.equal((await permissionHandoff(async()=>({data:{scopes:[]}}))).error.code,'42501');
 const handoff=await permissionHandoff(async()=>({data:{scopes:['workspace:read']}}));
 assert.equal(handoff.data.humanActionRequired,true);assert.match(handoff.data.url,/section=agent#agent-connections/);
 assert.throws(()=>validateRequest({operation:PERMISSIONS_HANDOFF_TOOL.operation,payload:{scopes:['network:write']}}));
 const calls=[];
 const handler=createHandler(async(_token,op)=>{calls.push(op);return {status:200,data:op==='credentials.verify'?{scopes:['workspace:read']}:handoff.data};});
 const result=await handler(new Request('https://example.com',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+'a'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'open_agent_permissions',arguments:{}}})}));
 assert.equal(result.status,200);assert(calls.includes(PERMISSIONS_HANDOFF_TOOL.operation));assert(!calls.includes('connections.permissions'));
});
test('demo permission edits preserve metadata, reject stale/revoked/expired updates and reset',async()=>{
 const data={'demo.fictional':true},store={get:key=>data[key],set:(key,value)=>{data[key]=value;}};
 const call=createConnectionDemo(store);const initial=(await call('connections.list')).data;
 const original=initial.find(c=>c.id==='demo-agent-active');
 const scopes=[...original.scopes,'network:write'];
 const changed=(await call('connections.permissions',{id:original.id,expectedScopes:original.scopes,scopes})).data;
 assert.deepEqual({...changed,scopes:original.scopes},original);
 await assert.rejects(call('connections.permissions',{id:original.id,expectedScopes:original.scopes,scopes}),/changed elsewhere/);
 for(const row of initial.filter(c=>c.revoked_at||Date.parse(c.expires_at)<Date.now()))await assert.rejects(call('connections.permissions',{id:row.id,expectedScopes:row.scopes,scopes}),/Active demo/);
 const fresh={'demo.fictional':true};assert(!(await createConnectionDemo({get:k=>fresh[k],set:(k,v)=>fresh[k]=v})('connections.list')).data.find(c=>c.id===original.id).scopes.includes('network:write'));
});
