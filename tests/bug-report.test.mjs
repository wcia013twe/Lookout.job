import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {BUG_TOOL,bugTitleKey,reportBug} from '../supabase/functions/agent-gateway/bug-report.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {createTestDatabase} from './helpers/database.mjs';

const payload={title:'Synthetic: settings panel does not open',description:'Attempted: Opened the fictional demo settings.\nHappened: The panel stayed closed.\nExpected: The panel should open.'};
const options={payload,token:'synthetic-github-token',connectionId:'synthetic-connection',cryptoImpl:webcrypto,
  authorize:async()=>({status:200,data:{id:'synthetic-connection',scopes:['activity:write']}})};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status});

test('report schema rejects private material, injected arguments and missing observations',()=>{
  assert.doesNotThrow(()=>validateRequest({operation:'bugs.report',payload}));
  for(const description of [payload.description+' Contact someone@example.test',payload.description+' https://example.test/private',payload.description+' Bearer secret',payload.description+' +1 555 555 1234',payload.description+' resume contents', 'It broke']) {
    assert.throws(()=>validateRequest({operation:'bugs.report',payload:{...payload,description}}));
  }
  assert.throws(()=>validateRequest({operation:'bugs.report',payload:{...payload,repository:'elsewhere/private'}}));
  assert.equal(bugTitleKey('Settings: PANEL!'),bugTitleKey('settings panel'));
});

test('invalid credentials, wrong connection, missing scope and missing configuration cannot touch GitHub',async()=>{
  for(const overrides of [
    {authorize:async()=>({status:401})},
    {connectionId:'another-connection'},
    {authorize:async()=>({status:200,data:{id:'synthetic-connection',scopes:[]}})},
    {token:undefined},
  ]) {
    const r=await reportBug({...options,...overrides,fetchImpl:()=>assert.fail('GitHub must not be called')});
    assert.ok([401,403,503].includes(r.status));
  }
});

test('MCP synthetic report forwards only fixed operation and marks external publication',async()=>{
  const calls=[];
  const handler=createHandler(async(token,operation,args)=>{
    calls.push({operation,args});
    return {status:200,data:operation==='credentials.verify'?{scopes:['activity:write']}:{issueNumber:19,duplicate:false,agentStarted:false}};
  });
  const req=(method,params)=>new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+'a'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  const list=await (await handler(req('tools/list',{}))).json();
  assert.equal(list.result.tools.find(t=>t.name===BUG_TOOL.name).annotations.openWorldHint,true);
  const r=await (await handler(req('tools/call',{name:'report_bug',arguments:payload}))).json();
  assert.equal(r.result.isError,undefined);
  assert.deepEqual(calls.at(-1),{operation:'bugs.report',args:payload});
});

