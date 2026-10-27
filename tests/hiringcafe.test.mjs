import test from 'node:test';
import assert from 'node:assert/strict';
import {hiringCafeSource,hiringCafeQueries,readHiringCafeLeads,resolveHiringCafeEmployer} from '../backend/runtime/hiringcafe.ts';
import {fetchSource} from '../backend/runtime/ats.ts';
import {executeSearch} from '../backend/runtime/worker.ts';
import {executeCareerTask} from '../runner/career-tools.mjs';
const source={name:'HiringCafe',careers_url:'https://hiringcafe.com/',keywords:['backend engineer'],api:'https://ignored.example/'};
const profile={filters:{Employment:'Full-time, Internship',Location:'United States','Experience level':'Entry-level','Work arrangement':'Remote preferred'}};
const url='https://job-boards.greenhouse.io/example/jobs/123';
const job={id:'fictional-job',title:'Backend Engineer',company:'Example Systems (fictional)',location:'United States',applyUrl:url,datePosted:'2026-10-20T00:00:00Z'};
const json=x=>new Response(JSON.stringify(x));
const result=(jobs,total_matches=jobs.length)=>json({result:{structuredContent:{jobs,total_matches}}});
test('HiringCafe maps saved filters into separate bounded tracks without making preferences mandatory',()=>{
 assert(hiringCafeSource('https://hiring.cafe/'));for(const u of ['https://hiringcafe.com.evil.test','https://hiringcafe.com@evil.test','http://hiringcafe.com','https://hiringcafe.com:444'])assert(!hiringCafeSource(u));
 const plan=hiringCafeQueries(source,profile,30);assert.equal(plan.queries.length,2);assert.deepEqual(plan.queries.map(q=>q.employment_types),[['Full Time'],['Internship']]);assert.equal(plan.queries[0].posted_within_days,30);assert.equal(plan.queries[0].location,'United States');assert.equal(plan.queries[0].workplace_types,undefined);assert.deepEqual(plan.queries[0].seniority_levels,['No Prior Experience Required','Entry Level']);
 assert.deepEqual(hiringCafeQueries({},{}).queries,[{posted_within_days:3}]);assert(hiringCafeQueries({...source,keywords:['a','b','c']},{filters:{Location:'A;B;C',Employment:'Full-time, Internship'}}).omittedQueries>0);
});
test('HiringCafe only resolves explicit public employer links; missing and ambiguous links remain unknown',async()=>{
 assert.equal(await resolveHiringCafeEmployer(job),url);
 const j={applyUrl:'https://hiringcafe.com/job/example'};
 assert.equal(await resolveHiringCafeEmployer(j,async()=>new Response(`<a href="${url}">Apply now</a><a href="https://example.com/privacy">Privacy</a>`)),url);
 for(const html of [`<a href="http://127.0.0.1">Apply now</a>`,`<a href="${url}">Privacy</a>`,`<a href="${url}">Apply now</a><a href="https://example.com/job2">Apply now</a>`])await assert.rejects(resolveHiringCafeEmployer(j,async()=>new Response(html)),/missing or ambiguous/);
 await assert.rejects(resolveHiringCafeEmployer(j,async()=>new Response('challenge',{status:403})),/403/);
});
test('aggregate failures are explicit, provider dates stay source evidence, and duplicate IDs are fetched once',async()=>{
 let calls=0;const page=await readHiringCafeLeads(source,{profile:{filters:{Employment:'Full-time'}},request:async(endpoint,init)=>{calls++;assert.equal(endpoint,'https://hiringcafe.com/api/chatgpt/mcp');assert.equal(init.redirect,'error');return result([job,job],10);}});
 assert.equal(calls,1);assert.equal(page.leads.length,1);assert.equal(page.coverage,'truncated');assert.equal(page.leads[0].employerPostedAt,undefined);assert.equal(page.leads[0].employmentType,'FT');
 for(const response of [new Response('rate',{status:429}),json({error:{message:'failure'}}),json({result:{structuredContent:{jobs:[]}}})]){
  const output=await fetchSource('portal:cafe',source,{request:async()=>response});assert.equal(output.coverage,'inaccessible');assert.equal(output.listings.length,0);assert.match(output.blocker,/HiringCafe/);
 }
});
test('unresolved HiringCafe pages remain diagnostics and never enter employer verification',async()=>{
 let verify=0;const request=async(_url,init)=>{if(init.method==='POST'){const p=JSON.parse(init.body).params;if(p.name==='search_hiringcafe_jobs')return result([{...job,applyUrl:undefined}],1);return json({result:{structuredContent:{job:{...job,applyUrl:'https://hiringcafe.com/job/example'}}}});}return new Response('challenge',{status:403});};
 const output=await fetchSource('portal:cafe',source,{request,execute:async(task,input)=>{if(task==='dedup-discovery')return input.jobs;verify++;throw Error('must not verify unresolved links');}});
 assert.equal(verify,0);assert.equal(output.coverage,'truncated');assert.equal(output.diagnostics[0].status,'uncertain');assert.match(output.diagnostics[0].reason,/403/);assert.equal(output.listings.length,0);
});
test('one batch search job collects HiringCafe, verifies employer URLs, screens and deduplicates the saved shortlist',async()=>{
 const context={personalVersion:7,documents:[{kind:'profile',id:'general',version:3,projection:{filters:{Employment:'Full-time',Location:'United States','Experience level':'Entry-level'}}}]};
 const run={id:'run',profile_id:'general',state:'active',version:0,days:3,sources:[{source_id:'portal:cafe',source,version:0,state:'pending'}]},saved=[],calls=[],http=[];
 const dispatch=async(op,p)=>{calls.push(op);if(op==='search.run.start'||op==='search.run.read')return structuredClone(run);if(op==='search.context')return context;if(op==='search.discoveries.save'){saved.push(...p.listings.map((r,i)=>({...r,id:'listing-'+i,canonical_url:r.url,observation:{id:'observation-'+i,description:r.description,employer_posted_at:r.employerPostedAt},screeningVersion:0})));return {};}
  if(op==='search.discoveries.read')return {listings:saved,nextOffset:null};if(op==='search.screenings.read')return null;if(op==='search.screenings.commit')return {screenings:p.screenings,evaluatedProfileVersion:3,personalVersion:7};if(op==='search.progress'){Object.assign(run.sources[0],p);run.version++;return {};}
  if(op==='search.run.finish'){run.state=p.state;return {};}throw Error('Unexpected '+op);
 };
 const execute=async(task,input)=>{if(task==='verify-discovery-leads'){assert.deepEqual(input.leads,[{url}]);return {jobs:[{url,title:job.title,company:job.company,description:'Employer verified backend role',location:'United States',postedAt:null,listingIdentity:{ats_provider:'greenhouse',board_slug:'example',posting_id:'123'}}],diagnostics:[{url,status:'active',extraction:'parsed'}]};}return executeCareerTask(task,input);};
 const output=await executeSearch({id:'batch',kind:'search_ats',input:{profileId:'general'},version:1,attempts:1},dispatch,{execute,request:async(endpoint,init)=>{http.push(JSON.parse(init.body));return result([job,job],5);}});
 assert.equal(http.length,1);assert.equal(http[0].params.arguments.search,'backend engineer');assert.deepEqual(http[0].params.arguments.employment_types,['Full Time']);assert.equal(output.status,'partial');assert.equal(output.result.saved,1);assert.deepEqual(output.result.shortlist.retainedListingIds,['listing-0']);assert.equal(saved[0].employerPostedAt,null);assert(calls.includes('search.screenings.commit'));assert.equal(output.result.provenance[0].aggregate,'HiringCafe public MCP');assert(!calls.some(op=>/publish|submit|application/.test(op)));
});
