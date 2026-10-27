import test from 'node:test';
import assert from 'node:assert/strict';
import {roleApplication,roleApplied,trackedApplications} from '../lib/discover-application-state.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {APPLICATION_JOB_TOOL} from '../supabase/functions/agent-gateway/application-jobs.mjs';
import {TOOLS,requiredToolScopes} from '../supabase/functions/agent-mcp/protocol.mjs';
import {createMemoryStore,demoFixtures} from '../next-app/lib/demo.mjs';
import {createDemoServices} from '../next-app/lib/muse-demo-fixtures.mjs';
const posting={id:'public-job',url:'https://job-boards.greenhouse.io/fixture/jobs/2000',company:'Fictional Systems',title:'Fictional Backend Engineer',employmentType:'FT',location:'Remote'};
const role={...posting,applicationUrl:posting.url};
const payload={posting,expectedRevision:0,eventKey:'selected-role:1'};
test('an opened public-catalog role survives outside the current private batch',()=>{
 const publicRole={...role,id:'singlestore-software-engineer-helios-new-grad-2027-8205389',company:'SingleStore'};
 const items=trackedApplications({roles:[],publicRoles:[publicRole],trackerIds:[publicRole.id],trackerItems:{[publicRole.id]:{openedDate:'2026-10-26',status:'New'}}});
 assert.equal(items.length,1);assert.equal(items[0].company,'SingleStore');
 assert.equal(roleApplied(publicRole,{}, {[publicRole.id]:{status:'New'}}),false);
});
test('queued, running, failed, blocked and uncertain applications stay in Discover until recorded applied',()=>{
 for(const status of ['queued','running','partial','failed','cancelled']){
  const app={id:'server-canonical-id',url:posting.url,status:status==='partial'?'Blocked':'Queued',executionJob:{id:'job',status}};
  assert.equal(roleApplication(role,{[app.id]:app}),app);
  assert.equal(roleApplied(role,{[app.id]:app}),false,status);
 }
 assert.equal(roleApplied(role,{a:{id:'a',url:posting.url,status:'Submitted'}}),true);
 assert.equal(roleApplied(role,{}, {[role.id]:{status:'Applied',appliedDate:'2026-10-27'}}),true);
});
test('AI Apply has a closed MCP contract, full execution scopes, and no owner/URL injection',()=>{
 validateRequest({operation:'applications.submit_job',payload});
 assert(TOOLS.some(t=>t.operation===APPLICATION_JOB_TOOL.operation));
 assert.deepEqual(requiredToolScopes(APPLICATION_JOB_TOOL).sort(),['drafts:write','workspace:read','preferences:write','approvals:read','resumes:read'].sort());
 for(const patch of [{ownerId:'other'},{connectionId:'other'},{expectedRevision:-1},{eventKey:' '},{posting:{...posting,url:'http://127.0.0.1/private'}},{posting:{...posting,url:posting.url+'?redirect=https://evil.example'}},{posting:{...posting,shell:'rm'}}])assert.throws(()=>validateRequest({operation:'applications.submit_job',payload:{...payload,...patch}}));
});
test('fictional queue creates a visible queued application and never marks applied or touches the fixture',async()=>{
 const fixture=demoFixtures('2026-10-27').state,store=createMemoryStore(fixture),api=createDemoServices(store);
 const result=await api.queueApplicationJob(payload);
 assert.equal(result.job.status,'queued');assert.equal(roleApplied(role,store.get('workflow.applications')),false);
 assert.equal((await api.queueApplicationJob(payload)).job.id,result.job.id);
 assert.equal(store.get('workflow.applications.'+posting.id).executionJob.id,result.job.id);
 assert.equal(fixture.workflow.applications[posting.id],undefined);
 assert.equal(store.get('tracker.ids').includes(posting.id),false);
});
