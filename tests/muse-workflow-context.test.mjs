import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {contextResponse} from '../supabase/functions/agent-gateway/context.mjs';
import {bootstrapInstructions} from '../supabase/functions/agent-gateway/operating-guide.mjs';
import {readGuide, guideIndex, discoverGuides} from '../supabase/functions/agent-gateway/guides.mjs';
import {MUSE_CHANGE_TYPES, museChangeFeedResponse} from '../lib/muse-change-feed.mjs';
import {loadWorkflowGuide} from '../mcp/context-cache.mjs';
import {consumeMuseChanges} from '../mcp/change-worker.mjs';

test('startup budgets exclude all task bodies and workflow references resolve to unique current guides',async()=>{
 const context=contextResponse('context.developer',{}),index=guideIndex();
 assert(Buffer.byteLength(bootstrapInstructions+context.instructions.join('\n\n'))<=6000);
 assert(Buffer.byteLength(JSON.stringify(index))<=4000);
 assert.deepEqual(Object.keys(context),['developerVersion','instructions','guides']);
 assert.equal(new Set(index.map(g=>g.id)).size,index.length);
 const all=[...index,...discoverGuides().guides.filter(g=>!index.some(i=>i.id===g.id))];
 assert.equal(new Set(all.map(g=>g.id)).size,all.length);
 for(const entry of all){const guide=readGuide(entry.id);assert.equal(guide.version,entry.version);assert(guide.instructions.trim());}
 for(const type of MUSE_CHANGE_TYPES)assert.equal(readGuide(type.workflow.guideId).version,type.workflow.guideVersion);
 for(const entry of index)assert(!Object.hasOwn(entry,'instructions')&&!Object.hasOwn(entry,'manual'));
 const startup=bootstrapInstructions+JSON.stringify(context);
 for(const phrase of ['--test-wake','pipelineVersion','Attempted:','answerUpdates','APILayer'])assert(!startup.includes(phrase),phrase);
 assert(!/q\[\d+\]/.test(await readFile(new URL('../supabase/functions/agent-gateway/operating-guide.mjs',import.meta.url),'utf8')));
});

test('guide caches retain content per connection and refresh changed, missing or compacted content',async()=>{
 const workflow={guideId:'application-workspace',guideVersion:readGuide('application-workspace').version};
 let reads=0;const call=async(name,args)=>{assert.equal(name,'read_guide');reads++;return readGuide(args.id);};
 const first=await loadWorkflowGuide({call,workflow,connectionKey:'a'});
 await loadWorkflowGuide({call,workflow,connectionKey:'a',cache:first.cache});assert.equal(reads,1);
 for(const options of [{hasContext:false},{connectionKey:'b'},{cache:{connectionKey:'a',guides:{[workflow.guideId]:{version:workflow.guideVersion}}}},{cache:{connectionKey:'a',guides:{[workflow.guideId]:{...first.guide,version:1}}}}]){
  await loadWorkflowGuide({call,workflow,connectionKey:'a',cache:first.cache,...options});
 }
 assert.equal(reads,5);
 await assert.rejects(loadWorkflowGuide({call:async()=>({...first.guide,version:1}),workflow,connectionKey:'a'}),/stale/);
 first.guide.instructions='mutated';assert.notEqual(first.cache.guides[workflow.guideId].instructions,'mutated');
});

