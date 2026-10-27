import test from 'node:test';
import assert from 'node:assert/strict';
import {applicationStats} from '../lib/application-stats.mjs';

test('tracker totals include native and imported history while excluding drafts from submissions',()=>{
 const applications=[{id:'saved',status:'Opened'},{id:'draft',status:'Awaiting approval'},
  {id:'native',status:'Blocked'},{id:'imported',status:'Interview',imported:true},
  {id:'closed',status:'Rejected'},{id:'offer',status:'Offer'}];
 assert.deepEqual(applicationStats(applications,{native:{status:'Applied'},closed:{status:'Interview'}}),
  {tracked:6,applied:4,interviewing:1,offers:1});
});
test('terminal timeline outcomes exclude active interviews and offers but preserve submitted totals',()=>{
 const applications=[{id:'a',status:'Interview',milestones:[{id:'r',kind:'rejected',phase:'received'}]},
  {id:'b',status:'Offer',milestones:[{id:'w',kind:'withdrawn',phase:'completed'}]}];
 assert.deepEqual(applicationStats(applications),{tracked:2,applied:2,interviewing:0,offers:0});
 assert.deepEqual(applicationStats([]),{tracked:0,applied:0,interviewing:0,offers:0});
});
