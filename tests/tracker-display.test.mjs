import test from 'node:test';
import assert from 'node:assert/strict';
import { trackerProgress } from '../legacy/tracker-display.mjs';
import { timelineItems } from '../lib/application-timeline.mjs';
test('preparation state does not erase manually reported hiring progress',()=>{
 const p=trackerProgress({status:'Blocked'},{status:'Interview',openedDate:'2026-10-01'});
 assert.equal(p.status,'Interview');assert.equal(p.dates[1],undefined);
});
test('rounds retain separate scheduled events and private notes',()=>{
 const app={status:'Interview',milestones:[1,2,3].map(n=>({id:`r${n}`,kind:'technical_round',label:`Round ${n}`,phase:n===3?'scheduled':'completed',occurred_at:`2026-10-${10+n}T12:00:00Z`,source:{kind:'user',note:`Private notes ${n}`}}))};
 assert.equal(trackerProgress(app).rounds,3);
 assert.deepEqual(timelineItems(app).map(e=>e.source.note),['Private notes 1','Private notes 2','Private notes 3']);
 assert.equal(timelineItems(app)[2].phase,'scheduled');
});
test('closed outcomes stay visible without inventing prior milestone dates',()=>{
 const p=trackerProgress({status:'Rejected'},{});assert.equal(p.status,'Rejected');assert.equal(p.level,0);assert.ok(p.dates.every(d=>d===undefined));
});
test('recorded terminal email events close the tracker even when the old status remains Interview',()=>{
 assert.equal(trackerProgress({status:'Interview',milestones:[{id:'rejection',kind:'rejected',phase:'received',source:{kind:'email'}}]}).status,'Rejected');
});
