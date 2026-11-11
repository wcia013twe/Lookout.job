import test from 'node:test';
import assert from 'node:assert/strict';
import {cumulativeDiscoverBatch} from '../lib/discovery-log.mjs';
import {matchesDiscoveryStatus, discoveryIsHidden} from '../next-app/lib/discover-view.mjs';
import {createBackend} from '../backend/client.mjs';
const item=(id,note='',dismissed=false)=>({job_id:id,recommendation:{whyItFits:note},dismissed_at:dismissed?'2026-11-07T12:00:00Z':null,jobs:{canonical_url:`https://example.com/jobs/${id}`,employer:{company:'Fictional employer',title:'Software Engineer',employmentType:'FT'}}});
const batch=(id,date,items)=>({batch:{id,batch_date:date,created_at:date+'T12:00:00Z',label:'Fictional batch'},items});
test('earlier 32-role and later 14-role batches accumulate without a 14-role cap or duplicate jobs',()=>{
 const old=batch('old','2026-11-05',Array.from({length:32},(_,i)=>item(String(i),'earlier assessment'))),recent=batch('new','2026-11-06',Array.from({length:14},(_,i)=>item(String(i+28),'newer assessment'))),snapshot=structuredClone([old,recent]);
 const log=cumulativeDiscoverBatch([recent,old]);assert.equal(log.roles.length,42);assert.equal(log.batchCount,2);assert.equal(log.cumulative,true);
 assert.equal(log.roles.find(r=>r.id==='28').whyItFits,'newer assessment');assert.equal(log.roles.find(r=>r.id==='28').discoveredDate,'2026-11-05');
 assert.equal(log.roles.find(r=>r.id==='0').whyItFits,'earlier assessment');assert.deepEqual([old,recent],snapshot);
});
test('latest dismissal does not resurrect an older copy, empty publications do not erase earlier jobs',()=>{
 const old=batch('old','2026-11-05',[item('one'),item('two')]);
 assert.equal(cumulativeDiscoverBatch([old,batch('empty','2026-11-06',[])]).roles.length,2);
 assert.deepEqual(cumulativeDiscoverBatch([old,batch('new','2026-11-06',[item('one','',true)])]).roles.map(r=>r.id),['two']);
 assert.equal(cumulativeDiscoverBatch([]),null);
});
test('cumulative default excludes applied jobs while including queued/unapplied and preserves every application',()=>{
 const roles=[item('one'),item('two'),item('three')].map(i=>({id:i.job_id,applicationUrl:i.jobs.canonical_url}));
 const applications={one:{id:'one',status:'Submitted'},two:{id:'two',status:'Queued'}},before=structuredClone(applications);
 const visible=roles.filter(r=>matchesDiscoveryStatus(r,{applications}));assert.deepEqual(visible.map(r=>r.id),['two','three']);
 assert.equal(roles.filter(r=>matchesDiscoveryStatus(r,{applications,includeApplied:true})).length,3);assert.deepEqual(applications,before);
});
test('all owned batches and items are bulk paged and account changes reject results',async()=>{
 let owner='one',calls=0,switchOwner=false;
 const rows=Array.from({length:205},(_,i)=>({id:String(i).padStart(3,'0'),user_id:'one'}));
 const client={auth:{getUser:async()=>({data:{user:{id:owner}}})},from:table=>{const q={select(){return q},eq(k,v){assert.equal(k,'user_id');assert.equal(v,'one');return q},order(){return q},async range(a,b){calls++;if(switchOwner)owner='two';return {data:table==='job_batches'?rows.slice(a,b+1):[]}}};return q}};
 const api=createBackend(client,'one');
 assert.equal((await api.allBatches()).length,205);assert.equal(calls,3);
 switchOwner=true;await assert.rejects(()=>api.allBatches(),/Account changed/);
});


test('rejected jobs never reappear, including rejection-only imports, tracker outcomes and applied-history mode',()=>{
 const role={id:'catalog',applicationUrl:'https://example.com/jobs/rejected'};
 const fixtures=[
  {applications:{catalog:{id:'catalog',status:'Rejected'}}},
  {applications:{imported:{id:'different-id',url:role.applicationUrl,status:'Rejected'}}},
  {trackerItems:{catalog:{status:'Rejected'}}},
  {applications:{alias:{id:'different-id',applicationUrl:role.applicationUrl,status:'Queued',milestones:[{id:'rejection',kind:'rejected',phase:'received',occurred_at:'2026-11-07T12:00:00Z'}]}}},
  {applications:{queued:{id:'queued',url:role.applicationUrl,status:'Queued'},rejected:{id:'rejected',url:role.applicationUrl,status:'Rejected'}}},
 ];
 for(const fixture of fixtures){const before=structuredClone(fixture);assert.equal(matchesDiscoveryStatus(role,fixture),false);assert.equal(matchesDiscoveryStatus(role,{...fixture,includeApplied:true}),false);assert.deepEqual(fixture,before);}
 assert.equal(matchesDiscoveryStatus(role,{applications:{unrelated:{id:'unrelated',url:'https://example.com/jobs/other',status:'Rejected'}}}),true);
 assert.equal(matchesDiscoveryStatus(role,{applications:{queued:{id:'queued',url:role.applicationUrl,status:'Queued',milestones:[{id:'future',kind:'rejected',phase:'scheduled'}]}}}),true);
});

