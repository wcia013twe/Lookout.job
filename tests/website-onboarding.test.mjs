import test from 'node:test';
import assert from 'node:assert/strict';
import {websiteOnboardingComplete,websiteOnboardingDestination,finishWebsiteOnboarding} from '../next-app/lib/website-onboarding.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
const completed={revision:3,step:'connection_pending',data:{websiteCompletedAt:'2026-10-23T12:00:00Z'}};
test('routing waits for auth and server completion, preserves privacy/reset and skips returning-user setup',()=>{
 const base={path:'/',demo:false,authReady:true,signedIn:true,status:'incomplete'};
 const route=extra=>websiteOnboardingDestination({...base,...extra});
 assert.equal(route({}),'/onboarding/');assert.equal(route({signedIn:false}),'/onboarding/');
 assert.equal(route({path:'/onboarding/'}),null);assert.equal(route({path:'/onboarding/',status:'complete'}),'/?tour=dashboard');
 for(const status of ['loading','error','complete'])assert.equal(route({status}),null);
 for(const extra of [{demo:true},{authReady:false},{path:'/privacy/'},{path:'/workspace-reset/'}])assert.equal(route(extra),null);
 assert.equal(websiteOnboardingComplete(completed),true);
 for(const state of [null,{step:'ready',data:{}},{data:{websiteCompletedAt:'fake'}}])assert.equal(websiteOnboardingComplete(state),false);
});
test('finish reads latest revision and saves only website completion; retries use a stable request',async()=>{
 const calls=[];
 const api={async onboardingAction(operation,payload){calls.push({operation,payload});return operation==='onboarding.get_state'?{revision:2,data:{}}:completed;}};
 assert.equal(await finishWebsiteOnboarding(api),completed);
 const expected={expectedRevision:2,eventKey:'website-complete-2',event:'website_complete',data:{}};
 assert.deepEqual(calls[1],{operation:'onboarding.submit_step',payload:expected});
 assert.doesNotThrow(()=>validateRequest({operation:'onboarding.submit_step',payload:expected}));
 await finishWebsiteOnboarding(api);assert.deepEqual(calls[3],calls[1]);
 calls.length=0;await finishWebsiteOnboarding({async onboardingAction(op){calls.push(op);return completed;}});assert.deepEqual(calls,['onboarding.get_state']);
 await assert.rejects(finishWebsiteOnboarding({async onboardingAction(){throw Error('offline');}}),/offline/);
});
