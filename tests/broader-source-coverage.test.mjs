import test from 'node:test';
import assert from 'node:assert/strict';
import {prefilterDiscovery,filterDiscovery} from '../runner/career-search-filters.mjs';
import {readJobrightLeads} from '../backend/runtime/jobright.ts';
const profile={filters:{Location:'United States; Remote (United States)',Employment:'Full-time; Internship'},instructions:'## Priority & flexibility\n- Location: Required\n\n## Career Ops discovery filters\n\n```json\n'+JSON.stringify({title_filter:{positive:['Software Engineer'],negative:['word:Senior']},skip_tiers:['senior'],max_posting_age_days:7})+'\n```'};
test('explicit engineering families include common aliases without overriding seniority or unrelated roles',async()=>{
 const titles=['Software Development Engineer','Software Dev Engineer I','SDE','Software Developer','Full Stack Engineer','Full-Stack Engineer','Frontend Engineer','Senior Software Developer','Account Executive'];
 const rows=titles.map((title,i)=>({id:String(i),title}));
 assert.deepEqual((await prefilterDiscovery({profile,jobs:rows})).map(r=>r.title),titles.slice(0,7));
 const narrow={...profile,instructions:profile.instructions.replace('Software Engineer','Database Engineer')};
 assert.equal((await prefilterDiscovery({profile:narrow,jobs:rows})).length,0);
});
test('US-wide targeting accepts state forms and retains unknown cities but rejects explicit foreign countries',async()=>{
 const places=['Hawthorne, CA','Redmond, WA','Cupertino, California, USA','Silver Spring, MD, US','New York','Seattle','Toronto, ON, Canada','London, United Kingdom','Cork, Ireland','Ontario, CA, Canada',null,'Toronto, Canada; New York, NY, United States'];
 const {results}=await filterDiscovery({profile,listings:places.map((location,i)=>({id:String(i),title:'Software Engineer',employmentType:'FT',location}))});
 assert.deepEqual(results.map(r=>r.passed),[true,true,true,true,true,true,false,false,false,false,true,true]);
 assert.equal(results[5].checks.find(c=>c.requirement==='location').status,'unknown');
 const strict={...profile,instructions:profile.instructions.replace('"max_posting_age_days":7','"max_posting_age_days":7,"location_filter":{"allow":["Boston"],"strict":true}')};
 assert.equal((await filterDiscovery({profile:strict,listings:[{id:'x',title:'Software Engineer',location:'Seattle'}]})).results[0].passed,false);
});
test('every published Jobright row is retained before title triage and failed employer resolution',async()=>{
 const base='https://github.com/jobright-ai/2026-Software-Engineer-New-Grad';const id=n=>String(n).padStart(24,'0');
 const markdown=[['Software Engineer',1],['Senior Software Engineer',2]].map(([title,n])=>`| [Example](https://example.com) | [${title}](https://jobright.ai/jobs/info/${id(n)}) | United States | Hybrid | Nov 07 |`).join('\n');
 const snapshots=[];let selected=false;
 const page=await readJobrightLeads(base,{select:async rows=>{assert.equal(snapshots[0].length,2);selected=true;return rows.slice(0,1);},onRetained:async rows=>snapshots.push(structuredClone(rows)),request:async url=>{
  if(url.includes('raw.github'))return new Response(markdown);
  assert(selected);return new Response(`<script id="__NEXT_DATA__">${JSON.stringify({props:{pageProps:{dataSource:{jobResult:{jobId:id(1)}}}}})}</script>`);
 }});
 assert.equal(page.retained.length,2);assert.equal(page.retained[0].resolution,'unresolved');assert.equal(page.retained[1].resolution,'filtered-title');assert.equal(page.leads.length,0);assert.equal(page.retained[0].sourceListedDate,'Nov 07');assert.equal(snapshots.length,2);
});

test('retained source paging rejects expired pools and mismatched backend runs before exposing rows',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises');const path=await import('node:path');const {tmpdir}=await import('node:os');
 const {SearchStaging}=await import('../backend/runtime/search-staging.ts');const {readSearchSourceLeads}=await import('../backend/runtime/search-intake.ts');
 const root=await mkdtemp(path.join(tmpdir(),'expired-pool-')),runId='11111111-1111-4111-8111-111111111111',jobId='22222222-2222-4222-8222-222222222222';
 try{
  const store=new SearchStaging(root,jobId,runId);const key=await store.write(1,'portal:jobright',{rawLeads:[{url:'https://jobright.ai/jobs/info/'+'1'.repeat(24)}],retainedAt:new Date(Date.now()-8*86400000).toISOString()});
  const call=async operation=>operation==='search.run.read'?{data:{sources:[{source_id:'portal:jobright',source:{careers_url:'https://github.com/jobright-ai/2026-Software-Engineer-New-Grad'},checkpoint:{stagingJobId:jobId,stagingKey:key}}]}}:{data:{jobs:[{id:jobId,search_run_id:runId}]}};
  const payload={runId,sourceId:'portal:jobright'};
  const expired=await readSearchSourceLeads(call,payload,{stagingRoot:root});assert.equal(expired.error.code,'P0002');assert.equal(expired.data,undefined);
  const wrong=await readSearchSourceLeads(call,payload,{stagingRoot:root,readJob:async()=>({data:{jobs:[{id:jobId,search_run_id:'another-run'}]}})});assert.equal(wrong.error.code,'42501');assert.equal(wrong.data,undefined);
 }finally{await rm(root,{recursive:true,force:true});}
});
