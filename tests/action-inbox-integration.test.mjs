import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createTestDatabase} from './helpers/database.mjs';
import {createApi} from '../backend/runtime/api.ts';
import {createDispatch,credentialHash} from '../backend/runtime/service.ts';
import {createBackend} from '../backend/client.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';

test('Node HTTP MCP and browser read the same atomic handoffs through Edge/SQL',async()=>{
 const db=await createTestDatabase();let server;
 const owner='11111111-1111-1111-1111-111111111111',token='jb_agent_'+'a'.repeat(64),hash=credentialHash(token);
 let edgeCalls=0;
 const rpc=async(name,args)=>{
  assert.equal(name,'agent_dispatch');
  try {return {data:(await db.query('select public.agent_dispatch($1,$2,$3) data',[args.credential_hash,args.operation,args.payload])).rows[0].data,error:null};}
  catch(error){return {data:null,error};}
 };
 try {
  await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Fictional inbox integration',$2,array['workspace:read','drafts:write'],now()+interval '1 hour')",[owner,hash]);
  await db.exec(`insert into public.jobs(id,canonical_url,employer) values('inbox-http','https://example.test/jobs/inbox-http','{"company":"Fictional"}');`);
  const applicationId=(await db.query("insert into public.applications(user_id,job_id,draft) values($1,'inbox-http','{}') returning id",[owner])).rows[0].id;
  const dispatch=createDispatch({rpc,supabaseUrl:'https://example.supabase.co',request:async(url,init)=>{
   assert.equal(String(url),'https://example.supabase.co/functions/v1/agent-gateway');edgeCalls++;
   assert.equal(init.headers.Authorization,'Bearer '+token);
   const body=JSON.parse(init.body);validateRequest(body);
   const result=await rpc('agent_dispatch',{credential_hash:hash,...body});
   return Response.json(result.error?{error:result.error.message}:{data:result.data},{status:result.error?400:200});
  }});
  server=createApi({dispatch});server.listen(0,'127.0.0.1');await once(server,'listening');
  const url=`http://127.0.0.1:${server.address().port}/mcp`;
  let id=0;
  const call=async(method,params)=>{
   const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params})});
   assert.equal(response.status,200);const body=await response.json();assert(!body.error,JSON.stringify(body));return body.result;
  };
  const tools=await call('tools/list',{});
  assert(tools.tools.some(t=>t.name==='read_action_inbox'));
  assert(!tools.tools.some(t=>/clear_action|dismiss_action|resolve_action/.test(t.name)));
  const failure={applicationId,eventKey:'inbox-http-failure',expectedRevision:0,stage:'playwright',outcome:'blocked',reason:'Employer requires a manual step',nextAction:'Review employer form',attempts:[{stage:'playwright',status:'failed'}]};
  const failed=await call('tools/call',{name:'report_application_failure',arguments:failure});
  assert(!failed.isError,JSON.stringify(failed));
  const read=async()=>{
   const result=await call('tools/call',{name:'read_action_inbox',arguments:{state:'all'}});
   assert(!result.isError,JSON.stringify(result));return result.structuredContent||JSON.parse(result.content[0].text);
  };
  const inbox=await read();assert.equal(inbox.items.length,1);assert.equal(inbox.items[0].kind,'resolve_blocker');
  await call('tools/call',{name:'report_application_failure',arguments:failure});
  assert.equal((await read()).items.length,1);
  const browser=createBackend({auth:{getUser:async()=>({data:{user:{id:owner}}})},rpc:async(name,args)=>{
   assert.equal(name,'read_action_inbox');
   await db.query("select set_config('test.uid',$1,false)",[owner]);
   await db.exec('set role authenticated');
   try{return {data:(await db.query('select public.read_action_inbox($1) data',[args.payload])).rows[0].data};}finally{await db.exec('reset role');}
  }},owner);
  assert.deepEqual(await browser.readActionInbox({state:'all'}),inbox);
  assert(edgeCalls>=4,'Lightweight inbox CRUD must continue to use Edge');
 }finally{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await db.close();}
});

test('migration backfills existing blockers and registers only the owner invalidation table for Realtime',async()=>{
 const owner='11111111-1111-1111-1111-111111111111';
 const db=await createTestDatabase({beforeMigration:async(db,name)=>{
  if(!name.endsWith('_durable_action_inbox.sql'))return;
  await db.exec(`create publication supabase_realtime;insert into public.jobs(id,canonical_url,employer) values('inbox-upgrade','https://example.test/jobs/inbox-upgrade','{}');`);
  await db.query("insert into public.applications(user_id,job_id,draft,blocker) values($1,'inbox-upgrade','{}','Existing blocker')",[owner]);
 }});
 try{
  const rows=(await db.query('select * from public.action_inbox')).rows;
  assert.equal(rows.length,1);assert.equal(rows[0].reason,'Existing blocker');assert.equal(rows[0].resolved_at,null);
  assert.deepEqual((await db.query("select tablename from pg_publication_tables where pubname='supabase_realtime'")).rows,[{tablename:'workspace_changes'}]);
  assert((await db.query('select private.workspace_reset_tables() tables')).rows[0].tables.includes('public.action_inbox'));
 }finally{await db.close();}
});
