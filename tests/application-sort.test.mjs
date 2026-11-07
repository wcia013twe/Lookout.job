import test from 'node:test';
import assert from 'node:assert/strict';
import {sortActiveApplications, applicationSortDate} from '../lib/application-sort.mjs';
import {importedApplication} from '../lib/simplify-import.mjs';
test('active applications group advanced stages first and sort newest application dates within each group',()=>{
 const rows=[{id:'new-applied',status:'Submitted',submittedAt:'2026-11-07'},{id:'old-interview',status:'Interview',submittedAt:'2026-10-01'},{id:'new-offer',status:'Offer',submittedAt:'2026-11-02'},{id:'old-applied',status:'Submitted',submittedAt:'2026-10-10'},{id:'screen',status:'Phone Screen',submittedAt:'2026-10-20'}];
 const before=structuredClone(rows);
 assert.deepEqual(sortActiveApplications(rows).map(a=>a.id),['new-offer','screen','old-interview','new-applied','old-applied']);assert.deepEqual(rows,before);
});
test('imported, tracker-only and sourced process stages share priority and date rules',()=>{
 const imported=importedApplication({id:'imported',record:{status:'INTERVIEW',appliedDate:'2026-11-05'}});
 const rows=[{id:'tracker',status:'Blocked'},{id:'email',status:'Submitted',submittedAt:'2026-11-03',milestones:[{kind:'technical_round',phase:'scheduled',occurred_at:'2026-12-20'}]},imported,{id:'waiting',status:'Submitted',submittedAt:'2026-11-07'}];
 assert.deepEqual(sortActiveApplications(rows,{tracker:{status:'OA',appliedDate:'2026-11-06'}}).map(a=>a.id),['tracker','import:imported','email','waiting']);
 assert.equal(applicationSortDate(rows[1]),'2026-11-03');
});
test('missing and invalid dates sort last within their group, with stable ties and no inferred interview dates',()=>{
 const rows=[{id:'unknown',status:'Interview',milestones:[{kind:'technical_round',occurred_at:'2026-12-01',phase:'scheduled'}]},{id:'invalid',status:'Interview',submittedAt:'2026-02-30'},{id:'dated',status:'Interview',submittedAt:'2026-11-01'},{id:'same',status:'Interview',submittedAt:'2026-11-01'},{id:'waiting-unknown',status:'Submitted'},{id:'waiting-known',status:'Submitted',submittedAt:'2026-11-07'}];
 assert.equal(applicationSortDate(rows[0]),null);
 assert.deepEqual(sortActiveApplications(rows).map(a=>a.id),['dated','same','unknown','invalid','waiting-known','waiting-unknown']);
});
test('explicit tracker dates and current submission events are used without promoting closed outcomes',()=>{
 const rows=[{id:'closed',status:'Interview',submittedAt:'2026-11-07',milestones:[{kind:'rejected',phase:'received'}]},{id:'active',status:'Interview',milestones:[{id:'old',kind:'submitted',occurred_at:'2026-10-01'},{id:'correct',kind:'submitted',occurred_at:'2026-11-04',supersedes_id:'old'}]}];
 assert.equal(applicationSortDate(rows[1]),'2026-11-04');assert.equal(applicationSortDate(rows[1],{appliedDate:'2026-11-05'}),'2026-11-05');
 assert.deepEqual(sortActiveApplications(rows).map(a=>a.id),['active','closed']);
 assert.equal(applicationSortDate({id:'opened',trackerItem:{openedDate:'2026-11-02'}}),'2026-11-02');
});
