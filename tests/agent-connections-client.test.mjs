import {test} from 'node:test';
import assert from 'node:assert/strict';
import {invokeConnection,connectionScopes} from '../lib/agent-connections.mjs';
import {createDemoServices, createDemoWorkspace} from '../next-app/lib/muse-demo-fixtures.mjs';
import {createMemoryStore} from '../next-app/lib/demo.mjs';
function client(result, {sessionOwner='owner', afterInvoke=()=>{}}={}) {
  return {auth:{getSession:async()=>({data:{session:{user:{id:sessionOwner},access_token:'fictional-session'}},error:null})},functions:{invoke:async(name,input)=>{assert.equal(name,'agent-gateway');assert.equal(input.headers.Authorization,'Bearer fictional-session');afterInvoke();return result;}}};
}
test('access choices grant their described permissions without application authority leaking into context access',()=>{
  assert.deepEqual(connectionScopes('read',['profile:write']),['workspace:read']);
  const context=connectionScopes('context');assert(context.includes('profile:write'));assert(context.includes('preferences:write'));assert(!context.includes('drafts:write'));assert(!context.includes('batches:write'));assert(!context.includes('tracking:write'));
  const work=connectionScopes('work',['preferences:write']);assert(work.includes('drafts:write'));assert(work.includes('batches:write'));assert(work.includes('tracking:write'));assert.equal(work.length,new Set(work).size);
  assert.throws(()=>connectionScopes('admin'),/Choose an access/);
});
test('connection client preserves issue token and revoke response shapes',async()=>{
  for (const [operation,data] of [['connections.issue',{connection:{id:'fixture'},token:'demo-only'}],['connections.revoke',{data:{id:'fixture',revoked_at:'2026-10-20'}}]])
    assert.deepEqual(await invokeConnection(client({data}),operation,{},()=> 'owner','owner'),data);
});
test('HTTP connection errors surface server text from Supabase error context',async()=>{
  const error={context:new Response(JSON.stringify({error:'Connection request rejected'}),{status:400})};
  await assert.rejects(invokeConnection(client({data:null,error}),'connections.issue',{},()=> 'owner','owner'),/Connection request rejected/);
  await assert.rejects(invokeConnection(client({data:{error:{message:'Revoke rejected'}}}),'connections.revoke',{},()=> 'owner','owner'),/Revoke rejected/);
});
test('connection account guards reject signed out, stale sessions and late responses',async()=>{
  await assert.rejects(invokeConnection(null,'connections.list',{},()=>null,null),/Sign in/);
  await assert.rejects(invokeConnection(client({}, {sessionOwner:'other'}),'connections.list',{},()=> 'owner','owner'),/Account changed/);
  let owner='owner';await assert.rejects(invokeConnection(client({data:{token:'demo-only'}},{afterInvoke:()=>{owner='other';}}),'connections.issue',{},()=>owner,'owner'),/Account changed/);
});
test('fictional connection creation, setup access and revocation remain isolated and resettable',async()=>{
  const store=createMemoryStore(createDemoWorkspace('2026-10-20'));
  const demo=createDemoServices(store);
  const initial=await demo.connections('connections.list');assert.equal(initial.data.length,4);
  const issued=await demo.connections('connections.issue',{name:'Demo laptop',scopes:connectionScopes('work')});
  assert(issued.connection.scopes.includes('tracking:write'),'Default demo connections can import application history');
  assert.equal(issued.token,'demo_only_not_a_real_agent_token');assert(!JSON.stringify(store.get()).includes(issued.token));
  const id=issued.connection.id;
  assert.match(id,/^[a-f0-9-]{36}$/i,'Demo connections can be assigned to validated tasks');
  assert(initial.data.some(c=>c.scopes.includes('batches:write')),'A fictional publishing connection is available');
  const setup=await demo.connections('connections.profile_setup',{id,enabled:true});assert(setup.data.scopes.includes('profile:write'));
  const revoked=await demo.connections('connections.revoke',{id});assert(revoked.data.revoked_at);
  assert((await demo.connections('connections.list')).data.find(c=>c.id===id).revoked_at);
  await assert.rejects(demo.connections('connections.profile_setup',{id,enabled:true}),/Active demo/);
  assert.equal((await createDemoServices(createMemoryStore(createDemoWorkspace('2026-10-20'))).connections('connections.list')).data.length,4);
});
