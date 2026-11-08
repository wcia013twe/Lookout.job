import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
import {applicationRounds,applicationRoundStats,roundStatsFromContext,validateImportedRounds} from '../lib/application-rounds.mjs';
import {trackerProgress} from '../lib/tracker-display.mjs';
import {applicationFlow} from '../lib/application-flow.mjs';
import {applicationNextAction} from '../lib/application-next-action.mjs';
import {museFeatureDispatch} from '../supabase/functions/agent-gateway/muse-features.mjs';
import {createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {React,renderToStaticMarkup,bundleComponent} from './helpers/render.mjs';
const round=(id,stage='INTERVIEW',phase='scheduled',extra={})=>({id,label:id,stage,type:'take_home',phase,date:'2026-11-11',notes:'Candidate report',cancelled:false,...extra});
test('rounds count stable imported IDs and native replacements, explicit stage overrides names/types, and completed rounds never imply Offer',()=>{
 const imported={status:'Submitted',imported:{record:{rounds:[round('screen-home','SCREEN','completed'),round('tech','INTERVIEW','scheduled',{type:'technical'}),round('cancel','INTERVIEW','received',{cancelled:true})]}}};
 const native={status:'Submitted',milestones:[{id:'old',kind:'technical_round',label:'Take home',phase:'scheduled',occurred_at:'2026-11-10T12:00:00Z',round:{stage:'SCREEN',type:'take_home'}},{id:'new',supersedes_id:'old',kind:'technical_round',label:'Take home',phase:'completed',round:{stage:'SCREEN',type:'take_home'}}]};
 const stats=applicationRoundStats([native,imported]);assert.equal(stats.total,4);assert.equal(stats.applicationsWithRounds,2);assert.equal(stats.byStage.SCREEN.completed,2);assert.equal(stats.byStage.INTERVIEW.scheduled,1);assert.equal(stats.cancelled,1);
 assert.equal(trackerProgress(native).status,'Screen');assert(trackerProgress(native).completed[2]);assert.equal(trackerProgress(imported).status,'Interview');assert(!trackerProgress(imported).completed[3]);
 const done={...imported,imported:{record:{rounds:[round('home','INTERVIEW','completed')]}}};assert.equal(trackerProgress(done).status,'Interview');assert(trackerProgress(done).completed[3]);
 assert.equal(applicationFlow([native,imported]).total,2);assert.equal(applicationNextAction(imported).label,'tech');assert.equal(applicationNextAction(done),null);
 assert.equal(applicationRounds({status:'Interview'}).length,0);assert.equal(applicationRounds({status:'Interview',activity:[{text:'Three rounds done'}]}).length,0);
});
test('round validation rejects ambiguous stages, duplicate IDs and guessed dates; context dedup matches the board',()=>{
 for(const rows of [[round('x','UNKNOWN')],[round('x'),round('x')],[round('x','SCREEN','scheduled',{date:'2026-02-30'})],[{...round('x'),extra:true}],[{...round('x'),cancelled:'false'}]])assert.throws(()=>validateImportedRounds(rows));
 const app={company:'Example',title:'Engineer',location:'Remote',url:'https://example.test/job',milestones:[]};
 assert.equal(roundStatsFromContext({applications:[app],imports:[{record:{...app,rounds:[round('duplicate')]}}]}).total,0);
});
test('real browser and scoped MCP writers/readers share exact native/imported round counts with owner/version/replay fences',async()=>{
 const db=await createTestDatabase(),u='11111111-1111-1111-1111-111111111111',other='22222222-2222-2222-2222-222222222222',hash='6'.repeat(64);
 try{
  await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Round test',$2,array['workspace:read','activity:write','tracking:write'],now()+interval '1 hour'),($3,'Foreign',repeat('7',64),array['workspace:read'],now()+interval '1 hour')",[u,hash,other]);
  await db.exec("insert into public.jobs(id,canonical_url,employer) values('round-test','https://example.test/native','{\"company\":\"Native\",\"title\":\"Engineer\"}');");
  const app=(await db.query("insert into public.applications(user_id,job_id,draft,status) values($1,'round-test','{}','Submitted') returning id",[u])).rows[0].id;
  const sql=async(op,payload={},h=hash)=>(await db.query('select public.agent_dispatch($1,$2,$3) data',[h,op,payload])).rows[0].data;
  const human=async(payload)=>(await db.query("select set_config('test.uid',$1,false)",[u]),(await db.query('select to_jsonb(public.record_application_milestone($1,$2)) data',[app,payload])).rows[0].data);
  const first={eventKey:'screen-home',kind:'technical_round',label:'Take home',phase:'completed',occurredAt:null,round:{stage:'SCREEN',type:'take_home'},practiceCategory:'coding',timeZone:'America/New_York',source:{kind:'user'}};
  const screen=await human(first);assert.equal(screen.round.stage,'SCREEN');assert.equal(screen.round_id,screen.id);assert.equal(screen.practice_category,'coding');assert.equal(screen.time_zone,'America/New_York');
  const next={applicationId:app,eventKey:'tech',kind:'technical_round',label:'Technical 1',phase:'scheduled',occurredAt:null,round:{stage:'INTERVIEW',type:'technical'},source:{kind:'user_reported',note:'Candidate described the round.'}};
  const scheduled=await sql('applications.milestone',next);assert.deepEqual(await sql('applications.milestone',next),scheduled);
  await assert.rejects(sql('applications.milestone',{...next,round:{stage:'SCREEN',type:'oa'}}),error=>error.code==='40001');
  const completed=await sql('applications.milestone',{...next,eventKey:'complete-tech',supersedesId:scheduled.id,phase:'completed',round:undefined});assert.equal(completed.round_id,scheduled.round_id);assert.deepEqual(completed.round,scheduled.round);assert.equal(applicationRounds({milestones:[scheduled,completed]})[0].id,scheduled.round_id);
  await sql('applications.milestone',{...next,eventKey:'cancel-manager',label:'Manager',phase:'cancelled',round:{stage:'INTERVIEW',type:'hiring_manager'}});
  const row={company:'Imported',title:'Engineer',location:'Remote',url:null,status:'APPLIED',employmentType:'FT',appliedDate:'2026-11-01',statusDate:null,archived:false,archivedDate:null,notes:'Original notes'};
  await sql('imports.save',{rows:[row],expectedVersion:0,eventKey:'round-import'});
  const imported=(await sql('imports.list')).records[0];
  const update={id:imported.id,expectedVersion:1,eventKey:'rounds',changes:{rounds:[round('home','SCREEN','completed'),round('technical','INTERVIEW'),round('cancelled','INTERVIEW','received',{cancelled:true})]}};
  const saved=await sql('imports.update',update);assert.equal(saved.record.record.status,'INTERVIEW');assert.deepEqual(saved.record.source_rows,imported.source_rows);
  assert.deepEqual(await sql('imports.update',update),saved);await assert.rejects(sql('imports.update',{...update,eventKey:'stale'}),e=>e.code==='40001');
  await db.exec('alter role service_role bypassrls; set role service_role');
  const context=await sql('applications.round_stats'),expected=roundStatsFromContext(context);
  await db.exec('reset role');
  assert(context.applications[0].milestones.every(m=>m.round_id&&m.confirmation));
  assert.equal(expected.total,6);assert.equal(expected.byStage.SCREEN.completed,2);assert.equal(expected.byStage.INTERVIEW.completed,1);assert.equal(expected.byStage.INTERVIEW.scheduled,1);assert.equal(expected.cancelled,2);
  const rpc=async(op,payload)=>{try{return {data:await sql(op,payload),error:null};}catch(error){return {error};}};
  const handler=createHandler(async(_token,op,payload)=>{validateRequest({operation:op,payload});if(op==='credentials.verify')return {status:200,data:{scopes:['workspace:read']}};const result=await museFeatureDispatch({operation:op,payload,rpc});return {status:result.error?400:200,data:result.data};});
  const response=await (await handler(new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+'a'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'read_application_round_stats',arguments:{}}})}))).json();
  assert(!response.result.isError);const actual=response.result.structuredContent||JSON.parse(response.result.content[0].text);assert.deepEqual(actual,expected);assert(!JSON.stringify(actual).includes('Original notes'));
  assert.equal(roundStatsFromContext(await sql('applications.round_stats',{},'7'.repeat(64))).total,0);
  await assert.rejects(sql('applications.round_stats',{userId:other}));
  await assert.rejects(human({...first,eventKey:'invalid-round',round:{stage:'ADMIN',type:'take_home'}}));
  await assert.rejects(sql('imports.update',{id:imported.id,expectedVersion:2,eventKey:'bad-round-date',changes:{rounds:[round('bad','SCREEN','received',{date:'2026-02-30'})]}}));
 }finally{await db.close();}
});
test('round summary renders round units separately from application totals',async()=>{
 const Component=(await bundleComponent('next-app/components/application-round-stats.tsx'))();
 const html=renderToStaticMarkup(React.createElement(Component,{applications:[{imported:{record:{rounds:[round('one'),round('two','SCREEN','completed')]}}}]}));assert.match(html,/2 rounds across 1 application/);assert.match(html,/Saved round counts/);assert.match(html,/Completed/);
});
test('the resettable round demo covers staged take-home, pending, scheduled and cancelled rounds without changing ordinary fixtures',async()=>{
 const {demoFixtures}=await import('../next-app/lib/demo.mjs');const {withApplicationFlowDemo}=await import('../next-app/lib/application-flow-demo.mjs');
 const make=()=>withApplicationFlowDemo(demoFixtures('2026-11-07'),'application-rounds');
 const first=make(),stats=applicationRoundStats(Object.values(first.state.workflow.applications));
 assert(stats.byType.take_home.completed>0);assert(stats.pending>0);assert(stats.scheduled>0);assert(stats.cancelled>0);
 first.state.workflow.applications['demo-interview'].milestones.length=0;
 assert(applicationRoundStats(Object.values(make().state.workflow.applications)).total>applicationRoundStats(Object.values(first.state.workflow.applications)).total);
 assert(!demoFixtures('2026-11-07').state.workflow.applications['demo-interview'].milestones.some(row=>row.id==='demo-rounds-home'));
});
