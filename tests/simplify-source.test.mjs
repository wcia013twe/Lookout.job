import test from 'node:test';import assert from 'node:assert/strict';import {readSimplifyLeads,simplifyFeed} from '../backend/runtime/simplify.ts';
const url='https://github.com/SimplifyJobs/Summer2027-Internships';
const row=(id,patch={})=>({id,active:true,is_visible:true,url:'https://job-boards.greenhouse.io/example/jobs/'+id,title:'Software Engineer Intern',company_name:'Example',terms:['Summer 2027'],locations:['NYC'],date_posted:100,...patch});
test('Simplify adapter preserves active exact-season leads and bounded pagination without claiming verification',async()=>{
 const calls=[];const request=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify([row('a'),row('b',{date_posted:200}),row('closed',{active:false}),row('hidden',{is_visible:false}),row('winter',{terms:['Winter 2027']}),row('old',{terms:['Summer 2026']})]));};
 const page=await readSimplifyLeads(url,{request,now:86400000,limit:1});assert.equal(page.total,2);assert.equal(page.leads[0].url.endsWith('/b'),true);assert.equal(page.nextOffset,1);assert.equal(page.coverage,'truncated');assert.equal(page.leads[0].employmentType,'Internship');assert.equal(page.leads[0].sourceListAgeDays,0);assert.ok(!('employerPostedAt'in page.leads[0]));assert.ok(!('liveness'in page.leads[0]));assert.match(calls[0].url,/^https:\/\/raw.githubuser/);assert.equal(calls[0].options.redirect,'error');
 const next=await readSimplifyLeads(url,{request,now:86400000,offset:1,limit:1});assert.equal(next.nextOffset,null);
});
test('unconfigured feeds, malformed JSON and HTTP failures fail loudly',async()=>{
 assert.equal(simplifyFeed('https://evil.test/list'),null);await assert.rejects(readSimplifyLeads('https://evil.test/list'),/official Simplify/);
 await assert.rejects(readSimplifyLeads(url,{request:async()=>new Response('[]',{status:503})}),/HTTP 503/);
 await assert.rejects(readSimplifyLeads(url,{request:async()=>new Response('{}')}),/array/);
 await assert.rejects(readSimplifyLeads(url,{request:async()=>new Response('bad')}),/valid structured JSON/);
});

test('background source collection consumes the full Simplify feed in verification batches',async()=>{
 const {fetchSource}=await import('../backend/runtime/ats.ts');const sizes=[];let requests=0;
 const rows=Array.from({length:61},(_,i)=>row(String(i)));
 const output=await fetchSource('portal:simplify',{careers_url:url},{request:async()=>{requests++;return new Response(JSON.stringify(rows));},execute:async(task,input)=>{
  if(task==='dedup-discovery')return input.jobs;
  assert.equal(task,'verify-discovery-leads');sizes.push(input.leads.length);
  return {jobs:input.leads.map(({url})=>({url,title:'Software Engineer Intern',company:'Example',description:'Verified',postedAt:null,listingIdentity:{ats_provider:'greenhouse',board_slug:'example',posting_id:url.split('/').at(-1)}})),diagnostics:input.leads.map(({url})=>({url,status:'active',extraction:'parsed'}))};
 }});
 assert.equal(requests,1);assert.deepEqual(sizes,[25,25,11]);assert.equal(output.total,61);assert.equal(output.listings.length,61);assert.equal(output.coverage,'exhaustive');
 assert(output.listings.every(r=>r.employmentType==='Internship'));
});
