import test from 'node:test';
import assert from 'node:assert/strict';

import {createTestDatabase} from './helpers/database.mjs';
import {AUDIT_FEATURES, validateAudit} from '../supabase/functions/agent-gateway/agent-audit.mjs';
import {createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';

const owner='11111111-1111-1111-1111-111111111111', hash='7'.repeat(64);
const decision=(feature='discover')=>({eventKey:`${feature}-decision`,schemaVersion:2,feature,scenarioId:'fixture-v1',kind:'decision',data:{chosenAction:'Exclude the on-site role',justification:'The fixture profile requires remote work.',preferencesApplied:[{ref:'fixture-profile',version:7}],evidenceRefs:[{ref:'fixture-posting',version:1}]}});
const assertion=(feature='discover')=>({eventKey:`${feature}-check`,schemaVersion:2,feature,kind:'assertion',dimension:'personalization',scenarioId:'fixture-v1',checkId:'respect-preferences',data:{evaluationSource:'self_check',status:'pass',expected:'Follow the current fixture preference.',observed:'The decision follows the current fixture preference.',rubricVersion:'fixture-rubric-v1',evidenceEventKeys:[`${feature}-decision`]}});

test('structured evidence covers all retained features, validates provenance and preserves retry/ownership boundaries',async()=>{
 const db=await createTestDatabase();
 await db.exec('alter role service_role bypassrls');
 const call=async(operation,payload)=>{
  await db.exec('set role service_role');
  try{return (await db.query('select public.agent_audit_dispatch($1,$2,$3::jsonb) result',[hash,operation,JSON.stringify(payload)])).rows[0].result;}
  finally{await db.exec('reset role');}
 };
 try{
  await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Fictional benchmark',$2,array['workspace:read','activity:write'],now()+interval '1 day')",[owner,hash]);
  const run=await call('audit.start',{eventKey:'structured-fixture',task:'Fictional benchmark evidence',area:'action_board',mode:'controlled'});
  const append=events=>call('audit.append',{runId:run.id,events});
  for(const feature of AUDIT_FEATURES.slice(0,5)){
   const args=[decision(feature),assertion(feature)];
   validateAudit('audit.append',{runId:run.id,events:args});
   const saved=await append(args);
   assert.equal(saved.events[1].actor,'agent');assert.equal(saved.events[1].schema_version,2);
   assert.equal(saved.events[1].feature,feature);assert.equal(saved.events[1].scenario_id,'fixture-v1');
   assert.equal(saved.events[1].check_id,'respect-preferences');assert.equal(saved.events[1].data.evaluationSource,'self_check');
   assert.deepEqual(await append(args),saved);
  }
  const variants=[
   {...assertion(),eventKey:'missing-dimension',dimension:undefined},
   {...assertion(),eventKey:'unknown-feature',feature:'invented'},
   {...assertion(),eventKey:'null-version',schemaVersion:null},
   {...assertion(),eventKey:'legacy-with-fields',schemaVersion:1},
   {...assertion(),eventKey:'missing-scenario',scenarioId:undefined},
   {...assertion(),eventKey:'missing-check',checkId:undefined},
   {...assertion(),eventKey:'forged-actor',actor:'evaluator'},
   {...assertion(),eventKey:'forged-origin',data:{...assertion().data,evaluationSource:'independent'}},
   {...assertion(),eventKey:'no-evidence',data:{...assertion().data,evidenceEventKeys:[]}},
   {...assertion(),eventKey:'null-status',data:{...assertion().data,status:null}},
   {...assertion(),eventKey:'unknown-status',data:{...assertion().data,status:'success'}},
   {...assertion(),eventKey:'missing-rubric',data:{...assertion().data,rubricVersion:undefined}},
   {...decision(),eventKey:'no-choice',data:{}},
   {eventKey:'no-context',schemaVersion:2,feature:'discover',kind:'context.loaded',data:{}},
   {eventKey:'negative-usage',schemaVersion:2,feature:'discover',kind:'usage',data:{metricsScope:'task',durationMs:-1}},
   {eventKey:'string-usage',schemaVersion:2,feature:'discover',kind:'usage',data:{metricsScope:'task',costUsd:'0.1'}},
   {eventKey:'fractional-count',schemaVersion:2,feature:'discover',kind:'usage',data:{metricsScope:'task',toolCallCount:1.5}},
   {eventKey:'missing-scope',schemaVersion:2,feature:'discover',kind:'usage',data:{durationMs:1}},
  ];
  for(const item of variants){
   assert.throws(()=>validateAudit('audit.append',{runId:run.id,events:[item]}),undefined,item.eventKey);
   await assert.rejects(append([item]),undefined,item.eventKey);
  }
  await assert.rejects(append([{...assertion(),eventKey:'nonexistent-evidence',data:{...assertion().data,evidenceEventKeys:['never-written']}}]),/earlier events/);
  // No forward/self references and no partial writes from a failed batch.
  await assert.rejects(append([{...decision(),eventKey:'rollback-marker'},{...assertion(),eventKey:'forward-check',data:{...assertion().data,evidenceEventKeys:['later']}},{...decision(),eventKey:'later'}]),/earlier events/);
  assert.equal((await db.query("select count(*)::int n from public.agent_audit_events where event_key='rollback-marker'")).rows[0].n,0);
  await assert.rejects(append([{...decision(),feature:'network'}]),e=>e.code==='40001');
  const missing={...assertion(),eventKey:'missing-comparison',dimension:'consistency',checkId:'repeatability',data:{...assertion().data,status:'not_evaluated',observed:'No comparable second run is available.',evidenceEventKeys:[]}};
  const notApplicable={...missing,eventKey:'not-applicable',data:{...missing.data,status:'not_applicable',observed:'This fixture does not authorize submission.'}};
  const usage={eventKey:'observed-usage',schemaVersion:2,feature:'discover',dimension:'performance',kind:'usage',data:{metricsScope:'task',durationMs:42,toolCallCount:2,inputTokens:null,outputTokens:null,costUsd:0.008,measurementSource:'fictional runner fixture'}};
  const context={eventKey:'loaded-context',schemaVersion:2,feature:'discover',kind:'context.loaded',data:{contextRefs:[{ref:'fixture-profile',version:7}]}};
  const extra=await append([missing,notApplicable,usage,context]);assert.equal(extra.events[0].data.status,'not_evaluated');assert.equal(extra.events[2].data.inputTokens,null);
  // Legacy calls remain usable and their exact retry semantics remain unchanged.
  const legacy={eventKey:'legacy',kind:'run.finished',data:{outcome:'fixture complete'}};
  const saved=await append([legacy]);assert.equal(saved.events[0].schema_version,1);assert.equal(saved.events[0].feature,null);
  assert.deepEqual(await append([legacy]),saved);
  let cursor=0,events=[];
  for(;;){const page=await call('audit.read',{runId:run.id,afterSequence:cursor,limit:3});events.push(...page.events);cursor=page.nextSequence;if(!page.hasMore)break;}
  assert.equal(events.length,15);assert(events.every(e=>e.actor==='agent'));
  // Actual MCP schema/dispatch accepts version-2 events and rejects actor injection.
  const handler=createHandler(async(_token,op,payload)=>{
   if(op==='credentials.verify')return {status:200,data:{scopes:['workspace:read','activity:write']}};
   return {status:200,data:await call(op,payload)};
  });
  const request=events=>new Request('http://localhost/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+'7'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'append_agent_audit_events',arguments:{runId:run.id,events}}})});
  const accepted=await (await handler(request([decision()]))).json();assert.equal(JSON.parse(accepted.result.content[0].text).events[0].feature,'discover');
  const rejected=await (await handler(request([{...decision(),actor:'evaluator'}]))).json();assert.equal(rejected.error.code,-32602);
 }finally{await db.close();}
});

test('migration retains legacy event identity and replay when upgrading populated storage',async()=>{
 const file='20261107005745_agent_audit_benchmark_events.sql';let original;
 const db=await createTestDatabase({beforeMigration:async(db,name)=>{
  if(name!==file)return;
  const run=(await db.query("insert into public.agent_audit_runs(user_id,connection_id,event_key,task,area,mode) values($1,$1,'old-run','Old task','discover','controlled') returning *",[owner])).rows[0];
  original=(await db.query("insert into public.agent_audit_events(user_id,run_id,connection_id,event_key,kind,data) values($1,$2,$1,'old-event','decision','{\"old\":true}') returning *",[owner,run.id])).rows[0];
 }});
 try{
  const row=(await db.query('select * from public.agent_audit_events where sequence=$1',[original.sequence])).rows[0];
  for(const [key,value] of Object.entries(original))assert.deepEqual(row[key],value,key);
  assert.equal(row.schema_version,1);assert.equal(row.actor,'agent');assert.equal(row.feature,null);
 }finally{await db.close();}
});
