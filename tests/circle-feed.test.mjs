import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
import {createCircleKnowledgeDemo} from '../lib/circle-knowledge-demo.mjs';
import {validateCircleFeedPayload,visibleCircleFeedEvents} from '../lib/circle-feed.mjs';
import {contextResponse} from '../supabase/functions/agent-gateway/context.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {createHandler,TOOLS} from '../supabase/functions/agent-mcp/protocol.mjs';

const owner='11111111-1111-1111-1111-111111111111',friend='22222222-2222-2222-2222-222222222222';
const content={title:'Shared preparation',body:'Compare actual and estimated rows.',type:'discussion',sources:[],provenance:'agent_observed',personalDisclosure:true};

test('feed discovery, bounded cursor validation and cached thread invalidation',()=>{
 const tool=TOOLS.find(tool=>tool.name==='read_circle_feed');assert.equal(tool.scope,'knowledge:read');assert.equal(tool.readOnly,true);
 const after={version:1,circleId:owner,position:'1',through:'3'};
 validateRequest({operation:'knowledge.feed',payload:{circleId:owner,after,limit:20}});
 for(const payload of [{circleId:owner,limit:0},{circleId:owner,limit:51},{circleId:owner,ownerId:friend},{circleId:owner,after:null},{circleId:owner,after:{...after,circleId:friend}},{circleId:owner,after:{...after,position:1}},{circleId:owner,after:{...after,position:'4'}},{circleId:owner,after:{...after,unknown:'x'}}])assert.throws(()=>validateCircleFeedPayload(payload));
 const base={id:'event-1',position:'1',postId:'parent',threadId:'parent',post:{content},sourceAvailable:true};
 const reply={...base,id:'event-2',position:'2',postId:'reply'};
 const hidden={...base,id:'event-3',position:'3',post:null,sourceAvailable:false,invalidateThread:true};
 assert(visibleCircleFeedEvents([base,reply,hidden]).every(event=>event.post===null));
 assert.equal(visibleCircleFeedEvents([base,{...base,id:'event-4',position:'4',post:null,sourceAvailable:false}])[0].post,null);
});

test('fictional feed snapshots, pagination, revisions, withdrawal and reset stay isolated',()=>{
 const demo=createCircleKnowledgeDemo(),circleId='demo-circle';
 const initial=demo.action('knowledge.feed',{circleId,limit:1});assert(initial.nextCursor);assert.equal(initial.items.length,1);
 const baseline=demo.action('knowledge.feed',{circleId,limit:50});
 assert(baseline.items.every(event=>event.post?.state==='published'));
 assert(!baseline.items.some(event=>event.postId==='demo-review-draft'));
 const draft=demo.action('knowledge.propose',{circleId,content,expectedRevision:0,eventKey:'demo-propose'});
 assert.equal(demo.action('knowledge.feed',{circleId,after:baseline.checkpoint}).items.length,0);
 demo.action('knowledge.approve',{circleId,postId:draft.postId,expectedRevision:1});
 const publish={circleId,postId:draft.postId,expectedRevision:1,eventKey:'demo-publish'};
 demo.action('knowledge.publish',publish);demo.action('knowledge.publish',publish);
 const incremental=demo.action('knowledge.feed',{circleId,after:baseline.checkpoint});assert.equal(incremental.items.length,1);
 demo.action('knowledge.propose',{circleId,postId:draft.postId,expectedRevision:1,content:{...content,body:'Private edited draft'}});
 assert.equal(demo.action('knowledge.feed',{circleId,after:baseline.checkpoint}).items[0].post.content.body,content.body);
 assert(!demo.action('knowledge.feed',{circleId,after:initial.nextCursor,limit:50}).items.some(event=>event.postId===draft.postId));
 demo.action('knowledge.withdraw',{circleId,postId:draft.postId,expectedRevision:2});
 const withdrawn=demo.action('knowledge.feed',{circleId,after:baseline.checkpoint});assert.equal(withdrawn.items.length,2);assert(withdrawn.items.every(event=>event.post===null));
 assert(!createCircleKnowledgeDemo().action('knowledge.feed',{circleId,limit:50}).items.some(event=>event.postId===draft.postId));
});

