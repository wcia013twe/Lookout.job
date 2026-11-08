import test from 'node:test';
import assert from 'node:assert/strict';
import {swipeResponse,safeBoardReturn,matchesBoardApplication} from '../lib/action-board.mjs';
import {buildPreparationAgenda} from '../lib/preparation-planner.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {TOOLS} from '../supabase/functions/agent-mcp/protocol.mjs';
test('mobile decisions require deliberate horizontal release and never substitute for input',()=>{
 const base={width:360,canAccept:true,canReject:true};
 assert.equal(swipeResponse({...base,dx:100,dy:5}),'accept');
 assert.equal(swipeResponse({...base,dx:-100,dy:5}),'reject');
 for(const patch of [{dx:30,dy:0},{dx:100,dy:100},{dx:100,dy:0,canAccept:false},{dx:-100,dy:0,canReject:false}])assert.equal(swipeResponse({...base,...patch}),null);
 assert.equal(safeBoardReturn('/needs-you/'),'/needs-you/');
 for(const link of [null,'https://evil.test/','//evil.test/','/profile/','javascript:alert(1)'])assert.equal(safeBoardReturn(link),null);
});
test('MCP offers read-only board discovery and rejects identity and human decisions',()=>{
 assert(TOOLS.some(t=>t.name==='read_action_board'&&t.readOnly));
 assert.doesNotThrow(()=>validateRequest({operation:'actions.board.read',payload:{}}));
 for(const payload of [{ownerId:'other'},{approve:true}])assert.throws(()=>validateRequest({operation:'actions.board.read',payload}));
 assert.throws(()=>validateRequest({operation:'actions.board.respond',payload:{}}));
});
function fixture(){return {today:'2026-11-07',settings:{dailyMinutes:45},sessions:[],applications:{job:{id:'job',backendId:'app',company:'Fixture',status:'Interview',milestones:[{id:'m1',round_id:'r1',kind:'technical_round',label:'Opaque A',phase:'scheduled',occurred_at:'2026-11-10T17:00:00Z',confirmation:'confirmed',practice_category:'systems',time_zone:'UTC'},{id:'m2',round_id:'r2',kind:'technical_round',label:'Opaque B',phase:'scheduled',occurred_at:'2026-11-12T17:00:00Z',confirmation:'confirmed',practice_category:'coding',time_zone:'UTC'}]}},plans:[{application_id:'app',version:3,plan:{applicationId:'job',deadline:{date:null,status:'needs_confirmation'},tasks:[{id:'r1:practice',roundId:'r1',key:'practice',title:'Round A practice',minutes:30},{id:'r2:practice',roundId:'r2',key:'practice',title:'Round B practice',minutes:30}]}}]};}
test('typed round identity drives dates and practice without interpreting labels',()=>{
 const bundle=fixture(),agenda=buildPreparationAgenda(bundle),items=agenda.days.flatMap(d=>d.items);
 assert.deepEqual(agenda.interviews.map(i=>i.date),['2026-11-10','2026-11-12']);
 assert(items.some(i=>i.title==='Practice system design'));assert(items.some(i=>i.title==='Practice coding interviews'));
 assert(items.every(i=>i.targets.every(t=>t.expectedVersion===3)));
 bundle.applications.job.milestones.push({...bundle.applications.job.milestones[0],id:'m3',supersedes_id:'m1',occurred_at:'2026-11-11T17:00:00Z'});
 assert.equal(buildPreparationAgenda(bundle).interviews.find(i=>i.roundId==='r1').date,'2026-11-11');
 bundle.applications.job.milestones.at(-1).phase='completed';
 assert.equal(buildPreparationAgenda(bundle).interviews.length,1);
 bundle.holds=[{application_id:'app',resumed_at:null}];
 assert.equal(buildPreparationAgenda(bundle).interviews.length,0);
});
test('practice credit survives rescheduling and unknown categories stay general',()=>{
 const bundle=fixture();bundle.applications.job.milestones[0].practice_category='general';
 bundle.sessions=[{minutes:15,completed_at:'2026-11-07T12:00:00Z',targets:[{applicationId:'app',taskId:'r1:practice'}]}];
 const agenda=buildPreparationAgenda(bundle),items=agenda.days.flatMap(d=>d.items);
 assert(items.some(i=>i.title==='Round A practice'&&i.minutes===15));
 assert.equal(agenda.days[0].completedMinutes,15);
 assert(!items.some(i=>i.title==='Practice system design'));
});

