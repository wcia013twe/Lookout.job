import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceEndpoint,canonicalUrl,deduplicate,fetchSource} from '../backend/runtime/ats.ts';
import {listingBatches,executeSearch,workOnce} from '../backend/runtime/worker.ts';
import {createDispatch} from '../backend/runtime/service.ts';
import {createApi} from '../backend/runtime/api.ts';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const row={id:1,title:'Backend Engineer',absolute_url:'https://job-boards.greenhouse.io/example/jobs/1?utm_source=feed',location:{name:'Remote'},content:'<p>Work on infrastructure.</p>',updated_at:'2026-10-26T00:00:00Z'};
const source={name:'Example Systems',careers_url:'https://job-boards.greenhouse.io/example'};
const job={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',kind:'search_ats',input:{profileId:'general'},version:2,attempts:1};

test('ATS fetches use only closed HTTPS provider endpoints and reject private/arbitrary origins',async()=>{
  for(const careers_url of ['http://127.0.0.1:54321','https://attacker.example/jobs','https://boards.greenhouse.io.evil.test/company','https://user:secret@boards.greenhouse.io/company','https://boards.greenhouse.io:444/company']) {
    assert.equal(sourceEndpoint({careers_url}),null);
    const result=await fetchSource('portal:unsupported',{careers_url},{request:()=>{throw Error('No request allowed');}});
    assert.equal(result.coverage,'inaccessible');
  }
  assert.equal(sourceEndpoint(source).url.href,'https://boards-api.greenhouse.io/v1/boards/example/jobs?content=true');
  let seen;
  const result=await fetchSource('portal:example',source,{now:()=>new Date('2026-10-26T12:00:00Z'),request:async(url,init)=>{seen={url:url.href,init};return json({jobs:[row]});}});
  assert.equal(seen.init.redirect,'error');
  assert.equal(result.coverage,'exhaustive');
  assert.equal(result.listings[0].employerPostedAt,null,'Updated date must not become invented publication date');
  assert.equal(result.listings[0].url,'https://job-boards.greenhouse.io/example/jobs/1');
  assert.equal(result.listings[0].checkedAt,'2026-10-26T12:00:00.000Z');
  assert.equal(result.listings[0].location,'Remote');
  assert.ok(!Object.hasOwn(result.listings[0],'score'));
});

test('source retries are bounded GETs, unsupported/malformed sources retain honest coverage',async()=>{
  let calls=0;
  const recovered=await fetchSource('portal:example',source,{request:async()=>++calls===1?json({},503):json({jobs:[row]})});
  assert.equal(calls,2);assert.equal(recovered.coverage,'exhaustive');
  calls=0;
  const missing=await fetchSource('portal:example',source,{request:async()=>{calls++;return json({},404);}});
  assert.equal(calls,1);assert.equal(missing.coverage,'inaccessible');
  calls=0;
  const unavailable=await fetchSource('portal:example',source,{request:async()=>{calls++;throw Error('offline');}});
  assert.equal(calls,2);assert.equal(unavailable.coverage,'inaccessible');
  const lever={name:'Example',careers_url:'https://jobs.lever.co/example'};
  const malformed=await fetchSource('portal:lever',lever,{request:async()=>json([{id:'1',text:'Engineer',hostedUrl:'https://jobs.lever.co/example/1',categories:{}},{id:'2',text:'Broken',hostedUrl:'not a URL'}])});
  assert.equal(malformed.coverage,'truncated');assert.equal(malformed.listings.length,1);assert.equal(malformed.listings[0].location,null);
});

test('Lever pages are bounded and canonical then normalized employer/title/location dedup is deterministic',async()=>{
  const pages=[];
  const result=await fetchSource('portal:lever',{name:'Example',careers_url:'https://jobs.lever.co/example'},{request:async url=>{
    const skip=Number(url.searchParams.get('skip'));pages.push(skip);
    return json(Array.from({length:100},(_,i)=>({id:String(skip+i),text:'Engineer '+(skip+i),hostedUrl:'https://jobs.lever.co/example/'+(skip+i),categories:{location:'Remote'}})));
  }});
  assert.deepEqual(pages,[0,100,200]);assert.equal(result.coverage,'truncated');assert.equal(result.listings.length,300);
  const first={...result.listings[0],company:'Example Systems',title:'Backend Engineer',location:'New York'};
  const sameUrl={...first,title:'Another label',url:first.url+'?utm_source=source'};
  const sameMatch={...first,url:'https://jobs.lever.co/example/another',company:'Ｅxample Systems',title:'backend-engineer',location:'new york'};
  const different={...first,url:'https://jobs.lever.co/example/different',location:'Boston'};
  assert.deepEqual(deduplicate([first,sameUrl,sameMatch,different]),[first,different]);
  assert.equal(canonicalUrl('https://example.com/jobs/1?ref=feed&job=1#details'),'https://example.com/jobs/1?job=1');
});

test('database observation batches are bounded by both rows and encoded UTF-8 bytes',()=>{
  const rows=Array.from({length:61},(_,i)=>({id:i,description:'界'.repeat(4000)}));
  const batches=listingBatches(rows);
  assert.deepEqual(batches.flatMap(batch=>batch.listings),rows);
  for(const batch of batches){assert.ok(batch.listings.length<=25);assert.ok(Buffer.byteLength(JSON.stringify(batch.listings))<=48000);}
  assert.throws(()=>listingBatches([{description:'x'.repeat(50000)}]),/bounded/);
});

function workerHarness(sources){
  const calls=[];let version=0;const run={id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',state:'active',version,sources:structuredClone(sources)};
  const dispatch=async(operation,payload)=>{
    calls.push({operation,payload});
    if(operation==='search.run.start'||operation==='search.run.read')return structuredClone(run);
    if(operation==='search.discoveries.read')return {listings:[],nextOffset:null};
    if(operation==='search.progress'){
      const source=run.sources.find(source=>source.source_id===payload.sourceId);
      assert.equal(payload.expectedVersion,source.version);Object.assign(source,payload,{version:source.version+1});run.version++;
    }
    if(operation==='search.discoveries.save')run.version++;
    if(operation==='search.run.finish'){assert.equal(payload.expectedVersion,run.version);run.state=payload.state;run.version++;}
    return {};
  };
  return {calls,run,dispatch};
}
test('worker preserves incomplete source coverage and saves unscored evidence through checkpointed SQL operations',async()=>{
  const h=workerHarness([{source_id:'portal:example',source,version:0,state:'pending'},{source_id:'query:1',source:{query:'backend jobs'},version:0,state:'pending'}]);
  const result=await executeSearch(job,h.dispatch,{request:async()=>json({jobs:[row,{...row,id:2,absolute_url:'https://example.com/another',title:'backend-engineer',location:{name:'remote'}}]})});
  assert.equal(result.status,'partial');assert.equal(result.result.saved,1);assert.equal(result.result.screening,'review-needed');
  assert.equal(h.run.sources[1].coverage,'inaccessible');
  assert.ok(!h.calls.some(call=>/screening|publish|submission/.test(call.operation)));
  const saved=h.calls.find(call=>call.operation==='search.discoveries.save');
  assert.ok(saved.payload.eventKey.length<=160);assert.equal(saved.payload.listings[0].employerPostedAt,null);
  const progress=h.calls.find(call=>call.operation==='search.progress');assert.equal(progress.payload.checkpoint.savedOffset,1);
});

test('worker transactions fence every dispatch and failed execution cannot write an unfenced result',async()=>{
  const calls=[];
  const rpc=async(name,args)=>{
    calls.push({name,args});assert.equal(name,'backend_worker');
    if(args.operation==='enqueue_due')return {data:{enqueued:0}};
    if(args.operation==='claim')return {data:{job,leaseToken:'lease-secret',credentialHash:'not-an-agent-token'}};
    if(args.operation==='dispatch'){
      assert.equal(args.payload.jobId,job.id);assert.equal(args.payload.expectedVersion,job.version);assert.equal(args.payload.leaseToken,'lease-secret');
      return {data:null,error:{code:'40001'}};
    }
    return {data:null,error:{code:'40001'}};
  };
  assert.equal(await workOnce(rpc),true);
  const finished=calls.find(call=>call.args.operation==='finish');
  assert.equal(finished.args.payload.status,'failed');assert.equal(finished.args.payload.expectedVersion,job.version);
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


test('resumed discovery seeds durable identity pages and never re-saves a normalized earlier posting',async()=>{
  const h=workerHarness([{source_id:'portal:completed',source,version:1,state:'completed',coverage:'exhaustive'},{source_id:'portal:pending',source,version:0,state:'pending'}]);
  const base=h.dispatch;let pages=0;
  const dispatch=async(operation,payload)=>{
    if(operation==='search.discoveries.read'){
      pages++;
      return {listings:payload.offset===0?[{url:'https://example.com/previous',company:'Example Systems',title:'Backend Engineer',location:'Remote'}]:[],nextOffset:payload.offset===0?100:null};
    }
    return base(operation,payload);
  };
  const outcome=await executeSearch({...job,attempts:2,search_run_id:h.run.id},dispatch,{request:async()=>json({jobs:[row]})});
  assert.equal(pages,2);assert.equal(outcome.status,'completed');assert.equal(outcome.result.saved,0);
  assert.ok(!h.calls.some(call=>call.operation==='search.discoveries.save'));
  assert.ok(h.calls.some(call=>call.operation==='search.progress'&&call.payload.eventKey.includes('a2')));
});
