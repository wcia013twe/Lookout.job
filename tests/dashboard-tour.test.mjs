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
 assert.equal(dashboardTourSteps.length,7);
 assert.match(dashboardTourSteps[0].text,/don’t need this dashboard open/);
});

import {showAgentEmptyState} from '../next-app/lib/discover-view.mjs';
test('new personal workspaces wait for a private batch while public browsing and regular demos remain available',()=>{
 assert.equal(showAgentEmptyState({signedIn:true,hasPrivateBatch:false}),true);
 assert.equal(showAgentEmptyState({signedIn:true,hasPrivateBatch:true}),false);
 assert.equal(showAgentEmptyState({signedIn:false,hasPrivateBatch:false}),false);
 assert.equal(showAgentEmptyState({demo:true,demoArrival:true}),true);
 assert.equal(showAgentEmptyState({demo:true,demoArrival:false}),false);
 assert.equal(dashboardTourSteps.at(-1).illustration,'circles');
 assert.ok(dashboardTourSteps.some(step=>step.illustration==='tools'));
 assert.equal(dashboardTourSteps.some(step=>step.targets.includes('[data-dashboard-tour="profile"]')),false);
});

test('tour introduces the workspace then each navigation tab separately, with the Network illustration',()=>{
 assert.deepEqual(dashboardTourSteps.slice(1).map(step=>step.targets.length),[1,1,1,1,1,1]);
 assert.deepEqual(dashboardTourSteps.slice(1).map(step=>step.title),['Action board','Discover','Applications','Network','Career Toolkit','Community']);
 assert.equal(dashboardTourSteps.find(step=>step.title==='Network').illustration,'network');
});
