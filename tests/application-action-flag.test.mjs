import test from 'node:test';
import assert from 'node:assert/strict';
import {applicationAction,nextActionTime} from '../lib/action-inbox.mjs';
import {demoFixtures,createMemoryStore} from '../next-app/lib/demo.mjs';

const now=Date.parse('2026-11-07T12:00:00Z');
const row={id:'review',application_id:'owned',kind:'review_application',reason:'Review the application.',created_at:'2026-11-07T00:00:00Z',available_at:'2026-11-07T00:00:00Z',resolved_at:null};
test('flags use saved application identity, never a guessed hiring stage or local import id',()=>{
 for(const kind of ['review_application','resolve_blocker','check_submission'])assert.equal(applicationAction({backendId:'owned'},[{...row,kind}],now).kind,kind);
 assert.equal(applicationAction({backendId:'other'},[row],now),null);
 assert.equal(applicationAction({id:'owned',status:'Interview'},[row],now),null);
 assert.equal(applicationAction({backendId:'owned',status:'Blocked'},[],now),null);
});
test('resolved and deferred actions do not raise flags; due actions appear without changing application status',()=>{
 const app={backendId:'owned',status:'Interview'};
 assert.equal(applicationAction(app,[{...row,resolved_at:'2026-11-07T10:00:00Z'}],now),null);
 const future={...row,available_at:'2026-11-07T13:00:00Z'};
 assert.equal(applicationAction(app,[future],now),null);
 const due=nextActionTime([future],now);
 assert.equal(applicationAction(app,[future],due).id,'review');
 assert.equal(app.status,'Interview');
});
test('fictional review flag resolves and resets in isolated demo storage',()=>{
 const fixture=demoFixtures('2026-11-07'),store=createMemoryStore(fixture.state),app=store.get('workflow.applications.demo-robinhood');
 const inbox=store.get('workflow.actionInbox');
 assert.equal(applicationAction(app,inbox,now)?.kind,'review_application');
 store.set('workflow.actionInbox',inbox.map(item=>({...item,resolved_at:new Date(now).toISOString(),resolution:'approved'})));
 assert.equal(applicationAction(app,store.get('workflow.actionInbox'),now),null);
 assert.equal(applicationAction(app,demoFixtures('2026-11-07').state.workflow.actionInbox,now)?.id,'demo-review-handoff');
});
