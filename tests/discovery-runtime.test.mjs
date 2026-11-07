import test from 'node:test';
import assert from 'node:assert/strict';
import {executeCareerTask} from '../runner/career-tools.mjs';
import {fetchSource} from '../backend/runtime/ats.ts';
import {listingBatches,scanAllSources,executeSearch,workOnce,workerDiagnostics} from '../backend/runtime/worker.ts';
import {createDispatch} from '../backend/runtime/service.ts';
import {createApi} from '../backend/runtime/api.ts';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const job={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',kind:'search_ats',input:{profileId:'general'},version:2,attempts:1};
const native=id=>({ats_provider:'greenhouse',board_slug:'example',posting_id:id});
const posting=(id,extra={})=>({company:'Example',title:'Backend Engineer',location:'Remote',url:'https://job-boards.greenhouse.io/example/jobs/'+id,listingIdentity:native(id),...extra});

test('exact copied scanner and tracker keep distinct native postings and functional URL parameters',async()=>{
 const a=posting('111'),b=posting('222');
 const refA=posting('333',{url:'https://example.com/job?ref=A',listingIdentity:null});
 const refB=posting('444',{url:'https://example.com/job?ref=B',listingIdentity:null});
 const duplicate={...a,url:a.url+'?utm_source=feed'};
 const rows=await executeCareerTask('dedup-discovery',{jobs:[a,b,refA,refB,duplicate],previous:[]});
 assert.deepEqual(rows.map(row=>row.url),[a.url,b.url,refA.url,refB.url]);
 const resumed=await executeCareerTask('dedup-discovery',{jobs:[duplicate,b],previous:[a]});
 assert.deepEqual(resumed.map(row=>row.url),[b.url]);
});

test('thin runtime delegates to copied discovery task and maps evidence without invented publication dates',async()=>{
 const calls=[];
 const result=await fetchSource('portal:example',{name:'Example',careers_url:'https://job-boards.greenhouse.io/example'},{execute:async(task,input)=>{calls.push({task,input});return task==='verify-discovery-leads'?{jobs:[{...posting('111'),postedAt:null,description:'Verified full description'}],diagnostics:[{status:'active'}],provenance:{verification:'copied verifier'}}:{status:'ok',provider:'greenhouse',available:1,truncated:false,jobs:[{...posting('111'),postedAt:'2026-10-26T00:00:00Z',description:'Upstream plain-text excerpt'}],provenance:{provider:'providers/greenhouse.mjs',dedup:'dedup-tracker.mjs'}};}});
 assert.equal(calls[0].task,'discovery');assert.equal(calls[1].task,'verify-discovery-leads');assert.equal(calls[0].input.limit,undefined);assert.equal(result.coverage,'exhaustive');
 assert.equal(result.listings[0].employerPostedAt,null,'Discovery metadata cannot override verified employer publication evidence');
 assert.equal(result.listings[0].atsIdentity,'greenhouse:example:111');
 assert.ok(!Object.hasOwn(result.listings[0],'score'));
 const unsupported=await fetchSource('query:1',{query:'research this source'},{execute:async()=>({status:'unsupported',jobs:[]})});
 assert.equal(unsupported.coverage,'inaccessible');assert.match(unsupported.blocker,/agent research/);
});

test('database observation batches are bounded by rows and encoded UTF-8 bytes',()=>{
 const rows=Array.from({length:61},(_,i)=>({id:i,description:'界'.repeat(4000)}));
 const batches=listingBatches(rows);assert.deepEqual(batches.flatMap(batch=>batch.listings),rows);
 for(const batch of batches){assert.ok(batch.listings.length<=25);assert.ok(Buffer.byteLength(JSON.stringify(batch.listings))<=48000);}
 assert.throws(()=>listingBatches([{description:'x'.repeat(50000)}]),/bounded/);
});

function harness(sources){
 const calls=[];const run={id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',state:'active',version:0,sources:structuredClone(sources)};
 const dispatch=async(operation,payload)=>{
  calls.push({operation,payload});
  if(operation==='search.run.start'||operation==='search.run.read')return structuredClone(run);
  if(operation==='search.discoveries.read')return {listings:payload.purpose?[]:[posting('old')],nextOffset:null};
  if(operation==='search.context')return {personalVersion:1,documents:[{kind:'profile',id:'general',version:1,projection:{filters:{}}}]};
  if(operation==='search.progress'){const source=run.sources.find(s=>s.source_id===payload.sourceId);assert.equal(source.version,payload.expectedVersion);Object.assign(source,payload,{version:source.version+1});run.version++;}
  if(operation==='search.discoveries.save')run.version++;
  if(operation==='search.run.finish'){assert.equal(payload.expectedVersion,run.version);run.state=payload.state;}
  return {};
 };
 return {calls,run,dispatch};
}
test('worker resumes persisted identities through isolated copied scan task and retains honest partial coverage',async()=>{
 const h=harness([{source_id:'portal:example',source:{name:'Example',careers_url:'https://example.com'},version:0,state:'pending'},{source_id:'query:1',source:{query:'unsupported'},version:0,state:'pending'}]);
 const copied=[];
 const execute=async(task,input)=>{copied.push({task,input});if(task==='inspect-discovery-filters')return {ready:true,gaps:[],validation:{errors:[]}};if(task==='dedup-discovery')return [];if(task==='verify-discovery-leads')return {jobs:[{...posting('new'),description:'Verified',postedAt:null}],diagnostics:[{status:'active'}]};return input.target.id==='query:1'?{status:'unsupported',jobs:[]}:{status:'ok',provider:'greenhouse',available:2,truncated:false,jobs:[posting('new')],provenance:{provider:'providers/greenhouse.mjs',identity:'scan.mjs isOfferSeen/markOfferSeen',dedup:'dedup-tracker.mjs'}};};
 const result=await executeSearch({...job,attempts:2,search_run_id:h.run.id},h.dispatch,{execute});
 assert.equal(result.status,'partial');assert.equal(result.result.shortlist.applicantEligibility,'not-evaluated');
 assert.equal(result.result.provenance[0].dedup,'dedup-tracker.mjs');
 assert.equal(copied.find(c=>c.task==='discovery').input.previous[0].url,posting('old').url);
 assert.ok(!h.calls.some(call=>/screening|publish|submission/.test(call.operation)));
 assert.ok(h.calls.find(call=>call.operation==='search.progress').payload.eventKey.includes('a2'));
});

test('worker database failures retain fenced finish and rate-limit diagnostics with a recovery event',async()=>{
 const calls=[];
 const rpc=async(name,args)=>{calls.push({name,args});assert.equal(name,'backend_worker');
  if(args.operation==='claim')return {data:{job,leaseToken:'lease-secret'}};
  return {data:null,error:{code:'40001'}};};
 assert.equal(await workOnce(rpc),true);
 assert.ok(!calls.some(call=>call.args.operation==='enqueue_due'),'Worker only claims submitted jobs');
 assert.equal(calls.find(call=>call.args.operation==='finish').args.payload.leaseToken,'lease-secret');
 let time=0;const lines=[];const diagnostics=workerDiagnostics(message=>lines.push(message),()=>time);
 diagnostics.unavailable();time=5000;diagnostics.unavailable();assert.equal(lines.length,1);
 time=60000;diagnostics.unavailable();assert.equal(lines.length,2);
 diagnostics.recovered();diagnostics.recovered();assert.equal(lines.length,3);assert.match(lines[2],/recovered/);
});

test('Node API routes approved queue and skill reads directly to SQL while legacy setup retains Edge compatibility',async()=>{
  const calls=[],forwarded=[];
  const dispatch=createDispatch({supabaseUrl:'http://127.0.0.1:54321',rpc:async(name,args)=>{calls.push({name,args});return {data:args.operation==='context.developer'?{}:{id:'queued'}};},request:async(url,options)=>{forwarded.push({url:url.href,options});return json({data:{profile:{}}});}});
  const token='jb_agent_'+'a'.repeat(64);
  assert.equal((await dispatch(token,'backend.jobs.submit',{kind:'search_ats',input:{profileId:'general'},eventKey:'job-test'})).status,200);
  assert.equal(calls.at(-1).name,'backend_job_dispatch');assert.equal(forwarded.length,0);
  assert.equal((await dispatch(token,'guides.read',{id:'career-find-jobs'})).status,200);assert.equal(forwarded.length,0);
  assert.equal((await dispatch(token,'workspace.read',{})).status,200);assert.equal(forwarded.length,1);
  assert.equal((await dispatch(token,'connections.issue',{name:'Agent',scopes:['workspace:read']})).status,403);
  const api=createApi({dispatch});await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
  try{
    const base='http://127.0.0.1:'+api.address().port;
    assert.equal((await fetch(base+'/healthz')).status,200);
    assert.equal((await fetch(base+'/v1/operations',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
    assert.equal((await fetch(base+'/mcp',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.example'},body:'{}'})).status,403);
  }finally{await new Promise(resolve=>api.close(resolve));}
});


test('source pool scans the whole catalog with ten concurrent fetches',async()=>{
 let active=0,peak=0;const visited=[];
 await scanAllSources(Array.from({length:27},(_,i)=>i),async id=>{
  active++;peak=Math.max(peak,active);
  await new Promise(resolve=>setTimeout(resolve,2));visited.push(id);active--;
 });
 assert.equal(peak,10);assert.equal(active,0);assert.deepEqual(visited.sort((a,b)=>a-b),Array.from({length:27},(_,i)=>i));
});
test('source pool drains in-flight work before returning a failure',async()=>{
 let active=0;
 await assert.rejects(scanAllSources([0,1,2],async id=>{
  active++;try{if(id===0)throw Error('lease expired');await new Promise(resolve=>setTimeout(resolve,10));}finally{active--;}
 },2),/lease expired/);
 assert.equal(active,0);
});
test('worker fetches and checkpoints sources beyond the former ten-source sample',async()=>{
 const sources=Array.from({length:23},(_,i)=>({source_id:'portal:'+i,source:{name:'Employer '+i,careers_url:'https://example.com/'+i},version:0,state:i===0?'completed':'pending',coverage:i===0?'exhaustive':null}));
 const h=harness(sources);const fetched=[];
 const execute=async(task,input)=>{
  if(task==='inspect-discovery-filters')return {ready:true};
  if(task==='discovery'){fetched.push(input.target.id);return {status:'ok',available:0,truncated:false,jobs:[]};}
  if(task==='verify-discovery-leads')return {jobs:[],diagnostics:[]};
  if(task==='dedup-discovery')return [];
  throw Error('Unexpected task '+task);
 };
 const result=await executeSearch(job,h.dispatch,{execute});
 assert.equal(fetched.length,22);assert(fetched.includes('portal:22'));assert(!fetched.includes('portal:0'));
 assert.equal(h.calls.filter(c=>c.operation==='search.progress').length,22);
 assert.equal(result.status,'completed');
});


test('retry identity pagination reads beyond the old 5000-observation ceiling',async()=>{
 const h=harness([]);let pages=0;
 const dispatch=async(operation,payload)=>{
  if(operation==='search.discoveries.read'&&!payload.purpose){pages++;return {listings:[],nextOffset:payload.offset<5100?payload.offset+100:null};}
  return h.dispatch(operation,payload);
 };
 const execute=async task=>task==='inspect-discovery-filters'?{ready:true}:[];
 await executeSearch({...job,search_run_id:h.run.id},dispatch,{execute});
 assert.equal(pages,52);
});

test('all provider results are verified in 25-link batches without dropping the tail',async()=>{
 const jobs=Array.from({length:61},(_,i)=>posting(String(i)));
 const sizes=[];let discovered;
 const execute=async(task,input)=>{
  if(task==='discovery'){discovered=input;return {status:'ok',available:61,truncated:false,jobs};}
  assert.equal(task,'verify-discovery-leads');sizes.push(input.leads.length);
  return {jobs:input.leads.map(({url})=>({...jobs.find(j=>j.url===url),description:'Verified',postedAt:null})),diagnostics:input.leads.map(({url})=>({url,status:'active',extraction:'parsed'}))};
 };
 const result=await fetchSource('portal:example',{careers_url:'https://example.com/careers'},{execute});
 assert.equal(discovered.limit,undefined);assert.deepEqual(sizes,[25,25,11]);
 assert.equal(result.listings.length,61);assert.equal(result.coverage,'exhaustive');assert.equal(result.diagnostics.length,61);
});
test('a failed verification batch preserves successful batches and labels every missed URL',async()=>{
 const jobs=Array.from({length:61},(_,i)=>posting(String(i)));let batch=0;
 const execute=async(task,input)=>{
  if(task==='discovery')return {status:'ok',available:61,truncated:false,jobs};
  if(++batch===2)throw Error('Timed out');
  return {jobs:input.leads.map(({url})=>({...jobs.find(j=>j.url===url),description:'Verified',postedAt:null})),diagnostics:input.leads.map(({url})=>({url,status:'active',extraction:'parsed'}))};
 };
 const result=await fetchSource('portal:example',{careers_url:'https://example.com/careers'},{execute});
 assert.equal(batch,3);assert.equal(result.listings.length,36);assert.equal(result.coverage,'truncated');
 assert.equal(result.diagnostics.length,61);assert.equal(result.diagnostics.filter(d=>d.status==='uncertain').length,25);
});
