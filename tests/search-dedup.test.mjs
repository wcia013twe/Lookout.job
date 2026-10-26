import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {executeCareerTask} from '../runner/career-tools.mjs';
import {deduplicateSearchDiscoveries,discoveryDedupRow} from '../lib/search-dedup.mjs';
import {validateDedup} from '../supabase/functions/agent-gateway/search-dedup.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {TOOLS,createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {operationService} from '../lib/mcp-services.mjs';
import {createDispatch} from '../backend/runtime/service.ts';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const runId=id(99);
const row=(n,extra={})=>({id:id(n),company:'Example Systems (fictional)',title:'Backend Engineer',canonical_url:`https://job-boards.greenhouse.io/example/jobs/${n}`,identity:`ats:greenhouse:example:${n}`,location:'Remote',requisition_id:`R${n}`,...extra});
function owned(rows,previous=[]){
 const calls=[];
 return {calls,dispatch:async(op,p)=>{calls.push({op,p});if(op==='search.run.read')return {data:{id:runId}};if(op==='search.discoveries.read')return {data:{listings:p.runId?rows:[...rows,...previous],nextOffset:null}};throw Error('Unexpected write or operation '+op);}};
}

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

test('scoped read-only dedup tool rejects forged/unbounded selectors',()=>{
 const tool=TOOLS.find(t=>t.name==='deduplicate_search_discoveries');assert.equal(tool.readOnly,true);assert.equal(tool.scope,'workspace:read');assert.equal(operationService(tool.operation).handler,'node');
 const p={runId,listingIds:[id(1)]};assert.doesNotThrow(()=>validateRequest({operation:tool.operation,payload:p}));
 for(const patch of [{runId:'bad'},{listingIds:[]},{listingIds:[id(1),id(1)]},{listingIds:Array.from({length:101},(_,n)=>id(n))},{previousListingIds:['bad']},{previousListingIds:Array(101).fill(id(1))},{userId:id(2)},{url:'https://arbitrary.test'}])assert.throws(()=>validateDedup(tool.operation,{...p,...patch}));
});

test('real copied code suppresses native identity aliases and keeps distinct postings',async()=>{
 const a=row(1),alias=row(2,{canonical_url:'https://boards.greenhouse.io/example/jobs/1?utm_source=feed',identity:a.identity,requisition_id:'R1'}),distinct=row(3);
 const h=owned([a,alias,distinct]),before=structuredClone([a,alias,distinct]);
 const r=await deduplicateSearchDiscoveries(h.dispatch,{runId,listingIds:[a.id,alias.id,distinct.id]});
 assert.equal(r.error,null);assert.deepEqual(r.data.retainedListingIds,[a.id,distinct.id]);assert.deepEqual(r.data.duplicateListingIds,[alias.id]);assert.deepEqual([a,alias,distinct],before);
 assert.ok(h.calls.every(c=>['search.run.read','search.discoveries.read'].includes(c.op)));
});

test('same title does not erase distinct requisitions, functional query URLs or locations',async()=>{
 const jobs=[row(1),row(2,{location:'New York'}),row(3,{canonical_url:'https://example.test/job?ref=A',identity:null,requisition_id:null}),row(4,{canonical_url:'https://example.test/job?ref=B',identity:null,requisition_id:null})].map(discoveryDedupRow);
 const kept=await executeCareerTask('dedup-discovery',{jobs,previous:[]});assert.deepEqual(kept.map(r=>r.id),jobs.map(r=>r.id));
});

test('explicit previous-run history suppresses repeat reports without editing that history',async()=>{
 const old=row(1),fresh=row(2,{identity:old.identity,requisition_id:old.requisition_id,canonical_url:old.canonical_url+'?utm_source=again'}),h=owned([fresh],[old]);
 const r=await deduplicateSearchDiscoveries(h.dispatch,{runId,listingIds:[fresh.id],previousListingIds:[old.id]});
 assert.deepEqual(r.data.retainedListingIds,[]);assert.deepEqual(r.data.duplicateListingIds,[fresh.id]);assert.deepEqual(r.data.comparedPreviousListingIds,[old.id]);assert.equal(r.data.historyScope,'explicit-listing-ids');
 const without=await deduplicateSearchDiscoveries(h.dispatch,{runId,listingIds:[fresh.id]});assert.deepEqual(without.data.retainedListingIds,[fresh.id]);
});

test('missing or foreign-owned candidate/history fails before executing child',async()=>{
 const h=owned([row(1)]);let executed=false;
 for(const request of [{runId,listingIds:[id(2)]},{runId,listingIds:[id(1)],previousListingIds:[id(2)]}]){
  const r=await deduplicateSearchDiscoveries(h.dispatch,request,{execute:async()=>{executed=true;return [];}});assert.equal(r.error.code,'P0002');
 }
 assert.equal(executed,false);
 const denied=await deduplicateSearchDiscoveries(async()=>({error:{code:'42501'}}),{runId,listingIds:[id(1)]});assert.equal(denied.error.code,'42501');
});

test('pagination reads past the first page and rejects incomplete/cyclic history',async()=>{
 let pages=0;
 const dispatch=async(op,p)=>({data:op==='search.run.read'?{}:(pages++,p.offset===0?{listings:[],nextOffset:100}:{listings:[row(1)],nextOffset:null})});
 const ok=await deduplicateSearchDiscoveries(dispatch,{runId,listingIds:[id(1)]},{execute:async(_t,p)=>p.jobs});assert.equal(ok.error,null);assert.equal(pages,2);
 const bad=await deduplicateSearchDiscoveries(async op=>({data:op==='search.run.read'?{}:{listings:[],nextOffset:0}}),{runId,listingIds:[id(1)]});assert.equal(bad.error.code,'22023');
});

test('malformed child output fails loudly instead of publishing a false shortlist',async()=>{
 for(const out of [null,[{id:id(2)}],[{id:id(1)},{id:id(1)}]]){
  const r=await deduplicateSearchDiscoveries(owned([row(1)]).dispatch,{runId,listingIds:[id(1)]},{execute:async()=>out});assert.equal(r.error.code,'22023');
 }
});

test('MCP and Node dispatch invoke the same read-only owned service and real copied child',async()=>{
 const h=owned([row(1)]);
 const dispatch=createDispatch({supabaseUrl:'http://127.0.0.1:54321',rpc:async(name,args)=>{assert.equal(name,'agent_dispatch');return args.operation==='credentials.verify'?{data:{scopes:['workspace:read']}}:h.dispatch(args.operation,args.payload);},request:async()=>{throw Error('Must not forward to Edge');}});
 const handler=createHandler(dispatch),token='jb_agent_'+'a'.repeat(64);
 const response=await handler(new Request('http://localhost/mcp',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'deduplicate_search_discoveries',arguments:{runId,listingIds:[id(1)]}}})}));
 const body=await response.json();assert.ok(body.result,JSON.stringify(body));assert.ok(!body.result.isError,JSON.stringify(body));const data=body.result.structuredContent||JSON.parse(body.result.content[0].text);assert.deepEqual(data.retainedListingIds,[id(1)]);
});
