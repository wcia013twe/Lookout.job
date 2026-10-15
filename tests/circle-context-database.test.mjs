import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
import {contextResponse} from '../supabase/functions/agent-gateway/context.mjs';

test('context-only website and agent writes share validation, search and exact-revision consent',async()=>{
 const database=await createTestDatabase();
 const owner='11111111-1111-1111-1111-111111111111',friend='22222222-2222-2222-2222-222222222222',hash='a'.repeat(64);
 let sequence=0;
 const reads=new Set(['circles.list','circles.read','knowledge.search','knowledge.read']);
 const payloadFor=(operation,payload)=>({...payload,...(!reads.has(operation)?{eventKey:`context-${++sequence}`}:{})});
 async function human(user,operation,payload={}){
  await database.query("select set_config('test.uid',$1,false)",[user]);
  await database.exec('set role authenticated');
  try{return (await database.query('select public.knowledge_action($1,$2::jsonb) as result',[operation,JSON.stringify(payloadFor(operation,payload))])).rows[0].result;}
  finally{await database.exec('reset role');}
 }
 async function agent(operation,payload){
  const result=(await database.query('select public.agent_dispatch($1,$2,$3::jsonb) as result',[hash,operation,JSON.stringify(payloadFor(operation,payload))])).rows[0].result;
  return contextResponse(operation,result);
 }
 try{
  await database.exec('update private.knowledge_config set enabled=true');
  await database.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Context agent',$2,array['knowledge:read','knowledge:write'],now()+interval '1 day')",[owner,hash]);
  const {circleId}=await human(owner,'circles.create',{name:'Context circle',alias:'Owner'});
  const invitation=await human(owner,'circles.invite',{circleId});
  await human(friend,'circles.join',{token:invitation.token,alias:'Friend'});
  const content={title:'Useful context',body:'',insight:'Discuss cache-coherence tradeoffs.',jobUrl:'https://example.com/job',stage:'Technical interview',type:'interview_report',sources:[],provenance:'agent_observed',personalDisclosure:false};
  const draft=await agent('knowledge.propose',{circleId,expectedRevision:0,content});
  await assert.rejects(()=>human(friend,'knowledge.read',{circleId,postId:draft.postId}),/unavailable/i);
  await assert.rejects(()=>agent('knowledge.publish',{circleId,postId:draft.postId,expectedRevision:1}),/review/i);
  await human(owner,'knowledge.approve',{circleId,postId:draft.postId,expectedRevision:1});
  await agent('knowledge.publish',{circleId,postId:draft.postId,expectedRevision:1});
  const shared=await human(friend,'knowledge.read',{circleId,postId:draft.postId});
  assert.equal(shared.post.content.body,'');
  assert.equal(shared.post.content.insight,content.insight);
  assert.equal((await human(friend,'knowledge.search',{circleId,query:'cache-coherence'})).items[0].id,draft.postId);
  const updated={...content,insight:'A different insight'};
  await agent('knowledge.propose',{circleId,postId:draft.postId,expectedRevision:1,content:updated});
  assert.equal((await human(friend,'knowledge.read',{circleId,postId:draft.postId})).post.content.insight,content.insight);
  await assert.rejects(()=>agent('knowledge.publish',{circleId,postId:draft.postId,expectedRevision:2}),/review/i);
  await human(owner,'knowledge.approve',{circleId,postId:draft.postId,expectedRevision:2});
  await agent('knowledge.publish',{circleId,postId:draft.postId,expectedRevision:2});
  assert.equal((await agent('knowledge.read',{circleId,postId:draft.postId})).post.agentContext.insight,updated.insight);
  for(const invalid of [{insight:''},{insight:42},{insight:'x'.repeat(4001)},{jobUrl:'http://example.com/job'},{jobUrl:'https://example.com/job?token=private'},{jobUrl:'https://user:secret@example.com/job'},{type:'reply'}]){
   await assert.rejects(()=>human(owner,'knowledge.propose',{circleId,expectedRevision:0,content:{...content,...invalid}}));
   await assert.rejects(()=>agent('knowledge.propose',{circleId,expectedRevision:0,content:{...content,...invalid}}));
  }
  await human(owner,'circles.policy',{circleId,allowedTypes:['resource']});
  const template={title:'Shared public resource',body:'A public resource to evaluate independently.',type:'resource',sources:[{url:'https://www.postgresql.org/docs/current/using-explain.html',label:'Public source'}],provenance:'agent_observed',personalDisclosure:false};
  for(const extra of [{insight:'Freeform context must not bypass review.'},{jobUrl:'https://example.com/job'}]){
   const proposal=await agent('knowledge.propose',{circleId,expectedRevision:0,content:{...template,...extra}});
   await assert.rejects(()=>agent('knowledge.publish',{circleId,postId:proposal.postId,expectedRevision:1}),/review/i);
  }
 }finally{await database.close();}
});
