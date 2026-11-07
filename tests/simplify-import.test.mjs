import {readGuide} from '../supabase/functions/agent-gateway/guides.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSimplifyCsv,parseCsv,canonicalImportUrl,importedApplication} from '../lib/simplify-import.mjs';
import {simplifyDemoCsv,createDemoSimplifyImport} from '../next-app/lib/simplify-import-demo.mjs';
import {createSimplifyImporter} from '../backend/simplify-import.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {contextResponse} from '../supabase/functions/agent-gateway/context.mjs';
import {connectionScopes} from '../lib/agent-connections.mjs';
import {createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
test('Simplify export maps dates, saved/applied, missing URLs and archived rows without guessing',()=>{
 const parsed=parseSimplifyCsv('\uFEFF'+simplifyDemoCsv.replaceAll('\n','\r\n'));
 assert.equal(parsed.total,4);assert.equal(parsed.missingUrls,2);assert.equal(parsed.applied,3);
 const a=importedApplication({id:'example',record:parsed.rows[0]});assert.equal(a.status,'Submitted');assert.equal(a.receipt,undefined);assert.equal(a.activity[0].actor,'user');
 assert.equal(parsed.rows[2].appliedDate,null);assert.equal(parsed.rows[3].archived,true);
 assert.equal(canonicalImportUrl('https://example.com/job?utm_source=Simplify&ref=Simplify&role=intern&src=Simplify#apply'),'https://example.com/job?role=intern');
});
test('CSV handles quoted commas, escaped quotes and multiline notes, rejects broken or unsafe input',()=>{
 assert.deepEqual(parseCsv('a,b\n"Smith, Inc","Line 1\nLine ""2"""'),[['a','b'],['Smith, Inc','Line 1\nLine "2"']]);
 for(const bad of ['a\n"unfinished','a\n"closed"extra','a\nb"bad'])assert.throws(()=>parseCsv(bad));
 assert.throws(()=>parseSimplifyCsv('Other,Columns\na,b'),/Simplify/);
 assert.throws(()=>parseSimplifyCsv(simplifyDemoCsv.replace('2026-10-20','2026-02-30')),/invalid date/);
 assert.throws(()=>parseSimplifyCsv(simplifyDemoCsv.replace('APPLIED','UNKNOWN')),/unsupported status/);
 assert.throws(()=>parseSimplifyCsv(simplifyDemoCsv.replace('https://example.com/demo/platform','javascript:alert(1)')),/HTTPS or HTTP/);
 assert.throws(()=>parseCsv('x'.repeat(200001)),/200 KB/);
});
test('fictional importer previews duplicates and missing links, saves once and resets without real services',async()=>{
 const call=createDemoSimplifyImport(),rows=parseSimplifyCsv(simplifyDemoCsv).rows;
 const preview=await call('preview',{rows});assert.equal(preview.added,3);assert.equal(preview.duplicateRows,1);assert.equal((await call('list')).records.length,0);
 const request={rows,expectedVersion:0,eventKey:'demo'};const saved=await call('save',request);assert.equal((await call('list')).records.length,3);assert.deepEqual(await call('save',request),saved);
 await assert.rejects(call('save',{...request,eventKey:'stale'}));assert.equal((await createDemoSimplifyImport()('list')).records.length,0);
});
test('browser adapter guards both sides of account changes and never hides a missing backend',async()=>{
 let owner='me',calls=[];const client={auth:{getUser:async()=>({data:{user:{id:owner}}})},rpc:async(name,args)=>{calls.push({name,args});return {data:{version:0,decisions:[]}}}};
 const call=createSimplifyImporter(client,'me');const p={rows:parseSimplifyCsv(simplifyDemoCsv).rows};await call('preview',p);assert.deepEqual(calls,[{name:'simplify_import',args:{action:'preview',payload:p}}]);
 owner='other';await assert.rejects(call('preview',p),/Account changed/);assert.equal(calls.length,1);
 owner='me';client.rpc=async()=>{owner='other';return {data:{version:0,records:[]}}};await assert.rejects(call('list'),/Account changed/);
 owner='me';client.rpc=async()=>({error:{code:'PGRST202'}});await assert.rejects(call('list'),/backend release/);
});
test('MCP imports expose only scoped actions and share exact payload validation',async()=>{
 const token='jb_agent_'+ 'a'.repeat(64),calls=[];
 const handler=createHandler(async(t,operation,payload)=>{assert.equal(t,token);if(operation==='credentials.verify')return {status:200,data:{scopes:connectionScopes('work')}};validateRequest({operation,payload});calls.push({operation,payload});return {status:200,data:{version:0,decisions:[]}};});
 const send=async(method,params)=>await (await handler(new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}))).json();
 const discovery=JSON.parse((await send('tools/call',{name:'discover_tools',arguments:{workflow:'search'}})).result.content[0].text);assert.ok(discovery.tools.some(t=>t.name==='import_simplify_jobs'));
 const payload={rows:parseSimplifyCsv(simplifyDemoCsv).rows};const result=await send('tools/call',{name:'preview_simplify_import',arguments:payload});assert.ok(!result.result.isError);assert.deepEqual(calls,[{operation:'imports.preview',payload}]);
 assert.throws(()=>validateRequest({operation:'imports.save',payload:{...payload,expectedVersion:0,eventKey:'ok',userId:'other'}}));
 assert.throws(()=>validateRequest({operation:'imports.save',payload:{...payload,expectedVersion:-1,eventKey:'ok'}}));
});

