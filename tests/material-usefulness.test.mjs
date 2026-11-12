import test from 'node:test';
import assert from 'node:assert/strict';
import {validateArtifact} from '../lib/artifacts.mjs';
import {createBackend} from '../backend/client.mjs';
import {TOOLS,createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {createTestDatabase} from './helpers/database.mjs';
import {createArtifactDemo} from '../next-app/lib/artifact-demo.mjs';
import {createMemoryStore} from '../next-app/lib/demo.mjs';

const owner='11111111-1111-1111-1111-111111111111',other='22222222-2222-2222-2222-222222222222',id='33333333-3333-4333-8333-333333333333';
const doc={id,expectedVersion:0,title:'Round brief',purpose:'Prepare an answer',kind:'interview_brief',format:'markdown',body:'A fictional practice brief.',sources:[],links:[]};
const feedback={id,version:1,expectedRevision:0,useful:true,note:''};

test('usefulness contracts and browser/MCP share the exact version and explicit-user boundary',async()=>{
 validateArtifact('artifacts.feedback.save',feedback);
 for(const patch of [{version:0},{version:1.5},{expectedRevision:-1},{useful:'yes'},{note:'x'.repeat(2001)},{source:'user'},{userId:owner}])assert.throws(()=>validateArtifact('artifacts.feedback.save',{...feedback,...patch}));
 const tool=TOOLS.find(item=>item.name==='save_artifact_feedback');assert.equal(tool.scope,'drafts:write');assert.match(tool.description,/explicit/i);
 const calls=[];let user=owner;
 const backend=createBackend({auth:{getUser:async()=>({data:{user:{id:user}},error:null})},rpc:async(name,args)=>{calls.push([name,args]);return {data:{revision:1},error:null};}},owner);
 assert.deepEqual(await backend.artifactAction('artifacts.feedback.save',feedback),{revision:1});
 assert.deepEqual(calls,[['artifact_action',{operation:'artifacts.feedback.save',payload:feedback}]]);
 user=other;await assert.rejects(backend.artifactAction('artifacts.feedback.save',feedback),/Account changed/);assert.equal(calls.length,1);
 let scopes=['workspace:read','drafts:write'];const forwarded=[];
 const handler=createHandler(async(token,operation,payload)=>{if(operation==='credentials.verify')return {status:200,data:{scopes}};forwarded.push([operation,payload]);return {status:200,data:{revision:1}};});
 const request=()=>handler(new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:`Bearer jb_agent_${'a'.repeat(64)}`,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'save_artifact_feedback',arguments:feedback}})}));
 assert.equal((await(await request()).json()).result.isError,undefined);assert.deepEqual(forwarded,[['artifacts.feedback.save',feedback]]);
 scopes=['workspace:read'];assert.equal((await(await request()).json()).result.isError,true);assert.equal(forwarded.length,1);
});

test('database feedback is private, revision-bound, retryable and does not mutate material or progress',async()=>{
 const db=await createTestDatabase(),hash='e'.repeat(64),readHash='f'.repeat(64);
 const browser=async(operation,payload)=>(await db.query('select public.artifact_action($1,$2) data',[operation,payload])).rows[0].data;
 const agent=async(operation,payload,token=hash)=>(await db.query('select public.agent_dispatch($1,$2,$3) data',[token,operation,payload])).rows[0].data;
 try{
  for(const [token,scopes] of [[hash,['workspace:read','drafts:write']],[readHash,['workspace:read']]])await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Feedback test',$2,$3,now()+interval '1 hour')",[owner,token,scopes]);
  await db.query("select set_config('test.uid',$1,false)",[owner]);await browser('artifacts.save',doc);
  const before=await browser('artifacts.read',{id});const saved=await browser('artifacts.feedback.save',feedback);
  assert.equal(saved.source,'user');assert.equal(saved.revision,1);assert.equal(saved.note,'');assert.deepEqual(await browser('artifacts.feedback.save',feedback),saved);
  const after=await browser('artifacts.read',{id});assert.deepEqual(after.content,before.content);assert.equal(after.version,before.version);assert.equal(after.updated_at,before.updated_at);assert.deepEqual(after.history,before.history);assert.deepEqual(after.feedback,saved);
  await assert.rejects(browser('artifacts.feedback.save',{...feedback,useful:false}),/Feedback changed/);
  await assert.rejects(browser('artifacts.feedback.save',{...feedback,version:2}),/Artifact not found/);
  for(const patch of [{useful:null},{note:'x'.repeat(2001)},{version:1.5},{source:'user'}])await assert.rejects(browser('artifacts.feedback.save',{...feedback,...patch}));
  const changed=await agent('artifacts.feedback.save',{...feedback,expectedRevision:1,useful:false,note:'More concrete examples, please.'});assert.equal(changed.source,'agent_reported');assert.equal(changed.revision,2);
  await assert.rejects(agent('artifacts.feedback.save',feedback,readHash),/scope/i);
  await browser('artifacts.save',{...doc,expectedVersion:1,body:'Revised brief.'});
  const latest=await agent('artifacts.read',{id});assert.equal(latest.feedback,null);assert.equal(latest.feedbackHistory[0].note,changed.note);
  assert.deepEqual((await agent('artifacts.read',{id,version:1})).feedback,changed);
  await browser('artifacts.feedback.save',{...feedback,version:2});
  await db.query("select set_config('test.uid',$1,false)",[other]);await assert.rejects(browser('artifacts.feedback.save',{...feedback,expectedRevision:2}),/Artifact not found/);await assert.rejects(browser('artifacts.read',{id}));
  await db.exec('set role authenticated');assert.equal((await db.query('select * from public.career_artifact_feedback')).rows.length,0);
  await assert.rejects(db.query('delete from public.career_artifact_feedback'),/permission denied/);await db.exec('reset role');
  await db.query("select set_config('test.uid','',false)");await assert.rejects(browser('artifacts.feedback.save',feedback),/Sign in required/);
 }finally{await db.close();}
});

test('fictional demo feedback supports notes, revision isolation and fresh-store reset',async()=>{
 const store=createMemoryStore({demo:{fictional:true}}),demo=createArtifactDemo(store);
 await demo.artifactAction('artifacts.save',doc);const before=demo.artifactSnapshot();
 const saved=await demo.artifactAction('artifacts.feedback.save',feedback);assert.deepEqual(await demo.artifactAction('artifacts.feedback.save',feedback),saved);
 await assert.rejects(demo.artifactAction('artifacts.feedback.save',{...feedback,useful:false}),/Feedback changed/);
 await demo.artifactAction('artifacts.feedback.save',{...feedback,expectedRevision:1,note:'Shorter please'});assert.deepEqual(demo.artifactSnapshot(),before);
 await demo.artifactAction('artifacts.save',{...doc,expectedVersion:1,body:'Shorter.'});
 assert.equal((await demo.artifactAction('artifacts.read',{id})).feedback,null);
 assert.equal((await createArtifactDemo(store).artifactAction('artifacts.read',{id,version:1})).feedback.note,'Shorter please');
 const reset=createArtifactDemo(createMemoryStore({demo:{fictional:true}}));await reset.artifactAction('artifacts.save',doc);assert.equal((await reset.artifactAction('artifacts.read',{id})).feedback,null);
});
