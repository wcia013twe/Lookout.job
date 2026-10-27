import test from 'node:test';
import assert from 'node:assert/strict';
import {applicationFlow} from '../lib/application-flow.mjs';
import {applicationStats} from '../lib/application-stats.mjs';

test('flow partitions submitted progress into current outcomes without inventing past stages or ghosting',()=>{
 const applications=[{id:'saved',status:'Opened'},{id:'draft',status:'Approved'},
  {id:'waiting',status:'Applied'},{id:'screen',status:'Blocked',milestones:[{kind:'phone_screen'}]},
  {id:'interview',status:'Blocked'},{id:'offer',status:'Offer'},
  {id:'rejected',status:'Interview',milestones:[{kind:'rejected'}]},
  {id:'withdrawn',status:'Submitted',milestones:[{kind:'withdrawn'}]},
  {id:'unknown',status:'Rejected'}];
 const items={interview:{status:'Interview'}};
 const flow=applicationFlow(applications,items);
 assert.equal(flow.total,6);
 assert.equal(flow.total,applicationStats(applications,items).applied);
 assert.deepEqual(flow.destinations.map(({id,count})=>[id,count]),[['waiting',1],['screen',1],['interview',1],['offer',1],['rejected',1],['withdrawn',1]]);
 assert.equal(flow.links.reduce((sum,link)=>sum+link.value,0),flow.total);
 assert.ok(flow.links.every(link=>link.source==='applied'&&link.target!=='applied'));
 assert.ok(!JSON.stringify(flow).includes('ghost'));
});
test('native and imported submission evidence share flow rules and input stays unchanged',()=>{
 const applications=[{id:'receipt',status:'Blocked',submitted_at:'2026-10-01'},
  {id:'import',imported:true,status:'Applied'}, {id:'new',status:'New'}];
 const before=structuredClone(applications),flow=applicationFlow(applications);
 assert.deepEqual(flow.links,[{source:'applied',target:'waiting',value:2}]);
 assert.deepEqual(applications,before);
 assert.deepEqual(applicationFlow([]),{total:0,destinations:[],nodes:[],links:[]});
 assert.equal(applicationFlow([{id:'draft',status:'Draft'}]).nodes.length,0);
});

import {withApplicationFlowDemo} from '../next-app/lib/application-flow-demo.mjs';
test('fictional flow fixtures cover all branches, single outcome and empty state without persistence',()=>{
 const fixture=()=>({state:{workflow:{applications:{}},tracker:{ids:[],items:{}}}});
 for(const [scenario,expected] of [['application-flow',6],['application-flow-single',1],['application-flow-empty',0]]){
  const data=withApplicationFlowDemo(fixture(),scenario).state;
  const flow=applicationFlow(Object.values(data.workflow.applications),data.tracker.items);
  assert.equal(flow.total,expected);assert.equal(flow.links.length,expected);
 }
 const untouched=fixture();assert.equal(withApplicationFlowDemo(untouched,'other'),untouched);
});
