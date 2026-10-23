import test from 'node:test';
import assert from 'node:assert/strict';
import {handoffOnboardingSearch} from '../next-app/lib/onboarding-search-handoff.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
const runtime={connectionId:'runtime-1',browsingReportedAt:'2026-10-23T12:00:00Z'};
function fake(initial){
 let state=structuredClone(initial);const writes=[];
 return {writes,get state(){return state;},onboardingAction:async(operation,payload={})=>{
  validateRequest({operation,payload});
  if(operation==='onboarding.get_state')return structuredClone(state);
  writes.push({operation,payload:structuredClone(payload)});
  assert.equal(payload.expectedRevision,state.revision);
  if(operation==='onboarding.submit_step'){assert.equal(payload.event,'intent');state={...state,revision:state.revision+1,step:'first_match_pending',data:{...state.data,intent:payload.data}};}
  else if(operation==='tasks.create'){assert.equal(payload.kind,'discover');assert.deepEqual(payload.target,{});state.tasks.push({id:'task',kind:'discover',state:'queued'});}
  else assert.fail('Unapproved operation');
  return structuredClone(state);
 }};
}
test('actual connection hands off saved intent and one bounded discovery request, with safe reconnect',async()=>{
 const api=fake({revision:1,step:'intent_pending',data:{runtime},tasks:[]});
 assert.equal((await handoffOnboardingSearch(api,'Backend roles in New York')).status,'queued');
 assert.deepEqual(api.writes.map(write=>write.operation),['onboarding.submit_step','tasks.create']);
 assert.match(api.state.data.intent.text,/Backend roles/);
 await handoffOnboardingSearch(api,'Backend roles in New York');
 assert.equal(api.writes.length,2);
});
test('issued credentials, paused setup, blocked/uncertain searches and existing results never create more work',async()=>{
 for(const initial of [
  {revision:0,step:'connection_pending',data:{},tasks:[]},
  {revision:2,step:'paused',data:{runtime},tasks:[]},
  {revision:2,step:'first_match_pending',data:{runtime,blocker:'No suitable jobs'},tasks:[]},
  {revision:2,step:'first_match_pending',data:{runtime},tasks:[{kind:'discover',state:'uncertain'}]},
  {revision:3,step:'action_policy_pending',data:{runtime,match:{jobId:'owned'}},tasks:[]},
 ]){const api=fake(initial);await handoffOnboardingSearch(api,'Saved preferences');assert.equal(api.writes.length,0);}
});
test('account changes and missing search intent prevent handoff writes',async()=>{
 const api=fake({revision:1,step:'intent_pending',data:{runtime},tasks:[]});
 assert.equal((await handoffOnboardingSearch(api,'Search',()=>false)).status,'cancelled');
 await assert.rejects(()=>handoffOnboardingSearch(api,''),/preferences/);
 assert.equal(api.writes.length,0);
});

import {rememberOnboardingReturn,takeOnboardingReturn} from '../next-app/lib/onboarding-auth.mjs';
test('OAuth return resumes only a requested onboarding after actual sign-in, with a fixed destination',()=>{
 const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
 rememberOnboardingReturn(storage,'/lookout/onboarding/');
 assert.equal(takeOnboardingReturn(storage,{signedIn:false,path:'/lookout/'}),false);
 assert.equal(takeOnboardingReturn(storage,{signedIn:true,path:'/lookout/'}),true);
 assert.equal(takeOnboardingReturn(storage,{signedIn:true,path:'/lookout/'}),false);
 rememberOnboardingReturn(storage,'/lookout/onboarding/');
 assert.equal(takeOnboardingReturn(storage,{signedIn:true,path:'/lookout/onboarding/'}),false);
 rememberOnboardingReturn(storage,'/profile/');
 assert.equal(takeOnboardingReturn(storage,{signedIn:true,path:'/'}),false);
});