test('synthetic MCP backend creates one issue, suppresses unresolved duplicates and reserves safely across retries',async()=>{
  const db=await createTestDatabase();
  const issues=[];let posts=0;
  const ledger=async(action,args)=>(await db.query('select public.bug_report_receipt($1,$2) result',[action,JSON.stringify(args)])).rows[0].result;
  const fetchImpl=async(url,init)=>{
    const path=new URL(url).pathname;
    assert.equal(new URL(url).hostname,'api.github.com');
    if(path.endsWith('/labels/auto-fix'))return json({name:'auto-fix'});
    if(path.endsWith('/issues')&&init.method==='POST') {
      posts++;const body=JSON.parse(init.body);assert.deepEqual(body.labels,['auto-fix']);
      assert.ok(!body.body.includes(options.token));
      const issue={number:posts,title:body.title,state:'open'};issues.push(issue);return json(issue,201);
    }
    if(path.endsWith('/issues'))return json(issues.filter(i=>i.state==='open'));
    return json(issues.find(i=>path.endsWith('/'+i.number)));
  };
  try {
    const handle=createHandler(async(_token,operation,args)=>operation==='credentials.verify'
      ? options.authorize()
      : reportBug({...options,payload:args,ledger,fetchImpl}));
    const request=()=>new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+'a'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'report_bug',arguments:payload}})});
    const mcp=await (await handle(request())).json();
    assert.ok(!mcp.result.isError);
    const first={status:200,data:JSON.parse(mcp.result.content[0].text)};
    assert.equal(first.status,200);assert.equal(first.data.duplicate,false);assert.equal(first.data.agentStarted,false);
    const repeated=await reportBug({...options,payload:{...payload,title:payload.title.toUpperCase()},ledger,fetchImpl});
    assert.equal(repeated.data.duplicate,true);assert.equal(posts,1);
    issues[0].state='closed';
    assert.equal((await reportBug({...options,ledger,fetchImpl})).data.duplicate,false);
    assert.equal(posts,2);
    const fp='a'.repeat(64);
    const a=await ledger('reserve',{fingerprint:fp});
    assert.ok(a.claim_id);
    assert.equal((await ledger('reserve',{fingerprint:fp})).claim_id,undefined);
    await assert.rejects(ledger('finish',{fingerprint:fp,claimId:'00000000-0000-0000-0000-000000000001',issueNumber:9}));
    await db.exec('set role authenticated');
    await assert.rejects(ledger('read',{fingerprint:fp}));
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select * from private.bug_report_receipts'));
    await db.exec('reset role');
    const parallelPayload={...payload,title:'Synthetic: concurrent panel failure'};
    const before=posts;
    const parallel=await Promise.all([reportBug({...options,payload:parallelPayload,ledger,fetchImpl}),reportBug({...options,payload:parallelPayload,ledger,fetchImpl})]);
    assert.equal(posts,before+1);
    assert.ok(parallel.some(r=>r.status===200));
    assert.ok(parallel.every(r=>[200,409].includes(r.status)));
    // GitHub timeout after the claim must never blindly retry issue creation.
    const other={...payload,title:'Synthetic: second settings problem'};
    let attempts=0;
    const timeoutFetch=async(url,init)=>{if(init.method==='POST'){attempts++;throw Error('sensitive response detail');}return fetchImpl(url,init);};
    assert.equal((await reportBug({...options,payload:other,ledger,fetchImpl:timeoutFetch})).status,503);
    assert.equal((await reportBug({...options,payload:other,ledger,fetchImpl:timeoutFetch})).status,409);
    assert.equal(attempts,1);
    await ledger('reserve',{fingerprint:'b'.repeat(64)});
    assert.ok((await ledger('reserve',{fingerprint:'c'.repeat(64)})).claim_id);
  } finally {await db.close();}
});

test('duplicate scan and GitHub errors fail closed without leaking raw details',async()=>{
  const r=await reportBug({...options,fetchImpl:async()=>json({message:'private detail'},403)});
  assert.equal(r.status,503);assert.ok(!r.error.includes('private detail'));
  let calls=0;
  const bounded=await reportBug({...options,ledger:()=>assert.fail(),fetchImpl:async()=>{calls++;return json(Array.from({length:100},()=>({title:'Different issue'})));}});
  assert.equal(bounded.status,503);assert.equal(calls,10);
});

test('format discovery explains actual newlines and rejects bullets, headings and escaped newline text',()=>{
  assert.match(BUG_TOOL.inputSchema.properties.description.description,/column one/);
  for(const description of [payload.description.replaceAll('\n','\\n'),payload.description.split('\n').map(s=>'- '+s).join('\n'),payload.description.split('\n').map(s=>'## '+s).join('\n')]){
    assert.throws(()=>validateRequest({operation:'bugs.report',payload:{...payload,description}}),/newline-separated/);
  }
  assert.doesNotThrow(()=>validateRequest({operation:'bugs.report',payload}));
});

