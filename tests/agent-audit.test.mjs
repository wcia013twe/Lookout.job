import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
import {AUDIT_TOOLS,validateAudit} from '../supabase/functions/agent-gateway/agent-audit.mjs';
import {createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {createDispatch,credentialHash} from '../backend/runtime/service.ts';
import {contextResponse} from '../supabase/functions/agent-gateway/context.mjs';
import {guideDispatch} from '../supabase/functions/agent-gateway/guides.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
const owner='11111111-1111-1111-1111-111111111111',other='22222222-2222-2222-2222-222222222222';
const token='jb_agent_'+'6'.repeat(64),hash=credentialHash(token),otherHash='8'.repeat(64);
const start={eventKey:'fictional-run-1',task:'Find a fictional backend role and prepare an application',area:'applications',mode:'controlled',metadata:{model:'fixture-model',codeCommit:'fixture-commit',profileVersion:1}};
const event={eventKey:'step-1',kind:'tool.result',summary:'Fictional posting verified',toolName:'verify_job_posting',occurredAt:'2026-11-06T20:00:00Z',data:{url:'https://example.test/jobs/1',status:'active',latencyMs:25}};

test('private audit storage preserves ordered evidence, replay safety, scope boundaries and reset coverage',async t=>{
 const db=await createTestDatabase();
 // Match Supabase: service_role bypasses RLS, while grants still apply.
 await db.exec('alter role service_role bypassrls');
 const call=async(operation,payload,credential=hash)=>{
  await db.exec('set role service_role');
  try{return (await db.query('select public.agent_audit_dispatch($1,$2,$3::jsonb) result',[credential,operation,JSON.stringify(payload)])).rows[0].result;}
  finally{await db.exec('reset role');}
 };
 try{
  await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Fictional audit',$2,array['workspace:read','activity:write'],now()+interval '1 day'),($3,'Other audit',$4,array['workspace:read','activity:write'],now()+interval '1 day')",[owner,hash,other,otherHash]);
  const run=await call('audit.start',start),args={runId:run.id,events:[event]};
  assert.equal(run.user_id,owner);assert.equal(run.metadata.model,'fixture-model');
  await t.test('exact retries reuse immutable start and event; conflicts do not overwrite',async()=>{
   assert.deepEqual(await call('audit.start',start),run);
   await assert.rejects(call('audit.start',{...start,task:'Changed task'}),e=>e.code==='40001');
   const first=await call('audit.append',args);
   assert.deepEqual(await call('audit.append',args),first);
   await assert.rejects(call('audit.append',{...args,events:[{...event,data:{changed:true}}]}),e=>e.code==='40001');
   assert.equal(first.events[0].connection_id,run.connection_id);
   assert.equal(first.events[0].data.latencyMs,25);
  });
  await t.test('batch conflicts roll back new events and read cursors retain late arrivals',async()=>{
   await assert.rejects(call('audit.append',{...args,events:[{...event,eventKey:'rolled-back'},{...event,summary:'changed'}]}));
   let read=await call('audit.read',{runId:run.id,limit:1});assert.equal(read.events.length,1);assert.equal(read.hasMore,false);
   await call('audit.append',{runId:run.id,events:[{eventKey:'step-2',kind:'run.finished',data:{outcome:'blocked',reason:'Missing candidate answer'}}]});
   const second=await call('audit.read',{runId:run.id,afterSequence:read.nextSequence});assert.equal(second.events.length,1);assert.equal(second.events[0].kind,'run.finished');
   assert.equal((await call('audit.read',{runId:run.id,limit:1})).hasMore,true);
   assert.equal((await db.query("select count(*)::int n from public.agent_audit_events where event_key='rolled-back'")).rows[0].n,0);
  });
  await t.test('owners can read only their logs and API roles cannot rewrite history',async()=>{
   await db.query("select set_config('test.uid',$1,false)",[other]);await db.exec('set role authenticated');
   assert.equal((await db.query('select * from public.agent_audit_runs')).rows.length,0);
   assert.equal((await db.query('select * from public.agent_audit_events')).rows.length,0);
   await assert.rejects(db.query('select public.agent_audit_dispatch($1,$2,$3)',[hash,'audit.start',JSON.stringify(start)]));
   await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[owner]);await db.exec('set role authenticated');
   assert.equal((await db.query('select * from public.agent_audit_events')).rows.length,2);
   await assert.rejects(db.query("update public.agent_audit_events set summary='altered'"));
   await assert.rejects(db.query('delete from public.agent_audit_runs'));
   await db.exec('reset role');await db.exec('set role service_role');
   await assert.rejects(db.query('delete from public.agent_audit_events'));
   await db.exec('reset role');await db.exec('set role anon');
   await assert.rejects(db.query('select * from public.agent_audit_events'));await db.exec('reset role');
   await assert.rejects(call('audit.read',{runId:run.id},otherHash),e=>e.code==='P0002');
   await assert.rejects(call('audit.append',args,otherHash),e=>e.code==='P0002');
  });
  await t.test('SQL rejects unredacted secrets, identity injection, malformed batches and oversized data',async()=>{
   for(const payload of [{...start,eventKey:'bad',userId:other},{...start,metadata:{nested:{api_key:'private'}}},{...start,metadata:{url:'https://example.test/storage/v1/object/sign/resumes/file?token=abc'}}])await assert.rejects(call('audit.start',payload));
   for(const events of [[],[null],[{...event,eventKey:'bad',data:{answer:token}}],[{...event,eventKey:'bad',data:{body:'x'.repeat(128001)}}],[{...event,eventKey:'bad',occurredAt:'2026-11-06'}]])await assert.rejects(call('audit.append',{runId:run.id,events}));
   await assert.rejects(call('audit.read',{runId:run.id,limit:21}));
  });
  await t.test('read-only, expired and revoked connections cannot append',async()=>{
   await db.query("update private.agent_connections set scopes=array['workspace:read'] where token_hash=$1",[hash]);
   assert.equal((await call('audit.read',{runId:run.id})).events.length,2);
   await assert.rejects(call('audit.append',args),e=>e.code==='42501');
   await db.query("update private.agent_connections set scopes=array['workspace:read','activity:write'],expires_at=now()-interval '1 second' where token_hash=$1",[hash]);
   await assert.rejects(call('audit.read',{runId:run.id}),e=>e.code==='28000');
   await db.query("update private.agent_connections set expires_at=now()+interval '1 day',revoked_at=now() where token_hash=$1",[hash]);
   await assert.rejects(call('audit.append',args),e=>e.code==='28000');
   await db.query('update private.agent_connections set revoked_at=null where token_hash=$1',[hash]);
  });
  await t.test('Node/MCP use the dedicated SQL boundary and reject missing permissions',async()=>{
   const rpc=async(name,params)=>{
    assert.equal(name,'agent_audit_dispatch');
    try{return {data:await call(params.operation,params.payload,params.credential_hash)};}catch(e){return {error:{code:e.code,message:e.message}};}
   };
   const dispatch=createDispatch({rpc,supabaseUrl:'http://localhost:54321',request:async()=>{throw Error('Must not call Edge');}});
   assert.equal((await dispatch(token,'audit.read',{runId:run.id})).data.events.length,2);
   const forwardCalls=[];
   const handler=createHandler(async(_token,op,payload)=>{
    forwardCalls.push(op);
    if(op==='credentials.verify')return {status:200,data:{scopes:['workspace:read','activity:write']}};
    return dispatch(token,op,payload);
   });
   const request=body=>new Request('http://localhost/mcp',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,...body})});
   const result=await (await handler(request({method:'tools/call',params:{name:'read_agent_audit_run',arguments:{runId:run.id}}}))).json();
   assert.equal(JSON.parse(result.result.content[0].text).events.length,2);
   const invalid=await (await handler(request({method:'tools/call',params:{name:'start_agent_audit_run',arguments:{...start,ownerId:other}}}))).json();assert.equal(invalid.error.code,-32602);
   assert.deepEqual(forwardCalls,['credentials.verify','audit.read','credentials.verify']);
  });
  await t.test('logs participate in the existing reset and pending resets fence inserts',async()=>{
   const tables=(await db.query('select private.workspace_reset_tables() tables')).rows[0].tables;
   assert(tables.indexOf('public.agent_audit_events')<tables.indexOf('public.agent_audit_runs'));
   await db.query("insert into private.workspace_resets(user_id,id,state,blocked_paths) values($1,gen_random_uuid(),'pending','{}')",[owner]);
   await assert.rejects(call('audit.append',{runId:run.id,events:[{eventKey:'during-reset',kind:'run.note'}]}),e=>e.code==='55000');
   await db.query('delete from private.workspace_resets where user_id=$1',[owner]);
  });
 }finally{await db.exec('reset role');await db.close();}
});

