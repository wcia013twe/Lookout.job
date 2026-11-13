import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT,createLocalJWKSet,exportJWK} from 'jose';
import {cloudRunWakeup,googleAccessToken,maintenanceAuthorization} from '../backend/runtime/google-cloud.ts';
import {CloudStaging} from '../backend/runtime/cloud-staging.ts';
import {createMaintenance} from '../backend/runtime/maintenance.ts';
import {createApi} from '../backend/runtime/api.ts';
import {createDispatch} from '../backend/runtime/service.ts';
import {drainWorker,workOnce} from '../backend/runtime/worker.ts';
import {loadOAuthConfig} from '../backend/runtime/oauth.mjs';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status});
const audience='https://lookout-api-123.us-east1.run.app',email='scheduler@example.iam.gserviceaccount.com';

test('Google metadata and job execution use bounded fixed endpoints and no job overrides',async()=>{
 let fetched=0;
 const request=async(url,options)=>{
  fetched++;assert.equal(options.redirect,'error');assert.ok(options.signal instanceof AbortSignal);
  if(fetched===1){assert.equal(url,'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token');assert.equal(options.headers['Metadata-Flavor'],'Google');return json({access_token:'ephemeral-token'});}
  assert.equal(url,'https://run.googleapis.com/v2/projects/example/locations/us-east1/jobs/discovery:run');
  assert.equal(options.headers.Authorization,'Bearer ephemeral-token');assert.equal(options.method,'POST');assert.equal(options.body,'{}');return json({name:'operation'});
 };
 await cloudRunWakeup({project:'example',region:'us-east1',job:'discovery',request})();assert.equal(fetched,2);
 await assert.rejects(googleAccessToken(async()=>json({})),/identity unavailable/);
 await assert.rejects(cloudRunWakeup({project:'example',region:'us-east1',job:'discovery',accessToken:async()=>'token',request:async()=>json({},403)})(),/wakeup unavailable/);
 assert.throws(()=>cloudRunWakeup({project:'example/escape',region:'us-east1',job:'discovery'}),/Invalid/);
});

test('maintenance accepts only a signed Google token for the exact Scheduler identity and audience',async()=>{
 const {privateKey,publicKey}=await generateKeyPair('RS256');
 const key=await exportJWK(publicKey);key.kid='fixture';
 const authorize=maintenanceAuthorization(audience,email,createLocalJWKSet({keys:[key]}));
 const sign=(changes={})=>new SignJWT({email,email_verified:true,...changes}).setProtectedHeader({alg:'RS256',kid:'fixture'}).setIssuer('https://accounts.google.com').setAudience(audience).setSubject('scheduler-subject').setIssuedAt().setExpirationTime('2m').sign(privateKey);
 const valid=await sign();assert.equal(await authorize('Bearer '+valid),true);
 for(const token of [undefined,'Bearer jb_agent_invalid','Bearer '+await sign({email:'other@example.iam.gserviceaccount.com'}),'Bearer '+await sign({email_verified:false}), 'Bearer '+valid.slice(0,-4)+'AAAA'])assert.equal(await authorize(token),false);
 const wrongAudience=maintenanceAuthorization(audience+'/other',email,createLocalJWKSet({keys:[key]}));assert.equal(await wrongAudience('Bearer '+valid),false);
 const expired=await new SignJWT({email,email_verified:true}).setProtectedHeader({alg:'RS256',kid:'fixture'}).setIssuer('https://accounts.google.com').setAudience(audience).setSubject('scheduler-subject').setIssuedAt().setExpirationTime(1).sign(privateKey);
 assert.equal(await authorize('Bearer '+expired),false);
});