test('precheck diagnostics distinguish GitHub stages and HTTP statuses without leaking upstream data',async()=>{
 for(const stage of ['duplicate_scan','label_check'])for(const status of [401,403,404,429,500]){
  let posts=0;
  const r=await reportBug({...options,ledger:()=>assert.fail('No receipt access'),fetchImpl:async(url,init)=>{
   if(init.method==='POST')posts++;
   if(stage==='duplicate_scan'||url.endsWith('/labels/auto-fix'))return json({message:'PRIVATE upstream response'},status);
   return json([]);
  }});
  assert.equal(r.status,503);assert.match(r.error,new RegExp(`stage=${stage}; githubStatus=${status}`));
  assert.match(r.error,/No new issue was attempted/);assert.match(r.error,/Stop automatic retries/);
  assert.ok(!r.error.includes('PRIVATE'));assert.equal(posts,0);
 }
 const timeout=await reportBug({...options,fetchImpl:async()=>{throw Object.assign(Error('PRIVATE token'),{status:418});}});
 assert.match(timeout.error,/stage=duplicate_scan/);assert.ok(!timeout.error.includes('418'));assert.ok(!timeout.error.includes('PRIVATE'));
});

test('receipt and uncertain creation failures preserve their distinct stages and never retry writes',async()=>{
 for(const failed of ['read','reserve','create','finish']){
  let posts=0;
  const r=await reportBug({...options,ledger:async action=>{
   if(action===failed)throw Error('PRIVATE receipt data');
   return action==='reserve'?{claim_id:'synthetic'}:{};
  },fetchImpl:async(url,init)=>{
   if(init.method==='POST'){posts++;if(failed==='create')throw Error('PRIVATE timeout');return json({number:17});}
   return url.includes('/labels/')?json({name:'auto-fix'}):json([]);
  }});
  assert.equal(r.status,503);
  const stage=failed==='create'?'issue_create':`receipt_${failed}`;
  assert.match(r.error,new RegExp(`stage=${stage}`));assert.ok(!r.error.includes('PRIVATE'));
  if(['create','finish'].includes(failed)){assert.equal(posts,1);assert.match(r.error,/An issue may exist/);assert.match(r.error,/at most once/);}
  else {assert.equal(posts,0);assert.match(r.error,/No new issue was attempted/);}
 }
});

test('quota migration preserves receipts and permissions while allowing more than five distinct concurrent reservations',async()=>{
 let saved;
 const db=await createTestDatabase({beforeMigration:async(db,name)=>{
  if(!name.endsWith('_remove_bug_report_daily_quota.sql'))return;
  await db.exec("insert into private.bug_report_receipts(fingerprint,issue_number) values(repeat('d',64),71),(repeat('e',64),null)");
  saved=(await db.query('select * from private.bug_report_receipts order by fingerprint')).rows;
 }});
 try {
  assert.deepEqual((await db.query('select * from private.bug_report_receipts order by fingerprint')).rows,saved);
  const ledger=async(action,args)=>(await db.query('select public.bug_report_receipt($1,$2) result',[action,JSON.stringify(args)])).rows[0].result;
  const fingerprints=Array.from({length:7},(_,i)=>String(i+1).repeat(64));
  const claims=await Promise.all(fingerprints.map(fingerprint=>ledger('reserve',{fingerprint})));
  assert.equal(claims.filter(c=>c.claim_id).length,7);
  const duplicates=await Promise.all(Array.from({length:4},()=>ledger('reserve',{fingerprint:fingerprints[0]})));
  assert.ok(duplicates.every(c=>!c.claim_id));
  assert.equal((await db.query('select count(*)::int as n from private.bug_report_receipts')).rows[0].n,9);
  assert.equal((await ledger('reserve',{fingerprint:'d'.repeat(64)})).issue_number,71);
  assert.ok(!(await ledger('reserve',{fingerprint:'e'.repeat(64)})).claim_id);
  await ledger('finish',{fingerprint:fingerprints[0],claimId:claims[0].claim_id,issueNumber:72});
  assert.equal((await ledger('reserve',{fingerprint:fingerprints[0]})).issue_number,72);
  for(const role of ['anon','authenticated']){
   await db.exec('set role '+role);
   await assert.rejects(ledger('reserve',{fingerprint:'f'.repeat(64)}));
   await db.exec('reset role');
  }
  await db.exec('set role service_role');
  assert.ok((await ledger('reserve',{fingerprint:'f'.repeat(64)})).claim_id);
  await db.exec('reset role');
 } finally {await db.close();}
});