test('feed migration keeps historical knowledge without inventing publication events',async()=>{
 let circleId,postId;
 const db=await createTestDatabase({beforeMigration:async(database,name)=>{
  if(!name.endsWith('_circle_member_feed.sql'))return;
  await database.exec('update private.knowledge_config set enabled=true');
  const action=async(op,payload)=>(await database.query('select private.knowledge_action($1,$2,$3::jsonb) result',[owner,op,JSON.stringify(payload)])).rows[0].result;
  circleId=(await action('circles.create',{name:'Historical Circle',alias:'Owner',eventKey:'history-circle'})).circleId;
  postId=(await action('knowledge.propose',{circleId,expectedRevision:0,content,eventKey:'history-draft'})).postId;
  await action('knowledge.publish',{circleId,postId,expectedRevision:1,eventKey:'history-publish'});
 }});
 try{
  const action=async(op,payload)=>(await db.query('select private.knowledge_action($1,$2,$3::jsonb) result',[owner,op,JSON.stringify(payload)])).rows[0].result;
  const feed=await action('knowledge.feed',{circleId});assert.deepEqual(feed.items,[]);assert.equal(feed.checkpoint.position,'0');
  assert.equal((await action('knowledge.search',{circleId})).items[0].id,postId);
  await action('knowledge.propose',{circleId,postId,expectedRevision:1,content:{...content,body:'New shared revision'},eventKey:'history-edit'});
  await action('knowledge.publish',{circleId,postId,expectedRevision:2,eventKey:'history-republish'});
  const published=await action('knowledge.feed',{circleId});assert.equal(published.items.length,1);assert.equal(published.items[0].kind,'revision_published');assert.equal(published.items[0].revision,2);
 }finally{await db.close();}
});

