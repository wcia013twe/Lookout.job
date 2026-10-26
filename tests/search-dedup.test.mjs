import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {executeCareerTask} from '../runner/career-tools.mjs';
import {deduplicateDiscoveryRows,discoveryDedupRow} from '../lib/search-dedup.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {TOOLS} from '../supabase/functions/agent-mcp/protocol.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const row=(n,extra={})=>({id:id(n),company:'Example Systems (fictional)',title:'Backend Engineer',canonical_url:`https://job-boards.greenhouse.io/example/jobs/${n}`,identity:`ats:greenhouse:example:${n}`,location:'Remote',requisition_id:`R${n}`,...extra});
test('the reused scanner and tracker are exact pinned upstream files',async()=>{
 const root=new URL('../runner/vendor/career-ops/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',root)));
 for(const path of ['scan.mjs','dedup-tracker.mjs','url-key.mjs','tracker-parse.mjs']){
  const pinned=manifest.files.find(f=>f.path===path);assert.ok(pinned,path);
  assert.equal(createHash('sha256').update(await readFile(new URL(path,root))).digest('hex'),pinned.sha256,path);
 }
});

test('canonical storage fields map to upstream rows without applicant/private text',()=>{
 const r=discoveryDedupRow({...row(1),description:'private irrelevant text',observation:{description:'full JD'},applicationStatus:'Applied'});
 assert.equal(r.url,row(1).canonical_url);assert.equal(r.requisitionId,'R1');
 assert.equal(Object.hasOwn(r,'observation'),false);assert.equal(Object.hasOwn(r,'description'),false);assert.equal(Object.hasOwn(r,'applicationStatus'),false);
});

test('the redundant standalone dedup tool is retired in favor of one backend job',()=>{assert.equal(TOOLS.some(t=>t.name==='deduplicate_search_discoveries'),false);assert.throws(()=>validateRequest({operation:'search.discoveries.deduplicate',payload:{}}));});

test('real copied code suppresses native identity aliases and keeps distinct postings',async()=>{
 const a=row(1),alias=row(2,{canonical_url:'https://boards.greenhouse.io/example/jobs/1?utm_source=feed',identity:a.identity,requisition_id:'R1'}),distinct=row(3);
 const before=structuredClone([a,alias,distinct]);
 const data=await deduplicateDiscoveryRows([a,alias,distinct]);
 assert.deepEqual(data.retainedListingIds,[a.id,distinct.id]);assert.deepEqual(data.duplicateListingIds,[alias.id]);assert.deepEqual([a,alias,distinct],before);
});

test('same title does not erase distinct requisitions, functional query URLs or locations',async()=>{
 const jobs=[row(1),row(2,{location:'New York'}),row(3,{canonical_url:'https://example.test/job?ref=A',identity:null,requisition_id:null}),row(4,{canonical_url:'https://example.test/job?ref=B',identity:null,requisition_id:null})].map(discoveryDedupRow);
 const kept=await executeCareerTask('dedup-discovery',{jobs,previous:[]});assert.deepEqual(kept.map(r=>r.id),jobs.map(r=>r.id));
});

test('explicit history uses copied dedup without editing previous records',async()=>{
 const old=row(1),fresh=row(2,{identity:old.identity,requisition_id:old.requisition_id,canonical_url:old.canonical_url+'?utm_source=again'}),before=structuredClone(old);
 const data=await deduplicateDiscoveryRows([fresh],[old]);
 assert.deepEqual(data.retainedListingIds,[]);assert.deepEqual(data.duplicateListingIds,[fresh.id]);assert.deepEqual(old,before);
 const without=await deduplicateDiscoveryRows([fresh]);assert.deepEqual(without.retainedListingIds,[fresh.id]);
});
test('malformed child output fails loudly instead of saving a false shortlist',async()=>{
 for(const out of [null,[{id:id(2)}],[{id:id(1)},{id:id(1)}]])await assert.rejects(()=>deduplicateDiscoveryRows([row(1)],[],{execute:async()=>out}),/Malformed/);
});
