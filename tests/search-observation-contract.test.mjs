import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {TOOLS} from '../supabase/functions/agent-mcp/protocol.mjs';
const listing=()=>({sourceId:'portal:fixture',url:'https://example.com/jobs/42',company:'Fictional Example',title:'Engineer',location:null,checkedAt:new Date().toISOString(),liveness:'uncertain',evidence:'Fictional test only',employerPostedAt:null,sourceListAgeDays:null,description:''});
const discovery=listings=>({operation:'search.discoveries.save',payload:{runId:'fixture',eventKey:'fixture',listings}});
const progress=overrides=>({operation:'search.progress',payload:{runId:'fixture',sourceId:'query:1',expectedVersion:0,eventKey:'fixture',state:'active',checkpoint:{page:1},counts:{found:0},coverage:'unknown',...overrides}});
test('MCP discovery describes nested listing vocabulary, nullability and bounded progress',()=>{
 const observations=TOOLS.find(t=>t.name==='save_search_discoveries').inputSchema.properties.listings;
 assert.equal(observations.items.additionalProperties,false);
 for(const field of Object.keys(listing()))assert(observations.items.required.includes(field));
 assert.deepEqual(observations.items.properties.location.type,['string','null']);
 const p=TOOLS.find(t=>t.name==='record_search_progress').inputSchema.properties;
 assert.deepEqual(p.coverage.enum,['unknown','exhaustive','truncated','inaccessible']);
 assert.deepEqual(p.counts.additionalProperties,{type:'integer',minimum:0,maximum:999999999});
});
test('gateway diagnoses listing indexes/fields without reflecting untrusted content',()=>{
 for(const [patch,error]of [
  [{company:' '},/listings\[1\].company/],[{url:'http://example.com'},/listings\[1\].url/],
  [{checkedAt:'not a date'},/listings\[1\].checkedAt/],[{checkedAt:new Date(Date.now()+600000).toISOString()},/five minutes/],
  [{liveness:'live'},/active, expired, uncertain/],[{sourceListAgeDays:-1},/sourceListAgeDays/],
  [{employerPostedAt:'invalid'},/employerPostedAt/],[{description:'x'.repeat(60001)},/description/],
 ])assert.throws(()=>validateRequest(discovery([listing(),{...listing(),...patch}])),error);
 const missing=listing();delete missing.location;
 assert.throws(()=>validateRequest(discovery([missing])),/listings\[0\].location: required/);
 assert.throws(()=>validateRequest(discovery([{...listing(),'PRIVATE_UNTRUSTED_KEY':'PRIVATE_VALUE'}])),e=>e.message.includes('unsupported field')&&!/PRIVATE/.test(e.message));
 for(const value of [null,[],42])assert.throws(()=>validateRequest(discovery([value])),/listings\[0\]: expected object/);
 for(const count of [0,26])assert.throws(()=>validateRequest(discovery(Array.from({length:count},listing))),/1–25/);
});
test('progress rejects invalid counter values and explains coverage without exposing source data',()=>{
 for(const value of [-1,1.5,'1',null,{},1000000000])assert.throws(()=>validateRequest(progress({counts:{PRIVATE_COUNTER:value}})),e=>/counts values/.test(e.message)&&!e.message.includes('PRIVATE_COUNTER'));
 assert.throws(()=>validateRequest(progress({coverage:'complete'})),/unknown, exhaustive, truncated, inaccessible/);
 assert.throws(()=>validateRequest(progress({blocker:'x'.repeat(3001)})),/blocker/);
});
test('valid nullable observations and bounded counters survive validation unchanged',()=>{
 const request=discovery([listing(),{...listing(),location:'Remote',employerPostedAt:'2026-01-01',sourceListAgeDays:0}]);
 const original=structuredClone(request);validateRequest(request);assert.deepEqual(request,original);
 for(const coverage of ['unknown','exhaustive','truncated','inaccessible'])validateRequest(progress({coverage,counts:{found:999999999,checked:0}}));
 validateRequest(progress({counts:{},checkpoint:{cursor:null,seen:['fictional']}}));
});
