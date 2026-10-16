import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
import {createCircleKnowledgeDemo} from '../lib/circle-knowledge-demo.mjs';
import {createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {contextResponse} from '../supabase/functions/agent-gateway/context.mjs';

const offers=[{company:'Company A',base:'USD 140,000 / year',notes:'Infrastructure team'},{company:'Company B',equity:'0.03% options / 4 years'}];
const base={title:'Two paths',body:'What would you weigh here?',type:'offer_comparison',offers,jobId:'REQ-1234',sources:[],provenance:'agent_observed',personalDisclosure:true};

test('demo conversations preserve attached context, search job IDs and reset independently',()=>{
 const demo=createCircleKnowledgeDemo(),circleId='demo-circle';
 assert.equal(demo.action('knowledge.search',{circleId,type:'discussion'}).items[0].content.type,'discussion');
 assert.equal(demo.action('knowledge.search',{circleId,query:'6865687002'}).items[0].id,'demo-interview-report');
 const draft=demo.action('knowledge.propose',{circleId,expectedRevision:0,content:base});
 const read=demo.action('knowledge.read',{circleId,postId:draft.postId}).post;
 assert.equal(read.agentContext.visibility,'private_draft');assert.deepEqual(read.agentContext.offers,offers);
 read.agentContext.offers[0].company='Modified';assert.equal(demo.action('knowledge.read',{circleId,postId:draft.postId}).post.content.offers[0].company,'Company A');
 assert.equal(createCircleKnowledgeDemo().action('knowledge.search',{circleId,query:'REQ-1234'}).items.length,0);
 for(const extra of [{offers:[]},{offers:[offers[0]]},{offers:[{company:''},offers[1]]},{offers:[{company:'A',base:42},offers[1]]},{type:'discussion'},{jobId:42},{jobId:' '},{offers:[{company:'A',privateNotes:'secret'},offers[1]]}])assert.throws(()=>demo.action('knowledge.propose',{circleId,expectedRevision:0,content:{...base,...extra}}));
});

test('website and scoped MCP share offer/job validation, search and exact-revision approval',async()=>{
 const db=await createTestDatabase(),owner='11111111-1111-1111-1111-111111111111',friend='22222222-2222-2222-2222-222222222222',hash='d'.repeat(64);let sequence=0;
 async function human(user,operation,payload){await db.query("select set_config('test.uid',$1,false)",[user]);await db.exec('set role authenticated');try{return (await db.query('select public.knowledge_action($1,$2::jsonb) result',[operation,JSON.stringify({...payload,...(['knowledge.read','knowledge.search'].includes(operation)?{}:{eventKey:`human-${++sequence}`})})])).rows[0].result;}finally{await db.exec('reset role');}}
 const handler=createHandler(async(token,operation,payload)=>{
  if(operation==='credentials.verify')return {status:200,data:{scopes:['knowledge:read','knowledge:write']}};
  try{return {status:200,data:contextResponse(operation,(await db.query('select public.agent_dispatch($1,$2,$3::jsonb) result',[hash,operation,JSON.stringify(payload)])).rows[0].result)};}
  catch(error){return {status:400,data:{error:error.message}};}
 });
 async function mcp(name,args){const result=await handler(new Request('https://example.com/mcp',{method:'POST',headers:{Authorization:`Bearer jb_agent_${hash}`,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:++sequence,method:'tools/call',params:{name,arguments:args}})}));const packet=(await result.json()).result;if(packet.isError)throw Error(packet.content[0].text);return JSON.parse(packet.content[0].text);}
 try{
  await db.exec('update private.knowledge_config set enabled=true');await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Circle agent',$2,array['knowledge:read','knowledge:write'],now()+interval '1 day')",[owner,hash]);
  const {circleId}=await human(owner,'circles.create',{name:'Friends',alias:'Owner'}),invite=await human(owner,'circles.invite',{circleId});await human(friend,'circles.join',{token:invite.token,alias:'Friend'});
  const draft=await mcp('propose_circle_contribution',{circleId,expectedRevision:0,content:base,eventKey:'offer-draft'});
  await assert.rejects(()=>human(friend,'knowledge.read',{circleId,postId:draft.postId}),/unavailable/i);
  await assert.rejects(()=>mcp('publish_circle_contribution',{circleId,postId:draft.postId,expectedRevision:1,eventKey:'offer-publish-denied'}),/rejected/i);
  await human(owner,'knowledge.approve',{circleId,postId:draft.postId,expectedRevision:1});
  await mcp('publish_circle_contribution',{circleId,postId:draft.postId,expectedRevision:1,eventKey:'offer-publish'});
  const shared=await human(friend,'knowledge.read',{circleId,postId:draft.postId});assert.deepEqual(shared.post.content.offers,offers);
  const read=await mcp('read_circle_thread',{circleId,postId:draft.postId});assert.deepEqual(read.post.agentContext.offers,offers);assert.equal(read.post.agentContext.jobId,'REQ-1234');
  for(const query of ['REQ-1234','Infrastructure'])assert.equal((await human(friend,'knowledge.search',{circleId,query})).items[0].id,draft.postId);
  await human(owner,'knowledge.propose',{circleId,postId:draft.postId,expectedRevision:1,content:{...base,offers:[{company:'Changed company'},offers[1]]}});
  await assert.rejects(()=>mcp('publish_circle_contribution',{circleId,postId:draft.postId,expectedRevision:2,eventKey:'offer-edit-denied'}),/rejected/i);
  assert.equal((await human(friend,'knowledge.read',{circleId,postId:draft.postId})).post.content.offers[0].company,'Company A');
  const chat=await human(owner,'knowledge.propose',{circleId,expectedRevision:0,content:{...base,type:'discussion',offers:undefined,jobId:undefined}});await human(owner,'knowledge.publish',{circleId,postId:chat.postId,expectedRevision:1});
  for(const extra of [{offers:[]},{offers:null},{offers:[{company:'A',base:42},offers[1]]},{offers:[{company:'A',unknown:'x'},offers[1]]},{offers:[{company:'A',notes:'https://example.com?token=secret'},offers[1]]},{offers:[{company:''},offers[1]]},{offers:[...offers,...offers,offers[0]]},{type:'discussion'},{jobId:42},{jobId:' '},{jobId:'x'.repeat(201)}]){
   await assert.rejects(()=>human(owner,'knowledge.propose',{circleId,expectedRevision:0,content:{...base,...extra}}));
   await assert.rejects(()=>mcp('propose_circle_contribution',{circleId,expectedRevision:0,content:{...base,...extra},eventKey:`invalid-${++sequence}`}));
  }
  await human(owner,'circles.policy',{circleId,allowedTypes:['resource']});const template={title:'Shared public resource',body:'A public resource to evaluate independently.',type:'resource',jobId:'REQ-1234',sources:[{url:'https://www.postgresql.org/docs/current/using-explain.html',label:'Public source'}],provenance:'agent_observed',personalDisclosure:false};
  const resource=await mcp('propose_circle_contribution',{circleId,expectedRevision:0,content:template,eventKey:'attached-template'});await assert.rejects(()=>mcp('publish_circle_contribution',{circleId,postId:resource.postId,expectedRevision:1,eventKey:'attached-publish'}),/rejected/i);
 }finally{await db.close();}
});
