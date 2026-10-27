import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {currentTimelineItems,timelineItems,hasTerminalOutcome} from '../lib/application-timeline.mjs';
import {debriefPayload,debriefMarker} from '../lib/interview-debrief.mjs';
import {createMemoryStore} from '../next-app/lib/demo.mjs';
import {createDemoServices,createDemoWorkspace} from '../next-app/lib/muse-demo-fixtures.mjs';
const applicationId='11111111-1111-4111-8111-111111111111';
test('MCP accepts actual candidate reports and replacement IDs without claiming authenticated human/email evidence',()=>{
 const p={applicationId,eventKey:'conversation:1',kind:'interview',label:'Next interview',phase:'scheduled',occurredAt:null,source:{kind:'user_reported',note:'Candidate says there is another interview; date not confirmed.'}};
 validateRequest({operation:'applications.milestone',payload:p});
 validateRequest({operation:'applications.milestone',payload:{...p,supersedesId:applicationId}});
 for(const patch of [{source:{kind:'user_reported'}},{source:{kind:'user_reported',note:'  '}},{source:{...p.source,messageId:'forged'}},{source:{kind:'user',note:'Approved'}},{occurredAt:'2026-11-06T14:00:00Z'},{supersedesId:'anything'}])assert.throws(()=>validateRequest({operation:'applications.milestone',payload:{...p,...patch}}));
});
test('rescheduling retains provenance/history and current views exclude replaced dates and outcomes',()=>{
 const app={milestones:[{id:'friday',kind:'interview',label:'Friday',phase:'scheduled',occurred_at:'2026-11-06T14:00:00Z',source:{kind:'email'}},{id:'monday',kind:'interview',label:'Monday',phase:'scheduled',occurred_at:'2026-11-09T14:00:00Z',supersedes_id:'friday',source:{kind:'user_reported',note:'Candidate: moved to Monday.'}}]};
 const history=timelineItems(app);assert.equal(history.length,2);assert.equal(history[0].supersededBy,'monday');
 assert.deepEqual(currentTimelineItems(app).map(row=>row.label),['Monday']);assert.equal(currentTimelineItems(app)[0].source.kind,'user_reported');
 const correction={milestones:[{id:'rejected',kind:'rejected',phase:'received'},{id:'interview',kind:'interview',phase:'scheduled',supersedes_id:'rejected'}]};
 assert.equal(hasTerminalOutcome(correction),false);
});
test('simple notes need no round form and preserve agent metadata when a human edits',()=>{
 const app={id:'job',backendId:applicationId,company:'Example'};
 const payload=debriefPayload(app,{id:applicationId,summary:'Candidate report: interview went well.'});
 validateRequest({operation:'artifacts.save',payload});assert.equal(payload.purpose,debriefMarker(applicationId)+' Interview note');
 assert.deepEqual(payload.links,[{applicationId}]);
 const original={...payload};delete original.id;delete original.expectedVersion;
 original.title='Muse conversation note';original.sources=[{title:'Source',url:'https://example.com/interview',observedAt:'2026-10-26'}];
 const edit=debriefPayload(app,{id:applicationId,version:1,summary:'Corrected details.',original});
 validateRequest({operation:'artifacts.save',payload:edit});assert.deepEqual(edit.sources,original.sources);assert.deepEqual(edit.links,original.links);assert.equal(edit.title,original.title);
});
test('resettable demo exercises rescheduling and simple note edits without account access',async()=>{
 const fixture=createDemoWorkspace('2026-10-26'),store=createMemoryStore(fixture),api=createDemoServices(store);
 const app=store.get('workflow.applications.demo-interview');
 const original=currentTimelineItems(app).find(row=>row.kind==='technical_round');
 const p={eventKey:'demo-reschedule',supersedesId:original.id,kind:'technical_round',label:'Moved again',phase:'scheduled',occurredAt:null,source:{kind:'user',note:'Fictional reschedule; exact time not known.'}};
 const row=await api.recordApplicationMilestone('demo-interview',p);assert.deepEqual(await api.recordApplicationMilestone('demo-interview',p),row);
 await assert.rejects(api.recordApplicationMilestone('demo-interview',{...p,eventKey:'fork'}),/replaced/);
 assert.equal(currentTimelineItems(store.get('workflow.applications.demo-interview')).find(r=>r.kind==='technical_round').label,'Moved again');
 const payload=debriefPayload(app,{id:applicationId,summary:'A simple fictional note.'});
 const note=await api.artifactAction('artifacts.save',payload);assert.equal(note.version,1);
 assert.equal((await api.artifactAction('artifacts.read',{id:note.id})).content.body,payload.body);
 assert(!fixture.workflow.applications['demo-interview'].milestones.some(r=>r.id===row.id));
});
test('interview panels subscribe to owned invalidations and contain no polling timers',async()=>{
 for(const name of ['interview-debriefs','application-preparation']){
  const source=await readFile(new URL(`../next-app/components/${name}.tsx`,import.meta.url),'utf8');
  assert.match(source,/subscribePreparationRefresh/);assert.doesNotMatch(source,/setInterval|setTimeout/);
 }
 const source=await readFile(new URL('../next-app/components/interview-debriefs.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(source,/Share to Circle|Debrief round|useKnowledgeClient/);
});
