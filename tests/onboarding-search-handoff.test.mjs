import test from 'node:test';
import assert from 'node:assert/strict';
import {checkOnboardingConnection} from '../next-app/lib/onboarding-search-handoff.mjs';
const connectionTest={connectionId:'runtime-1',checkedAt:'2026-10-23T12:00:00Z'};
test('connection polling reads state without changing intent, starting discovery or touching queued work',async()=>{
 for(const step of ['connection_pending','intent_pending','first_match_pending','execution_ready','ready','paused']){
  const session={revision:4,step,data:{connectionTest},tasks:[{kind:'discover',state:'queued'}]};
  const calls=[];const api={onboardingAction:async(op)=>{calls.push(op);return session;}};
  const result=await checkOnboardingConnection(api);
  assert.equal(result.status,'connected');assert.equal(result.session,session);
  assert.deepEqual(calls,['onboarding.get_state']);assert.equal(session.tasks[0].state,'queued');
 }
});
test('credentials alone are not confirmation, stale accounts are ignored, and read failures remain failures',async()=>{
 const api={onboardingAction:async()=>({step:'connection_pending',data:{}})};
 assert.equal((await checkOnboardingConnection(api)).status,'waiting');
 assert.equal((await checkOnboardingConnection(api,()=>false)).status,'cancelled');
 await assert.rejects(checkOnboardingConnection({onboardingAction:async()=>{throw Error('offline');}}),/offline/);
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
