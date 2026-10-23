import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardTourKey,dashboardTourSteps,shouldStartDashboardTour} from '../next-app/lib/dashboard-tour.mjs';

test('dashboard tour is opt-in at onboarding handoff, once automatically, and always replayable',()=>{
 assert.equal(shouldStartDashboardTour(null,false),false);
 assert.equal(shouldStartDashboardTour('unknown',false),false);
 assert.equal(shouldStartDashboardTour('dashboard',false),true);
 assert.equal(shouldStartDashboardTour('dashboard',true),false);
 assert.equal(shouldStartDashboardTour('replay',true),true);
});
test('tour completion keys isolate account and guest state',()=>{
 assert.notEqual(dashboardTourKey('user-a'),dashboardTourKey('user-b'));
 assert.notEqual(dashboardTourKey('user-a'),dashboardTourKey(null));
 assert.equal(dashboardTourSteps.length,3);
 assert.match(dashboardTourSteps[2].text,/don’t need this dashboard open/);
});
