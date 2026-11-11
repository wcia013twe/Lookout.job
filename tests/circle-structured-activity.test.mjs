import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
import {circleActivity} from '../lib/circle-activity.mjs';
import {createCircleKnowledgeDemo} from '../lib/circle-knowledge-demo.mjs';
import {createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {contextResponse} from '../supabase/functions/agent-gateway/context.mjs';

const activity={highlights:['Practiced query plans'],goal:'2 of 3 sessions complete',help:'Review my project'};
const content={title:'Weekly update',body:'My update',type:'discussion',activity,sources:[],provenance:'agent_observed',personalDisclosure:true};

test('structured demo activity, legacy fallback and independent resets',()=>{
 const demo=createCircleKnowledgeDemo(),circleId='demo-circle';
 const alex=demo.action('knowledge.read',{circleId,postId:'demo-alex-activity'}).post;
 assert.equal(circleActivity(alex.content).highlights.length,3);
 assert.deepEqual(alex.agentContext.activity,alex.content.activity);
 alex.agentContext.activity.highlights.push('Changed');
 assert.equal(demo.action('knowledge.read',{circleId,postId:alex.id}).post.content.activity.highlights.length,3);
 const sam=demo.action('knowledge.read',{circleId,postId:'demo-sam-activity'}).post;
 assert.equal(sam.content.activity,undefined);
 assert.ok(circleActivity(sam.content).goal);
 assert.equal(circleActivity({body:'Message',activity}).message,'Message');
 const draft=demo.action('knowledge.propose',{circleId,content});
 assert.deepEqual(demo.action('knowledge.read',{circleId,postId:draft.postId}).post.content.activity,activity);
 assert.equal(createCircleKnowledgeDemo().action('knowledge.search',{circleId,query:'Weekly update'}).items.length,0);
 for(const invalid of [null,{}, {...activity,highlights:['a','b','c','d']},{...activity,goal:42},{...activity,secret:'private'}, {highlights:[],goal:'',help:''}]){
  assert.throws(()=>demo.action('knowledge.propose',{circleId,content:{...content,activity:invalid}}));
 }
});

test('website and actual MCP dispatch store activity on exact revisions and enforce consent and membership',async()=>{
 const db=await createTestDatabase(),owner='11111111-1111-1111-1111-111111111111',friend='22222222-2222-2222-2222-222222222222',hash='e'.repeat(64);let sequence=0;
 async function human(user,operation,payload){
  await db.query("select set_config('test.uid',$1,false)",[user]);await db.exec('set role authenticated');
  try{return (await db.query('select public.knowledge_action($1,$2::jsonb) result',[operation,JSON.stringify({...payload,...(['knowledge.read','knowledge.search'].includes(operation)?{}:{eventKey:`human-${++sequence}`})})])).rows[0].result;}
  finally{await db.exec('reset role');}
 }
 const handler=createHandler(async(token,operation,payload)=>{
  if(operation==='credentials.verify')return {status:200,data:{scopes:['knowledge:read','knowledge:write']}};
  try{return {status:200,data:contextResponse(operation,(await db.query('select public.agent_dispatch($1,$2,$3::jsonb) result',[hash,operation,JSON.stringify(payload)])).rows[0].result)};}
  catch(error){return {status:400,data:{error:error.message}};}
 });
 async function agent(name,args){
  const response=await handler(new Request('https://example.com/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+'e'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:++sequence,method:'tools/call',params:{name,arguments:args}})}));
  const packet=await response.json();if(packet.result.isError)throw Error(packet.result.content[0].text);return JSON.parse(packet.result.content[0].text);
 }
 const propose=(circleId,value,extra={})=>agent('propose_circle_contribution',{circleId,expectedRevision:0,content:value,eventKey:`agent-${++sequence}`,...extra});
 const publish=(circleId,postId,revision)=>agent('publish_circle_contribution',{circleId,postId,expectedRevision:revision,eventKey:`publish-${++sequence}`});
 try{
  await db.exec('update private.knowledge_config set enabled=true');
  await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Activity agent',$2,array['knowledge:read','knowledge:write'],now()+interval '1 day')",[owner,hash]);
  const {circleId}=await human(owner,'circles.create',{name:'Activity circle',alias:'Owner'});
  const invite=await human(owner,'circles.invite',{circleId});await human(friend,'circles.join',{token:invite.token,alias:'Friend'});
  const draft=await propose(circleId,content);
  await assert.rejects(()=>human(friend,'knowledge.read',{circleId,postId:draft.postId}));
  await assert.rejects(()=>publish(circleId,draft.postId,1),/Operation rejected/);
  await human(owner,'knowledge.approve',{circleId,postId:draft.postId,expectedRevision:1});
  await publish(circleId,draft.postId,1);
  assert.deepEqual((await human(friend,'knowledge.read',{circleId,postId:draft.postId})).post.content.activity,activity);
  assert.equal((await human(friend,'knowledge.search',{circleId,query:'Practiced query plans'})).items[0].id,draft.postId);
  const updated={...content,activity:{...activity,goal:'3 of 3 sessions complete'}};
  await propose(circleId,updated,{postId:draft.postId,expectedRevision:1});
  assert.deepEqual((await human(friend,'knowledge.read',{circleId,postId:draft.postId})).post.content.activity,activity);
  const owned=await agent('read_circle_thread',{circleId,postId:draft.postId});
  assert.equal(owned.post.agentContext.visibility,'private_draft');assert.deepEqual(owned.post.agentContext.activity,updated.activity);
  await assert.rejects(()=>publish(circleId,draft.postId,2),/Operation rejected/);
  for(const bad of [null,{},[],{...activity,highlights:[42]},{...activity,highlights:[' ']},{...activity,highlights:['x'.repeat(301)]},{...activity,goal:'x'.repeat(301)},{...activity,help:42},{...activity,unknown:'secret'},{...activity,help:'https://example.com/?token=private'},{highlights:[],goal:' ',help:''}]){
   const invalid={...content,activity:bad};
   await assert.rejects(()=>human(owner,'knowledge.propose',{circleId,expectedRevision:0,content:invalid}));
   await assert.rejects(()=>propose(circleId,invalid));
  }
  for(const invalid of [{...content,type:'resource'},{...content,personalDisclosure:false}])await assert.rejects(()=>propose(circleId,invalid));
  await human(owner,'knowledge.approve',{circleId,postId:draft.postId,expectedRevision:2});await publish(circleId,draft.postId,2);
  await human(owner,'circles.remove',{circleId,memberId:friend});
  await assert.rejects(()=>human(friend,'knowledge.read',{circleId,postId:draft.postId}));
  await db.exec('set role authenticated');await assert.rejects(()=>db.query('select * from private.knowledge_revisions'));await db.exec('reset role');
 }finally{await db.close();}
});