test('CSV import discovery and direct calls preserve each connection scope boundary',async()=>{
 const payload={rows:parseSimplifyCsv(simplifyDemoCsv).rows};
 for(const scopes of [connectionScopes('read'),connectionScopes('context'),connectionScopes('work').filter(s=>s!=='tracking:write'),connectionScopes('work')]){
  const calls=[];
  const handler=createHandler(async(_token,operation,args)=>{
   if(operation==='credentials.verify')return {status:200,data:{scopes}};
   validateRequest({operation,payload:args});calls.push(operation);
   return {status:200,data:operation==='context.developer'?contextResponse(operation,{}):{version:0,records:[]}};
  });
  const send=async(method,params={})=>(await handler(new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+'a'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}))).json();
  const names=JSON.parse((await send('tools/call',{name:'discover_tools',arguments:{workflow:'search'}})).result.content[0].text).tools.map(t=>t.name);
  const canImport=scopes.includes('tracking:write');
  assert.ok(names.includes('list_imported_jobs'));
  for(const [name,args,operation] of [['preview_simplify_import',payload,'imports.preview'],['import_simplify_jobs',{...payload,expectedVersion:0,eventKey:'scope-test'},'imports.save']]){
   assert.equal(names.includes(name),canImport);
   const result=(await send('tools/call',{name,arguments:args})).result;
   assert.equal(!!result.isError,!canImport);
   assert.equal(calls.includes(operation),canImport);
   if(!canImport)assert.match(result.content[0].text,/Missing required scope: tracking:write/);
  }
  const context=JSON.parse((await send('tools/call',{name:'read_developer_context'})).result.content[0].text);
  assert(context.guides.some(g=>g.id==='workspace-maintenance'));
  const guidance=readGuide('workspace-maintenance').instructions;
  assert.match(guidance,/tracking:write/);
  assert.match(guidance,/workspace:read/);
  assert.match(guidance,/If either tool is absent/);
  assert.match(guidance,/never self-grant/);
 }
});

test('all settings job types and explicit outcomes retain truthful tracker progress',async()=>{
 const {importEmploymentTypes,importStatuses}=await import('../lib/simplify-import.mjs');
 const {EMPLOYMENT_TYPES}=await import('../lib/discovery-filter-contract.mjs');
 const {trackerProgress}=await import('../lib/tracker-display.mjs');
 assert.deepEqual(Object.keys(importEmploymentTypes),[...EMPLOYMENT_TYPES]);
 for(const [type,label] of Object.entries(importEmploymentTypes)){
  const parsed=parseSimplifyCsv(simplifyDemoCsv.replaceAll('Internship',label));assert.equal(parsed.rows[0].employmentType,type);
 }
 for(const status of Object.keys(importStatuses)){
  const parsed=parseSimplifyCsv(simplifyDemoCsv.replaceAll('APPLIED',status));
  const a=importedApplication({id:status,record:{...parsed.rows[0],appliedDate:status==='SAVED'?null:parsed.rows[0].appliedDate}}),progress=trackerProgress(a);
  assert.equal(a.receipt,undefined);
  assert.equal(progress.status,{SAVED:'Opened',APPLIED:'Applied',SCREEN:'Screen',INTERVIEW:'Interview',OFFER:'Offer',REJECTED:'Rejected',WITHDRAWN:'Withdrawn',CLOSED:'Closed'}[status]);
 }
 const noDate=importedApplication({id:'unknown',record:{...parseSimplifyCsv(simplifyDemoCsv).rows[0],status:'REJECTED',appliedDate:null}});
 assert.equal(trackerProgress(noDate).level,0);assert.equal(noDate.trackerItem.appliedDate,null);
});
test('demo corrections preserve source history and reject stale or changed retries',async()=>{
 const call=createDemoSimplifyImport(),rows=parseSimplifyCsv(simplifyDemoCsv).rows;
 await call('save',{rows,expectedVersion:0,eventKey:'seed'});
 const before=await call('list'),record=before.records[0];
 const payload={id:record.id,expectedVersion:1,eventKey:'correct',changes:{status:'INTERVIEW',employmentType:'Contract',statusDate:null}};
 const saved=await call('update',payload);assert.equal(saved.version,2);
 assert.deepEqual((await call('list')).records[0].source_rows,record.source_rows);
 assert.deepEqual(await call('update',payload),saved);
 await assert.rejects(call('update',{...payload,eventKey:'stale'}),/changed/);
 await assert.rejects(call('update',{...payload,changes:{status:'OFFER'}}),/key changed/);
});
test('MCP imported corrections expose applications routing and enforce scope and field boundaries',async()=>{
 const {IMPORT_TOOLS}=await import('../supabase/functions/agent-gateway/simplify-import.mjs');
 const args={id:'11111111-1111-4111-8111-111111111111',expectedVersion:1,eventKey:'update',changes:{employmentType:'Part-time',status:'REJECTED',statusDate:null}};
 validateRequest({operation:'imports.update',payload:args});
 for(const changes of [{receipt:{}},{userId:'other'},{}])assert.throws(()=>validateRequest({operation:'imports.update',payload:{...args,changes}}));
 for(const scopes of [['workspace:read'],['tracking:write']]){
  const calls=[];const handler=createHandler(async(_token,operation,payload)=>{
   if(operation==='credentials.verify')return {status:200,data:{scopes}};
   calls.push({operation,payload});return {status:200,data:{version:2,record:{id:args.id}}};
  });
  const response=await (await handler(new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+'a'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'update_imported_job',arguments:args}})}))).json();
  assert.equal(!!response.result.isError,!scopes.includes('tracking:write'));
  assert.equal(calls.length,scopes.includes('tracking:write')?1:0);
 }
});
