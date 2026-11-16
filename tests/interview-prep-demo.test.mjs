import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoWorkspace,createDemoServices} from '../next-app/lib/muse-demo-fixtures.mjs';
import {createDemoStore} from '../next-app/lib/demo-store.mjs';
import {validateArtifact} from '../lib/artifacts.mjs';

const fixture=()=>createDemoServices(createDemoStore(createDemoWorkspace('2026-11-16T12:00:00Z')));
async function materials(service){
 const items=[];let offset=0;
 do{const page=await service.artifactAction('artifacts.list',{shelf:'all',offset});items.push(...page.items);offset=page.nextOffset;}while(offset!==null);
 return items;
}
test('interview demo covers answer categories, statuses and independent practice',async()=>{
 const service=fixture(),items=await materials(service);
 const answers=await Promise.all(items.filter(row=>row.content.kind==='story_bank').map(row=>service.artifactAction('artifacts.read',{id:row.id})));
 for(const category of ['Introductions and motivation','Behavioral questions','Project and experience stories','Technical explanations','Questions to ask interviewers'])assert(answers.some(row=>row.content.body.includes(`## Category\n${category}`)));
 for(const status of ['Draft','Needs Review','Ready'])assert(answers.some(row=>row.content.body.includes(`## Status\n${status}`)));
 for(const category of ['Algorithms and coding','System design','Behavioral practice'])assert(items.some(row=>row.content.title.startsWith(category)));
 assert(items.some(row=>row.content.kind==='mock_interview'&&row.content.sessionStatus==='completed'));
});
test('material editor contract uses versioned artifacts and preserves prior research and ownership',async()=>{
 const service=fixture(),items=await materials(service),summary=items.find(row=>row.content.kind==='company_research');
 const original=await service.artifactAction('artifacts.read',{id:summary.id});
 const payload={...original.content,body:original.content.body+'\n\n## Verification\nA fictional note, not a new verified fact.',id:original.id,expectedVersion:original.version};
 assert.doesNotThrow(()=>validateArtifact('artifacts.save',payload));
 await service.artifactAction('artifacts.save',payload);
 const saved=await service.artifactAction('artifacts.read',{id:original.id});
 assert.equal(saved.version,original.version+1);assert.deepEqual(saved.content.links,original.content.links);assert.deepEqual(saved.content.sources,original.content.sources);
 assert.equal((await service.artifactAction('artifacts.read',{id:original.id,version:original.version})).content.body,original.content.body);
 await assert.rejects(()=>service.artifactAction('artifacts.save',{...payload,body:'Conflicting edit'}),/changed/);
 assert.equal((await fixture().artifactAction('artifacts.read',{id:original.id})).version,original.version);
});
test('checklist records actual practice through the existing version-checked session boundary',async()=>{
 const service=fixture(),bundle=await service.readPreparationPlanner();
 const row=bundle.plans.find(candidate=>candidate.plan.tasks.some(task=>!task.completed&&task.minutes<=bundle.settings.dailyMinutes));
 const task=row.plan.tasks.find(candidate=>!candidate.completed&&candidate.minutes<=bundle.settings.dailyMinutes);
 const input={sessionId:'eeeeeeee-1000-4000-8000-111111111111',minutes:task.minutes,targets:[{applicationId:row.application_id,taskId:task.id,expectedVersion:row.version}]};
 const next=await service.completePreparationSession(input);
 assert.equal(next.plans.find(candidate=>candidate.application_id===row.application_id).plan.tasks.find(candidate=>candidate.id===task.id).completed,true);
 assert.equal((await service.completePreparationSession(input)).sessions.length,next.sessions.length);
 const staleTask=row.plan.tasks.find(candidate=>!candidate.completed&&candidate.id!==task.id);
 if(staleTask)await assert.rejects(()=>service.completePreparationSession({...input,sessionId:'eeeeeeee-1001-4000-8000-111111111111',minutes:1,targets:[{applicationId:row.application_id,taskId:staleTask.id,expectedVersion:row.version}]}),/changed/);
 assert.equal((await fixture().readPreparationPlanner()).sessions.length,0);
});
