import test from 'node:test';import assert from 'node:assert/strict';
import {parseJobrightList,jobrightFeed,jobrightEmployerUrl,readJobrightLeads} from '../backend/runtime/jobright.ts';
import {fetchSource} from '../backend/runtime/ats.ts';
const address='https://github.com/jobright-ai/2026-Software-Engineer-New-Grad';
const id=n=>String(n).padStart(24,'0');
const line=(n,company='**[Fictional Systems](https://example.com)**')=>`| ${company} | **[Software Engineer](https://jobright.ai/jobs/info/${id(n)}?utm_source=test)** | United States | Remote | Nov 07 |`;
const html=(n,patch={})=>`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({props:{pageProps:{dataSource:{jobResult:{jobId:id(n),applyLink:`https://job-boards.greenhouse.io/fictional/jobs/${n}`,...patch}}}}})}</script>`;
test('Jobright public list parsing preserves inherited companies, distinct jobs and tracking-free identity',()=>{
 const rows=parseJobrightList([line(1),line(2,'↳'),line(1),line(3,'**[Other Company](https://example.com)**')].join('\n'),'FT',address);
 assert.equal(rows.length,3);assert.equal(rows[1].company,'Fictional Systems');assert.equal(rows[2].company,'Other Company');assert(!rows[0].url.includes('?'));assert.equal(rows[0].sourceListAgeDays,undefined);assert.equal(rows[0].employerPostedAt,undefined);
 assert(jobrightFeed(address));assert(jobrightFeed(address.replace('New-Grad','Internship')));assert.equal(jobrightFeed(address+'/evil'),null);
});
test('Jobright resolution requires explicit same-job public employer link; summaries are insufficient',()=>{
 assert.match(jobrightEmployerUrl(html(1),id(1)),/greenhouse/);
 for(const patch of [{jobId:id(2)},{isDeleted:true},{applyLink:null},{applyLink:'http://localhost/job'},{applyLink:'https://127.0.0.1/job'},{applyLink:'https://jobright.ai/jobs/info/'+id(1)},{originalUrl:'https://other.example/job'}])assert.throws(()=>jobrightEmployerUrl(html(1,patch),id(1)));
 assert.throws(()=>jobrightEmployerUrl('<h1>Apply Now</h1>',id(1)),/unavailable/);
});
test('Jobright consumes every list row in bounded concurrency, reports unresolved links and applies title gate first',async()=>{
 let active=0,peak=0,requests=0;const rows=Array.from({length:62},(_,i)=>line(i+1)).join('\n');
 const page=await readJobrightLeads(address,{select:async rows=>rows.slice(1),request:async(url,options)=>{
  assert.equal(options.redirect,'error');if(url.includes('raw.githubusercontent'))return new Response(rows);
  requests++;active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,1));active--;
  const n=Number(new URL(url).pathname.split('/').at(-1));return new Response(html(n,n===2?{applyLink:null}:{}));
 }});
 assert.equal(page.total,62);assert.equal(page.examined,61);assert.equal(page.prefilterExcluded,1);assert.equal(requests,61);assert.equal(peak,6);assert.equal(page.leads.length,60);assert.equal(page.diagnostics.length,1);
});
test('Jobright routes resolved leads through existing prefilter, copied dedup and 25-link employer verification',async()=>{
 const sizes=[],calls=[];const output=await fetchSource('portal:jobright-newgrad',{careers_url:address},{prefilter:true,request:async url=>new Response(url.includes('raw.githubusercontent')?Array.from({length:62},(_,i)=>line(i+1)).join('\n'):html(Number(new URL(url).pathname.split('/').at(-1)))),execute:async(task,input)=>{
  calls.push(task);if(task==='prefilter-discovery')return input.jobs;
  if(task==='dedup-discovery')return input.jobs.filter(row=>!row.url.endsWith('/1'));
  assert.equal(task,'verify-discovery-leads');assert(input.leads.every(row=>row.url.includes('greenhouse.io')));sizes.push(input.leads.length);
  return {jobs:input.leads.map(({url})=>({url,title:'Software Engineer',company:'Fictional Systems',description:'Employer JD',listingIdentity:{ats_provider:'greenhouse',board_slug:'fictional',posting_id:url.split('/').at(-1)}})),diagnostics:[]};
 }});
 assert.equal(output.total,62);assert.equal(output.listings.length,61);assert.deepEqual(sizes,[25,25,11]);assert.equal(calls[0],'prefilter-discovery');assert.equal(output.coverage,'truncated');assert.match(output.blocker,/seven days/);assert(output.listings.every(l=>l.employmentType==='FT'&&l.liveness==='active'));
});
test('Jobright unavailable feeds, changed format, bad detail data and HTTP failures stay explicit',async()=>{
 await assert.rejects(readJobrightLeads('https://evil.example'),/configured/);
 await assert.rejects(readJobrightLeads(address,{request:async()=>new Response('bad')}),/format/);
 await assert.rejects(readJobrightLeads(address,{request:async()=>new Response('bad',{status:503})}),/HTTP 503/);
 const page=await readJobrightLeads(address,{request:async url=>new Response(url.includes('raw.githubusercontent')?line(1):'not JSON')});assert.equal(page.leads.length,0);assert.equal(page.diagnostics.length,1);
});

test('fictional demo exposes unresolved Jobright coverage without network or account writes',async()=>{
 const {searchDemo}=await import('../lib/search/demo.mjs');const a=searchDemo(),b=searchDemo();
 const source=a.runs.find(r=>r.id==='demo-run').sources.find(s=>s.source.id==='demo-jobright');
 assert(source);assert.equal(source.coverage,'truncated');assert.equal(source.counts.saved,0);assert.match(source.blocker,/No network request/);source.blocker='changed';assert.notEqual(b.runs.find(r=>r.id==='demo-run').sources.find(s=>s.source.id==='demo-jobright').blocker,'changed');
});

test('Jobright resolved URLs honor real copied prior-history dedup before employer verification',async()=>{
 const {executeCareerTask}=await import('../runner/career-tools.mjs');let verified=0;
 const out=await fetchSource('portal:jobright-newgrad',{careers_url:address},{previous:[{url:'https://job-boards.greenhouse.io/fictional/jobs/1',company:'Fictional Systems',title:'Software Engineer',location:'United States'}],request:async url=>new Response(url.includes('raw.githubusercontent')?line(1):html(1)),execute:async(task,input)=>{
  if(task==='verify-discovery-leads'){verified+=input.leads.length;throw Error('Previously saved role must not be verified again');}
  return executeCareerTask(task,input);
 }});
 assert.equal(verified,0);assert.equal(out.listings.length,0);assert.equal(out.coverage,'truncated');
});