test('browser RPC and actual MCP share publication order, exact shared revisions, cursors and revocation',async()=>{
 const db=await createTestDatabase();let sequence=0;
 const hashes={owner:'a'.repeat(64),friend:'b'.repeat(64),readOnly:'c'.repeat(64),noRead:'d'.repeat(64),expired:'e'.repeat(64)};
 async function human(user,operation,payload={}){
  await db.query("select set_config('test.uid',$1,false)",[user]);await db.exec('set role authenticated');
  try{return (await db.query('select public.knowledge_action($1,$2::jsonb) result',[operation,JSON.stringify(payload)])).rows[0].result;}
  finally{await db.exec('reset role');}
 }
 const write=(user,operation,payload)=>human(user,operation,{...payload,eventKey:`write-${++sequence}`});
 const handler=createHandler(async(token,operation,payload)=>{
  if(operation==='credentials.verify')return {status:200,data:{scopes:['knowledge:read']}};
  await db.exec('set role service_role');
  try{return {status:200,data:contextResponse(operation,(await db.query('select public.agent_dispatch($1,$2,$3::jsonb) result',[hashes.friend,operation,JSON.stringify(payload)])).rows[0].result)};}
  catch(error){return {status:400,data:{error:error.message}};}
  finally{await db.exec('reset role');}
 });
 async function mcp(payload){
  const response=await handler(new Request('https://example.com/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+'b'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:++sequence,method:'tools/call',params:{name:'read_circle_feed',arguments:payload}})}));
  const packet=await response.json();if(packet.result.isError)throw Error(packet.result.content[0].text);return JSON.parse(packet.result.content[0].text);
 }
 async function dispatch(name,payload){
  await db.exec('set role service_role');
  try{return (await db.query("select public.agent_dispatch($1,'knowledge.feed',$2::jsonb) result",[hashes[name],JSON.stringify(payload)])).rows[0].result;}
  finally{await db.exec('reset role');}
 }
 try{
  assert.equal((await human(owner,'knowledge.feed',{circleId:owner})).available,false);
  await db.exec('update private.knowledge_config set enabled=true');
  for(const [name,user,scopes] of [['owner',owner,['knowledge:read','knowledge:write']],['friend',friend,['knowledge:read']],['readOnly',owner,['knowledge:read']],['noRead',owner,['knowledge:write']],['expired',owner,['knowledge:read']]])await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,$2,$3,$4,now()+$5::interval)",[user,name,hashes[name],scopes,name==='expired'?'-1 day':'1 day']);
  const {circleId}=await write(owner,'circles.create',{name:'Feed circle',alias:'Owner'});
  const invite=await write(owner,'circles.invite',{circleId});await write(friend,'circles.join',{token:invite.token,alias:'Friend'});
  const other=(await write(owner,'circles.create',{name:'Other circle',alias:'Owner'})).circleId;
  assert.deepEqual((await mcp({circleId})).items,[]);
  await assert.rejects(()=>dispatch('noRead',{circleId}),/scope/i);await assert.rejects(()=>dispatch('expired',{circleId}),/credential/i);
  async function publish(title){const draft=await write(owner,'knowledge.propose',{circleId,expectedRevision:0,content:{...content,title}});const payload={circleId,postId:draft.postId,expectedRevision:1,eventKey:`publish-${++sequence}`};await human(owner,'knowledge.publish',payload);await human(owner,'knowledge.publish',payload);return draft;}
  const a=await publish('First'),b=await publish('Second');
  const browser=await human(friend,'knowledge.feed',{circleId,limit:1}),remote=await mcp({circleId,limit:1});
  assert.equal(remote.items[0].id,browser.items[0].id);assert.deepEqual(remote.items[0].post.agentContext.source,{circleId,postId:a.postId,revision:1});
  assert.equal(browser.items[0].position,'1');assert.equal(browser.checkpoint.position,'2');assert(browser.nextCursor);
  const c=await publish('Published during pagination');
  const second=await mcp({circleId,after:browser.nextCursor,limit:1});assert.equal(second.items[0].postId,b.postId);assert.equal(second.nextCursor,null);assert.equal(second.checkpoint.position,'2');
  const next=await mcp({circleId,after:second.checkpoint});assert.equal(next.items.length,1);assert.equal(next.items[0].postId,c.postId);
  await write(owner,'knowledge.propose',{circleId,postId:a.postId,expectedRevision:1,content:{...content,body:'SECRET PRIVATE DRAFT'}});
  const own=await dispatch('readOnly',{circleId});assert.equal(own.items[0].post.content.body,content.body);assert.equal(own.items[0].post.revision,1);assert(!JSON.stringify(own).includes('SECRET'));
  await write(owner,'knowledge.publish',{circleId,postId:a.postId,expectedRevision:2});
  const revised=await mcp({circleId});assert.equal(revised.items[0].post,null);assert.equal(revised.items.at(-1).kind,'revision_published');assert.equal(revised.items.at(-1).post.revision,2);
  const reply=await write(owner,'knowledge.propose',{circleId,parentId:b.postId,expectedRevision:0,content:{...content,type:'reply',body:'A published reply'}});await write(owner,'knowledge.publish',{circleId,postId:reply.postId,expectedRevision:1});
  await write(owner,'knowledge.withdraw',{circleId,postId:b.postId,expectedRevision:1});
  const withdrawn=await mcp({circleId});assert.equal(withdrawn.items.find(event=>event.postId===reply.postId).post,null);assert.equal(withdrawn.items.at(-1).invalidateThread,true);
  await write(friend,'knowledge.report',{circleId,postId:c.postId,reason:'Fictional test report'});await write(owner,'knowledge.hide',{circleId,postId:c.postId});
  assert.equal((await mcp({circleId})).items.at(-1).kind,'hidden');
  const previous=(await mcp({circleId})).checkpoint;
  // An aborted publication leaves neither an event nor a cursor gap.
  const rolled=await write(owner,'knowledge.propose',{circleId,expectedRevision:0,content});
  await db.exec('begin');await write(owner,'knowledge.publish',{circleId,postId:rolled.postId,expectedRevision:1});await db.exec('rollback');
  assert.equal((await mcp({circleId,after:previous})).items.length,0);
  await write(owner,'knowledge.publish',{circleId,postId:rolled.postId,expectedRevision:1});assert.equal((await mcp({circleId,after:previous})).items[0].position,String(BigInt(previous.position)+1n));
  for(const payload of [{circleId,limit:0},{circleId,limit:51},{circleId,limit:1.5},{circleId,after:null},{circleId,after:{...browser.nextCursor,circleId:other}},{circleId,after:{...previous,position:'999999'}},{circleId,after:{...previous,extra:'secret'}},{circleId,after:{...previous,through:'999999'}},{circleId,userId:owner}])await assert.rejects(()=>human(owner,'knowledge.feed',payload));
  await assert.rejects(()=>mcp({circleId:other}));
  await write(owner,'circles.remove',{circleId,memberId:friend});await assert.rejects(()=>mcp({circleId,after:previous}));
  await db.query('update private.agent_connections set revoked_at=now() where token_hash=$1',[hashes.readOnly]);await assert.rejects(()=>dispatch('readOnly',{circleId}),/credential/i);
  for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);await assert.rejects(()=>db.query('select * from private.circle_events'));await assert.rejects(()=>db.query("select private.circle_feed_dispatch('x','{}')"));await assert.rejects(()=>db.query("select public.agent_dispatch('x','knowledge.feed','{}')"));await db.exec('reset role');}
 }finally{await db.close();}
});
