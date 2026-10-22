import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
import {emptyCompany,companyIndex,importLegacyCompanies,resolveCompany} from '../lib/network-model.mjs';
import {matchesCompanyContext} from '../lib/company-knowledge.mjs';
import {createCompanySync} from '../lib/company-sync.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {createHandler,TOOLS} from '../supabase/functions/agent-mcp/protocol.mjs';
const owner='11111111-1111-1111-1111-111111111111',friend='22222222-2222-2222-2222-222222222222',companyId='c0000000-0000-4000-8000-000000000001';
test('identity resolution and saved list preserve ambiguity, aliases and duplicate targets',()=>{
 const registry=[{id:'one',name:'Acme',domain:'acme.test',aliases:['Acme Inc.']}];
 assert.equal(resolveCompany(registry,' ACME Inc. '),'one');assert.equal(resolveCompany(registry,'Acme','https://other.test'),null);
 assert.equal(resolveCompany([...registry,{id:'two',name:'ACME',aliases:[]}],'Acme'),null);
 const record=emptyCompany('Acme');assert.equal(companyIndex([{id:'1',record},{id:'2',record}],[],[]).length,2);
 const imported=importLegacyCompanies({network:{referrals:[{id:'legacy',collection:'companies',company:'Unknown',notes:'{malformed'}],people:[]}});
 assert.equal(imported.companies[0].record.research,'{malformed');assert.equal(imported.referrals.length,0);
 assert.deepEqual(importLegacyCompanies({network:imported}),imported);
 assert.equal(matchesCompanyContext({company:'Acme',role:'Backend',contexts:[{kind:'application',company:'Other',role:'Frontend'}]},{company:'Acme',role:'Frontend'}),false);
 for(const name of ['list_companies','list_company_workspaces','save_company_workspace'])assert.ok(TOOLS.find(t=>t.name===name));
 assert.doesNotThrow(()=>validateRequest({operation:'company_workspaces.save',payload:{id:'text-target',record,expectedRevision:0}}));
 assert.throws(()=>validateRequest({operation:'knowledge.search',payload:{scope:'current_memberships',companyId:'one',company:'Acme'}}));
});
test('offline queue retains edits, recovers lost responses and isolates account changes',async()=>{
 let rows=[{id:'c',record:emptyCompany('Unknown'),revision:0,dirty:true}],remote=[],active=true,calls=0;
 const sync=createCompanySync({owner,get:()=>rows,set:value=>rows=value,isCurrent:()=>active,read:async()=>remote,write:async row=>{calls++;remote=[{...row,revision:row.revision+1,dirty:false}];throw Error('lost response');}});
 await assert.rejects(sync.synchronize());assert.equal(rows[0].dirty,true);
 await sync.synchronize();assert.equal(rows[0].revision,1);assert.equal(rows[0].dirty,false);assert.equal(calls,1);
 rows=[{...rows[0],record:{...rows[0].record,research:'local'},dirty:true}];remote=[{...remote[0],revision:3}];await sync.synchronize();assert.equal(rows[0].conflict,true);assert.equal(rows[0].record.research,'local');
 active=false;const previous=structuredClone(rows);await sync.synchronize();assert.deepEqual(rows,previous);
});
test('migration, website and MCP preserve research, revisions, ownership and Circle source permissions',async()=>{
 const legacy={...emptyCompany('Databricks'),nextAction:'Ask about team',followUpDate:'2026-10-21',sources:[{title:'Role',url:'https://example.com/jobs?gh_jid=73',observedAt:'2026-10-20',summary:'Observed'}]};
 const db=await createTestDatabase({beforeMigration:async(db,name)=>{if(!name.endsWith('durable_company_hub.sql'))return;for(const [id,notes] of [['legacy-a',JSON.stringify(legacy)],['legacy-b',JSON.stringify(legacy)],['bad','{broken notes']])await db.query("insert into public.outreach_contacts(user_id,id,record,revision,updated_at) values($1,$2,$3::jsonb,4,'2026-10-20T12:00:00Z')",[owner,id,JSON.stringify({collection:'companies',company:'Databricks',notes})]);}});
 let event=0;const hash='d'.repeat(64);
 async function human(user,fn,operation,payload={}){await db.query("select set_config('test.uid',$1,false)",[user]);await db.exec('set role authenticated');try{return (await db.query(`select public.${fn}($1,$2::jsonb) result`,[operation,JSON.stringify(payload)])).rows[0].result;}finally{await db.exec('reset role');}}
 const workspace=(user,op,p={})=>human(user,'company_action',op,p);
 const circle=(user,op,p={})=>human(user,'knowledge_action',op,{...p,...(!['circles.list','circles.read','knowledge.search','knowledge.read'].includes(op)?{eventKey:'hub-'+(++event)}:{})});
 const handler=createHandler(async(token,op,payload)=>{
  if(op==='credentials.verify')return {status:200,data:{scopes:['workspace:read','network:write','knowledge:read','knowledge:write']}};
  try{return {status:200,data:(await db.query('select public.agent_dispatch($1,$2,$3::jsonb) result',[hash,op,JSON.stringify(payload)])).rows[0].result};}catch(e){return {status:400,data:{error:e.message}};}
 });
 const agent=async(op,p)=>{const response=await handler(new Request('https://example.com/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+hash,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:++event,method:'tools/call',params:{name:TOOLS.find(tool=>tool.operation===op).name,arguments:p}})}));const packet=await response.json();if(packet.result.isError)throw Error(packet.result.content[0].text);return JSON.parse(packet.result.content[0].text);};
 try{
  let migrated=(await workspace(owner,'company_workspaces.list')).items;
  assert.equal(migrated.length,3);assert.equal(migrated.find(r=>r.id==='legacy-a').revision,4);assert.deepEqual(migrated.find(r=>r.id==='legacy-a').record,legacy);
  assert.ok(migrated.every(r=>r.companyId===null&&r.needsReview));assert.equal(migrated.find(r=>r.id==='bad').record.research,'{broken notes');
  assert.deepEqual((await workspace(friend,'company_workspaces.list')).items,[]);
  assert.equal((await db.query("select count(*)::int n from public.outreach_contacts where deleted_at is null")).rows[0].n,0);
  const saved=await workspace(owner,'company_workspaces.save',{id:'legacy-a',expectedRevision:4,record:{...legacy,research:'Updated'}});assert.equal(saved.revision,5);
  await assert.rejects(()=>workspace(owner,'company_workspaces.save',{id:'legacy-a',expectedRevision:4,record:legacy}),/changed/i);
  await assert.rejects(()=>workspace(friend,'company_workspaces.save',{id:'private-link',expectedRevision:0,record:{...emptyCompany('Private'),contactIds:['legacy-a']}}),/owned/i);
  const unknown=await workspace(owner,'company_workspaces.save',{id:'unknown',expectedRevision:0,record:emptyCompany('Unregistered private company')});assert.equal(unknown.companyId,null);
  const canonical=await workspace(friend,'company_workspaces.save',{id:'canonical',expectedRevision:0,record:emptyCompany('Databricks Inc.')});assert.equal(canonical.companyId,companyId);
  const edited=await workspace(friend,'company_workspaces.save',{id:'canonical',expectedRevision:1,record:{...canonical.record,website:'https://different.example'}});assert.equal(edited.companyId,null);
  assert.equal((await workspace(friend,'companies.list',{query:'Databricks'})).items[0].domain,'databricks.com');
  await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Hub test',$2,array['workspace:read','network:write','knowledge:read','knowledge:write'],now()+interval '1 day')",[owner,hash]);
  assert.equal((await agent('companies.list',{query:'Databricks Inc.'})).items[0].id,companyId);
  assert.equal((await agent('company_workspaces.save',{id:'mcp-target',record:emptyCompany('Together AI'),expectedRevision:0})).revision,1);
  assert.ok((await agent('company_workspaces.list',{})).items.some(r=>r.id==='mcp-target'));
  const projection=(await agent('contacts.read',{})).find(r=>r.id==='legacy-a');assert.equal(projection.revision,5);
  const compat=await agent('contacts.save',{id:'legacy-a',expectedRevision:5,record:projection.record});assert.equal(compat.revision,6);
  assert.equal((await db.query("select count(*)::int n from public.outreach_contacts where id='legacy-a' and deleted_at is null")).rows[0].n,0);
  await db.query("select set_config('test.uid',$1,false)",[owner]);await db.exec('set role authenticated');
  await assert.rejects(()=>db.query("select public.save_outreach_contact('legacy-a',5,'{\"company\":\"Databricks\",\"collection\":\"companies\"}', $1)",[owner]),/reload/i);
  await assert.rejects(()=>db.query("insert into public.companies(name) values('Not maintained')"),/permission/i);await db.exec('reset role');
  await db.exec('update private.knowledge_config set enabled=true');
  const c1=(await circle(owner,'circles.create',{name:'First',alias:'Same alias'})).circleId;
  const c2=(await circle(friend,'circles.create',{name:'Second',alias:'Same alias'})).circleId;
  const invite=await circle(friend,'circles.invite',{circleId:c2});await circle(owner,'circles.join',{token:invite.token,alias:'Same alias'});
  const content={title:'Two contexts',body:'Published evidence',type:'interview_report',company:'Oracle',role:'Frontend',stage:'Screen',contexts:[{kind:'application',label:'Database round',company:'Databricks Inc.',role:'Backend',stage:'Technical',jobId:'REQ-73',jobUrl:'https://example.com/jobs?gh_jid=73'}],sources:[],provenance:'user_confirmed',personalDisclosure:true};
  const posts=[];
  for(const [user,cid] of [[owner,c1],[friend,c2]]){const p=await circle(user,'knowledge.propose',{circleId:cid,expectedRevision:0,content});await circle(user,'knowledge.publish',{circleId:cid,postId:p.postId,expectedRevision:1});posts.push(p.postId);}
  let results=await agent('knowledge.search',{scope:'current_memberships',companyId,role:'Backend',stage:'Technical',limit:1});assert.equal(results.items.length,1);assert.ok(results.nextCursor);
  const next=await agent('knowledge.search',{scope:'current_memberships',companyId,role:'Backend',stage:'Technical',limit:1,cursor:results.nextCursor});assert.equal(next.items.length,1);assert.notEqual(next.items[0].id,results.items[0].id);
  assert.equal((await agent('knowledge.search',{scope:'current_memberships',companyId,role:'Frontend'})).items.length,0);
  results=await agent('knowledge.search',{scope:'current_memberships',company:'Databricks'});assert.equal(results.items.length,2);assert.ok(results.items.every(p=>p.authorId&&p.circleName&&p.content.contexts[0].jobId==='REQ-73'));
  await circle(owner,'knowledge.propose',{circleId:c1,postId:posts[0],expectedRevision:1,content:{...content,body:'Unpublished secret'}});
  results=await agent('knowledge.search',{scope:'current_memberships',companyId});assert.equal(results.items.find(p=>p.id===posts[0]).content.body,'Published evidence');
  await circle(friend,'circles.remove',{circleId:c2,memberId:owner});assert.equal((await agent('knowledge.search',{scope:'current_memberships',companyId})).items.length,1);
  await circle(owner,'knowledge.withdraw',{circleId:c1,postId:posts[0],expectedRevision:2});assert.equal((await agent('knowledge.search',{scope:'current_memberships',companyId})).items.length,0);
  assert.deepEqual((await db.query('select content from private.knowledge_revisions where post_id=$1 and revision=1',[posts[0]])).rows[0].content,content);
 }finally{await db.close();}
});
