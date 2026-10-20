import test from 'node:test';
import assert from 'node:assert/strict';
import {profileOverviewStats} from '../lib/profile-overview.mjs';
test('overview account totals deduplicate roles and distinguish saved, applied and active stages',()=>{
 const state={tracker:{ids:['saved','interview','closed','offer','saved'],items:{saved:{status:'New'},interview:{status:'Interview'},closed:{status:'Applied'},offer:{status:'Offer'}}},workflow:{applications:{saved:{status:'Awaiting approval'},interview:{status:'Blocked'},closed:{status:'Rejected'},draft:{status:'Draft'},uncertain:{status:'Blocked'}}}};
 assert.deepEqual(profileOverviewStats(state),{tracked:6,applied:3,interviewing:1,offers:1});
});
test('closed email outcomes do not count as active interviews or offers',()=>{
 const applications={a:{status:'Interview',milestones:[{id:'r',kind:'rejected',phase:'received'}]},b:{status:'Offer',milestones:[{id:'w',kind:'withdrawn',phase:'completed'}]}};
 assert.deepEqual(profileOverviewStats({workflow:{applications}}),{tracked:2,applied:2,interviewing:0,offers:0});
 assert.deepEqual(profileOverviewStats({}),{tracked:0,applied:0,interviewing:0,offers:0});
});
