import test from 'node:test';
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
