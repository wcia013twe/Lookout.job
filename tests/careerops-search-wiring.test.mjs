import test from 'node:test';
import assert from 'node:assert/strict';
import {profileDiscoveryFilters,discoveryFilterPlan} from '../lib/search/discovery-config.mjs';
import {inspectDiscoveryFilters} from '../runner/career-search-plan.mjs';
import {filterDiscovery} from '../runner/career-search-filters.mjs';
import {profileDocument,parseDocument} from '../lib/search/documents.mjs';
import {readSearchFilterPlan} from '../backend/runtime/search-intake.ts';
import {createDispatch} from '../backend/runtime/service.ts';
import {TOOLS} from '../supabase/functions/agent-mcp/protocol.mjs';
import {searchResponse} from '../supabase/functions/agent-gateway/search.mjs';
const section=config=>'## Career Ops discovery filters\n```json\n'+JSON.stringify(config)+'\n```';
const profile=config=>({id:'systems',name:'Systems',active:true,filters:{Employment:'Full-time',Location:'New York; Remote'},priorities:{},instructions:'## Role preferences\n- Roles: Software Engineer; UX Designer\n'+section(config)});
const row=(id,title,location='New York')=>({id,title,location,url:'https://example.test/jobs/'+id,employmentType:'FT',description:'Build distributed systems.'});

