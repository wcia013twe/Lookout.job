import {test} from 'node:test';import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
import {createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {prepareSearch,searchResponse} from '../supabase/functions/agent-gateway/search.mjs';
import {readGuide} from '../supabase/functions/agent-gateway/guides.mjs';
import {profileDocument} from '../lib/search/documents.mjs';
import {hashToken} from '../supabase/functions/agent-gateway/contract.mjs';
test('a hosted-MCP-only agent configures, checkpoints, reconnects, resumes, publishes and completes a sweep',async()=>{
 const db=await createTestDatabase();const token='jb_agent_'+'c'.repeat(64);const hash=await hashToken(token);const owner='11111111-1111-1111-1111-111111111111';
 try{
 await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Portable agent',$2,array['workspace:read','preferences:write','drafts:write','batches:write'],now()+interval '1 hour')",[owner,hash]);
 const handler=()=>createHandler(async(_token,operation,payload)=>{
  try{validateRequest({operation,payload});if(operation.startsWith('search.'))payload=prepareSearch(operation,payload);
  const {rows}=await db.query('select public.agent_dispatch($1,$2,$3) data',[hash,operation==='guides.read'?'context.developer':operation,operation==='guides.read'?{}:payload]);
  return {status:200,data:operation==='guides.read'?readGuide(payload.id):operation.startsWith('search.')?searchResponse(operation,rows[0].data):rows[0].data};
  }catch(e){return {status:e.code==='40001'?409:400,error:e.message};}
 });
 let transport=handler();
 const call=async(name,args={})=>{
  const res=await transport(new Request('http://localhost/mcp',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})}));
  const body=await res.json();assert(!body.error,JSON.stringify(body));assert(!body.result.isError,JSON.stringify(body.result));return body.result.structuredContent||JSON.parse(body.result.content[0].text);
 };
 const empty=await call('read_search_context');assert.equal(empty.configurationGaps.length,2);
 const guide=await call('read_guide',{id:'career-find-jobs'});assert(guide.dependencies.runtime.includes('agent browsing/search'));
 await call('save_search_document',{kind:'profile',id:'general',expectedVersion:0,eventKey:'profile',content:profileDocument({id:'general',name:'General',active:true,filters:{Employment:'Full-time'},priorities:{},instructions:'Prefer backend infrastructure; unknown leveling needs review.'})});
 await call('save_search_document',{kind:'portals',id:'shared',expectedVersion:0,eventKey:'portals',content:'tracked_companies:\n  - id: example\n    name: Example\n    kind: careers\n    careers_url: https://example.com/careers\n    enabled: true\nsearch_queries: []\n'});
 const run=await call('start_search_run',{profileId:'general',eventKey:'start'});assert.equal(run.days,3);
 await call('record_search_progress',{runId:run.id,sourceId:'portal:example',expectedVersion:0,state:'active',checkpoint:{page:1},counts:{found:0},coverage:'unknown',eventKey:'page1'});
 // A fresh MCP transport has no conversation memory, local files, scanner or runner.
 transport=handler();
 const context=await call('read_search_context',{profileId:'general'});assert.equal(context.configurationGaps.length,0);
 const resumed=await call('read_search_run',{runId:run.id});assert.deepEqual(resumed.sources[0].checkpoint,{page:1});
 const saved=await call('save_search_discoveries',{runId:run.id,eventKey:'lead',listings:[{sourceId:'portal:example',url:'https://example.com/jobs/42',company:'Example',title:'Backend Engineer',location:'New York',checkedAt:new Date().toISOString(),liveness:'active',evidence:'Fictional official posting fixture; no real network observation.',employerPostedAt:null,sourceListAgeDays:null,description:'Fictional JD: early career backend systems.'}]});
 const listingId=saved.saved[0].listingId;
 const page=await call('read_search_discoveries',{runId:run.id});assert.equal(page.listings[0].id,listingId);assert.equal(page.listings[0].observation.employer_posted_at,null);
 await call('save_search_screening',{runId:run.id,listingId,expectedVersion:0,decision:'review-needed',checks:[{requirement:'graduation',status:'unknown',evidence:'The fixture posting omits a graduation window.'}],explanation:'Review graduation eligibility.',eventKey:'screening'});
 const batch=await call('publish_batch',{eventKey:'selected',label:'Fictional search integration',jobs:[{canonicalUrl:'https://example.com/jobs/42',employer:{company:'Example',title:'Backend Engineer',location:'New York'},recommendation:{searchListingId:listingId,searchRunId:run.id,decision:'review-needed'}}]});assert(batch);
 await call('record_search_progress',{runId:run.id,sourceId:'portal:example',expectedVersion:1,state:'completed',checkpoint:{page:2},counts:{found:1},coverage:'exhaustive',eventKey:'page2'});
 const current=await call('read_search_run',{runId:run.id});await call('finish_search_run',{runId:run.id,expectedVersion:current.version,state:'completed',summary:'Fictional source exhausted; one role needs eligibility review.',eventKey:'finish'});
 assert.equal((await db.query('select count(*)::int n from public.applications')).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from public.approvals')).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from public.submission_attempts')).rows[0].n,0);
 }finally{await db.close();}
});
