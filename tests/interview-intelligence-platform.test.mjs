import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createTestDatabase} from './helpers/database.mjs';
import {createDispatch,credentialHash} from '../backend/runtime/service.ts';
import {createApi} from '../backend/runtime/api.ts';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {TOOLS} from '../supabase/functions/agent-mcp/protocol.mjs';
import {createCircleKnowledgeDemo} from '../lib/circle-knowledge-demo.mjs';
const A='11111111-1111-1111-1111-111111111111',B='22222222-2222-2222-2222-222222222222';
const appA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',appB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const jobId='catalog-bloomberg-ny-2026',url='https://example.com/bloomberg/new-grad/2026';
test('posting intelligence shares human/Node MCP authorization, published evidence and exact posting scope',async()=>{
 const db=await createTestDatabase();let server;let event=0;
 async function human(user,operation,payload={}){
  if(!['knowledge.interview','knowledge.read','knowledge.search','circles.list','circles.read'].includes(operation))payload={...payload,eventKey:payload.eventKey||`event-${++event}`};
  await db.query("select set_config('test.uid',$1,false)",[user]);await db.exec('set role authenticated');
  try{return (await db.query('select public.knowledge_action($1,$2::jsonb) result',[operation,JSON.stringify(payload)])).rows[0].result;}finally{await db.exec('reset role');}
 }
 try{
  await db.exec('update private.knowledge_config set enabled=true');
  await db.query('insert into public.jobs(id,canonical_url,employer) values($1,$2,$3::jsonb)',[jobId,url,JSON.stringify({company:'Bloomberg',title:'New Grad Software Engineer'})]);
  await db.query('insert into public.applications(id,user_id,job_id) values($1,$2,$3),($4,$5,$3)',[appA,A,jobId,appB,B]);
  const circle=(await human(B,'circles.create',{name:'Fictional Bloomberg',alias:'Peer'})).circleId;
  const invite=await human(B,'circles.invite',{circleId:circle});await human(A,'circles.join',{token:invite.token,alias:'Reader'});
  const content={type:'interview_report',title:'Fictional OA report',body:'',insight:'My fictional OA had two tasks.',company:'Bloomberg',role:'New Grad Software Engineer',stage:'OA',jobId:'EMPLOYER-777',jobUrl:url,experienceDate:'2026-10-26',sources:[],provenance:'user_confirmed',personalDisclosure:true,uncertainty:'Fictional individual experience.'};
  async function publish(extra={},published=true){
   const p=await human(B,'knowledge.propose',{circleId:circle,expectedRevision:0,content:{...content,...extra},eventKey:`p${++event}`});
   if(published){await human(B,'knowledge.approve',{circleId:circle,postId:p.postId,expectedRevision:1});await human(B,'knowledge.publish',{circleId:circle,postId:p.postId,expectedRevision:1,eventKey:`s${++event}`});}return p.postId;
  }
  const expected=await publish();
  await publish({title:'Other posting',jobId:'EMPLOYER-888',jobUrl:'https://example.com/bloomberg/new-grad/2025'});
  await publish({title:'Unpublished'},false);
  await publish({title:'Technical report',stage:'Technical'});
  const context=await publish({title:'Context-linked report',company:'Cedar',role:'Other',jobId:'other',jobUrl:'https://example.com/other',experienceDate:'2026-10-24',contexts:[{kind:'application',label:'Bloomberg application',company:'Bloomberg',role:'New Grad Software Engineer',jobUrl:url,stage:'OA'}]});
  await db.exec('set role authenticated');
  await assert.rejects(()=>db.query('select private.interview_intelligence($1,$2::jsonb)',[B,JSON.stringify({jobId})]),/permission denied/);await db.exec('reset role');
  const payload={applicationId:appA,stage:'oa'};
  let packet=await human(A,'knowledge.interview',payload);
  assert.deepEqual(packet.evidence.map(r=>r.sourceId),[expected,context]);assert.equal(packet.scope.jobId,jobId);
  assert.equal(packet.scope.match,'exact_posting');assert.equal(packet.evidence[0].source.revision,1);
  assert.equal((await human(A,'knowledge.interview',{jobId,stage:'OA',since:'2026-10-25',limit:1})).evidence[0].sourceId,expected);
  assert.equal((await human(A,'knowledge.interview',{jobId,stage:'Offer'})).automaticAction,'suppress');
  for(const bad of [{applicationId:appB},{jobId,ownerId:B},{jobId,limit:11},{jobId,since:'2026-02-30'},{jobId,since:'2026-10-27',until:'2026-10-20'},{jobId,applicationId:appA}])await assert.rejects(()=>human(A,'knowledge.interview',bad));
  const token='jb_agent_'+'f'.repeat(64),hash=credentialHash(token);
  await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Intel test',$2,array['workspace:read','knowledge:read'],now()+interval '1 day')",[A,hash]);
  const rpc=async(name,args)=>{try{const result=await db.query('select public.agent_dispatch($1,$2,$3::jsonb) result',[args.credential_hash,args.operation,JSON.stringify(args.payload)]);return {data:result.rows[0].result,error:null};}catch(error){return {data:null,error:{code:error.code,message:error.message}};}};
  const dispatch=createDispatch({rpc,supabaseUrl:'http://localhost:54321',request:async()=>{throw Error('Must use Node credential RPC, not Edge forwarding');}});
  assert.deepEqual((await dispatch(token,'knowledge.interview',payload)).data,packet);
  server=createApi({dispatch});server.listen(0,'127.0.0.1');await once(server,'listening');
  const response=await fetch(`http://127.0.0.1:${server.address().port}/mcp`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'read_interview_intelligence',arguments:payload}})});
  const body=await response.json();assert.equal(response.status,200);assert(!body.result?.isError,JSON.stringify(body));
  assert.deepEqual(JSON.parse(body.result.content[0].text),packet);
  await db.query("update private.agent_connections set scopes=array['workspace:read'] where token_hash=$1",[hash]);assert.equal((await dispatch(token,'knowledge.interview',payload)).status,403);
  await db.query("update private.agent_connections set scopes=array['knowledge:read'] where token_hash=$1",[hash]);assert.equal((await dispatch(token,'knowledge.interview',payload)).status,403);
  await db.query("update private.agent_connections set scopes=array['workspace:read','knowledge:read'] where token_hash=$1",[hash]);
  await human(B,'knowledge.propose',{circleId:circle,postId:expected,expectedRevision:1,content:{...content,insight:'Unpublished changed wording'},eventKey:`edit${++event}`});
  packet=await human(A,'knowledge.interview',payload);assert.equal(packet.evidence[0].insight,content.insight,'only the published revision is readable');
  await human(B,'knowledge.withdraw',{circleId:circle,postId:expected,expectedRevision:2,eventKey:`withdraw${++event}`});
  assert(!(await human(A,'knowledge.interview',payload)).evidence.some(r=>r.sourceId===expected));
  await human(A,'circles.leave',{circleId:circle});
  assert.deepEqual((await human(A,'knowledge.interview',payload)).evidence,[]);
  assert.equal((await dispatch(token,'knowledge.interview',payload)).data.status,'no_discussions');
  await db.query('update private.agent_connections set revoked_at=now() where token_hash=$1',[hash]);assert.equal((await dispatch(token,'knowledge.interview',payload)).status,401);
 }finally{if(server)await new Promise(r=>server.close(r));await db.close();}
});
test('interview tool and fictional demo expose bounded evidence without global writes',()=>{
 assert(TOOLS.some(t=>t.name==='read_interview_intelligence'));
 assert.doesNotThrow(()=>validateRequest({operation:'knowledge.interview',payload:{jobId,limit:3}}));
 for(const payload of [{},{jobId,applicationId:appA},{jobId,ownerId:A}])assert.throws(()=>validateRequest({operation:'knowledge.interview',payload}));
 const demo=createCircleKnowledgeDemo({getJobs:()=>[{id:'demo-interview',company:'Cedar Systems (demo)',title:'Backend Engineer'},{id:'empty-demo',company:'Cedar Systems (demo)',title:'Backend Engineer'}]});
 const report=demo.action('knowledge.interview',{jobId:'demo-interview'});assert.equal(report.evidence.length,1);assert.match(report.evidence[0].insight,/Fictional/);
 assert.equal(demo.action('knowledge.interview',{jobId:'empty-demo'}).status,'no_discussions');
 demo.action('circles.leave',{circleId:'demo-circle'});assert.deepEqual(demo.action('knowledge.interview',{jobId:'demo-interview'}).evidence,[]);
});