function fixture(kinds=['backend_job_finished']){
 const ids=kinds.map((_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
 const events=museChangeFeedResponse({items:kinds.map((kind,i)=>({id:ids[i],kind,recordId:'fictional-record',version:i+1})),hasMore:false}).items;
 const calls=[],acks=new Set(),state={stage:'shortlist-ready',published:false,publications:0,blocked:false,resumeCondition:null};
 let failAck=false;
 const call=async(name,args)=>{
  calls.push({name,args});
  if(name==='read_developer_context')return contextResponse('context.developer',{});
  if(name==='read_guide')return readGuide(args.id);
  if(name==='read_muse_changes')return {items:events.filter(e=>!acks.has(e.id)),hasMore:false};
  if(name==='acknowledge_muse_changes'){
   if(failAck)throw Error('ack offline');
   for(const id of args.eventIds)acks.add(id);return {acknowledgedIds:args.eventIds};
  }
  return structuredClone({...state,...(name==='read_backend_jobs'?{jobs:[{id:'fictional-record',kind:'search_ats',status:'completed'}]}:{})});
 };
 return {events,calls,acks,state,call,setFailAck:value=>{failAck=value;}};
}

test('fresh worker resumes saved search once and crash before acknowledgement safely redelivers',async()=>{
 const f=fixture();f.setFailAck(true);
 const handle=async({guide,current})=>{
  assert.equal(guide.id,'career-find-jobs');
  if(!current.published){f.state.published=true;f.state.publications++;f.state.stage='published';}
  return {status:'handled'};
 };
 const verify=async()=>f.state.published;
 await assert.rejects(consumeMuseChanges({call:f.call,handle,verify,connectionKey:'search'}),/ack offline/);
 assert.equal(f.acks.size,0);f.setFailAck(false);
 const result=await consumeMuseChanges({call:f.call,handle,verify,connectionKey:'search'});
 assert.deepEqual(result.acknowledgedIds,[f.events[0].id]);assert.equal(f.state.publications,1);
 assert.equal(f.calls.filter(c=>c.name==='read_developer_context').length,2);
 assert(!f.calls.some(c=>/submit_backend_job|start_search_run/.test(c.name)));
});

test('schedule wake coalesces record reads, uses scheduling guide and requires scheduler receipts',async()=>{
 const f=fixture(['schedule_changed','schedule_changed']);
 let receipts=false,handles=0;
 const handle=async({events,guide})=>{handles++;assert.equal(events.length,2);assert.equal(guide.id,'connection-schedules');return {status:'handled'};};
 const options={call:f.call,handle,verify:async()=>receipts,connectionKey:'schedule',hasContext:true};
 await consumeMuseChanges(options);assert.equal(f.acks.size,0);receipts=true;
 await consumeMuseChanges(options);assert.equal(f.acks.size,2);assert.equal(handles,2);
 assert.equal(f.calls.filter(c=>c.name==='read_agent_schedule').length,2);
 assert(!f.calls.some(c=>/read_personal_context|read_developer_context|check_context_versions/.test(c.name)));
 const blocked=fixture(['schedule_changed']);
 await consumeMuseChanges({...options,call:blocked.call,handle:async()=>({status:'blocked',resumeCondition:'scheduler available'}),verify:async()=>true});assert.equal(blocked.acks.size,0);
});

test('confirmed answers and timeline changes selectively load their guides without authorizing submission',async()=>{
 for(const [kind,id] of [['answer_confirmed','application-workspace'],['application_timeline_changed','interview-preparation']]){
  const f=fixture([kind]);f.state.stage='uncertain';
  const result=await consumeMuseChanges({call:f.call,connectionKey:kind,handle:async({guide,current})=>{
   assert.equal(guide.id,id);assert.equal(current.stage,'uncertain');
   f.state.blocked=true;f.state.resumeCondition='authenticated human verification';
   return {status:'blocked',resumeCondition:f.state.resumeCondition};
  },verify:async()=>f.state.blocked&&!!f.state.resumeCondition});
  assert.equal(result.acknowledgedIds.length,1);
  assert.equal(f.state.stage,'uncertain');assert(!f.calls.some(c=>c.name==='submit_application'));
 }
});

test('failed persistence/read-back leaves events pending; unknown events and blocked pages do not spin',async()=>{
 const f=fixture();
 await assert.rejects(consumeMuseChanges({call:f.call,connectionKey:'failed-write',handle:async()=>{throw Error('checkpoint failed');},verify:async()=>true}),/checkpoint failed/);
 assert.equal(f.acks.size,0);
 const failed=await consumeMuseChanges({call:f.call,connectionKey:'failed-readback',handle:async()=>({status:'blocked',resumeCondition:'missing facts'}),verify:async()=>false});assert(failed.pending);assert.equal(f.acks.size,0);
 let reads=0;
 const call=async(name,args)=>name==='read_muse_changes'?(reads++,{items:[{id:'unknown',kind:'future-event'}],hasMore:true}):f.call(name,args);
 const result=await consumeMuseChanges({call,connectionKey:'unknown',handle:async()=>assert.fail(),verify:async()=>assert.fail()});
 assert(result.pending);assert.equal(reads,1);
});

test('concurrent wakes coalesce within a host process and scoped failures never acknowledge',async()=>{
 const f=fixture();let release,entered;
 const started=new Promise(resolve=>{entered=resolve;});const gate=new Promise(resolve=>{release=resolve;});
 const options={call:f.call,connectionKey:'serial',handle:async()=>{entered();await gate;return {status:'handled'};},verify:async()=>true};
 const first=consumeMuseChanges(options);await started;
 assert.equal((await consumeMuseChanges(options)).busy,true);release();await first;
 const denied=fixture();
 await assert.rejects(consumeMuseChanges({...options,connectionKey:'denied',call:async(name,args)=>{if(name==='read_backend_jobs')throw Error('42501');return denied.call(name,args);}}),/42501/);
 assert.equal(denied.acks.size,0);
});

test('toolkit tool reads defer bulky pinned references through the same authorized guide boundary',async()=>{
 const {guideDispatch}=await import('../supabase/functions/agent-gateway/guides.mjs');
 const authorize=async()=>({data:{}});
 const guide=(await guideDispatch('career-find-jobs',authorize)).data;
 assert(!guide.sourceDocuments&&!guide.manual);
 assert.equal(guide.referenceGuideId,'career-find-jobs-reference');
 const reference=(await guideDispatch(guide.referenceGuideId,authorize)).data;
 assert(reference.sourceDocuments.length);assert.equal(reference.version,guide.version);
 assert.equal((await guideDispatch(guide.referenceGuideId,async()=>({error:{code:'42501'}}))).error.code,'42501');
 assert.equal(readGuide('application-workspace-reference'),null);
});

test('backend completion reads current job kind before loading application guidance',async()=>{
 const f=fixture();
 const call=async(name,args)=>name==='read_backend_jobs'?{jobs:[{id:'fictional-record',kind:'application_submit',status:'partial'}]}:f.call(name,args);
 await consumeMuseChanges({call,connectionKey:'application-job',handle:async({guide})=>{assert.equal(guide.id,'application-workspace');return {status:'handled'};},verify:async()=>true});
 assert(!f.calls.some(c=>c.name==='read_guide'&&c.args.id==='career-find-jobs'));
});

test('malformed record pointers never call a tool or acknowledge and empty feeds stay idle',async()=>{
 const f=fixture();f.events[0].refresh.arguments={jobId:'another-record'};
 const result=await consumeMuseChanges({call:f.call,connectionKey:'malformed',handle:async()=>assert.fail(),verify:async()=>assert.fail()});
 assert(result.pending);assert(!f.calls.some(c=>c.name==='read_backend_jobs'));assert.equal(f.acks.size,0);
 const idle=await consumeMuseChanges({call:async(name,args)=>name==='read_muse_changes'?{items:[],hasMore:false}:f.call(name,args),connectionKey:'empty',handle:async()=>assert.fail(),verify:async()=>assert.fail()});assert.equal(idle.pending,false);
});

test('admin demo services expose the same workflow routing while keeping pending counts and receipts isolated',async()=>{
 const {demoFixtures,createMemoryStore,createDemoServices}=await import('../next-app/lib/demo.mjs');
 const store=createMemoryStore(demoFixtures('2026-11-03').state),demo=createDemoServices(store);
 const before=JSON.stringify(store.get('workflow'));
 const {watchId}=await demo.configureAgentWatch({enabled:true});
 const feed=await demo.readMuseChanges();
 assert.equal(await demo.readAgentPendingCount(watchId),feed.items.length);
 for(const event of feed.items){
  assert.equal(readGuide(event.workflow.guideId).version,event.workflow.guideVersion);
  assert(!('instructions' in event));
 }
 await demo.acknowledgeMuseChanges({eventIds:feed.items.map(event=>event.id)});
 assert.equal(await demo.readAgentPendingCount(watchId),0);
 assert.equal(JSON.stringify(store.get('workflow')),before);
 assert.equal((await createDemoServices(store).readMuseChanges()).items.length,5);
});

test('direct search completion requires personal analysis then private publication and read-back; demo retains the pending state',async()=>{
 const guide=readGuide('career-find-jobs');assert.equal(guide.version,21);
 assert.match(guide.instructions,/Private Discover publication is the final step[\s\S]*after agent personal fit analysis/);
 assert.match(guide.instructions,/Read back every returned batch with read_batch/);
 assert.match(guide.instructions,/discover:<runId>:profile:<version>:part:<index>/);
 assert(!guide.instructions.includes('Do not automatically call publish_batch after a direct search.'));
 const {searchDemo}=await import('../lib/search/demo.mjs');assert.match(searchDemo().runs.find(r=>r.id==='demo-run').summary,/agent fit analysis pending before private Discover publication/);
});

test('broad fit guidance retains clearance unknowns, conditional scenarios and routine authorized preparation',()=>{
 const search=readGuide('career-find-jobs'),apps=readGuide('application-workspace'),digest=readGuide('notifications');
 assert.equal(search.version,21);assert.equal(apps.version,24);assert.equal(digest.version,4);
 assert.match(search.instructions,/How good a fit is this job/);
 assert.match(search.instructions,/Missing clearance, citizenship[\s\S]*is unknown, not a negative fact/);
 assert.match(search.instructions,/keep them visible[\s\S]*active clearance required at application\/start/);
 assert.match(search.instructions,/December graduation internship scenario is not a confirmed education change/);
 assert.match(search.instructions,/A disclosed salary is known even when compensation fit is uncertain/);
 assert.match(search.instructions,/There is no separate displayed matchStrength field/);
 assert.match(search.instructions,/Reuse recommendation.priority \(Apply Now, Strong Consider, Skip Unless Team Fit\)/);
 assert.match(search.instructions,/Do not add a separate narrative strength label/);
 assert.match(apps.instructions,/Do not add a separate match-strength tag/);
 assert.match(apps.instructions,/close fit determines priority and tailoring depth, not whether to do the work at all/i);
 assert.match(apps.instructions,/Do not start applications merely because a search was requested/);
 assert.match(digest.instructions,/Counts and continuation claims require saved records and actual execution evidence/);
});

test('fit brief is concise, team-specific and uses existing narrative and priority fields',()=>{
 const search=readGuide('career-find-jobs'),apps=readGuide('application-workspace');
 assert.match(search.instructions,/about 130–180 words per role/);
 assert.match(search.instructions,/Team, Your contribution, Your growth, Support, Practical fit/);
 assert.match(search.instructions,/what would raise or lower the priority/);
 assert.match(search.instructions,/clearly labeled adjacent context, never as proof/);
 assert.match(search.instructions,/not proof of structured mentorship/);
 assert.match(search.instructions,/whether internships count toward an experience limit/);
 assert.match(search.instructions,/reuse recommendation.whyItFits[\s\S]*recommendation.materialGap/);
 assert.match(search.instructions,/do not require Markdown rendering or add new fields/);
 assert.match(search.instructions,/Do not append a research diary/);
 assert.match(apps.instructions,/follow career-find-jobs’ compact team-focused decision brief/);
});

test('recall guidance separates broad worth-a-look review from deeper top-pick research and unresolved recovery',()=>{
 const search=readGuide('career-find-jobs'),notifications=readGuide('notifications');
 assert.match(search.instructions,/MTS is a role family, not proof of the senior Staff rank/);
 assert.match(search.instructions,/Unknown start date, team, experience level/);
 assert.match(search.instructions,/broad Worth a look group alongside Top picks/);
 assert.match(search.instructions,/resolution=unresolved/);
 assert.match(search.instructions,/Employer-confirmed closure is an actual exclusion/);
 assert.match(notifications.instructions,/unresolved source leads using actual saved results/);
});
