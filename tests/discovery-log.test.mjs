import test from 'node:test';
import assert from 'node:assert/strict';
import {cumulativeDiscoverBatch} from '../lib/discovery-log.mjs';
import {matchesDiscoveryStatus} from '../next-app/lib/discover-view.mjs';
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
test('all owned batches are paged beyond 200 and account changes reject accumulated results',async()=>{
 let owner='one',calls=0;
 const rows=Array.from({length:205},(_,i)=>({id:String(i).padStart(3,'0')}));
 const client={auth:{getUser:async()=>({data:{user:{id:owner}}})},from:()=>{let start=0,end=0;const q={select(){return q;},eq(k,v){assert.equal(k,'user_id');assert.equal(v,'one');return q;},order(){return q;},range(a,b){start=a;end=b;return q;},then(done){calls++;return Promise.resolve({data:rows.slice(start,end+1)}).then(done);}};return q;}};
 const api=createBackend(client,'one');api.getBatch=async id=>batch(id,'2026-11-07',[item(id)]);
 assert.equal((await api.allBatches()).length,205);assert.equal(calls,2);
 api.getBatch=async id=>{owner='two';return batch(id,'2026-11-07',[]);};await assert.rejects(()=>api.allBatches(),/Account changed/);
});
