import test from 'node:test';
import assert from 'node:assert/strict';
import {validateArtifact,artifactWeek,artifactPrepDate} from '../lib/artifacts.mjs';
import {buildWeeklyPreparationAgenda} from '../lib/preparation-planner.mjs';
import {createTestDatabase} from './helpers/database.mjs';
import {createArtifactDemo} from '../next-app/lib/artifact-demo.mjs';
import {createMemoryStore} from '../next-app/lib/demo.mjs';
const owner='11111111-1111-1111-1111-111111111111',other='22222222-2222-2222-2222-222222222222',id='33333333-3333-4333-8333-333333333333';
const doc={id,expectedVersion:0,title:'Query plans',purpose:'Talk through a plan',kind:'interview_brief',format:'markdown',body:'Practice a plan.',prepOn:'2026-11-09',preparedFor:'2026-11-11',weekOf:'2026-11-02',sources:[],links:[]};
test('prep assignment is distinct from the target date, validates calendar dates and keeps mock scheduling separate',()=>{
 validateArtifact('artifacts.save',doc);assert.equal(artifactWeek(doc),'2026-11-09');assert.equal(artifactPrepDate(doc),'2026-11-09');
 for(const prepOn of ['2026-02-30','',null,'2026-11-09T12:00:00Z'])assert.throws(()=>validateArtifact('artifacts.save',{...doc,prepOn}));
 for(const kind of ['cover_letter','application_template'])assert.throws(()=>validateArtifact('artifacts.save',{...doc,kind}));
 assert.equal(artifactPrepDate({preparedFor:'2026-11-11'}),null);
 const event={id,version:1,content:doc};
 const agenda=buildWeeklyPreparationAgenda({calendarArtifacts:[event],today:'2026-11-07',weekOf:'2026-11-09',timeZone:'America/New_York'});
 const events=agenda.days.flatMap(d=>d.events);assert.equal(events.length,1);assert.equal(events[0].date,doc.prepOn);assert.equal(events[0].id,'material:'+id);assert(events[0].path.includes(id));
 assert.equal(agenda.days.reduce((n,d)=>n+d.plannedMinutes,0),0);
 assert.equal(buildWeeklyPreparationAgenda({calendarArtifacts:[{...event,archived:true}],weekOf:'2026-11-09'}).days.flatMap(d=>d.events).length,0);
});
test('browser and MCP share owned date saves, week reassignment, clear, versions, history, calendar privacy and scope checks',async()=>{
 const db=await createTestDatabase(),hash='e'.repeat(64),readHash='f'.repeat(64);
 const browser=async(operation,payload)=>(await db.query('select public.artifact_action($1,$2) data',[operation,payload])).rows[0].data;
 const agent=async(operation,payload,token=hash)=>(await db.query('select public.agent_dispatch($1,$2,$3) data',[token,operation,payload])).rows[0].data;
 try{
  for(const [token,scopes] of [[hash,['workspace:read','drafts:write']],[readHash,['workspace:read']]])await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Date test',$2,$3,now()+interval '1 hour')",[owner,token,scopes]);
  await db.query("select set_config('test.uid',$1,false)",[owner]);
  assert.equal((await browser('artifacts.save',doc)).version,1);assert.equal((await agent('artifacts.save',doc)).version,1);
  assert.equal((await browser('artifacts.list',{weekOf:'2026-11-02'})).items.length,0);
  assert.equal((await agent('artifacts.list',{weekOf:'2026-11-09'})).items[0].id,id);
  const snapshot=(await db.query('select public.read_preparation_planner() data')).rows[0].data;
  assert.deepEqual(snapshot,await agent('preparation.planner.read',{}));
  assert.equal(snapshot.calendarArtifacts[0].content.prepOn,doc.prepOn);assert(!JSON.stringify(snapshot.calendarArtifacts).includes('Practice a plan.'));
  const moved={...doc,expectedVersion:1,prepOn:'2026-11-16'};assert.equal((await agent('artifacts.save',moved)).version,2);
  await assert.rejects(browser('artifacts.save',{...doc,expectedVersion:1,prepOn:'2026-11-17'}));
  await assert.rejects(agent('artifacts.save',{...moved,expectedVersion:2},readHash));
  const {prepOn,...cleared}=moved;assert.equal((await browser('artifacts.save',{...cleared,expectedVersion:2})).version,3);
  assert.equal((await agent('artifacts.list',{weekOf:doc.weekOf})).items.length,1);
  assert.equal((await db.query('select public.read_preparation_planner() data')).rows[0].data.calendarArtifacts.length,0);
  assert.equal((await browser('artifacts.read',{id,version:1})).content.prepOn,doc.prepOn);
  for(const bad of [null,'2026-02-30',''])await assert.rejects(browser('artifacts.save',{...doc,expectedVersion:3,prepOn:bad}));
  await db.query("select set_config('test.uid',$1,false)",[other]);await assert.rejects(browser('artifacts.read',{id}));await assert.rejects(browser('artifacts.save',{...doc,expectedVersion:3}));
 }finally{await db.close();}
});
test('detached demo date changes move the same material and update its calendar without duplicate tasks',async()=>{
 const demo=createArtifactDemo(createMemoryStore({demo:{fictional:true}}));
 await demo.artifactAction('artifacts.save',doc);
 assert.equal((await demo.artifactAction('artifacts.list',{weekOf:'2026-11-09',query:'Query plans'})).items.length,1);
 assert(demo.artifactSnapshot().calendarArtifacts.some(a=>a.id===id&&a.content.prepOn===doc.prepOn));
 const {prepOn,...cleared}=doc;await demo.artifactAction('artifacts.save',{...cleared,expectedVersion:1});assert(!demo.artifactSnapshot().calendarArtifacts.some(a=>a.id===id));
});