test('maintenance drains one delivery batch, wakes only pending work and waits for both branches on failure',async()=>{
 const calls=[];
 const run=pending=>createMaintenance({rpc:async(name,args)=>{assert.equal(name,'backend_worker_pending');assert.deepEqual(args,{});return {data:pending};},wakeWorker:async()=>{calls.push('wake');},deliver:async()=>{calls.push('deliver');}})();
 assert.deepEqual(await run(false),{workerRequested:false});assert.deepEqual(calls,['deliver']);calls.length=0;
 assert.deepEqual(await run(true),{workerRequested:true});assert.deepEqual(calls,['wake','deliver']);
 let complete=false;
 await assert.rejects(createMaintenance({rpc:async()=>({data:true}),wakeWorker:async()=>{throw Error('unavailable');},deliver:async()=>{await new Promise(resolve=>setTimeout(resolve,10));complete=true;}})(),/incomplete/);
 assert.equal(complete,true);
 await assert.rejects(createMaintenance({rpc:async()=>({error:{code:'offline'}}),wakeWorker:async()=>{},deliver:async()=>{}})(),/Queue recovery unavailable/);
});

test('maintenance HTTP is isolated from product tokens, browser origins and unavailable work',async()=>{
 let runs=0;
 const api=createApi({dispatch:async()=>({status:200,data:{}}),maintenance:{authorize:async header=>header==='Bearer scheduler',run:async()=>{runs++;if(runs===2)throw Error('secret diagnostic');return {workerRequested:true};}}});
 await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+api.address().port+'/internal/maintenance';
 try{
  assert.equal((await fetch(url)).status,405);
  for(const headers of [{},{Authorization:'Bearer jb_agent_invalid'},{Authorization:'Bearer scheduler',Origin:'http://localhost:3000'}])assert.equal((await fetch(url,{method:'POST',headers})).status,401);
  assert.equal(runs,0);
  assert.equal((await fetch(url,{method:'POST',headers:{Authorization:'Bearer scheduler'}})).status,200);
  const failed=await fetch(url,{method:'POST',headers:{Authorization:'Bearer scheduler'}});assert.equal(failed.status,503);assert.doesNotMatch(await failed.text(),/secret diagnostic/);
 }finally{await new Promise(resolve=>api.close(resolve));}
});

test('GCS snapshots survive new instances, reject overwrite and delete only their generation-scoped prefix',async()=>{
 const objects=new Map(),requests=[];
 const request=async(address,options)=>{
  const url=new URL(address);requests.push(url);assert.equal(options.headers.Authorization,'Bearer ephemeral');assert.equal(options.redirect,'error');
  if(url.pathname.startsWith('/upload/')){assert.equal(url.searchParams.get('ifGenerationMatch'),'0');const key=url.searchParams.get('name');if(objects.has(key))return json({},412);objects.set(key,JSON.parse(options.body));return json({});}
  if(url.searchParams.has('prefix'))return json({items:[...objects.keys()].filter(key=>key.startsWith(url.searchParams.get('prefix'))).map(name=>({name,generation:'12'}))});
  const key=decodeURIComponent(url.pathname.split('/o/')[1]);
  if(options.method==='DELETE'){assert.equal(url.searchParams.get('ifGenerationMatch'),'12');objects.delete(key);return new Response(null,{status:204});}
  assert.equal(url.searchParams.get('alt'),'media');return objects.has(key)?json(objects.get(key)):json({},404);
 };
 const options={request,accessToken:async()=>'ephemeral'};
 const first=new CloudStaging('example-staging','job-run',options),second=new CloudStaging('example-staging','job-run',options),other=new CloudStaging('example-staging','other-run',options);
 await first.write('snapshot.json',{version:1});await other.write('snapshot.json',{version:2});
 assert.deepEqual(await second.read('snapshot.json'),{version:1});await assert.rejects(second.write('snapshot.json',{version:3}),/Immutable/);
 await first.clear();assert.equal(await second.read('snapshot.json'),null);assert.deepEqual(await other.read('snapshot.json'),{version:2});assert.ok(requests.every(url=>url.hostname==='storage.googleapis.com'));
});

