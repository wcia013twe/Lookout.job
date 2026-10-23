import test from 'node:test';
import assert from 'node:assert/strict';
import { ONBOARDING_TOOLS } from '../supabase/functions/agent-gateway/onboarding.mjs';
import { validateRequest } from '../supabase/functions/agent-gateway/contract.mjs';
import { TOOLS } from '../supabase/functions/agent-mcp/protocol.mjs';
import { createDemoServices } from '../next-app/lib/muse-demo-fixtures.mjs';
import { createMemoryStore, demoFixtures } from '../next-app/lib/demo.mjs';
test('onboarding conversation is discoverable through the same scoped MCP contract',()=>{
 for(const tool of ONBOARDING_TOOLS){assert.ok(TOOLS.some(t=>t.name===tool.name&&t.operation===tool.operation));assert.equal(tool.inputSchema.additionalProperties,false);}
 assert.doesNotThrow(()=>validateRequest({operation:'onboarding.get_state',payload:{}}));
 for(const payload of [{owner_id:'other'},{expectedRevision:0},{userId:'other'}])assert.throws(()=>validateRequest({operation:'onboarding.get_state',payload}));
 assert.throws(()=>validateRequest({operation:'onboarding.submit_step',payload:{expectedRevision:-1,eventKey:'x',event:'intent',data:{text:'backend'}}}));
 assert.throws(()=>validateRequest({operation:'tasks.create',payload:{expectedRevision:0,eventKey:'x',kind:'discover',target:{},userId:'other'}}));
 assert.doesNotThrow(()=>validateRequest({operation:'tasks.report_result',payload:{taskId:'id',claimToken:'token',expectedRevision:1,state:'needs_user',result:{summary:'No verified scheduler. Choose a channel.'}}}));
});
test('demo onboarding delivers fictional first value before resume and keeps work and consent isolated',async()=>{
 const fixtures=demoFixtures('2026-10-14'),store=createMemoryStore(fixtures.state,()=>{}),api=createDemoServices(store);
 const before=structuredClone(store.get('workflow.profile'));
 let state=await api.onboardingAction('onboarding.get_state');assert.equal(state.step,'connection_pending');
 state=await api.onboardingAction('onboarding.submit_step',{expectedRevision:0,event:'runtime',data:{browsing:true},eventKey:'runtime'});assert.equal(state.step,'intent_pending');
 state=await api.onboardingAction('onboarding.submit_step',{expectedRevision:1,event:'intent',data:{text:'Backend internships'},eventKey:'intent'});
 assert.equal(state.step,'action_policy_pending');assert.match(state.matchJob.employer.company,/fictional/);assert.equal(state.data.match.fitPreliminary,true);
 state=await api.onboardingAction('onboarding.submit_step',{expectedRevision:2,event:'policy',data:{choice:'recommend'},eventKey:'policy'});
 assert.equal(state.step,'execution_ready');
 state=await api.onboardingAction('tasks.create',{expectedRevision:3,eventKey:'demo-task',kind:'discover'});
 assert.equal(state.tasks[0].state,'completed');assert.match(state.tasks[0].result.summary,/Fictional/);
 assert.deepEqual(store.get('workflow.profile'),before);
 await assert.rejects(api.onboardingAction('onboarding.submit_step',{expectedRevision:0,event:'policy',data:{choice:'auto_apply_requested'}}),/changed/);
});

import { onboardingWork, onboardingTaskKey } from '../next-app/lib/onboarding-work.mjs';
test('preparation never advances on an old discovery result and retries use new stable keys',()=>{
 const state={revision:4,step:'execution_ready',data:{policy:'prepare'},tasks:[{id:'first-scan',kind:'discover',state:'completed'},{id:'failed-prep',kind:'prepare_application',state:'failed'}]};
 let work=onboardingWork(state);assert.equal(work.executionKind,'prepare_application');assert.equal(work.completed,undefined);assert.equal(work.pending,undefined);
 assert.equal(onboardingTaskKey(state,'prepare_application'),onboardingTaskKey(structuredClone(state),'prepare_application'));
 const key=onboardingTaskKey(state,'prepare_application');state.tasks.unshift({id:'retry',kind:'prepare_application',state:'needs_user'});assert.notEqual(onboardingTaskKey(state,'prepare_application'),key);
 state.tasks.push({id:'uncertain',kind:'prepare_application',state:'uncertain'});assert.equal(onboardingWork(state).uncertain.id,'uncertain');
 state.tasks.push({id:'prepared',kind:'prepare_application',state:'completed'});assert.equal(onboardingWork(state).completed.id,'prepared');
});


import {selectOnboardingRole,onboardingIntent} from '../next-app/lib/onboarding-catalog.mjs';
test('onboarding catalog preview respects work, employment and location without manufacturing a result',()=>{
 const roles=[{id:'ft',title:'Backend Engineer',employmentType:'FT',location:'New York',company:'Example',applicationUrl:'https://example.com/job'},{id:'intern',title:'Backend Intern',employmentType:'Internship',location:'Remote'}];
 assert.equal(selectOnboardingRole(roles,{work:'Backend engineering',employment:'Full-time',location:'Boston or New York'}).id,'ft');
 assert.equal(selectOnboardingRole(roles,{work:'Backend engineering',employment:'Internship',location:'Remote'}).id,'intern');
 assert.equal(selectOnboardingRole(roles,{work:'Designer',employment:'Full-time',location:'Open to anywhere'}),null);
 assert.equal(selectOnboardingRole(roles,{work:'Backend engineering',employment:'Full-time',location:'Remote'}),null);
 assert.equal(selectOnboardingRole(roles,{work:'',employment:'Full-time',location:'Remote'}),null);
 assert.match(onboardingIntent({work:'Backend engineering',employment:'Full-time',location:'Remote'},roles[0]),/Verify that it is open/);
});
