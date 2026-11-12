import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {createRecommendationLogger,recommendationExchange} from '../backend/runtime/recommendation-log.mjs';
import {createDispatch} from '../backend/runtime/service.ts';

const token='jb_agent_'+'a'.repeat(64),key='fictional-telemetry-secret-32-characters';
const env={LOOKOUT_RECOMMENDATION_LOG_ENABLED:'true',LOOKOUT_RECOMMENDATION_LOG_PROJECT:'fictional-project',LOOKOUT_RECOMMENDATION_LOG_SECRET:key};
const exchange={token,operation:'knowledge.interview',payload:{jobId:'fictional-job',stage:'Technical'},reply:{status:200,data:{status:'evidence_available',evidence:[{sourceId:'fictional-post',sourceRevision:1,insight:'Practice queue consumers.'}]}},durationMs:7};

test('captures the actual request and authorized evidence without generating advice',()=>{
  const entry=recommendationExchange(exchange,key);
  assert.deepEqual(entry.jsonPayload.request,exchange.payload);
  assert.deepEqual(entry.jsonPayload.response,exchange.reply.data);
  assert.equal(entry.jsonPayload.event,'agent.recommendation_exchange');
  assert.equal(entry.insertId,entry.jsonPayload.requestId);
  assert.equal(entry.jsonPayload.truncated,false);
  assert.equal(entry.jsonPayload.connectionKey,recommendationExchange(exchange,key).jsonPayload.connectionKey);
  assert.notEqual(entry.jsonPayload.connectionKey,recommendationExchange(exchange,key+'rotated').jsonPayload.connectionKey);
  for(const operation of ['credentials.verify','resumes.read','workspace.read','knowledge.propose'])assert.equal(recommendationExchange({...exchange,operation},key),null);
  assert.equal(recommendationExchange({...exchange,token:'invalid'},key),null);
  const denied=recommendationExchange({...exchange,reply:{status:403,data:exchange.reply.data}},key).jsonPayload;
  assert.equal(denied.request,null);assert.equal(denied.response,null);assert.equal(denied.status,403);
});

test('sanitizes identities, credentials and URL secrets, bounds content and does not mutate results',()=>{
  const data={authorId:'private-person',alias:'Private Name',credential:'private',insight:`Contact a@example.com ${token} ${key} https://user:pass@example.com/path?secret=hidden#private`,evidence:Array.from({length:70},()=>({insight:'é'.repeat(13000)}))};
  const before=JSON.stringify(data);
  const entry=recommendationExchange({...exchange,reply:{status:200,data}},key);
  const serialized=JSON.stringify(entry);
  for(const secret of ['private-person','Private Name','a@example.com',token,key,'user:pass','secret=hidden','#private'])assert(!serialized.includes(secret),secret);
  assert(serialized.includes('https://example.com/path'));
  assert(Buffer.byteLength(serialized)<65000);assert.equal(entry.jsonPayload.truncated,true);
  assert.equal(JSON.stringify(data),before);
  const none=recommendationExchange({...exchange,reply:{status:200,data:{status:'no_discussions',evidence:[],automaticAction:'suppress'}}},key);
  assert.deepEqual(none.jsonPayload.response.evidence,[]);assert.equal(none.jsonPayload.response.automaticAction,'suppress');
});

test('uses VM credentials and the private log only; failures are isolated and logging is opt-in',async()=>{
  assert.equal(createRecommendationLogger({}),null);
  assert.throws(()=>createRecommendationLogger({...env,LOOKOUT_RECOMMENDATION_LOG_SECRET:''}));
  const calls=[];let warnings=0;
  const logger=createRecommendationLogger(env,{request:async(url,init)=>{
    calls.push({url,init});
    return url.startsWith('http:')?Response.json({access_token:'fictional-google-token',expires_in:3600}):new Response('{}');
  },warn:()=>warnings++});
  logger(exchange);logger({...exchange,operation:'credentials.verify'});
  await nextTurn();
  assert.equal(calls.length,2);assert.equal(calls[0].init.headers['Metadata-Flavor'],'Google');
  assert.equal(calls[1].url,'https://logging.googleapis.com/v2/entries:write');
  assert.equal(calls[1].init.headers.Authorization,'Bearer fictional-google-token');
  assert.equal(JSON.parse(calls[1].init.body).logName,'projects/fictional-project/logs/lookout-shadow');
  assert(!calls[1].init.body.includes(token));assert(!calls[1].init.body.includes(key));
  logger(exchange);await nextTurn();assert.equal(calls.length,3);assert.equal(warnings,0);
  const failing=createRecommendationLogger(env,{request:async()=>{throw Error('secret provider diagnostic');},warn:()=>warnings++});
  failing(exchange);await nextTurn();assert.equal(warnings,1);
  let release;const waiting=new Promise(resolve=>{release=resolve;});
  const bounded=createRecommendationLogger(env,{request:async()=>{await waiting;return new Response('',{status:503});},warn:()=>warnings++});
  for(let index=0;index<33;index++)bounded(exchange);
  assert.equal(warnings,2);release();await nextTurn();
});

test('dispatch preserves responses when the recorder fails and performs no extra authorization calls',async()=>{
  let calls=0;
  const dispatch=createDispatch({rpc:async()=>{calls++;return {data:exchange.reply.data,error:null};},supabaseUrl:'http://localhost:54321',recordExchange:()=>{throw Error('Logging failed');}});
  assert.deepEqual(await dispatch(token,exchange.operation,exchange.payload),exchange.reply);
  assert.equal(calls,1);
});
