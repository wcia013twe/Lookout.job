import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPreparationAgenda, recordLocalPreparationSession, plannerToday } from '../lib/preparation-planner.mjs';
import { createPreparationPlan } from '../lib/preparation-model.mjs';
import { museFeatureDispatch } from '../supabase/functions/agent-gateway/muse-features.mjs';
import { validateRequest } from '../supabase/functions/agent-gateway/contract.mjs';
import { TOOLS } from '../supabase/functions/agent-mcp/protocol.mjs';
const today='2026-10-15', now=`${today}T14:00:00Z`;
function fixture(minutes=45) {
 const applications=Object.fromEntries(['one','two'].map(id=>[id,{id,backendId:id,company:`${id} systems`,title:'Database engineer',description:'SQL database services',status:'Interview'}]));
 const plans=Object.values(applications).map(application=>({application_id:application.id,version:1,plan:createPreparationPlan({application,now:today,deadline:{date:'2026-10-19',stage:'Technical interview',confirmed:true}})}));
 return {applications,plans,settings:{dailyMinutes:minutes,version:0},sessions:[],timeZone:'UTC'};
}
const agenda=bundle=>buildPreparationAgenda({...bundle,today});
test('calendar consolidates shared practice and resources, keeps company work separate, and stays within every daily budget',()=>{
 const bundle=fixture(), plan=agenda(bundle), items=plan.days.flatMap(d=>d.items);
 const practice=items.filter(i=>i.title==='Practice SQL and database questions');
 assert.ok(practice.length);assert.ok(practice.every(i=>i.targets.length===2));
 assert.ok(items.filter(i=>i.title.includes('Prepare questions')).every(i=>i.targets.length===1));
 assert.ok(plan.days.every(d=>d.plannedMinutes<=45));
 const total=items.reduce((sum,i)=>sum+i.minutes,0);
 assert.ok(total<bundle.plans.flatMap(r=>r.plan.tasks).reduce((sum,t)=>sum+t.minutes,0));
 assert.ok(items.every(i=>i.targets.every(t=>i.id.slice(0,10)<=t.deadline)));
 assert.deepEqual(agenda(bundle),plan);
});
test('short budgets split long tasks into honest sessions instead of dropping them',()=>{
 const bundle=fixture(15);bundle.plans.forEach(row=>{row.plan.tasks=row.plan.tasks.filter(t=>t.key==='practice');});
 const plan=agenda(bundle), items=plan.days.flatMap(d=>d.items);
 assert.equal(items.length,2);assert.deepEqual(items.map(i=>i.minutes),[15,15]);
 assert.equal(items[0].remainingAfter,15);assert.equal(items[1].remainingAfter,0);
 assert.equal(plan.unscheduled,0);
});
test('completed shared sessions consume time once and credit partial progress to all covered interviews',()=>{
 let bundle=fixture(45);bundle.plans.forEach(row=>{row.plan.tasks=row.plan.tasks.filter(t=>t.key==='practice');});
 const targets=bundle.plans.map(row=>({applicationId:row.application_id,expectedVersion:1,taskId:row.plan.tasks[0].id}));
 const input={sessionId:'session-1',minutes:15,targets};
 const next=recordLocalPreparationSession(bundle,input,now);
 assert.ok(next.plans.every(row=>row.version===2&&!row.plan.tasks[0].completed));
 assert.equal(agenda(next).days[0].completedMinutes,15);
 assert.equal(agenda(next).days.flatMap(d=>d.items).reduce((sum,i)=>sum+i.minutes,0),15);
 assert.deepEqual(recordLocalPreparationSession(next,input,now),next);
 const completed=recordLocalPreparationSession(next,{sessionId:'session-2',minutes:15,targets:targets.map(t=>({...t,expectedVersion:2}))},now);
 assert.ok(completed.plans.every(row=>row.plan.tasks[0].completed));
 assert.equal(agenda(completed).days[0].completedMinutes,30);
 assert.equal(agenda(completed).days.flatMap(d=>d.items).length,0);
 assert.throws(()=>recordLocalPreparationSession(next,{...input,sessionId:'new'},now),/changed/);
 assert.ok(bundle.plans.every(row=>row.version===1&&!row.plan.tasks[0].completed));
});
test('calendar leaves dormant, unknown, expired and closed processes out of active work',()=>{
 const bundle=fixture();
 bundle.plans[0].plan.deadline.date='2026-11-01';
 bundle.plans[1].plan.deadline.status='needs_confirmation';
 let plan=agenda(bundle);assert.equal(plan.dormantCount,1);assert.equal(plan.uncertainCount,1);assert.ok(plan.days.every(d=>!d.items.length));
 bundle.plans[0].plan.deadline.date='2026-10-14';plan=agenda(bundle);assert.equal(plan.expiredCount,1);
 bundle.applications.one.status='Rejected';assert.equal(agenda(bundle).expiredCount,0);
 bundle.applications.one.status='Interview';bundle.applications.one.milestones=[{kind:'rejected',phase:'received'}];assert.equal(agenda(bundle).expiredCount,0);
 assert.ok(agenda({...fixture(),settings:{dailyMinutes:0}}).days.every(d=>d.plannedMinutes===0));
 assert.throws(()=>agenda({...fixture(),settings:{dailyMinutes:241}}),/budget/);
});
test('coverage beats duplicated low-value work while near deadlines win equal coverage',()=>{
 const bundle=fixture(30);
 bundle.plans.forEach(row=>row.plan.tasks=row.plan.tasks.filter(t=>['practice','questions'].includes(t.key)));
 assert.equal(agenda(bundle).days[0].items[0].targets.length,2);
 bundle.plans.forEach(row=>row.plan.tasks=row.plan.tasks.filter(t=>t.key==='questions'));
 bundle.plans[0].plan.deadline.date=today;
 bundle.settings.dailyMinutes=15;
 assert.equal(agenda(bundle).days[0].items[0].targets[0].jobId,'one');
});
test('company-specific reports are not merged even when the resource URL matches',()=>{
 const bundle=fixture();
 for(const row of bundle.plans) {
  row.plan.guides=[{id:'report',url:'https://example.com/report',title:'Company report',companies:[bundle.applications[row.application_id].company],companyMatch:true}];
  row.plan.tasks=[{id:`${row.application_id}:guide-report`,key:'guide-report',guideId:'report',title:'Review company report',minutes:15,completed:false}];
 }
 assert.equal(agenda(bundle).days.flatMap(d=>d.items).length,2);
 assert.ok(agenda(bundle).days.flatMap(d=>d.items).every(i=>!i.shared&&i.targets.length===1));
});
test('session budget and target validation prevent double credit and partial local writes',()=>{
 const bundle=fixture(15), first=bundle.plans[0];
 const target={applicationId:first.application_id,expectedVersion:1,taskId:first.plan.tasks[0].id};
 assert.throws(()=>recordLocalPreparationSession(bundle,{sessionId:'s',minutes:16,targets:[target]},now),/budget/);
 assert.throws(()=>recordLocalPreparationSession(bundle,{sessionId:'s',minutes:15,targets:[target,{...target,applicationId:'foreign'}]},now),/changed/);
 assert.ok(bundle.plans.every(row=>row.version===1));
 assert.equal(plannerToday('2026-10-15T02:00:00Z','America/New_York'),'2026-10-14');
});
test('MCP planner uses the same owned snapshot and optimization as the website',async()=>{
 const bundle=fixture(), calls=[];
 const response=await museFeatureDispatch({operation:'preparation.planner.read',payload:{},now:new Date(now),rpc:async(op,payload)=>{calls.push([op,payload]);return{data:bundle,error:null};}});
 assert.deepEqual(response.data.agenda,agenda(bundle));
 assert.deepEqual(calls,[['preparation.planner.read',{}]]);
 for(const [operation,scope] of [['preparation.planner.read','workspace:read'],['preparation.budget','preferences:write'],['preparation.session.complete','drafts:write']]) assert.equal(TOOLS.find(t=>t.operation===operation).scope,scope);
 const denied={error:{code:'42501'}};assert.equal(await museFeatureDispatch({operation:'preparation.planner.read',payload:{},rpc:async()=>denied}),denied);
});
test('MCP contracts bound budgets, require all plan versions, reject arbitrary owners and report fabrication',()=>{
 const id='11111111-1111-1111-1111-111111111111';
 validateRequest({operation:'preparation.budget',payload:{dailyMinutes:0,expectedVersion:0}});
 const session={sessionId:id,minutes:15,targets:[{applicationId:id,taskId:'t',expectedVersion:1}]};
 validateRequest({operation:'preparation.session.complete',payload:session});
 for(const payload of [{...session,userId:id},{...session,minutes:0},{...session,targets:[{applicationId:id,taskId:'t'}]},{...session,targets:[...session.targets,...session.targets]}]) assert.throws(()=>validateRequest({operation:'preparation.session.complete',payload}));
 assert.throws(()=>validateRequest({operation:'preparation.planner.read',payload:{ownerId:id}}));
 const report={id:'r',title:'Report',url:'https://example.com/report',topics:['sql'],companies:['one systems'],minutes:15,source:'glassdoor',observedAt:today,evidence:'Saved report excerpt'};
 validateRequest({operation:'preparation.update',payload:{applicationId:id,expectedVersion:0,deadline:{date:today},resourceGuides:[report]}});
 assert.throws(()=>validateRequest({operation:'preparation.update',payload:{applicationId:id,expectedVersion:0,deadline:{date:today},resourceGuides:[{...report,evidence:''}]}}));
});