test('configured roles cannot silently search every title, and explicit broad targeting is visible',async()=>{
 const p={filters:{},instructions:'## Role preferences\n- Roles: Software Engineer'};
 const result=await inspectDiscoveryFilters({profile:p});assert.equal(result.ready,false);assert.match(result.gaps[0],/title keywords/);
 await assert.rejects(filterDiscovery({profile:p,listings:[]}),/title keywords/);
 const broad=await inspectDiscoveryFilters({profile:profile({title_filter:{positive:[]}})});assert.equal(broad.ready,true);assert.match(broad.warnings.join(' '),/every title/);
});
test('profile filters persist through the existing codec, override shared keys and leave other profiles unchanged',()=>{
 const shared={title_filter:{positive:['Account Executive']},location_filter:{block_hard:['Brazil']}};
 const p=profile({title_filter:{positive:['Software Engineer','Backend','UX Designer'],negative:['word:Senior']},skip_tiers:['senior']});
 const saved=parseDocument('profile',profileDocument(p));assert.deepEqual(saved.projection,p);
 const plan=discoveryFilterPlan(saved.projection,shared);assert.deepEqual(plan.config.title_filter.positive,['Software Engineer','Backend','UX Designer']);assert.deepEqual(plan.config.location_filter,shared.location_filter);
 assert.deepEqual(discoveryFilterPlan({instructions:'',filters:{}},shared).config.title_filter,shared.title_filter);
 assert.equal(shared.title_filter.positive[0],'Account Executive');
 assert.deepEqual(searchResponse('search.context',{profileId:p.id,documents:[{kind:'profile',id:p.id,projection:p}]}).filterPlan.config.skip_tiers,['senior']);
});
test('real Career Ops predicates reject run-3 style mismatches, with its original seniority classifier',async()=>{
 const p=profile({title_filter:{positive:['Backend','Software Engineer','UX Designer'],negative:[]},skip_tiers:['senior'],location_filter:{allow:['New York','Remote'],block_hard:['Brazil'],strict:true}});
 const {results}=await filterDiscovery({profile:p,listings:[row('good','Backend Engineer'),row('sales','Account Executive'),row('senior','Senior Backend Engineer'),row('foreign','Backend Engineer','Sao Paulo, Brazil'),row('ordinary','Software Engineer')]});
 assert.deepEqual(results.map(r=>r.decision),['review-needed','ineligible','ineligible','ineligible','review-needed']);
 assert.equal(results[2].checks.find(c=>c.requirement==='careerops-seniority').status,'unmet');
 assert.equal(results[4].checks.find(c=>c.requirement==='experience').status,'unknown');
});
test('shared hard location blocks compose with softer profile preferences',async()=>{
 const {results:[r]}=await filterDiscovery({profile:{filters:{Location:'United States'}},portals:{location_filter:{block_hard:['Brazil']}},listings:[row('foreign','Backend Engineer','Sao Paulo, Brazil')]});
 assert.equal(r.decision,'ineligible');assert.equal(r.checks.find(c=>c.requirement==='location-policy').status,'unmet');
});
test('upstream validator and the scoped boundary reject malformed or silently disabled filter configuration',async()=>{
 for(const config of [{title_filter:{positive:[3]}},{title_filter:{positve:['Backend']}},{title_filter:{positive:'Backend'}},{skip_tiers:['new-grad']},{salary_filter:{min:200,max:100}},{location_filter:{strict:'yes'}},{visa_filter:{enabled:'yes'}},{posted_after:'yesterday'}]){
  const result=await inspectDiscoveryFilters({profile:profile(config)});assert.equal(result.ready,false,JSON.stringify(config));assert.ok(result.validation.errors.length);
 }
 for(const instructions of [section({parser:{command:'shell'}}),section({title_filter:{positive:['a']}})+'\n'+section({}), '## Career Ops discovery filters\nnot json'])assert.throws(()=>profileDiscoveryFilters(instructions));
});
test('original offline portal audit reports source handoffs and stale queries without searching',async()=>{
 const result=await inspectDiscoveryFilters({profile:profile({title_filter:{positive:['Backend']}}),portals:{tracked_companies:[{id:'example',name:'Example',enabled:true,careers_url:'https://example.test/careers',config:{scan_method:'websearch',scan_query:'site:example.test Accountant'}}]}});
 assert.equal(result.sourceDiagnostics.unclaimed.handoff.length,1);assert.equal(result.sourceDiagnostics.staleQueries.length,1);
 assert.equal(result.provenance.validation,'validate-portals.mjs');
});
test('filter-plan MCP read authorizes owned context, advertises read scope and checks concurrent settings changes',async()=>{
 assert.equal(TOOLS.find(t=>t.name==='read_search_filter_plan').scope,'workspace:read');
 let executions=0;
 const denied=await readSearchFilterPlan(async()=>({error:{code:'42501'}}),{profileId:'systems'},{execute:async()=>{executions++;}});assert.equal(denied.error.code,'42501');assert.equal(executions,0);
 let reads=0;const context=()=>({data:{personalVersion:++reads,documents:[{kind:'profile',id:'systems',version:1,projection:profile({})}]}});
 const changed=await readSearchFilterPlan(context,{profileId:'systems'},{execute:async()=>({ready:true})});assert.equal(changed.error.code,'40001');
 const token='jb_agent_'+'a'.repeat(64);const dispatch=createDispatch({supabaseUrl:'http://localhost:54321',rpc:async()=>({error:{code:'42501'}}),request:async()=>assert.fail('must not forward to Edge')});
 assert.equal((await dispatch(token,'search.filters.inspect',{profileId:'systems'})).status,403);
});
test('resettable fictional demo exposes profile filter plan without account reads or network',async()=>{
 const {searchDemo}=await import('../lib/search/demo.mjs');const data=searchDemo();
 const result=searchResponse('search.context',data);assert.deepEqual(result.filterPlan.config.skip_tiers,['senior']);assert.deepEqual(searchDemo(),data);
});

