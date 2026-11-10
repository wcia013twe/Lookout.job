import test from 'node:test';import assert from 'node:assert/strict';
import {withLatestPostingEvidence,withLatestPostingEvidenceForBatches,invalidatePostingEvidence,postingRecency} from '../lib/batch-posting-evidence.mjs';import {batchRoles} from '../lib/cloud-model.mjs';
const batch={batch:{user_id:'owner'},items:[{job_id:'job',jobs:{employer:{description:'Old description'},canonical_url:'https://example.com/job'},recommendation:{sourceFreshness:'Old snapshot',whyItFits:'Keep analysis'}}]};
test('a new owned observation refreshes the same published batch in website and MCP projection',async()=>{
 const filters=[];const q={select(){return q},eq(k,v){filters.push([k,v]);return q},order(){return q},in(k,v){filters.push([k,v]);return q},range(){return Promise.resolve({data:[{checked_at:'2026-10-27T01:45:00Z',liveness:'active',employer_posted_at:'2026-09-15T00:00:00Z',description:'New description',search_listings:{job_id:'job'}}]})}};
 const updated=await withLatestPostingEvidence({from:()=>q},batch,'owner');assert.ok(filters.some(([k,v])=>k==='user_id'&&v==='owner'));assert.ok(filters.some(([k,v])=>k==='search_listings.user_id'&&v==='owner'));assert.ok(filters.some(([k,v])=>k==='search_listings.job_id'&&v[0]==='job'));
 const role=batchRoles(updated.items,'2026-10-26')[0];assert.match(role.sourceFreshness,/2026-10-27T01:45:00.000Z/);assert.match(role.sourceFreshness,/older than 72 hours/);assert.equal(role.description,'New description');assert.equal(role.whyItFits,'Keep analysis');assert.equal(batch.items[0].recommendation.sourceFreshness,'Old snapshot');
 await assert.rejects(withLatestPostingEvidence({from:()=>q},batch,'other'),/Owned/);
});
test('read errors fail loudly; no observation retains the publication fallback',async()=>{
 const q={select(){return q},eq(){return q},order(){return q},in(){return q},range(){return Promise.resolve({error:Error('Unavailable')})}};
 const client={from:()=>q};
 await assert.rejects(withLatestPostingEvidence(client,batch,'owner'),/Unavailable/);
 q.range=()=>Promise.resolve({data:[]});const b=await withLatestPostingEvidence(client,batch,'owner');assert.equal(batchRoles(b.items,'day')[0].sourceFreshness,'Old snapshot');
 assert.match(postingRecency({checkedAt:'2026-10-27T01:45:00Z',liveness:'expired',postedAt:null}),/expired.*not disclosed/);
});

test('bulk evidence deduplicates batches, shares concurrent reads until explicitly invalidated',async()=>{
 let reads=0;
 const client={from(){const q={select(){return q},eq(){return q},in(k,ids){assert.deepEqual(ids,['job']);return q},order(){return q},async range(){reads++;await Promise.resolve();return {data:[]}}};return q}};
 const batches=[batch,structuredClone(batch)];
 await Promise.all([withLatestPostingEvidenceForBatches(client,batches,'owner'),withLatestPostingEvidence(client,batch,'owner')]);
 assert.equal(reads,1);await withLatestPostingEvidence(client,batch,'owner');assert.equal(reads,1);
 invalidatePostingEvidence(client);await withLatestPostingEvidence(client,batch,'owner');assert.equal(reads,2);
 const other={...batch,batch:{user_id:'other'}};await withLatestPostingEvidence(client,other,'other');assert.equal(reads,3);
});
test('pagination does not lose jobs when one job has many newer observations',async()=>{
 let reads=0;const client={from(){const q={select(){return q},eq(){return q},in(){return q},order(){return q},async range(start){reads++;return {data:start===0?Array.from({length:200},()=>({checked_at:'2026-11-10T00:00:00Z',liveness:'active',search_listings:{job_id:'job'}})):[{checked_at:'2026-11-09T00:00:00Z',liveness:'expired',search_listings:{job_id:'second'}}]}}};return q}};
 const updated=await withLatestPostingEvidence(client,{...batch,items:[...batch.items,{job_id:'second'}]},'owner');
 assert.equal(reads,2);assert.equal(updated.items[1].postingObservation.liveness,'expired');
});
