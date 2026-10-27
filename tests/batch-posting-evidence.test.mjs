import test from 'node:test';import assert from 'node:assert/strict';
import {withLatestPostingEvidence,postingRecency} from '../lib/batch-posting-evidence.mjs';import {batchRoles} from '../lib/cloud-model.mjs';
const batch={batch:{user_id:'owner'},items:[{job_id:'job',jobs:{employer:{description:'Old description'},canonical_url:'https://example.com/job'},recommendation:{sourceFreshness:'Old snapshot',whyItFits:'Keep analysis'}}]};
test('a new owned observation refreshes the same published batch in website and MCP projection',async()=>{
 const filters=[];const q={select(){return q},eq(k,v){filters.push([k,v]);return q},order(){return q},limit(n){assert.equal(n,1);return Promise.resolve({data:[{checked_at:'2026-10-27T01:45:00Z',liveness:'active',employer_posted_at:'2026-09-15T00:00:00Z',description:'New description'}]})}};
 const updated=await withLatestPostingEvidence({from:()=>q},batch,'owner');assert.ok(filters.some(([k,v])=>k==='user_id'&&v==='owner'));assert.ok(filters.some(([k,v])=>k==='search_listings.user_id'&&v==='owner'));assert.ok(filters.some(([k,v])=>k==='search_listings.job_id'&&v==='job'));
 const role=batchRoles(updated.items,'2026-10-26')[0];assert.match(role.sourceFreshness,/2026-10-27T01:45:00.000Z/);assert.match(role.sourceFreshness,/older than 72 hours/);assert.equal(role.description,'New description');assert.equal(role.whyItFits,'Keep analysis');assert.equal(batch.items[0].recommendation.sourceFreshness,'Old snapshot');
 await assert.rejects(withLatestPostingEvidence({from:()=>q},batch,'other'),/Owned/);
});
test('read errors fail loudly; no observation retains the publication fallback',async()=>{
 const q={select(){return q},eq(){return q},order(){return q},limit(){return Promise.resolve({error:Error('Unavailable')})}};
 await assert.rejects(withLatestPostingEvidence({from:()=>q},batch,'owner'),/Unavailable/);
 q.limit=()=>Promise.resolve({data:[]});const b=await withLatestPostingEvidence({from:()=>q},batch,'owner');assert.equal(batchRoles(b.items,'day')[0].sourceFreshness,'Old snapshot');
 assert.match(postingRecency({checkedAt:'2026-10-27T01:45:00Z',liveness:'expired',postedAt:null}),/expired.*not disclosed/);
});
