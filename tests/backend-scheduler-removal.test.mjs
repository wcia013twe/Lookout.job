import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createTestDatabase} from './helpers/database.mjs';
import {createDispatch} from '../backend/runtime/service.ts';
import {createApi} from '../backend/runtime/api.ts';
import {createBackendJobsService} from '../lib/backend-jobs.mjs';

const owner='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',connection='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const schedule='dddddddd-dddd-4ddd-8ddd-dddddddddddd',oldJob='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const token='jb_agent_'+'b'.repeat(64),hash=createHash('sha256').update(token).digest('hex');
const routine={enabled:true,timezone:'UTC',configVersion:1,routines:[{id:'keep-my-agent',title:'Fictional task',sourceIds:[],connectionIds:[],enabled:true,mode:'scheduled',time:'09:00',description:'Fictional authorized Muse task'}]};

test('upgrade retires recurring execution, preserves history and My Agent routines, and keeps the website/Node MCP job flow',async()=>{
 let seeded=false;
 const db=await createTestDatabase({beforeMigration:async(db,name)=>{
  if(!name.endsWith('_remove_backend_search_scheduler.sql'))return;
  seeded=true;
  await db.query('insert into auth.users values($1)',[owner]);
  await db.query("insert into private.agent_connections(id,user_id,name,token_hash,scopes,expires_at) values($1,$2,'Fictional scheduler upgrade',$3,array['workspace:read','preferences:write','drafts:write'],now()+interval '1 day')",[connection,owner,hash]);
  await db.query("insert into public.search_documents(user_id,kind,id,version,content,projection) values($1,'profile','general',1,'{}','{\"active\":true}')",[owner]);
  const pref=(await db.query('insert into public.preferences(user_id) values($1) returning updated_at',[owner])).rows[0];
  await db.query("select set_config('test.uid',$1,false)",[owner]);
  await db.query("select public.configure_card_pack_preferences('preferences.notifications.save',$1)",[{settings:{schedule:routine},expectedUpdatedAt:pref.updated_at}]);
  await db.query("insert into private.backend_schedules(id,user_id,connection_id,kind,input,interval_minutes,enabled,next_run_at) values($1,$2,$3,'search_ats','{\"profileId\":\"general\"}',15,true,now()-interval '1 minute')",[schedule,owner,connection]);
  await db.query("insert into private.backend_jobs(id,user_id,connection_id,schedule_id,kind,input,status,result) values($1,$2,$3,$4,'search_ats','{\"profileId\":\"general\"}','completed','{\"summary\":\"Fictional retained result\"}')",[oldJob,owner,connection,schedule]);
  await db.query("insert into private.backend_requests(user_id,event_key,operation,payload,response) values($1,'old-schedule-retry','backend.schedules.save','{}','{\"id\":\"old-schedule\"}')",[owner]);
 }});
 let server;
 try {
  assert.ok(seeded);
  assert.equal((await db.query("select to_regclass('private.backend_schedules') as table_name")).rows[0].table_name,null);
  const archived=(await db.query("select response from private.backend_requests where user_id=$1 and operation='backend.schedules.retired'",[owner])).rows[0].response;
  assert.equal(archived.id,schedule);assert.equal(archived.enabled,true);
  assert.deepEqual((await db.query('select search from public.preferences where user_id=$1',[owner])).rows[0].search.schedule,routine);
  const kept=(await db.query('select schedule_id,status,result from private.backend_jobs where id=$1',[oldJob])).rows[0];
  assert.equal(kept.schedule_id,schedule);assert.equal(kept.status,'completed');assert.equal(kept.result.summary,'Fictional retained result');
  assert.ok(!(await db.query('select private.workspace_reset_tables() as names')).rows[0].names.includes('private.backend_schedules'));
  for(const operation of ['backend.schedules.save','backend.schedules.read'])await assert.rejects(db.query('select public.backend_job_dispatch($1,$2,$3)',[hash,operation,{eventKey:'old-schedule-retry'}]),/Unknown backend operation/);
  await assert.rejects(db.query("select public.backend_worker('enqueue_due','{}')"),/Unknown worker operation/);
  assert.equal((await db.query('select count(*)::int as count from private.backend_jobs')).rows[0].count,1);

  const rpc=async(name,args)=>{
   assert.ok(['agent_dispatch','backend_job_dispatch','backend_job_action'].includes(name));
   try {
    const browser=name==='backend_job_action';
    const result=await db.query(`select public.${name}(${browser?'$1,$2::jsonb':'$1,$2,$3::jsonb'}) as data`,browser?[args.operation,args.payload]:[args.credential_hash,args.operation,args.payload]);
    return {data:result.rows[0].data};
   }catch(error){return {error:{code:error.code}};}
  };
  server=createApi({dispatch:createDispatch({rpc,supabaseUrl:'http://127.0.0.1:54321',request:()=>{throw Error('Job operations must not use Edge');}})});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const http=async(path,body)=>{const response=await fetch(base+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};};
  const mcp=async(method,params)=>http('/mcp',{jsonrpc:'2.0',id:1,method,params});
  const tools=(await mcp('tools/list',{})).body.result.tools;
  assert.ok(tools.some(tool=>tool.name==='submit_backend_job'));
  for(const name of ['save_backend_schedule','read_backend_schedules'])assert.ok(!tools.some(tool=>tool.name===name));
  const retired=await http('/v1/operations',{operation:'backend.schedules.save',payload:{}});assert.equal(retired.status,400);
  const args={kind:'search_ats',input:{profileId:'general'},eventKey:'agent-scheduled-one-job'};
  const first=(await mcp('tools/call',{name:'submit_backend_job',arguments:args})).body;
  assert.ok(!first.error&&!first.result.isError,JSON.stringify(first));
  const job=JSON.parse(first.result.content[0].text);
  assert.equal(job.status,'queued');
  const replay=(await mcp('tools/call',{name:'submit_backend_job',arguments:args})).body;
  assert.equal(JSON.parse(replay.result.content[0].text).id,job.id);
  await db.query("select set_config('test.uid',$1,false)",[owner]);
  const website=createBackendJobsService({rpc,owner:async()=>owner});
  assert.ok((await website.read()).jobs.some(row=>row.id===job.id));
  const cancelled=await website.cancel({jobId:job.id,expectedVersion:job.version});assert.equal(cancelled.status,'cancelled');
  const browserJob=await website.submit({...args,eventKey:'website-one-job',connectionId:connection});assert.equal(browserJob.status,'queued');
  const claimed=(await db.query("select public.backend_worker('claim','{}') as data")).rows[0].data;
  assert.equal(claimed.job.id,browserJob.id);
  const finished=(await db.query("select public.backend_worker('finish',$1) as data",[{jobId:browserJob.id,leaseToken:claimed.leaseToken,expectedVersion:claimed.job.version,status:'partial',result:{summary:'Fictional bounded execution proof'}}])).rows[0].data;
  assert.equal(finished.status,'partial');
  assert.equal((await db.query('select search from public.preferences where user_id=$1',[owner])).rows[0].search.schedule.configVersion,1);
 }finally{if(server)await new Promise(resolve=>server.close(resolve));await db.close();}
});
