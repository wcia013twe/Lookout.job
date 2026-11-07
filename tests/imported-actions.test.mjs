import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTestDatabase} from './helpers/database.mjs';
import {parseDemoSimplify,createDemoSimplifyImport} from '../next-app/lib/simplify-import-demo.mjs';
import {importedApplication} from '../lib/simplify-import.mjs';
import {applicationNextAction,sortByNextAction} from '../lib/application-next-action.mjs';
import {applicationAction} from '../lib/action-inbox.mjs';
import {trackerProgress} from '../lib/tracker-display.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {React,renderToStaticMarkup,bundleComponent} from './helpers/render.mjs';

test('database shares imported action/completion ownership, versions, replay and validation across browser/MCP',async()=>{
 const db=await createTestDatabase();try{await db.exec(await readFile(new URL('./imported-actions-check.sql',import.meta.url),'utf8'));}finally{await db.close();}
});
test('imported actions drive flags/dates/sorting and completion independently of current status, without parsing notes',async()=>{
 const api=createDemoSimplifyImport();await api('save',{rows:parseDemoSimplify().rows,expectedVersion:0,eventKey:'import'});
 const source=(await api('list')).records[0],before=structuredClone(source.source_rows);
 const changes={status:'SCREEN',nextAction:'Complete assessment',actionDate:'2026-11-08',needsAction:true,completedStages:['APPLIED','SCREEN']};
 const request={id:source.id,changes,expectedVersion:1,eventKey:'actions'};
 const saved=await api('update',request);assert.deepEqual(await api('update',request),saved);
 let app=importedApplication(saved.record);
 assert.equal(applicationNextAction(app).date,'2026-11-08');assert.equal(applicationAction(app).reason,'Complete assessment');
 assert.equal(trackerProgress(app).status,'Screen');assert.deepEqual(trackerProgress(app).completed,[false,true,true,false,false]);
 assert.deepEqual(saved.record.source_rows,before);assert.equal(app.receipt,undefined);assert.equal(app.backendId,undefined);
 const waiting=await api('update',{id:source.id,expectedVersion:2,eventKey:'waiting',changes:{nextAction:'Wait for employer response',actionDate:null,needsAction:false}});
 app=importedApplication(waiting.record);assert.equal(applicationNextAction(app),null);assert.equal(applicationAction(app),null);assert(trackerProgress(app).completed[2]);
 assert.equal(applicationNextAction(importedApplication({...source,record:{...source.record,notes:'Next action: interview 2026-11-08'}})),null);
 const dated=importedApplication(saved.record);assert.deepEqual(sortByNextAction([app,dated]).map(row=>row.imported.record.actionDate),['2026-11-08',null]);
 await assert.rejects(api('update',{...request,eventKey:'stale'}));
 assert.equal((await createDemoSimplifyImport()('list')).records.length,0);
 const Component=(await bundleComponent('next-app/components/tracker-progress.tsx',{plugins:[{name:'logo',setup(build){build.onResolve({filter:/^\.\/role-card$/},()=>({path:'logo',namespace:'stub'}));build.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const CompanyLogo=()=>null;',loader:'js'}));}}]}))();
 const html=renderToStaticMarkup(React.createElement(Component,{application:dated}));assert.match(html,/Screen/);assert.equal((html.match(/>Completed<\/span>/g)||[]).length,2);
});
test('MCP advertises and forwards structured imported fields only under tracking scope',async()=>{
 const payload={id:'11111111-1111-4111-8111-111111111111',expectedVersion:66,eventKey:'structured',changes:{nextAction:'Technical interview',actionDate:'2026-11-11',needsAction:true,completedStages:['APPLIED','SCREEN']}};
 validateRequest({operation:'imports.update',payload});
 for(const changes of [{actionDate:'2026-02-30'},{needsAction:'yes'},{completedStages:['SCREEN','SCREEN']},{completedStages:['ADMIN']}])assert.throws(()=>validateRequest({operation:'imports.update',payload:{...payload,changes}}));
 for(const scopes of [['workspace:read'],['workspace:read','tracking:write']]){
  const calls=[];const handler=createHandler(async(_token,op,args)=>{if(op==='credentials.verify')return {status:200,data:{scopes}};validateRequest({operation:op,payload:args});calls.push({op,args});return {status:200,data:{version:67,record:{id:payload.id,record:payload.changes}}};});
  const result=await (await handler(new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+'a'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'update_imported_job',arguments:payload}})}))).json();
  assert.equal(!!result.result.isError,!scopes.includes('tracking:write'));if(scopes.includes('tracking:write'))assert.deepEqual(calls,[{op:'imports.update',args:payload}]);else assert.equal(calls.length,0);
 }
});
