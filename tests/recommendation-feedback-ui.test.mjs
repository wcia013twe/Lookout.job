import test from 'node:test';
import assert from 'node:assert/strict';
import {createFeedbackCache,feedbackTargetAvailable} from '../next-app/lib/recommendation-feedback.mjs';
import {createDemoFeedbackServices} from '../next-app/lib/recommendation-feedback-demo.mjs';

const turn=()=>new Promise(resolve=>setImmediate(resolve));
const target={kind:'job',targetId:'owned-job'};

test('public catalog jobs cannot mount account feedback without an owned batch target',()=>{
  const workspace={demo:false,roles:[{id:'owned-job'}]};
  assert.equal(feedbackTargetAvailable(workspace,target),true);
  assert.equal(feedbackTargetAvailable(workspace,{targetId:'public-job'}),false);
  assert.equal(feedbackTargetAvailable({...workspace,demo:true},{targetId:'fictional-job'}),true);
  assert.equal(feedbackTargetAvailable(workspace,{kind:'network',targetId:'owned-contact'}),true);
  assert.equal(feedbackTargetAvailable(workspace,{kind:'planning',targetId:'goal:owned:task'}),true);
});

test('feedback reads batch, deduplicate, cache and retain feedback versions independently of plan versions',async()=>{
  const calls=[];
  const cache=createFeedbackCache({
    async readRecommendationFeedback(input){calls.push(input);return {rows:input.targets.map(value=>({...value,rating:null,version:0}))};},
    async saveRecommendationFeedback(input){calls.push(input);return {...input,version:input.expectedVersion+1};},
  });
  cache.subscribe(target,()=>{});cache.subscribe(target,()=>{});
  const planning={kind:'planning',targetId:'application:owned-app:task'};
  cache.subscribe(planning,()=>{});
  assert.equal(cache.get(target).status,'loading');
  await turn();
  assert.deepEqual(calls,[{targets:[target,planning]}]);
  cache.subscribe(target,()=>{});await turn();assert.equal(calls.length,1);
  assert.equal(await cache.save(target,{rating:'not-helpful',reason:'Location',note:'Remote only'},{expectedPlanVersion:9},'request-1'),true);
  assert.equal(calls[1].expectedVersion,0);assert.equal(calls[1].requestId,'request-1');
  assert.equal(cache.get(target).note,'Remote only');
  await cache.save(target,{rating:null,reason:'',note:''},{},'request-2');
  assert.equal(calls[2].expectedVersion,1);assert.equal(cache.get(target).rating,null);
});

test('stale or uncertain writes require explicit reload, retaining confirmed state',async()=>{
  let latest={...target,rating:'not-helpful',reason:'Timing',note:'Saved note',version:4};
  const cache=createFeedbackCache({async readRecommendationFeedback(){return {rows:[latest]};},async saveRecommendationFeedback(){latest={...latest,version:5};throw new Error('stale version');}});
  cache.subscribe(target,()=>{});await turn();
  assert.equal(await cache.save(target,{rating:'helpful'},{},'request'),false);
  assert.equal(cache.get(target).status,'error');assert.equal(cache.get(target).note,'Saved note');
  assert.equal(await cache.save(target,{rating:'helpful'},{},'request'),false);
  cache.load(target);await turn();assert.equal(cache.get(target).version,5);assert.equal(cache.get(target).status,'ready');
});

test('old account responses and writes are ignored',async()=>{
  let current=true,finish;
  const cache=createFeedbackCache({readRecommendationFeedback:()=>new Promise(resolve=>finish=resolve),async saveRecommendationFeedback(){throw new Error('must not write');}},{current:()=>current});
  cache.subscribe(target,()=>{});await turn();current=false;
  finish({rows:[{...target,rating:'helpful',version:9}]});await turn();
  assert.equal(cache.get(target).rating,null);
  assert.equal(cache.get(target).status,'error');
  assert.equal(await cache.save(target,{rating:'helpful'},{},'request'),false);
});

test('failed initial read is retryable and a superseded read cannot replace newer state',async()=>{
  const pending=[];
  const cache=createFeedbackCache({readRecommendationFeedback:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))});
  cache.subscribe(target,()=>{});await turn();pending[0].reject(Error('offline'));await turn();
  assert.equal(cache.get(target).status,'error');cache.load(target);await turn();cache.load(target);await turn();
  pending[2].resolve({rows:[{...target,rating:'helpful',version:3}]});await turn();
  pending[1].resolve({rows:[{...target,rating:null,version:1}]});await turn();assert.equal(cache.get(target).version,3);
});

test('demo edits are fictional, independent and resettable',async()=>{
  const first=createDemoFeedbackServices(),second=createDemoFeedbackServices();
  const demoTarget={kind:'job',targetId:'demo-stripe'};
  const original=(await first.readRecommendationFeedback({targets:[demoTarget]})).rows[0];
  assert.equal(original.rating,'not-helpful');assert.match(original.note,/Fictional/);
  await first.saveRecommendationFeedback({...demoTarget,rating:null,reason:'',note:'',expectedVersion:original.version});
  assert.equal((await first.readRecommendationFeedback({targets:[demoTarget]})).rows[0].rating,null);
  assert.equal((await second.readRecommendationFeedback({targets:[demoTarget]})).rows[0].rating,'not-helpful');
});

test('detached unavailable demo covers retry, conflict reconciliation and note editing',async()=>{
  const services=createDemoFeedbackServices('unavailable');
  const demoTarget={kind:'network',targetId:'demo-referral'};
  await assert.rejects(services.readRecommendationFeedback({targets:[demoTarget]}),/Fictional demo load failure/);
  const original=(await services.readRecommendationFeedback({targets:[demoTarget]})).rows[0];
  await assert.rejects(services.saveRecommendationFeedback({...demoTarget,rating:'not-helpful',note:'Edited fictional note',expectedVersion:original.version}),/Fictional stale feedback version/);
  const fresh=(await services.readRecommendationFeedback({targets:[demoTarget]})).rows[0];
  assert.equal(fresh.version,original.version+1);
  const saved=await services.saveRecommendationFeedback({...demoTarget,rating:'not-helpful',note:'Edited fictional note',expectedVersion:fresh.version});
  assert.equal(saved.note,'Edited fictional note');assert.equal(saved.version,fresh.version+1);
});

test('large mounted target sets stay bounded without redundant requests',async()=>{
  const calls=[];
  const cache=createFeedbackCache({async readRecommendationFeedback(input){calls.push(input);return {rows:[]};}});
  for(let index=0;index<115;index++)cache.subscribe({kind:'job',targetId:`role-${index}`},()=>{});
  await turn();assert.deepEqual(calls.map(call=>call.targets.length),[50,50,15]);
});

test('in-flight save disables duplicate writes and reconciles after account switching',async()=>{
  let current=true,finish,writes=0;
  const cache=createFeedbackCache({
    async readRecommendationFeedback(){return {rows:[{...target,rating:null,version:0}]};},
    saveRecommendationFeedback(){writes++;return new Promise(resolve=>finish=resolve);},
  },{current:()=>current});
  cache.subscribe(target,()=>{});await turn();
  const saving=cache.save(target,{rating:'helpful'},{},'request');
  assert.equal(cache.get(target).status,'saving');
  assert.equal(await cache.save(target,{rating:'helpful'},{},'duplicate'),false);assert.equal(writes,1);
  current=false;finish({...target,rating:'helpful',version:1});assert.equal(await saving,false);
  assert.equal(cache.get(target).rating,null);assert.equal(cache.get(target).status,'error');
  current=true;cache.load(target);await turn();assert.equal(cache.get(target).status,'ready');
});
