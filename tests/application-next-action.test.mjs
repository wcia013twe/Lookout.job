import test from 'node:test';
import assert from 'node:assert/strict';
import {applicationNextAction,sortByNextAction} from '../lib/application-next-action.mjs';
import {sortActiveApplications} from '../lib/application-sort.mjs';
import {demoFixtures,createMemoryStore} from '../next-app/lib/demo.mjs';
import {createDemoServices} from '../next-app/lib/muse-demo-fixtures.mjs';
import {React,renderToStaticMarkup,bundleComponent} from './helpers/render.mjs';

const scheduled=(id,date,extra={})=>({id,kind:'technical_round',label:'Technical interview',phase:'scheduled',occurred_at:date,source:{kind:'user',timestampConfirmed:true},...extra});
const plan=(date,extra={})=>({applicationId:'app',deadline:{date,status:'confirmed',stage:'Technical interview'},tasks:[{completed:false}],...extra});
test('only recorded scheduled rounds supply dates; completed, superseded, unknown and invalid dates stay out',()=>{
 const app={id:'app',status:'Interview',milestones:[scheduled('old','2026-11-08T10:00:00Z'),scheduled('new','2026-11-10T14:00:00Z',{supersedes_id:'old'}),scheduled('done','2026-11-01T10:00:00Z',{phase:'completed'}),scheduled('unknown',null),scheduled('invalid','2026-02-30')]};
 const before=structuredClone(app);
 assert.equal(applicationNextAction(app).date,'2026-11-10T14:00:00Z');
 assert.deepEqual(app,before);
 assert.equal(applicationNextAction({status:'Interview'}),null);
 assert.equal(applicationNextAction({status:'Blocked',actionInbox:[{available_at:'2026-11-01'}]}),null);
});
test('confirmed unfinished preparation deadline is optional, owned, and never replaces a recorded round lifecycle',()=>{
 const app={id:'app'};
 assert.equal(applicationNextAction(app,plan('2026-11-09')).date,'2026-11-09');
 for(const p of [plan('next Friday'),plan('2026-02-30'),plan(null),plan('2026-11-09',{applicationId:'other'}),plan('2026-11-09',{tasks:[{completed:true}]}),plan('2026-11-09',{deadline:{date:'2026-11-09',status:'needs_confirmation'}})])assert.equal(applicationNextAction(app,p),null);
 const scheduledApp={...app,milestones:[scheduled('a','2026-11-10T14:00:00Z',{label:'Technical round 1'})]};
 assert.equal(applicationNextAction(scheduledApp,plan('2026-11-10')).date,'2026-11-10T14:00:00Z');
 assert.equal(applicationNextAction({...app,milestones:[scheduled('a','2026-11-10T14:00:00Z',{phase:'completed'})]},plan('2026-11-10')),null);
 assert.equal(applicationNextAction({...app,milestones:[scheduled('a',null,{phase:'completed'})]},plan('2026-11-10')),null);
});
test('terminal and archived applications never have a next action date',()=>{
 for(const extra of [{archived:true},{status:'Closed'},{status:'Rejected'},{status:'Withdrawn'},{milestones:[{kind:'rejected',phase:'received'}]}])assert.equal(applicationNextAction({id:'app',milestones:[scheduled('a','2026-11-10')],...extra},plan('2026-11-10')),null);
});
test('optional sort uses earliest pending date, then stable existing order for ties and undated applications',()=>{
 const rows=[{id:'future',status:'Interview',submittedAt:'2026-11-06',milestones:[scheduled('future','2026-11-12')]},{id:'waiting',status:'Submitted',submittedAt:'2026-11-07'},{id:'overdue',status:'Submitted',milestones:[scheduled('overdue','2026-11-01')]},{id:'same',status:'Interview',milestones:[scheduled('same','2026-11-12')]},{id:'unknown',status:'Interview'}];
 const before=structuredClone(rows),defaultOrder=sortActiveApplications(rows);
 assert.deepEqual(defaultOrder.map(app=>app.id),['future','overdue','same','unknown','waiting']);
 assert.deepEqual(sortByNextAction(defaultOrder).map(app=>app.id),['overdue','future','same','unknown','waiting']);
 assert.deepEqual(rows,before);
});
test('existing demo milestone writer reschedules and completes next action without creating a second date store',async()=>{
 const fixture=demoFixtures('2026-11-07'),store=createMemoryStore(fixture.state),api=createDemoServices(store),id='demo-interview';
 let app=store.get(`workflow.applications.${id}`),old=app.milestones.find(row=>row.id.endsWith('technical-round-1'));
 const moved=await api.recordApplicationMilestone(id,{eventKey:'next-action-move',kind:'technical_round',label:old.label,phase:'scheduled',occurredAt:'2026-11-12T15:00:00Z',source:{kind:'user',timestampConfirmed:true},supersedesId:old.id});
 app=store.get(`workflow.applications.${id}`);
 assert.equal(applicationNextAction(app).date,'2026-11-12T15:00:00Z');
 await api.recordApplicationMilestone(id,{eventKey:'next-action-done',kind:'technical_round',label:old.label,phase:'completed',occurredAt:'2026-11-12T15:00:00Z',source:{kind:'user',timestampConfirmed:true},supersedesId:moved.id});
 assert.equal(applicationNextAction(store.get(`workflow.applications.${id}`)),null);
 assert.notEqual(applicationNextAction(demoFixtures('2026-11-07').state.workflow.applications[id]).date,'2026-11-12T15:00:00Z');
});
test('date display is absent when unknown, can stand alone, and accompanies an independent Needs action flag',async()=>{
 const Component=(await bundleComponent('next-app/components/application-action-notice.tsx'))();
 const render=props=>renderToStaticMarkup(React.createElement(Component,{title:'Engineer',company:'Example',onOpen(){},...props}));
 assert.equal(render({}), '');
 const dateOnly=render({next:{date:'2026-11-09',label:'Assessment deadline'}});
 assert.match(dateOnly,/Next action/);assert.match(dateOnly,/<time dateTime="2026-11-09">/);assert.doesNotMatch(dateOnly,/Needs action/);
 const flagged=render({action:{reason:'Review application'},next:{date:'2026-11-09T14:00:00Z',label:'Technical interview'}});
 assert.match(flagged,/Needs action/);assert.match(flagged,/Review application/);assert.match(flagged,/dateTime="2026-11-09T14:00:00Z"/);
});
