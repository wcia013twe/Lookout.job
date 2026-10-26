import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {checkDiscoveryLiveness} from '../runner/career-liveness.mjs';
import {verifyDiscoveryLeads} from '../runner/career-search-intake.mjs';
import {checkLivenessViaApi} from '../runner/vendor/career-ops/liveness-api.mjs';
import {classifyLiveness} from '../runner/vendor/career-ops/liveness-core.mjs';
import {assertPostingLiveness} from '../lib/discovery-liveness-contract.mjs';
import {verifyLeadSource} from '../backend/runtime/ats.ts';
const gh='https://job-boards.greenhouse.io/example/jobs/123';
const lever='https://jobs.lever.co/example/fixture';
const stamp='2026-10-26T12:00:00.000Z';
const active={result:'active',code:'fixture_active',reason:'Fictional active posting.'};
const uncertain={result:'uncertain',code:'fixture_blocked',reason:'Fictional blocked posting.'};
function browserDouble(){let launches=0,closes=0;return {get launches(){return launches;},get closes(){return closes;},loadPlaywright:async()=>({chromium:{launch:async()=>{launches++;return {newContext:async()=>({newPage:async()=>({})}),close:async()=>{closes++;}};}}})};}

test('liveness classifier files are directly copied and retain their pinned hashes',async()=>{
 const root=new URL('../runner/vendor/career-ops/',import.meta.url),m=JSON.parse(await readFile(new URL('manifest.json',root)));
 for(const path of ['liveness-api.mjs','liveness-browser.mjs','liveness-core.mjs','check-liveness.mjs'])assert.equal(createHash('sha256').update(await readFile(new URL(path,root))).digest('hex'),m.files.find(f=>f.path===path).sha256,path);
});

test('original Lever API 404 falls back to browser instead of falsely expiring the posting',async()=>{
 const request=globalThis.fetch,b=browserDouble();let browserChecks=0;
 try{
  globalThis.fetch=async()=>new Response('{}',{status:404});
  const [r]=await checkDiscoveryLiveness([{url:lever}],{loadPlaywright:b.loadPlaywright,checkPage:async()=>{browserChecks++;return classifyLiveness({status:200,requestedUrl:lever,finalUrl:lever,bodyText:'Fictional job posting',applyControls:['Apply now']});}});
  assert.equal(r.result,'active');assert.equal(r.method,'browser');assert.equal(browserChecks,1);assert.equal(b.closes,1);
 }finally{globalThis.fetch=request;}
});

test('original API supports non-Greenhouse providers without opening a browser',async()=>{
 const request=globalThis.fetch;
 try{
  globalThis.fetch=async()=>new Response('{}',{status:200});
  const [r]=await checkDiscoveryLiveness([{url:lever}],{loadPlaywright:async()=>{throw Error('No browser needed');}});
  assert.equal(r.result,'active');assert.equal(r.method,'ats-api');assert.equal(r.code,'lever_api_ok');
 }finally{globalThis.fetch=request;}
});

test('authoritative Greenhouse API 404 stays expired and explicit API uncertainty stays uncertain',async()=>{
 const request=globalThis.fetch;
 try{
  globalThis.fetch=async()=>new Response('{}',{status:404});
  const [r]=await checkDiscoveryLiveness([{url:gh}],{loadPlaywright:async()=>{throw Error('Must not launch');}});assert.equal(r.result,'expired');assert.equal(r.code,'greenhouse_api_gone');
 }finally{globalThis.fetch=request;}
 const [r]=await checkDiscoveryLiveness([{url:lever}],{checkApi:async()=>uncertain,loadPlaywright:async()=>{throw Error('Must not override explicit uncertainty');}});assert.equal(r.result,'uncertain');assert.equal(r.method,'ats-api');
});

test('API work is concurrent but browser fallback is sequential and input order is stable',async()=>{
 const b=browserDouble();let inFlight=0,max=0,apiInFlight=0,apiMax=0;
 const rows=await checkDiscoveryLiveness([{url:gh},{url:lever},{url:'https://example.com/jobs/one'}],{checkApi:async()=>{apiInFlight++;apiMax=Math.max(apiMax,apiInFlight);await new Promise(r=>setTimeout(r,1));apiInFlight--;return null;},loadPlaywright:b.loadPlaywright,checkPage:async(_page,url)=>{inFlight++;max=Math.max(max,inFlight);await new Promise(r=>setTimeout(r,1));inFlight--;return classifyLiveness({status:200,requestedUrl:url,finalUrl:url,bodyText:'Just a moment... Checking your browser',applyControls:[]});}});
 assert.equal(apiMax,3);assert.equal(max,1);assert.equal(b.launches,1);assert.equal(b.closes,1);assert.deepEqual(rows.map(r=>r.url),[gh,lever,'https://example.com/jobs/one']);assert.ok(rows.every(r=>r.result==='uncertain'&&r.code==='bot_challenge'));
});

test('browser failure preserves every result and does not erase API-confirmed postings',async()=>{
 const rows=await checkDiscoveryLiveness([{url:'https://example.com/one'},{url:lever},{url:'https://example.com/two'}],{checkApi:async url=>url===lever?active:null,loadPlaywright:async()=>{throw Error('Unavailable');}});
 assert.equal(rows.length,3);assert.equal(rows[0].code,'browser_unavailable');assert.equal(rows[1].result,'active');assert.equal(rows[2].result,'uncertain');
});

