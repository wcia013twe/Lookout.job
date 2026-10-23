import test from 'node:test';
import assert from 'node:assert/strict';
import {ApiFailure,apiFailure,callApi} from '../lib/api-failure.mjs';
import {createBackend} from '../backend/client.mjs';
import {createMemoryStore,createDemoServices,demoFixtures} from '../next-app/lib/demo.mjs';
import {demoApiScenario} from '../next-app/lib/demo-api-scenarios.mjs';

test('missing APIs retain operation, code and HTTP status without exposing raw server details',()=>{
 for(const code of ['PGRST202','PGRST205','42P01','42883','42703']){
  const error=apiFailure('artifacts.list',{code,message:'SQL query contains secret-token',details:'private payload',hint:'secret'},404);
  assert.ok(error instanceof ApiFailure);assert.equal(error.code,code);assert.equal(error.status,404);
  assert.match(error.message,/artifacts.list failed/);assert.match(error.message,/missing or out of date/);
  assert.doesNotMatch(error.message,/secret|private payload|SQL query/);
  assert.equal(apiFailure('outer.catch',error),error);
 }
 assert.doesNotMatch(apiFailure('token=private',{code:'private data',message:'secret'}).message,/token=|private|secret/);
});
test('actionable explanations distinguish auth, permission, conflict, network and service failures',()=>{
 for(const [input,status,pattern] of [[{code:'PGRST301'},401,/Sign in again/],[{code:'42501'},403,/denied access/],[{code:'40001'},409,/reconcile your edits/],[new TypeError('Failed to fetch'),undefined,/could not be reached/],[{},0,/could not be reached/],[{code:'FEATURE_UNAVAILABLE'},200,/not enabled/],[{},500,/server could not complete/]])assert.match(apiFailure('circles.list',input,status).message,pattern);
});
test('successful empty data is valid while failed and malformed responses never become empty data',async()=>{
 assert.deepEqual(await callApi('contacts.read',async()=>({data:[],error:null,status:200}),Array.isArray),[]);
 for(const response of [{data:null,error:{code:'PGRST202'},status:404},{data:null,error:null,status:200},{data:{},status:200}])await assert.rejects(callApi('contacts.read',async()=>response,Array.isArray),error=>error instanceof ApiFailure&&error.operation==='contacts.read');
 await assert.rejects(callApi('contacts.read',async()=>{throw new TypeError('Failed to fetch');}),{code:'NETWORK_ERROR'});
 // A successful no-return insert is explicitly allowed by that operation's adapter.
 assert.equal(await callApi('requests.create',async()=>({data:null,error:null,status:201}),()=>true),null);
});
test('artifact adapter preserves empty lists, rejects missing APIs and invalid envelopes, and guards ownership',async()=>{
 let owner='one',response={data:{items:[],nextOffset:null},status:200};
 const api=createBackend({auth:{getUser:async()=>({data:{user:{id:owner}}})},rpc:async()=>response},'one');
 assert.deepEqual(await api.artifactAction('artifacts.list'),{items:[],nextOffset:null});
 response={data:null,error:{code:'PGRST202',message:'private sql'},status:404};
 await assert.rejects(api.artifactAction('artifacts.list'),error=>error.code==='PGRST202'&&error.status===404&&error.operation==='artifacts.list');
 response={data:{},status:200};await assert.rejects(api.artifactAction('artifacts.list'),{code:'INVALID_RESPONSE'});
 owner='two';await assert.rejects(api.artifactAction('artifacts.list'),/Account changed/);
});
test('detached demo covers an empty account and missing API recovery without account writes',async()=>{
 const store=createMemoryStore(demoFixtures('2026-10-23').state),services=createDemoServices(store),before=store.get();
 const empty=demoApiScenario(services,'empty');
 assert.deepEqual((await empty.artifactAction('artifacts.list')).items,[]);
 assert.deepEqual((await empty.knowledge.action('circles.list',{})).circles,[]);
 const unavailable=demoApiScenario(services,'unavailable');
 await assert.rejects(unavailable.artifactAction('artifacts.list'),{code:'PGRST202'});
 assert.ok((await unavailable.artifactAction('artifacts.list')).items.length);
 await assert.rejects(unavailable.knowledge.action('circles.list',{}),{code:'PGRST202'});
 assert.ok((await unavailable.knowledge.action('circles.list',{})).circles.length);
 assert.deepEqual(store.get(),before);
 assert.equal(demoApiScenario(services,'unknown'),services);
});