test('audit contract validates bounded typed data without allowing secrets or owner injection',()=>{
 assert.equal(AUDIT_TOOLS.length,3);
 assert.doesNotThrow(()=>validateRequest({operation:'audit.start',payload:start}));
 for(const payload of [{...start,metadata:{accessToken:'private'}},{...start,userId:owner},{...start,mode:'benchmark-success'}])assert.throws(()=>validateAudit('audit.start',payload));
 assert.throws(()=>validateAudit('audit.append',{runId:owner,events:[{eventKey:'e',kind:'tool.result',data:{nested:[{password:'private'}]}}]}));
 assert.throws(()=>validateAudit('audit.read',{runId:owner,afterSequence:-1}));
});


test('Muse instruction lookup routes to a usable audit guide and its examples persist through MCP',async()=>{
 const db=await createTestDatabase();
 await db.exec('alter role service_role bypassrls');
 try{
  await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Fictional guide capture',$2,array['workspace:read','activity:write'],now()+interval '1 day')",[owner,hash]);
  const calls=[];
  const forward=async(_token,operation,payload)=>{
   calls.push(operation);
   if(operation==='credentials.verify')return {status:200,data:{scopes:['workspace:read','activity:write']}};
   if(operation==='context.developer')return {status:200,data:contextResponse(operation,{})};
   if(operation==='guides.read')return {status:200,...await guideDispatch(payload.id,async()=>({data:{}}))};
   await db.exec('set role service_role');
   try{return {status:200,data:(await db.query('select public.agent_audit_dispatch($1,$2,$3::jsonb) result',[hash,operation,JSON.stringify(payload)])).rows[0].result};}
   finally{await db.exec('reset role');}
  };
  const handle=createHandler(forward);
  const send=async(method,params)=>{
   const response=await handle(new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}));
   const body=await response.json();assert(!body.error,JSON.stringify(body.error));return body.result;
  };
  const invoke=async(name,args={})=>{
   const result=await send('tools/call',{name,arguments:args});assert(!result.isError,JSON.stringify(result));return JSON.parse(result.content[0].text);
  };
  const startup=await send('initialize',{protocolVersion:'2025-11-25'});
  assert.match(startup.instructions,/load agent-audit to record the run/);
  const context=await invoke('read_developer_context');
  assert(context.instructions.some(s=>s.includes('Assignment data collection is enabled')&&s.includes('pause a logged test')));
  const entry=context.guides.find(g=>g.id==='agent-audit');assert.match(entry.whenToUse,/Required run logging/);
  const guide=await invoke('read_guide',{id:entry.id});assert.equal(guide.version,entry.version);
  for(const phrase of ['before each non-audit tool call','pause the logged test','Never log the audit tools','not complete runtime-native tracing','No scoring or grading'])assert(guide.instructions.includes(phrase),phrase);
  const discovered=await send('tools/list',{});
  for(const example of Object.values(guide.examples)){
   const tool=discovered.tools.find(t=>t.name===example.tool);assert(tool);
   validateRequest({operation:AUDIT_TOOLS.find(t=>t.name===example.tool).operation,payload:example.arguments});
  }
  const request=guide.examples.append.arguments.events.find(e=>e.kind==='tool.call');
  const supporting=await invoke('discover_tools',{workflow:'all',name:request.toolName});
  assert(supporting.tools.some(t=>t.name===request.toolName),'example must reference a discoverable domain tool');
  const run=await invoke(guide.examples.start.tool,guide.examples.start.arguments);
  await invoke(guide.examples.append.tool,{...guide.examples.append.arguments,runId:run.id});
  const saved=await invoke(guide.examples.read.tool,{...guide.examples.read.arguments,runId:run.id});
  assert.deepEqual(saved.events.map(e=>e.event_key),guide.examples.append.arguments.events.map(e=>e.eventKey));
  assert.equal(saved.events.at(-1).kind,'run.finished');assert.equal(saved.events.at(-1).data.outcome,'blocked');
  assert.equal(saved.events[1].data.toolCallId,saved.events[2].data.toolCallId);
  assert.deepEqual(calls.filter(op=>op.startsWith('audit.')),['audit.start','audit.append','audit.read']);
 }finally{await db.exec('reset role');await db.close();}
});