test('GCS cleanup paginates and fails closed on foreign prefixes and transport errors',async()=>{
 let pages=0,deletes=0;
 const options={accessToken:async()=>'token',request:async(address,init)=>{
  const url=new URL(address);
  if(init.method==='DELETE'){deletes++;return json({},412);}
  pages++;if(pages===1)return json({items:[{name:'run/one',generation:'1'}],nextPageToken:'next'});
  assert.equal(url.searchParams.get('pageToken'),'next');return json({items:[{name:'run/two',generation:'2'}]});
 }};
 await new CloudStaging('example-staging','run',options).clear();assert.equal(pages,2);assert.equal(deletes,2);
 await assert.rejects(new CloudStaging('example-staging','run',{accessToken:options.accessToken,request:async()=>json({items:[{name:'other/snapshot',generation:'1'}]})}).clear(),/Invalid staging object/);
 await assert.rejects(new CloudStaging('example-staging','run',{accessToken:options.accessToken,request:async()=>json({},503)}).read('snapshot'),/unavailable/);
});

test('enqueue wakeup is awaited and failure preserves a successful durable reply',async()=>{
 let release,wakes=0;
 const pending=new Promise(resolve=>{release=resolve;});
 const dispatch=createDispatch({supabaseUrl:'https://example.supabase.co',rpc:async()=>({data:{id:'queued'}}),wakeWorker:async()=>{wakes++;await pending;throw Error('offline');}});
 let returned=false;const result=dispatch('jb_agent_'+'a'.repeat(64),'backend.jobs.submit',{kind:'search_ats',input:{profileId:'general'},eventKey:'fixture'}).then(reply=>{returned=true;return reply;});
 await new Promise(resolve=>setTimeout(resolve,10));assert.equal(wakes,1);assert.equal(returned,false);release();assert.equal((await result).status,200);
 assert.equal((await dispatch('jb_agent_'+'a'.repeat(64),'backend.jobs.portal.submit',{kind:'search_ats',input:{profileId:'general',portalId:'example'},eventKey:'portal-fixture'})).status,200);assert.equal(wakes,2);
});

test('finite worker exits empty queues, propagates claim outages and leaves interrupted leases unfinished',async()=>{
 assert.equal(await drainWorker(async()=>({data:null}),new AbortController().signal),0);
 await assert.rejects(drainWorker(async()=>({error:{code:'offline'}}),new AbortController().signal),/transaction rejected/);
 const controller=new AbortController(),calls=[];
 const rpc=async(name,args)=>{calls.push(args.operation);if(args.operation==='claim')return {data:{leaseToken:'fixture',job:{id:'fixture',kind:'search_ats',version:2,input:{profileId:'fixture'}}}};controller.abort(Error('shutdown'));return {data:null};};
 await workOnce(rpc,{signal:controller.signal});assert.ok(!calls.includes('finish'));
 await assert.rejects(drainWorker(rpc,controller.signal),/shutdown/);
});

test('OAuth Secret Manager configuration validates the same issuer and private-key boundary',async()=>{
 const {privateKey}=await generateKeyPair('ES256',{extractable:true});const key=await exportJWK(privateKey);Object.assign(key,{kid:'fixture',use:'sig'});
 const config={issuer:audience+'/oauth',resource:audience+'/mcp',consentUrl:'https://lookout.example/oauth/consent',redirectUri:'https://host.example/callback',clientId:'fixture',jwks:{keys:[key]},cookieKeys:[Buffer.alloc(32,1).toString('base64')]};
 assert.deepEqual(await loadOAuthConfig({LOOKOUT_OAUTH_ENABLED:'true',LOOKOUT_OAUTH_CONFIG_JSON:JSON.stringify(config)}),config);
 await assert.rejects(loadOAuthConfig({LOOKOUT_OAUTH_ENABLED:'true',LOOKOUT_OAUTH_CONFIG_JSON:JSON.stringify({...config,resource:'https://other.example/mcp'})}),/issuer\/resource/);
 assert.equal(await loadOAuthConfig({LOOKOUT_OAUTH_CONFIG_JSON:JSON.stringify(config)}),null);
});
