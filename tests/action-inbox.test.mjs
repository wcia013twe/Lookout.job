import test from 'node:test';
import agentContract from '../supabase/functions/agent-gateway/instructions.json' with {type:'json'};
import assert from 'node:assert/strict';
import {pendingActions,nextActionTime} from '../lib/action-inbox.mjs';
import {subscribeWorkspaceChanges} from '../lib/workspace-subscription.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
test('inbox exposes only due unresolved actions and schedules one next deadline',()=>{
 const items=[{id:'a',created_at:'2026-01-01',available_at:'2026-01-01T00:00:00Z'}, {id:'b',created_at:'2026-01-02',available_at:'2026-01-03T00:00:00Z'}, {id:'c',available_at:'2026-01-01',resolved_at:'2026-01-02'}];
 const now=Date.parse('2026-01-02T00:00:00Z');
 assert.deepEqual(pendingActions(items,now).map(i=>i.id),['a']);
 assert.equal(nextActionTime(items,now),Date.parse('2026-01-03T00:00:00Z'));
 assert.deepEqual(pendingActions(items,Date.parse('2026-01-03T00:00:00Z')).map(i=>i.id),['a','b']);
 assert.equal(nextActionTime([],now),null);
});
test('notifications reconcile on reconnect, filter owners and stop after cleanup',()=>{
 let event,status,removed=0,refreshes=0,errors=0;
 const channel={on(type,filter,fn){assert.equal(type,'postgres_changes');assert.deepEqual(filter,{event:'*',schema:'public',table:'workspace_changes',filter:'user_id=eq.owner'});event=fn;return this;},subscribe(fn){status=fn;return this;}};
 const cleanup=subscribeWorkspaceChanges({channel:()=>channel,removeChannel:c=>{assert.equal(c,channel);removed++;}},'owner',()=>refreshes++,()=>errors++);
 status('SUBSCRIBED');event();status('CHANNEL_ERROR');status('SUBSCRIBED');
 assert.equal(refreshes,3);assert.equal(errors,1);
 cleanup();event();status('SUBSCRIBED');assert.equal(refreshes,3);assert.equal(removed,1);
});
test('MCP inbox arguments cannot supply identity, approval or clear operations',()=>{
 assert.doesNotThrow(()=>validateRequest({operation:'applications.inbox.read',payload:{state:'all',offset:100}}));
 for(const payload of [{userId:'foreign'},{approved:true},{clear:true},{offset:-1},{offset:100001},{state:'dismissed'}])assert.throws(()=>validateRequest({operation:'applications.inbox.read',payload}));
});

test('Muse receives next-cycle pickup directions through initialize, developer context and guide reads',async()=>{
 const {createHandler}=await import('../supabase/functions/agent-mcp/protocol.mjs');
 const {contextResponse}=await import('../supabase/functions/agent-gateway/context.mjs');
 const {readGuide}=await import('../supabase/functions/agent-gateway/guides.mjs');
 const handler=createHandler(async(_token,operation,payload)=>({status:200,data:operation==='credentials.verify'?{scopes:['workspace:read','approvals:read']}:operation==='context.developer'?contextResponse(operation,{}):operation==='guides.read'?readGuide(payload.id):{}}));
 const request=async(method,params)=>{
  const response=await handler(new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+'a'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}));
  const body=await response.json();assert(!body.error,JSON.stringify(body));assert(!body.result.isError);return body.result;
 };
 const init=await request('initialize',{protocolVersion:'2025-11-25'});
 assert.match(init.instructions,/read_developer_context/);
 const unpack=result=>result.structuredContent||JSON.parse(result.content[0].text);
 const developer=unpack(await request('tools/call',{name:'read_developer_context',arguments:{}}));
 assert.equal(developer.developerVersion,agentContract.developerVersion);
 assert(developer.guides.some(g=>g.id==='application-workspace'));
 const applicationGuide=readGuide('application-workspace').instructions;
 assert.match(applicationGuide,/read_action_inbox.*resolved history/);
 assert.match(applicationGuide,/read_approval/);
 assert.match(applicationGuide,/does not trigger an immediate Muse run/);
 const instruction=readGuide('application-workspace').instructions;
 for(const pattern of [/state all/,/pending-only reads miss approvals/,/read_approval/,/exact current revision/,/fresh server authorization/,/user_reported_submitted/,/Do not call prepare_draft/,/within that task.s scope/])assert.match(instruction,pattern);
 const guide=unpack(await request('tools/call',{name:'read_guide',arguments:{id:'application-workspace'}}));
 assert(guide.version>=3);
 for(const pattern of [/read_action_inbox with state all/,/read_approval with applicationId/,/search-only cycle does not authorize submission/,/new stable attemptId/,/does not trigger an immediate Muse run/])assert.match(guide.instructions,pattern);
});

test('same-owner subscriptions stay independent while channel removal is pending',async()=>{
 const channels=new Map(),pending=[];
 const client={
  channel(topic){
   if(channels.has(topic))return channels.get(topic);
   const channel={joined:false,on(type,filter,fn){
    if(this.joined)throw Error('cannot add callbacks after subscribe');
    assert.equal(filter.filter,'user_id=eq.owner');this.event=fn;return this;
   },subscribe(fn){this.joined=true;this.status=fn;return this;}};
   channels.set(topic,channel);return channel;
  },
  removeChannel(channel){return new Promise(resolve=>pending.push(()=>{
   for(const [topic,value] of channels)if(value===channel)channels.delete(topic);
   resolve('ok');
  }));}
 };
 let oldRefresh=0,newRefresh=0,oldErrors=0,newErrors=0;
 const stopOld=subscribeWorkspaceChanges(client,'owner',()=>oldRefresh++,()=>oldErrors++);
 const old=[...channels.values()][0];
 stopOld();
 const stopNew=subscribeWorkspaceChanges(client,'owner',()=>newRefresh++,()=>newErrors++);
 const current=[...channels.values()][1];
 assert.equal(channels.size,2);
 old.event();old.status('SUBSCRIBED');old.status('CLOSED');
 assert.equal(oldRefresh,0);assert.equal(oldErrors,0);
 pending.shift()();await Promise.resolve();
 assert.equal(channels.size,1);
 current.status('SUBSCRIBED');current.event();current.status('CHANNEL_ERROR');
 assert.equal(newRefresh,2);assert.equal(newErrors,1);
 // An overlapping consumer for the same owner also owns a distinct channel.
 const stopOther=subscribeWorkspaceChanges(client,'owner',()=>{});
 assert.equal(channels.size,2);
 stopNew();stopOther();for(const finish of pending)finish();
 await Promise.resolve();
 assert.equal(channels.size,0);
});
