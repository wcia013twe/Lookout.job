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


test('Simplify off-season page uses the same structured provider with its published season window',async()=>{
 const address=url+'/blob/dev/README-Off-Season.md';const rows=[row('fall',{terms:['Fall 2026']}),row('winter',{terms:['Winter 2027']}),row('spring',{terms:['Spring 2027']}),row('summer'),row('old',{terms:['Winter 2026']}),row('multi',{terms:['Summer 2027','Spring 2027']})];
 assert(simplifyFeed(address));
 const page=await readSimplifyLeads(address,{limit:null,request:async()=>new Response(JSON.stringify(rows))});
 assert.equal(page.coverage,'exhaustive');assert.deepEqual(new Set(page.leads.map(r=>r.url.split('/').at(-1))),new Set(['fall','winter','spring','multi']));
 const {sourceProviders}=await import('../backend/runtime/source-providers.ts');
 assert.equal(sourceProviders.get('simplify').detect({careers_url:address}),true);
});

test('Simplify verifies only the 100 newest matching leads after title triage and marks omissions partial',async()=>{
 const {fetchSource}=await import('../backend/runtime/ats.ts');const batches=[];
 const rows=Array.from({length:250},(_,i)=>row(String(i),{date_posted:i+1,title:i>=200?'Senior Software Engineer':'Software Engineer Intern'}));
 const result=await fetchSource('portal:simplify',{careers_url:url},{prefilter:true,request:async()=>new Response(JSON.stringify(rows)),execute:async(task,input)=>{
  if(task==='prefilter-discovery')return input.jobs.filter(r=>!r.title.startsWith('Senior')).reverse();
  if(task==='dedup-discovery')return input.jobs;
  assert.equal(task,'verify-discovery-leads');batches.push(input.leads.map(r=>r.url));
  return {jobs:input.leads.map(({url})=>({url,title:'Software Engineer Intern',company:'Example',description:'Verified',listingIdentity:{ats_provider:'greenhouse',board_slug:'example',posting_id:url.split('/').at(-1)}})),diagnostics:[]};
 }});
 assert.equal(result.total,250);assert.equal(result.listings.length,100);assert.deepEqual(batches.map(b=>b.length),[25,25,25,25]);
 assert.deepEqual(batches.flat().map(u=>Number(u.split('/').at(-1))).sort((a,b)=>b-a),Array.from({length:100},(_,i)=>199-i));
 assert.equal(result.coverage,'truncated');assert.equal(result.provenance.prefilterExcluded,50);assert.equal(result.provenance.omittedMatchingLeads,100);assert.match(result.blocker,/No continuation cursor/);
});

test('exactly 100 Simplify matching leads are not falsely reported as capped',async()=>{
 const {collectSource}=await import('../backend/runtime/source-providers.ts');
 for(const n of [0,100,101]){
  const page=await collectSource('portal:simplify',{careers_url:url},{profile:{},days:3,request:async()=>new Response(JSON.stringify(Array.from({length:n},(_,i)=>row(String(i))))),execute:async()=>{throw Error('No configured prefilter');}});
  assert.equal(page.jobs.length,Math.min(100,n));assert.equal(page.coverage,n>100?'truncated':'exhaustive');
 }
});

test('capped Simplify demo remains fictional, partial and resettable',async()=>{
 const {searchDemo}=await import('../lib/search/demo.mjs');const a=searchDemo(),b=searchDemo();const find=d=>d.runs.find(r=>r.id==='demo-run').sources.find(s=>s.source_id==='portal:demo-simplify-capped');
 assert.equal(find(a).coverage,'truncated');assert.equal(find(a).counts.observed,100);assert.match(find(a).blocker,/220 older/);find(a).blocker='edited';assert.notEqual(find(b).blocker,'edited');
});