test('detached demo shares stop, exact-review, outreach and round lifecycle behavior',async()=>{
 const {demoFixtures,createMemoryStore,createDemoServices}=await import('../next-app/lib/demo.mjs');
 const {withActionBoardDemo,enableActionBoardScenario}=await import('../next-app/lib/action-board-demo.mjs');
 const fixtures=demoFixtures('2026-11-07');enableActionBoardScenario(fixtures,'2026-11-07');
 const store=createMemoryStore(fixtures.state),services=withActionBoardDemo(createDemoServices(store),store);
 const act=(item,response,extra={})=>services.respondActionBoard({key:item.key,response,eventKey:crypto.randomUUID(),...extra});
 let board=await services.readActionBoard(),app=board.items.find(i=>i.kind==='review_application');
 await assert.rejects(act(app,'accept'),/Review/);await act(app,'review');
 const reviewed=(await services.readActionBoard()).items.find(i=>i.key===app.key);assert(reviewed.reviewed);
 await act(app,'reject');assert((await services.readActionBoard()).holds.some(h=>h.application_id===app.sourceId&&!h.resumed_at));
 await assert.rejects(services.queueApplicationJob({posting:{id:app.sourceId}}),/stopped/);
 await services.respondActionBoard({key:app.sourceId,response:'resume',expectedVersion:1,eventKey:crypto.randomUUID()});
 assert(!(await services.readActionBoard()).holds.some(h=>h.application_id===app.sourceId&&!h.resumed_at));
 board=await services.readActionBoard();const outreach=board.items.find(i=>i.kind==='review_outreach');
 await act(outreach,'review');await act(outreach,'accept');
 assert.equal((await services.readActionBoard()).outreach.find(i=>i.sourceId===outreach.sourceId).response,'accept');
 assert.equal(store.get('network.referrals').find(c=>c.id===outreach.sourceId).status,'Not asked');
 const proposal=board.items.find(i=>i.kind==='confirm_interview');await act(proposal,'accept');
 let bundle=await services.readPreparationPlanner();let agenda=buildPreparationAgenda({...bundle,today:'2026-11-07'});
 assert(agenda.interviews.some(i=>i.roundId==='demo-round-b'));
 const appRow=Object.values(bundle.applications).find(a=>a.backendId===proposal.applicationId),round=appRow.milestones.find(m=>m.round_id==='demo-round-b'&&m.supersedes_id);
 await services.recordApplicationMilestone(appRow.backendId,{eventKey:'cancel-fixture',supersedesId:round.id,kind:'technical_round',label:'Cancelled fixture',phase:'cancelled',occurredAt:null,source:{kind:'user'}});
 bundle=await services.readPreparationPlanner();agenda=buildPreparationAgenda({...bundle,today:'2026-11-07'});
 assert(!agenda.interviews.some(i=>i.roundId==='demo-round-b'));
});

test('round deadlines use the planner owner timezone, not the source event timezone',()=>{
 const bundle=fixture();bundle.timeZone='UTC';bundle.applications.job.milestones[0].occurred_at='2026-11-10T01:00:00Z';bundle.applications.job.milestones[0].time_zone='America/Los_Angeles';
 assert.equal(buildPreparationAgenda(bundle).interviews.find(i=>i.roundId==='r1').date,'2026-11-10');
 bundle.timeZone='America/Los_Angeles';assert.equal(buildPreparationAgenda(bundle).interviews.find(i=>i.roundId==='r1').date,'2026-11-09');
});