test('a queued duplicate cannot mask a prior submitted application',()=>{
 const role={id:'catalog',applicationUrl:'https://example.com/jobs/already-applied'},applications={queued:{id:'queued',url:role.applicationUrl,status:'Queued'},submitted:{id:'submitted',url:role.applicationUrl,status:'Submitted'}};
 assert.equal(matchesDiscoveryStatus(role,{applications}),false);assert.equal(matchesDiscoveryStatus(role,{applications,includeApplied:true}),true);
});

test('Discover reads imported outcomes without collapsing native duplicates or guessing null-URL identity',async()=>{
 const {discoveryApplications}=await import('../lib/discover-application-state.mjs');
 const role={id:'catalog',applicationUrl:'https://example.com/jobs/exact',company:'Fictional employer',title:'Software Engineer'};
 const native={catalog:{id:'catalog',url:role.applicationUrl,status:'Queued'}};
 for(const status of ['APPLIED','REJECTED']){
  const records=[{id:'imported',record:{company:role.company,title:role.title,url:role.applicationUrl,status}}],before=structuredClone(records);
  assert.equal(matchesDiscoveryStatus(role,{applications:discoveryApplications(native,records)}),false);assert.deepEqual(records,before);
  records[0].record.url=null;assert.equal(matchesDiscoveryStatus(role,{applications:discoveryApplications(native,records)}),true,'Do not infer requisition identity from a common title');
 }
});
test('all matching tracker keys participate instead of allowing an empty alias to mask rejection',()=>{
 const role={id:'catalog',applicationUrl:'https://example.com/jobs/exact'};
 assert.equal(matchesDiscoveryStatus(role,{applications:{alias:{id:'different',url:role.applicationUrl,status:'Queued'}},trackerItems:{alias:{},catalog:{status:'Rejected'}}}),false);
});

test('Discover refresh uses bulk reads and reuses evidence across repeated batches',async()=>{
 const user='owner',batches=Array.from({length:5},(_,i)=>({id:`batch-${i}`,user_id:user}));
 const items=batches.flatMap(b=>Array.from({length:20},(_,i)=>({id:`${b.id}-${i}`,batch_id:b.id,user_id:user,job_id:`job-${i}`,position:19-i})));
 const calls=[];
 const client={auth:{getUser:async()=>({data:{user:{id:user}}})},from(table){const q={select(){return q},eq(){return q},in(k,ids){assert.equal(ids.length,20);return q},order(){return q},async range(a,b){calls.push(table);return {data:(table==='job_batches'?batches:table==='batch_items'?items:[]).slice(a,b+1)}}};return q}};
 const api=createBackend(client,user),first=await api.allBatches();
 assert.deepEqual(calls,['job_batches','batch_items','search_observations']);
 assert.equal(first.length,5);assert.equal(first[0].items[0].position,0);
 calls.length=0;await createBackend(client,user).allBatches();assert.deepEqual(calls,['job_batches','batch_items']);
});

test('latest drop and priority determine default visibility, with personal overrides and expired postings',()=>{
 const old={id:'old',discoveredDate:'2026-11-01',priority:'Skip Unless Team Fit'};
 assert.equal(discoveryIsHidden(old,'2026-11-02'),true);
 assert.equal(discoveryIsHidden({...old,lastRecommendedDate:'2026-11-02'},'2026-11-02'),false);
 for(const priority of ['Apply Now','Strong Consider']) assert.equal(discoveryIsHidden({...old,priority},'2026-11-02'),false);
 assert.equal(discoveryIsHidden(old,'2026-11-02',{old:'visible'}),false);
 assert.equal(discoveryIsHidden({...old,priority:'Apply Now'},'2026-11-02',{old:'hidden'}),true);
 assert.equal(discoveryIsHidden({...old,priority:'Apply Now',postingObservation:{liveness:'expired'}},'2026-11-02',{old:'visible'}),true);
});
test('deduplicated roles retain latest recommendation date alongside first discovery',()=>{
 const log=cumulativeDiscoverBatch([batch('old','2026-11-01',[item('one')]),batch('new','2026-11-02',[item('one')])]);
 assert.equal(log.roles[0].discoveredDate,'2026-11-01'); assert.equal(log.roles[0].lastRecommendedDate,'2026-11-02');
});