test('original JD dispatcher retrieves each supported ATS body and Lookout keeps official metadata and identity',async t=>{
 const {verifyDiscoveryLeads}=await import('../runner/career-search-intake.mjs');
 const cases=[
  {url:'https://jobs.lever.co/example/abc-123',source:{name:'Example Labs',careers_url:'https://jobs.lever.co/example'},raw:{id:'abc-123',text:'Backend Engineer',descriptionPlain:'Build reliable distributed systems.',lists:[{text:'Requirements',content:'<ul><li>Two years of Rust</li></ul>'}],additionalPlain:'Benefits and compensation.',categories:{location:'Remote, US',commitment:'Full-time'}},body:/Two years of Rust/,ats:'lever'},
  {url:'https://jobs.ashbyhq.com/example/abc-123',source:{name:'Example Labs',careers_url:'https://jobs.ashbyhq.com/example'},raw:{jobs:[{id:'abc-123',title:'Backend Engineer',descriptionPlain:'Build reliable distributed systems.',location:'New York',employmentType:'FullTime',publishedAt:'2026-11-02T12:00:00Z'}]},body:/Build reliable/,ats:'ashby'},
  {url:'https://example.wd5.myworkdayjobs.com/External/job/New-York/Backend_REQ1',raw:{jobPostingInfo:{title:'Backend Engineer',jobDescription:'<p>Build reliable distributed systems.</p>',location:'New York',hiringOrganization:{name:'Example Labs'},jobReqId:'REQ1',startDate:'2026-11-02'}},body:/Build reliable/,ats:'workday'},
  {url:'https://jobs.smartrecruiters.com/Example/123-Backend',raw:{id:'123',name:'Backend Engineer',company:{name:'Example Labs'},location:{city:'New York',country:'US'},jobAd:{sections:{jobDescription:{text:'<p>Build reliable distributed systems.</p>'},qualifications:{text:'<p>Rust experience</p>'}}}},body:/Rust experience/,ats:'smartrecruiters'},
  {url:'https://example.test/careers?gh_jid=123',raw:{id:123,title:'Backend Engineer',company_name:'Example Labs',content:'<p>Build reliable distributed systems.</p>',absolute_url:'https://job-boards.greenhouse.io/example/jobs/123',location:{name:'New York'}},body:/Build reliable/,ats:'greenhouse'},
 ];
 let current;
 t.mock.method(globalThis,'fetch',async input=>String(input).includes('/embed/job_app')?new Response(null,{status:302,headers:{location:'https://boards.greenhouse.io/embed/job_app?for=example&token=123'}}):Response.json(current.raw));
 for(current of cases){
  const r=await verifyDiscoveryLeads([{url:current.url}],{source:current.source,check:async()=>[{url:current.url,result:'active',code:'fixture',reason:'Fictional active posting',checkedAt:'2026-11-03T12:00:00Z',method:'ats-api'}],fetchJson:async()=>current.raw});
  assert.equal(r.jobs.length,1,current.ats+': '+JSON.stringify(r.diagnostics));assert.match(r.jobs[0].description,current.body);assert.equal(r.jobs[0].company,'Example Labs');assert.equal(r.jobs[0].listingIdentity.ats_provider,current.ats);assert.equal(r.diagnostics[0].extraction,'parsed');
 }
});
test('JD text alone, aggregate labels, mismatched owned boards and mismatched posting IDs never create verified jobs',async()=>{
 const {verifyDiscoveryLeads}=await import('../runner/career-search-intake.mjs');
 const url='https://jobs.lever.co/example/abc-123';
 const options={check:async()=>[{url,result:'active',code:'fixture',reason:'Fictional active posting',checkedAt:'2026-11-03T12:00:00Z',method:'ats-api'}],fetchJd:async()=>({url,title:'Engineer',text:'Full official posting text.'}),fetchJson:async()=>({id:'abc-123',categories:{location:'Remote'}})};
 for(const source of [undefined,{name:'Invented employer',careers_url:'https://jobs.lever.co/different'},{name:'Aggregate',careers_url:'https://example.test/aggregate'}]){
  const r=await verifyDiscoveryLeads([{url,company:'Unverified aggregate label'}],{...options,source});assert.equal(r.jobs.length,0);assert.equal(r.diagnostics[0].status,'active');assert.equal(r.diagnostics[0].extraction,'failed');
 }
 const r=await verifyDiscoveryLeads([{url}],{...options,source:{name:'Example',careers_url:'https://jobs.lever.co/example'},fetchJson:async()=>({id:'different'})});assert.equal(r.jobs.length,0);
});