test('round prep authoring derives its deadline and preserves other rounds and completed IDs',async()=>{
 const {museFeatureDispatch}=await import('../supabase/functions/agent-gateway/muse-features.mjs');
 const bundle=fixture(),row=bundle.plans[0];row.plan.tasks[0].completed=true;row.plan.tasks[0].completedAt='2026-11-06T12:00:00Z';
 let saved;const response=await museFeatureDispatch({operation:'preparation.update',payload:{applicationId:'app',expectedVersion:3,roundId:'r1'},now:new Date('2026-11-07T12:00:00Z'),rpc:async(operation,payload)=>{
  if(operation==='preparation.read')return {data:{application:{job_id:'job',draft:{}},job:{employer:{title:'Backend engineer',company:'Fixture'}},preparation:row,rounds:bundle.applications.job.milestones,timeZone:'UTC'}};
  assert.equal(operation,'preparation.save');saved=payload.plan;return {data:payload};
 }});
 assert(response.data);assert.equal(saved.deadline.date,null,'No duplicate deadline is written');
 assert.deepEqual(saved.tasks.find(t=>t.id==='r2:practice'),row.plan.tasks[1]);
 assert.equal(saved.tasks.find(t=>t.id==='r1:practice').completed,true);
 assert(saved.tasks.filter(t=>t.roundId==='r1').every(t=>t.id.startsWith('r1:')));
 const id='11111111-1111-4111-8111-111111111111';
 assert.doesNotThrow(()=>validateRequest({operation:'preparation.update',payload:{applicationId:id,expectedVersion:1,roundId:id}}));
 assert.throws(()=>validateRequest({operation:'preparation.update',payload:{applicationId:id,expectedVersion:1,roundId:id,deadline:{date:'2026-11-10'}}}));
});

test('owned application links select exact native and imported identities',()=>{
 assert(matchesBoardApplication({id:'job',backendId:'app'},'app'));
 assert(matchesBoardApplication({id:'import:one'},'import:one'));
 assert(!matchesBoardApplication({id:'import:two'},'import:one'));
 assert(!matchesBoardApplication({id:'job'},'job'));
 assert(!matchesBoardApplication({id:'import:one'},null));
});
test('filled drafts, approved applications and explicit next actions stage with guarded human controls',async()=>{
 const {demoFixtures,createMemoryStore,createDemoServices}=await import('../next-app/lib/demo.mjs');
 const {withActionBoardDemo,enableActionBoardScenario}=await import('../next-app/lib/action-board-demo.mjs');
 const fixtures=demoFixtures('2026-11-07');enableActionBoardScenario(fixtures,'2026-11-07');
 const store=createMemoryStore(fixtures.state),services=withActionBoardDemo(createDemoServices(store),store);
 const board=await services.readActionBoard();
 for(const kind of ['prepared_application','submit_application','imported_action']){
  const item=board.items.find(i=>i.kind===kind);assert(item,kind);assert(item.canAccept&&item.canReject);
  if(kind!=='imported_action')await assert.rejects(services.respondActionBoard({key:item.key,response:'accept',eventKey:crypto.randomUUID()}),/form fields|Verification note/);
 }
 store.update('demo.boardImports',rows=>rows.map(row=>({...row,record:{...row.record,needsAction:false}})));
 assert(!(await services.readActionBoard()).items.some(i=>i.kind==='imported_action'));
});

test('scheduled interview context alone is not an action; an explicit confirmation task remains actionable',async()=>{
 const {demoFixtures,createMemoryStore,createDemoServices}=await import('../next-app/lib/demo.mjs');
 const {withActionBoardDemo,enableActionBoardScenario}=await import('../next-app/lib/action-board-demo.mjs');
 const fixtures=demoFixtures('2026-11-07');enableActionBoardScenario(fixtures,'2026-11-07');
 const store=createMemoryStore(fixtures.state),services=withActionBoardDemo(createDemoServices(store),store);
 const event=store.get('demo.boardImports').find(row=>row.identity_key==='demo-event-only');
 assert(event.record.rounds.some(round=>round.phase==='scheduled'));
 assert(!(await services.readActionBoard()).items.some(item=>item.sourceId===event.id));
 store.update('demo.boardImports',rows=>rows.map(row=>row.id===event.id?{...row,record:{...row.record,needsAction:true,nextAction:'Confirm interview time'}}:row));
 assert((await services.readActionBoard()).items.some(item=>item.sourceId===event.id));
 assert.deepEqual(store.get('demo.boardImports').find(row=>row.id===event.id).record.rounds,event.record.rounds);
});