test('bounded browser work returns explicit uncertainty for remaining links, never active or expired guesses',async()=>{
 let time=0,checks=0;const b=browserDouble();
 const rows=await checkDiscoveryLiveness([{url:gh},{url:lever}],{checkApi:async()=>null,loadPlaywright:b.loadPlaywright,now:()=>time,browserBudgetMs:50,checkPage:async()=>{checks++;time+=100;return uncertain;}});
 assert.equal(checks,1);assert.equal(rows[1].result,'uncertain');assert.equal(rows[1].method,'budget');assert.equal(rows[1].code,'browser_budget_exhausted');
});

test('URL guards run before network/browser access and typed status rejects fabricated outcomes',async()=>{
 const rows=await checkDiscoveryLiveness([{url:'https://127.0.0.1/secret'},{url:'http://example.com/job'},{url:'https://user:pass@example.com/job'}],{checkApi:async()=>{throw Error('Must not request');},loadPlaywright:async()=>{throw Error('Must not launch');}});
 assert.ok(rows.every(r=>r.result==='uncertain'&&r.method==='guard'));
 for(const result of ['alive','dead',true])assert.throws(()=>assertPostingLiveness({url:gh,result,code:'bad',reason:'Bad enum',checkedAt:stamp,method:'ats-api'}));
});

const verdict=(url,result='active')=>({url,result,code:'fictional_'+result,reason:'Fictional '+result,checkedAt:stamp,method:'ats-api'});
test('active non-Greenhouse posting retains its status independently of unsupported extraction',async()=>{
 const result=await verifyDiscoveryLeads([{url:lever},{url:gh}],{check:async()=>[verdict(lever),verdict(gh,'expired')],fetchJson:async()=>{throw Error('Must not parse unsupported or expired links');}});
 assert.equal(result.jobs.length,0);assert.equal(result.diagnostics[0].status,'active');assert.equal(result.diagnostics[0].extraction,'unsupported');assert.equal(result.diagnostics[1].status,'expired');assert.equal(result.diagnostics[1].extraction,'not-attempted');
});

test('failed extraction never rewrites a confirmed active liveness result',async()=>{
 const r=await verifyDiscoveryLeads([{url:gh}],{check:async()=>[verdict(gh)],fetchJson:async()=>{throw Error('Parser request failed');}});
 assert.equal(r.jobs.length,0);assert.equal(r.diagnostics[0].status,'active');assert.equal(r.diagnostics[0].extraction,'failed');
});

test('supported extraction still uses original parser and preserves original lead identity',async()=>{
 const r=await verifyDiscoveryLeads([{url:gh}],{check:async()=>[verdict(gh)],fetchJson:async()=>({id:123,title:'Backend Engineer',company_name:'Example',content:'<p>Build distributed systems.</p>',absolute_url:gh,location:{name:'Remote'}})});
 assert.equal(r.jobs.length,1);assert.equal(r.jobs[0].leadUrl,gh);assert.equal(r.jobs[0].postedAt,null);assert.equal(r.jobs[0].listingIdentity.posting_id,'123');assert.equal(r.diagnostics[0].extraction,'parsed');
});

test('mixed active unsupported links do not shift source recency onto the wrong parsed record',async()=>{
 const r=await verifyLeadSource('portal:fixture',[{url:lever,sourceListAgeDays:1},{url:gh,sourceListAgeDays:9,employmentType:'FT'}],{execute:async()=>({jobs:[{leadUrl:gh,url:gh,company:'Example',title:'Backend Engineer',description:'Fictional full posting',listingIdentity:{ats_provider:'greenhouse',board_slug:'example',posting_id:'123'}}],diagnostics:[{url:lever,status:'active',extraction:'unsupported'},{url:gh,status:'active',extraction:'parsed'}]})});
 assert.equal(r.listings[0].sourceListAgeDays,9);assert.equal(r.listings[0].employmentType,'FT');assert.equal(r.coverage,'truncated');
});

test('isolated fictional demo covers active parsed and uncertain unparsed link outcomes',async()=>{
 const {searchDemo}=await import('../lib/search/demo.mjs');
 const fixture=searchDemo(),sources=fixture.runs[0].sources;
 assert.equal(sources[0].checkpoint.diagnostics[0].status,'active');assert.equal(sources[0].checkpoint.diagnostics[0].extraction,'parsed');
 assert.equal(sources[1].checkpoint.diagnostics[0].status,'uncertain');assert.equal(sources[1].checkpoint.diagnostics[0].extraction,'not-attempted');
 assert.deepEqual(searchDemo(),fixture);
});

test('definitively expired links are completed checks, not an inaccessible source',async()=>{
 const r=await verifyLeadSource('portal:fixture',[{url:gh}],{execute:async()=>({jobs:[],diagnostics:[{url:gh,status:'expired',extraction:'not-attempted'}]})});
 assert.equal(r.listings.length,0);assert.equal(r.coverage,'exhaustive');assert.equal(r.blocker,'');
 const uncertain=await verifyLeadSource('portal:fixture',[{url:gh}],{execute:async()=>({jobs:[],diagnostics:[{url:gh,status:'uncertain',extraction:'not-attempted'}]})});
 assert.equal(uncertain.coverage,'inaccessible');
});
